import type {
  EmbedRequest,
  EmbedResult,
  GenerateRequest,
  GenerateResult,
  InitializeOptions,
  MemorySnapshot,
  PlatformKind,
  TokenEvent,
} from './provider.interface';
import { getDesktopBridge, getDesktopSidecarPort } from './desktop.runtime';
import { readSidecarSseTokens } from './sidecar-sse';
import { WebProvider } from './provider.web';
import { LlmError } from './errors';
import { DefaultModelScheduler } from './model.scheduler';
import { WASM_MAX_CONCURRENT_MODELS } from './wasmMemoryPolicy';
import type { DetokenizeResult, TokenizeResult } from '../workers/wasm.engine';

const MAX_MODELS = WASM_MAX_CONCURRENT_MODELS;

/**
 * Desktop LLM provider: native sidecar (HTTP) for GPU/CPU inference;
 * WASM worker for multimodal, LoRA, TTS, bench (inherited via composition).
 * Sidecar path supports up to 5 concurrent models with admission control.
 */
export class DesktopProvider extends WebProvider {
  override readonly platform: PlatformKind = 'desktop';

  private sidecarPort: number | null = null;
  private sidecarScheduler = new DefaultModelScheduler(MAX_MODELS);
  private sidecarLoadedModels = new Set<string>();
  private modelPaths = new Map<string, string>();

  private getPort(): number {
    if (this.sidecarPort != null) return this.sidecarPort;
    const p = getDesktopSidecarPort();
    if (p == null) {
      throw new LlmError(
        'NATIVE_PLUGIN_UNAVAILABLE',
        'Desktop sidecar port not set. Register desktop IPC handlers and preload bridge.',
      );
    }
    this.sidecarPort = p;
    return p;
  }

  private sidecarAvailable(): boolean {
    try {
      this.getPort();
      return true;
    } catch {
      return false;
    }
  }

  private async getDesktopMemorySnapshot(): Promise<MemorySnapshot> {
    const bridge = getDesktopBridge();
    if (bridge?.getMemorySnapshot) {
      return bridge.getMemorySnapshot();
    }
    return super.getMemorySnapshot();
  }

  private mapSidecarHttpError(status: number, text: string): LlmError {
    if (status === 429 || text.includes('model_limit_reached') || text.includes('Model limit')) {
      return new LlmError('MODEL_LIMIT_REACHED', text.slice(0, 200));
    }
    if (text.includes('INSUFFICIENT') || text.includes('memory')) {
      return new LlmError('INSUFFICIENT_MEMORY', text.slice(0, 200));
    }
    if (status === 404 && text.includes('model_not_found')) {
      return new LlmError('MODEL_NOT_LOADED', text.slice(0, 200));
    }
    return new LlmError('INFERENCE_FAILED', `Sidecar HTTP ${status}: ${text.slice(0, 200)}`);
  }

