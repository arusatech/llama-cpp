import type { NativeContextParams, NativeLlamaContext } from './definitions';
import { LlamaCppWeb } from './web';
import { DesktopProvider } from './isomorphic/provider.desktop';
import { getDesktopBridge } from './isomorphic/desktop.runtime';
import { WebProvider } from './isomorphic/provider.web';
import { LlmError } from './isomorphic/errors';

const MODEL_DESC_DESKTOP = {
  desc: 'Desktop sidecar model',
  size: 0,
  nEmbd: 0,
  nParams: 0,
  chatTemplates: {
    llamaChat: true,
    minja: {
      default: true,
      defaultCaps: {
        tools: false, toolCalls: false, toolResponses: false,
        systemRole: true, parallelToolCalls: false, toolCallId: false,
      },
      toolUse: false,
      toolUseCaps: {
        tools: false, toolCalls: false, toolResponses: false,
        systemRole: true, parallelToolCalls: false, toolCallId: false,
      },
    },
  },
  metadata: {},
  isChatTemplateSupported: true,
};

/** Sidecar DELETE route is `/v1/internal/models/([^/]+)` — never use absolute paths as ids. */
function sidecarModelIdFromPath(modelPath: string): string {
  const base = modelPath.split(/[/\\]/).pop() || modelPath;
  return base.replace(/\.gguf$/i, '') || base;
}

const FORCED_NATIVE_OVERRIDES = new Set([
  'sidecar-gpu',
  'sidecar-npu',
  'sidecar-cpu',
  'vulkan',
  'cuda',
  'rocm',
  'metal',
  'openvino-gpu',
  'openvino-npu',
  'openvino-cpu',
]);

function formatSidecarFailure(result: {
  reason?: string;
  stderr?: string;
  stdout?: string;
}): string {
  const reason = result.reason ?? 'sidecar-unavailable';
  const stderr = result.stderr ? String(result.stderr).slice(-2000) : '';
  const stdout = result.stdout ? String(result.stdout).slice(-1000) : '';
  return [reason, stderr && `stderr: ${stderr}`, stdout && `stdout: ${stdout}`]
    .filter(Boolean)
    .join(' | ');
}

/**
 * Capacitor LlamaCpp implementation for Electron desktop.
 * Core inference (chat, completion, embeddings) uses the native GPU/CPU sidecar.
 * Multimodal, LoRA, TTS, and benchmarking use the WASM worker (same as PWA).
 */
export class LlamaCppDesktop extends LlamaCppWeb {
  private desktopProvider: DesktopProvider;
  private sidecarActive = false;
  private gpuEnabled = false;

  constructor() {
    super();
    this.desktopProvider = new DesktopProvider();
    (this as unknown as { provider: WebProvider }).provider =
      this.desktopProvider as unknown as WebProvider;
  }

