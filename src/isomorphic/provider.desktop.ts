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
import { getDesktopSidecarPort } from './desktop.runtime';
import { readSidecarSseTokens } from './sidecar-sse';
import { WebProvider } from './provider.web';
import { LlmError } from './errors';
import type { DetokenizeResult, TokenizeResult } from '../workers/wasm.engine';

/**
 * Desktop LLM provider: native sidecar (HTTP) for GPU/CPU inference;
 * WASM worker for multimodal, LoRA, TTS, bench (inherited via composition).
 */
export class DesktopProvider extends WebProvider {
  override readonly platform: PlatformKind = 'desktop';

  private sidecarPort: number | null = null;
  private activeModelPath: string | null = null;

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

  private async sidecarFetch<T>(
    path: string,
    method: 'GET' | 'POST',
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
        throw new LlmError('INFERENCE_FAILED', `Sidecar HTTP ${res.status}: ${text.slice(0, 200)}`);
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
    this.activeModelPath = opts.modelPath ?? opts.modelId;
    if (!this.sidecarAvailable()) {
      await super.initialize(opts);
    }
  }

  override async loadModel(opts: InitializeOptions): Promise<void> {
    await this.initialize(opts);
    if (!this.sidecarAvailable()) {
      await super.loadModel(opts);
    }
  }

  override async unloadModel(modelId: string): Promise<void> {
    if (!this.sidecarAvailable()) {
      await super.unloadModel(modelId);
    }
    if (modelId === this.activeModelPath) {
      this.activeModelPath = null;
    }
  }

  override async generate(req: GenerateRequest): Promise<GenerateResult> {
    if (!this.sidecarAvailable()) {
      return super.generate(req);
    }
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
    if (req.messages && req.messages.length > 0) {
      return this.sidecarStreamChat(req, onToken);
    }
    return this.sidecarStreamCompletion(req, onToken);
  }

  override async embed(req: EmbedRequest): Promise<EmbedResult> {
    if (!this.sidecarAvailable()) {
      return super.embed(req);
    }
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
    return { pressure: 'low' };
  }

  override async health(): Promise<{ ok: boolean; details?: Record<string, unknown> }> {
    if (!this.sidecarAvailable()) {
      return super.health();
    }
    try {
      const h = await this.sidecarFetch<{ status?: string }>('/health', 'GET', undefined, 5000);
      return {
        ok: h.status === 'ok',
        details: { backend: 'sidecar', port: this.getPort(), platform: 'desktop' },
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