  private async sidecarFetch<T>(
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    body?: unknown,
    timeoutMs = 120000,
  ): Promise<T> {
    const port = this.getPort();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body != null ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        throw this.mapSidecarHttpError(res.status, text);
      }
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        return (await res.json()) as T;
      }
      return {} as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private async ensureSidecarProcess(opts?: InitializeOptions): Promise<void> {
    if (this.sidecarAvailable()) {
      return;
    }
    const bridge = getDesktopBridge();
    if (!bridge?.ensureSidecar) {
      throw new LlmError(
        'NATIVE_PLUGIN_UNAVAILABLE',
        'Desktop IPC bridge not available — register ipc-handlers in Electron main.',
      );
    }
    const payload: Parameters<NonNullable<ReturnType<typeof getDesktopBridge>>['ensureSidecar']>[0] = {
      modelId: opts?.modelId,
      n_ctx: opts?.n_ctx,
      n_gpu_layers: opts?.n_gpu_layers,
      n_threads: opts?.n_threads,
      embedding: opts?.embedding,
    };
    if (opts?.modelPath) {
      payload.modelPath = opts.modelPath;
    }
    const result = await bridge.ensureSidecar(payload);
    if (!result?.ok || !result.port) {
      throw new LlmError(
        'NATIVE_PLUGIN_UNAVAILABLE',
        `Sidecar failed to start: ${result?.reason ?? 'unknown'}`,
      );
    }
    this.setSidecarPort(result.port);
  }

  private requireSidecarModel(modelId: string): void {
    if (!this.sidecarLoadedModels.has(modelId)) {
      throw new LlmError('MODEL_NOT_LOADED', `Model '${modelId}' is not loaded on desktop sidecar`);
    }
  }

  async setContextLimit(limit: number): Promise<void> {
    const clamped = Math.min(MAX_MODELS, Math.max(1, Math.floor(limit)));
    this.sidecarScheduler = new DefaultModelScheduler(clamped);
    for (const modelId of this.sidecarLoadedModels) {
      this.sidecarScheduler.markLoaded(modelId);
    }
    if (this.sidecarAvailable()) {
      await this.sidecarFetch('/v1/internal/context-limit', 'POST', { limit: clamped }, 5000);
    }
  }

  listLoadedModels(): string[] {
    return this.sidecarScheduler.listLoaded();
  }

  private async sidecarStreamChat(
    req: GenerateRequest,
    onToken: (event: TokenEvent) => void,
  ): Promise<GenerateResult> {
    const port = this.getPort();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300000);
    let text = '';
    let index = 0;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: req.modelId,
          messages: req.messages,
          prompt: req.prompt,
          max_tokens: req.max_tokens ?? 256,
          temperature: req.temperature ?? 0.7,
          stream: true,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new LlmError('INFERENCE_FAILED', `Sidecar stream failed: ${res.status}`);
      }
      await readSidecarSseTokens(res.body, 'chat', (token) => {
        text += token;
        onToken({ modelId: req.modelId, token, index: index++ });
      });
    } finally {
      clearTimeout(timer);
    }
    return {
      text,
      tokens_predicted: index,
      tokens_evaluated: 0,
      finish_reason: 'stop',
    };
  }

  private async sidecarStreamCompletion(
    req: GenerateRequest,
    onToken: (event: TokenEvent) => void,
  ): Promise<GenerateResult> {
    const port = this.getPort();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300000);
    let text = '';
    let index = 0;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/v1/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: req.modelId,
          prompt: req.prompt ?? '',
          max_tokens: req.max_tokens ?? 256,
          temperature: req.temperature ?? 0.7,
          stream: true,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new LlmError('INFERENCE_FAILED', `Sidecar stream failed: ${res.status}`);
      }
      await readSidecarSseTokens(res.body, 'completion', (token) => {
        text += token;
        onToken({ modelId: req.modelId, token, index: index++ });
      });
    } finally {
      clearTimeout(timer);
    }
    return {
      text,
      tokens_predicted: index,
      tokens_evaluated: 0,
      finish_reason: 'stop',
    };
  }

  override async initialize(opts: InitializeOptions): Promise<void> {
    if (!this.sidecarAvailable()) {
      await this.ensureSidecarProcess(opts);
    }
    if (!this.sidecarAvailable()) {
      await super.initialize(opts);
      return;
    }
    await this.loadModel(opts);
  }

  override async loadModel(opts: InitializeOptions): Promise<void> {
    if (!opts.modelId) {
      throw new LlmError('INVALID_REQUEST', 'modelId is required');
    }

    await this.ensureSidecarProcess(opts);
    if (!this.sidecarAvailable()) {
      await super.loadModel(opts);
      return;
    }

    if (this.sidecarLoadedModels.has(opts.modelId)) {
      return;
    }

    const modelPath = opts.modelPath ?? opts.modelId;
    const modelBytes = typeof opts.modelBytes === 'number' ? opts.modelBytes : 0;
    const reserveBytes = typeof opts.reserveBytes === 'number' ? opts.reserveBytes : undefined;
    const memory = await this.getDesktopMemorySnapshot();
    if (typeof opts.availableMemoryBytes === 'number') {
      memory.freeBytes = opts.availableMemoryBytes;
    }
    if (typeof opts.totalMemoryBytes === 'number') {
      memory.totalBytes = opts.totalMemoryBytes;
    }
    this.sidecarScheduler.ensureCapacity(opts.modelId, modelBytes, memory, reserveBytes, {
      skipWasm: true,
      loadOpts: { n_ctx: opts.n_ctx, embedding: opts.embedding },
    });

    await this.sidecarFetch(
      '/v1/internal/models/load',
      'POST',
      {
        model_id: opts.modelId,
        path: modelPath,
        n_ctx: opts.n_ctx,
        n_gpu_layers: opts.n_gpu_layers,
        n_threads: opts.n_threads,
        embedding: opts.embedding,
      },
      300000,
    );

    this.sidecarLoadedModels.add(opts.modelId);
    this.modelPaths.set(opts.modelId, modelPath);
    this.sidecarScheduler.markLoaded(opts.modelId, modelBytes, {
      n_ctx: opts.n_ctx,
      embedding: opts.embedding,
    });
  }

  override async unloadModel(modelId: string): Promise<void> {
    if (!this.sidecarAvailable()) {
      await super.unloadModel(modelId);
      return;
    }
    if (!this.sidecarLoadedModels.has(modelId)) {
      return;
    }
    try {
      await this.sidecarFetch(
        `/v1/internal/models/${encodeURIComponent(modelId)}`,
        'DELETE',
        undefined,
        60000,
      );
    } catch {
      /* model may already be gone on sidecar */
    }
    this.sidecarLoadedModels.delete(modelId);
    this.modelPaths.delete(modelId);
    this.sidecarScheduler.markUnloaded(modelId);
  }

  override async generate(req: GenerateRequest): Promise<GenerateResult> {
    if (!this.sidecarAvailable()) {
      return super.generate(req);
    }
    this.requireSidecarModel(req.modelId);
    if (req.messages && req.messages.length > 0) {
      const data = await this.sidecarFetch<{
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { completion_tokens?: number; prompt_tokens?: number };
      }>('/v1/chat/completions', 'POST', {
        model: req.modelId,
        messages: req.messages,
        max_tokens: req.max_tokens ?? 256,
        temperature: req.temperature ?? 0.7,
        stream: false,
      });
      const text = data.choices?.[0]?.message?.content ?? '';
      return {
        text,
        tokens_predicted: data.usage?.completion_tokens ?? 0,
        tokens_evaluated: data.usage?.prompt_tokens ?? 0,
        finish_reason: 'stop',
      };
    }
    const data = await this.sidecarFetch<{
      choices?: Array<{ text?: string }>;
      usage?: { completion_tokens?: number; prompt_tokens?: number };
    }>('/v1/completions', 'POST', {
      model: req.modelId,
      prompt: req.prompt ?? '',
      max_tokens: req.max_tokens ?? 256,
      temperature: req.temperature ?? 0.7,
      stream: false,
    });
    return {
      text: data.choices?.[0]?.text ?? '',
      tokens_predicted: data.usage?.completion_tokens ?? 0,
      tokens_evaluated: data.usage?.prompt_tokens ?? 0,
      finish_reason: 'stop',
    };
  }

  override async generateStream(
    req: GenerateRequest,
    onToken: (event: TokenEvent) => void,
  ): Promise<GenerateResult> {
    if (!this.sidecarAvailable()) {
      return super.generateStream(req, onToken);
    }
    this.requireSidecarModel(req.modelId);
    if (req.messages && req.messages.length > 0) {
      return this.sidecarStreamChat(req, onToken);
    }
    return this.sidecarStreamCompletion(req, onToken);
  }

  override async embed(req: EmbedRequest): Promise<EmbedResult> {
    if (!this.sidecarAvailable()) {
      return super.embed(req);
    }
    this.requireSidecarModel(req.modelId);
    const input = Array.isArray(req.input) ? req.input : [req.input];
    const data = await this.sidecarFetch<{
      data?: Array<{ embedding?: number[] }>;
    }>('/v1/embeddings', 'POST', { model: req.modelId, input });
    return { vectors: (data.data ?? []).map((d) => d.embedding ?? []) };
  }

  override async tokenize(modelId: string, text: string): Promise<TokenizeResult> {
    if (!this.sidecarAvailable()) {
      return super.tokenize(modelId, text);
    }
    return super.tokenize(modelId, text);
  }

  override async detokenize(modelId: string, tokens: number[]): Promise<DetokenizeResult> {
    if (!this.sidecarAvailable()) {
      return super.detokenize(modelId, tokens);
    }
    return super.detokenize(modelId, tokens);
  }

  override async getMemorySnapshot(): Promise<MemorySnapshot> {
    if (!this.sidecarAvailable()) {
      return super.getMemorySnapshot();
    }
    const memory = await this.getDesktopMemorySnapshot();
    try {
      const reg = await this.sidecarFetch<{
        loaded_count?: number;
        max_models?: number;
      }>('/v1/internal/memory', 'GET', undefined, 5000);
      return {
        ...memory,
        loadedModelCount: reg.loaded_count,
        maxModels: reg.max_models,
      };
    } catch {
      return memory;
    }
  }

  override async health(): Promise<{ ok: boolean; details?: Record<string, unknown> }> {
    if (!this.sidecarAvailable()) {
      return super.health();
    }
    try {
      const h = await this.sidecarFetch<{ status?: string; registry?: Record<string, unknown> }>(
        '/health',
        'GET',
        undefined,
        5000,
      );
      return {
        ok: h.status === 'ok',
        details: {
          backend: 'sidecar',
          port: this.getPort(),
          platform: 'desktop',
          loadedModels: this.listLoadedModels(),
          registry: h.registry,
        },
      };
    } catch (err) {
      return { ok: false, details: { error: String(err) } };
    }
  }

  setSidecarPort(port: number): void {
    this.sidecarPort = port;
    if (typeof globalThis !== 'undefined') {
      (globalThis as { __annadataSidecarPort?: number }).__annadataSidecarPort = port;
    }
  }
}
