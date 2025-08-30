declare module 'llama-cpp-capacitor' {
  // Core types
  export interface NativeContextParams {
    model: string;
    chat_template?: string;
    is_model_asset?: boolean;
    use_progress_callback?: boolean;
    n_ctx?: number;
    n_batch?: number;
    n_ubatch?: number;
    n_threads?: number;
    n_gpu_layers?: number;
    no_gpu_devices?: boolean;
    flash_attn?: boolean;
    cache_type_k?: string;
    cache_type_v?: string;
    use_mlock?: boolean;
    use_mmap?: boolean;
    vocab_only?: boolean;
    lora?: string;
    lora_scaled?: number;
    lora_list?: Array<{ path: string; scaled?: number }>;
    rope_freq_base?: number;
    rope_freq_scale?: number;
    pooling_type?: number;
    ctx_shift?: boolean;
    kv_unified?: boolean;
    swa_full?: boolean;
    n_cpu_moe?: number;
    embedding?: boolean;
    embd_normalize?: number;
  }

  export interface NativeCompletionParams {
    prompt: string;
    n_threads?: number;
    jinja?: boolean;
    json_schema?: string;
    grammar?: string;
    grammar_lazy?: boolean;
    grammar_triggers?: Array<{
      type: number;
      value: string;
      token: number;
    }>;
    enable_thinking?: boolean;
    thinking_forced_open?: boolean;
    preserved_tokens?: Array<string>;
    chat_format?: number;
    reasoning_format?: string;
    media_paths?: Array<string>;
    stop?: Array<string>;
    n_predict?: number;
    n_probs?: number;
    top_k?: number;
    top_p?: number;
    min_p?: number;
    xtc_probability?: number;
    xtc_threshold?: number;
    typical_p?: number;
    temperature?: number;
    penalty_last_n?: number;
    penalty_repeat?: number;
    penalty_freq?: number;
    penalty_present?: number;
    mirostat?: number;
    mirostat_tau?: number;
    mirostat_eta?: number;
    dry_multiplier?: number;
    dry_base?: number;
    dry_allowed_length?: number;
    dry_penalty_last_n?: number;
    dry_sequence_breakers?: Array<string>;
    top_n_sigma?: number;
    ignore_eos?: boolean;
    logit_bias?: Array<Array<number>>;
    seed?: number;
    guide_tokens?: Array<number>;
    emit_partial_completion: boolean;
  }

  export interface NativeCompletionResult {
    text: string;
    reasoning_content: string;
    tool_calls: Array<{
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
      id?: string;
    }>;
    content: string;
    chat_format: number;
    tokens_predicted: number;
    tokens_evaluated: number;
    truncated: boolean;
    stopped_eos: boolean;
    stopped_word: string;
    stopped_limit: number;
    stopping_word: string;
    context_full: boolean;
    interrupted: boolean;
    tokens_cached: number;
    timings: {
      prompt_n: number;
      prompt_ms: number;
      prompt_per_token_ms: number;
      prompt_per_second: number;
      predicted_n: number;
      predicted_ms: number;
      predicted_per_token_ms: number;
      predicted_per_second: number;
    };
    completion_probabilities?: Array<{
      content: string;
      probs: Array<{
        tok_str: string;
        prob: number;
      }>;
    }>;
    audio_tokens?: Array<number>;
  }

  export interface NativeTokenizeResult {
    tokens: Array<number>;
    has_images: boolean;
    bitmap_hashes: Array<number>;
    chunk_pos: Array<number>;
    chunk_pos_images: Array<number>;
  }

  export interface NativeEmbeddingResult {
    embedding: Array<number>;
  }

  export interface NativeLlamaContext {
    contextId: number;
    model: {
      desc: string;
      size: number;
      nEmbd: number;
      nParams: number;
      chatTemplates: {
        llamaChat: boolean;
        minja: {
          default: boolean;
          defaultCaps: {
            tools: boolean;
            toolCalls: boolean;
            toolResponses: boolean;
            systemRole: boolean;
            parallelToolCalls: boolean;
            toolCallId: boolean;
          };
          toolUse: boolean;
          toolUseCaps: {
            tools: boolean;
            toolCalls: boolean;
            toolResponses: boolean;
            systemRole: boolean;
            parallelToolCalls: boolean;
            toolCallId: boolean;
          };
        };
      };
      metadata: Object;
      isChatTemplateSupported: boolean;
    };
    androidLib?: string;
    gpu: boolean;
    reasonNoGPU: string;
  }

  export interface NativeSessionLoadResult {
    tokens_loaded: number;
    prompt: string;
  }

  export interface NativeEmbeddingParams {
    embd_normalize?: number;
  }

  export interface NativeRerankParams {
    normalize?: number;
  }

  export interface NativeRerankResult {
    score: number;
    index: number;
  }

  // High-level types
  export interface LlamaCppMessagePart {
    type: string;
    text?: string;
    image_url?: {
      url?: string;
    };
    input_audio?: {
      format: string;
      data?: string;
      url?: string;
    };
  }

  export interface LlamaCppOAICompatibleMessage {
    role: string;
    content?: string | LlamaCppMessagePart[];
  }

  export interface ToolCall {
    type: 'function';
    id?: string;
    function: {
      name: string;
      arguments: string;
    };
  }

  export interface TokenData {
    token: string;
    completion_probabilities?: Array<{
      content: string;
      probs: Array<{
        tok_str: string;
        prob: number;
      }>;
    }>;
    content?: string;
    reasoning_content?: string;
    tool_calls?: Array<ToolCall>;
    accumulated_text?: string;
  }

  export interface ContextParams extends Omit<
    NativeContextParams,
    'cache_type_k' | 'cache_type_v' | 'pooling_type'
  > {
    cache_type_k?:
      | 'f16'
      | 'f32'
      | 'q8_0'
      | 'q4_0'
      | 'q4_1'
      | 'iq4_nl'
      | 'q5_0'
      | 'q5_1';
    cache_type_v?:
      | 'f16'
      | 'f32'
      | 'q8_0'
      | 'q4_0'
      | 'q4_1'
      | 'iq4_nl'
      | 'q5_0'
      | 'q5_1';
    pooling_type?: 'none' | 'mean' | 'cls' | 'last' | 'rank';
  }

  export interface EmbeddingParams extends NativeEmbeddingParams {}

  export interface RerankParams {
    normalize?: number;
  }

  export interface RerankResult {
    score: number;
    index: number;
    document?: string;
  }

  export interface CompletionResponseFormat {
    type: 'text' | 'json_object' | 'json_schema';
    json_schema?: {
      strict?: boolean;
      schema: object;
    };
    schema?: object;
  }

  export interface CompletionParams extends Omit<
    NativeCompletionParams,
    'emit_partial_completion' | 'prompt'
  > {
    prompt?: string;
    messages?: LlamaCppOAICompatibleMessage[];
    chatTemplate?: string;
    chat_template?: string;
    jinja?: boolean;
    tools?: object;
    parallel_tool_calls?: object;
    tool_choice?: string;
    response_format?: CompletionResponseFormat;
    media_paths?: string[];
    add_generation_prompt?: boolean;
    now?: string | number;
    chat_template_kwargs?: Record<string, string>;
    prefill_text?: string;
  }

  export interface BenchResult {
    modelDesc: string;
    modelSize: number;
    modelNParams: number;
    ppAvg: number;
    ppStd: number;
    tgAvg: number;
    tgStd: number;
  }

  export interface FormattedChatResult {
    type: 'jinja' | 'llama-chat';
    prompt: string;
    has_media: boolean;
    media_paths?: Array<string>;
  }

  export interface JinjaFormattedChatResult extends FormattedChatResult {
    chat_format?: number;
    grammar?: string;
    grammar_lazy?: boolean;
    grammar_triggers?: Array<{
      type: number;
      value: string;
      token: number;
    }>;
    thinking_forced_open?: boolean;
    preserved_tokens?: Array<string>;
    additional_stops?: Array<string>;
  }

  // Main LlamaContext class
  export class LlamaContext {
    id: number;
    gpu: boolean;
    reasonNoGPU: string;
    model: NativeLlamaContext['model'];

    constructor(context: NativeLlamaContext);

    loadSession(filepath: string): Promise<NativeSessionLoadResult>;
    saveSession(filepath: string, options?: { tokenSize: number }): Promise<number>;
    isLlamaChatSupported(): boolean;
    isJinjaSupported(): boolean;
    getFormattedChat(
      messages: LlamaCppOAICompatibleMessage[],
      template?: string | null,
      params?: {
        jinja?: boolean;
        response_format?: CompletionResponseFormat;
        tools?: object;
        parallel_tool_calls?: object;
        tool_choice?: string;
        enable_thinking?: boolean;
        add_generation_prompt?: boolean;
        now?: string | number;
        chat_template_kwargs?: Record<string, string>;
      }
    ): Promise<FormattedChatResult | JinjaFormattedChatResult>;
    completion(
      params: CompletionParams,
      callback?: (data: TokenData) => void
    ): Promise<NativeCompletionResult>;
    stopCompletion(): Promise<void>;
    tokenize(
      text: string,
      options?: { media_paths?: string[] }
    ): Promise<NativeTokenizeResult>;
    detokenize(tokens: number[]): Promise<string>;
    embedding(text: string, params?: EmbeddingParams): Promise<NativeEmbeddingResult>;
    rerank(
      query: string,
      documents: string[],
      params?: RerankParams
    ): Promise<RerankResult[]>;
    bench(pp: number, tg: number, pl: number, nr: number): Promise<BenchResult>;
    applyLoraAdapters(
      loraList: Array<{ path: string; scaled?: number }>
    ): Promise<void>;
    removeLoraAdapters(): Promise<void>;
    getLoadedLoraAdapters(): Promise<Array<{ path: string; scaled?: number }>>;
    initMultimodal(params: {
      path: string;
      use_gpu?: boolean;
    }): Promise<boolean>;
    isMultimodalEnabled(): Promise<boolean>;
    getMultimodalSupport(): Promise<{
      vision: boolean;
      audio: boolean;
    }>;
    releaseMultimodal(): Promise<void>;
    initVocoder(params: {
      path: string;
      n_batch?: number;
    }): Promise<boolean>;
    isVocoderEnabled(): Promise<boolean>;
    getFormattedAudioCompletion(
      speaker: object | null,
      textToSpeak: string
    ): Promise<{
      prompt: string;
      grammar?: string;
    }>;
    getAudioCompletionGuideTokens(textToSpeak: string): Promise<Array<number>>;
    decodeAudioTokens(tokens: number[]): Promise<Array<number>>;
    releaseVocoder(): Promise<void>;
    release(): Promise<void>;
  }

  // Utility functions
  export function toggleNativeLog(enabled: boolean): Promise<void>;
  export function addNativeLogListener(
    listener: (level: string, text: string) => void
  ): { remove: () => void };
  export function setContextLimit(limit: number): Promise<void>;
  export function loadLlamaModelInfo(model: string): Promise<Object>;
  export function initLlama(
    params: ContextParams,
    onProgress?: (progress: number) => void
  ): Promise<LlamaContext>;
  export function releaseAllLlama(): Promise<void>;

  // Constants
  export const BuildInfo: {
    number: string;
    commit: string;
  };

  export const LLAMACPP_MTMD_DEFAULT_MEDIA_MARKER: string;
  export const RNLLAMA_MTMD_DEFAULT_MEDIA_MARKER: string;

  // Re-export types for convenience (only types not already declared)
  export type {
    // These are already declared as interfaces above, so we don't re-export them
  };

  // Legacy type aliases for backward compatibility
  export type RNLlamaMessagePart = LlamaCppMessagePart;
  export type RNLlamaOAICompatibleMessage = LlamaCppOAICompatibleMessage;
}