  override async initContext({
    contextId,
    params,
  }: {
    contextId: number;
    params: NativeContextParams & { embedding?: boolean };
  }): Promise<NativeLlamaContext> {
    const modelPath = params.model;
    const modelId = sidecarModelIdFromPath(modelPath);
    const bridge = getDesktopBridge();

    if (bridge?.ensureSidecar) {
      const result = await bridge.ensureSidecar({
        modelPath,
        modelId,
        n_ctx: params.n_ctx,
        n_gpu_layers: params.n_gpu_layers,
        n_threads: params.n_threads,
        embedding: params.embedding,
      });
      if (result?.ok && result.port) {
        const sel = result.selection as
          | { type?: string; gpuBackend?: string | null; variant?: string | null; reason?: string }
          | undefined;
        const pathLabel = sel?.gpuBackend || sel?.type || (result.gpuEnabled ? 'gpu' : 'cpu');
        console.info(`[LlamaCppDesktop] initContext → sidecar (${pathLabel})`, {
          port: result.port,
          gpuEnabled: result.gpuEnabled,
          selection: sel,
          modelId,
          embedding: !!params.embedding,
        });
        this.desktopProvider.setSidecarPort(result.port);
        await this.desktopProvider.loadModel({
          modelId,
          modelPath,
          n_ctx: params.n_ctx,
          n_gpu_layers: params.n_gpu_layers,
          n_threads: params.n_threads,
          embedding: params.embedding,
        });
        this.sidecarActive = true;
        this.gpuEnabled = !!result.gpuEnabled;
        this.contextToModel.set(contextId, modelId);
        return {
          contextId,
          gpu: this.gpuEnabled,
          reasonNoGPU: this.gpuEnabled ? '' : (result.reasonNoGpu ?? 'CPU-only inference'),
          model: MODEL_DESC_DESKTOP,
        };
      }

      const failDetail = formatSidecarFailure(result ?? {});
      console.warn('[LlamaCppDesktop] sidecar unavailable:', failDetail);

      let override: string | null = null;
      if (bridge.getBackendOverride) {
        try {
          override = await bridge.getBackendOverride();
        } catch {
          override = null;
        }
      }
      const forcedNative = !!override && FORCED_NATIVE_OVERRIDES.has(override);
      if (forcedNative) {
        throw new LlmError(
          'SIDECAR_UNAVAILABLE',
          `Native sidecar required by override '${override}' but failed: ${failDetail}`,
          {
            reason: result?.reason,
            stderr: result?.stderr,
            stdout: result?.stdout,
            selection: result?.selection,
            override,
          },
        );
      }

      // Sidecar unavailable — fall back to a real WASM WebProvider (not DesktopProvider,
      // which would call ensureSidecar again and previously threw permanent-wasm-fallback).
      console.info('[LlamaCppDesktop] initContext → WASM CPU fallback', {
        reason: result?.reason,
        selection: result?.selection,
        modelId,
      });
      const wasmProvider = new WebProvider();
      const prevProvider = (this as unknown as { provider: WebProvider }).provider;
      (this as unknown as { provider: WebProvider }).provider = wasmProvider;
      try {
        const fallback = await super.initContext({ contextId, params });
        this.sidecarActive = false;
        const reasonNoGPU =
          result?.reasonNoGpu
          || (result?.reason ? `Sidecar unavailable: ${result.reason}` : '')
          || failDetail
          || 'Sidecar unavailable — WASM fallback';
        return {
          ...fallback,
          gpu: false,
          reasonNoGPU,
        };
      } catch (err) {
        (this as unknown as { provider: WebProvider }).provider = prevProvider;
        throw err;
      }
    }

    // No bridge — WASM path
    console.info('[LlamaCppDesktop] initContext → WASM CPU (no desktop bridge)', { modelId });
    const wasmProvider = new WebProvider();
    const prevProvider = (this as unknown as { provider: WebProvider }).provider;
    (this as unknown as { provider: WebProvider }).provider = wasmProvider;
    try {
      const fallback = await super.initContext({ contextId, params });
      this.sidecarActive = false;
      return fallback;
    } catch (err) {
      (this as unknown as { provider: WebProvider }).provider = prevProvider;
      throw err;
    }
  }

  async setContextLimit(opts: { limit: number }): Promise<void> {
    await this.desktopProvider.setContextLimit(opts.limit);
  }

  override async releaseContext({ contextId }: { contextId: number }): Promise<void> {
    const modelId = this.contextToModel.get(contextId);
    if (modelId && this.sidecarActive) {
      await this.desktopProvider.unloadModel(modelId);
    }
    await super.releaseContext({ contextId });
  }

  override async startNativeLlamaServer(options: {
    modelPath: string;
    host?: string;
    port?: number;
    params?: NativeContextParams;
  }): Promise<{ running: boolean }> {
    const bridge = getDesktopBridge();
    if (!bridge?.ensureSidecar) {
      throw new Error('LlamaCppDesktop: IPC bridge not available — register ipc-handlers in main process');
    }
    const result = await bridge.ensureSidecar({
      modelPath: options.modelPath,
      modelId: sidecarModelIdFromPath(options.modelPath),
      host: options.host ?? '127.0.0.1',
      port: options.port,
      n_ctx: options.params?.n_ctx,
      n_gpu_layers: options.params?.n_gpu_layers,
      n_threads: options.params?.n_threads,
    });
    if (result?.ok && result.port) {
      this.desktopProvider.setSidecarPort(result.port);
      this.sidecarActive = true;
      return { running: true };
    }
    console.warn('[LlamaCppDesktop] startNativeLlamaServer failed:', formatSidecarFailure(result ?? {}));
    return { running: false };
  }

  override async isNativeLlamaServerRunning(): Promise<{ running: boolean }> {
    const bridge = getDesktopBridge();
    if (bridge?.getSidecarStatus) {
      const st = await bridge.getSidecarStatus();
      return { running: !!st?.running };
    }
    return { running: this.sidecarActive };
  }

  override async stopNativeLlamaServer(): Promise<void> {
    const bridge = getDesktopBridge();
    if (bridge?.stopSidecar) {
      await bridge.stopSidecar();
    }
    this.sidecarActive = false;
  }
}
