import type { NativeContextParams, NativeLlamaContext } from './definitions';
import { LlamaCppWeb } from './web';
import { DesktopProvider } from './isomorphic/provider.desktop';
import { getDesktopBridge } from './isomorphic/desktop.runtime';
import { WebProvider } from './isomorphic/provider.web';

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
    const bridge = getDesktopBridge();

    if (bridge?.ensureSidecar) {
      const result = await bridge.ensureSidecar({
        modelPath,
        modelId: params.model,
        n_ctx: params.n_ctx,
        n_gpu_layers: params.n_gpu_layers,
        n_threads: params.n_threads,
        embedding: params.embedding,
      });
      if (result?.ok && result.port) {
        this.desktopProvider.setSidecarPort(result.port);
        await this.desktopProvider.loadModel({
          modelId: params.model,
          modelPath,
          n_ctx: params.n_ctx,
          n_gpu_layers: params.n_gpu_layers,
          n_threads: params.n_threads,
          embedding: params.embedding,
        });
        this.sidecarActive = true;
        this.gpuEnabled = !!result.gpuEnabled;
        this.contextToModel.set(contextId, params.model);
        return {
          contextId,
          gpu: this.gpuEnabled,
          reasonNoGPU: this.gpuEnabled ? '' : (result.reasonNoGpu ?? 'CPU-only inference'),
          model: MODEL_DESC_DESKTOP,
        };
      }
    }

    const fallback = await super.initContext({ contextId, params });
    this.sidecarActive = false;
    return fallback;
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
