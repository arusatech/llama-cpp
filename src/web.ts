import type { LlamaCppPlugin } from './definitions';

export class LlamaCppWeb implements LlamaCppPlugin {
  // Core initialization and management
  async toggleNativeLog(options: { enabled: boolean }): Promise<void> {
    console.warn('LlamaCpp: toggleNativeLog not supported on web platform');
  }

  async setContextLimit(options: { limit: number }): Promise<void> {
    console.warn('LlamaCpp: setContextLimit not supported on web platform');
  }

  async modelInfo(options: { path: string; skip?: string[] }): Promise<Object> {
    console.warn('LlamaCpp: modelInfo not supported on web platform');
    return {};
  }

  async initContext(options: { contextId: number; params: any }): Promise<any> {
    throw new Error('LlamaCpp: initContext not supported on web platform. Use native platforms (iOS/Android) for llama.cpp functionality.');
  }

  async releaseContext(options: { contextId: number }): Promise<void> {
    console.warn('LlamaCpp: releaseContext not supported on web platform');
  }

  async releaseAllContexts(): Promise<void> {
    console.warn('LlamaCpp: releaseAllContexts not supported on web platform');
  }

  // Chat and completion
  async getFormattedChat(options: {
    contextId: number;
    messages: string;
    chatTemplate?: string;
    params?: {
      jinja?: boolean;
      json_schema?: string;
      tools?: string;
      parallel_tool_calls?: string;
      tool_choice?: string;
      enable_thinking?: boolean;
      add_generation_prompt?: boolean;
      now?: string;
      chat_template_kwargs?: string;
    };
  }): Promise<any> {
    throw new Error('LlamaCpp: getFormattedChat not supported on web platform');
  }

  async completion(options: {
    contextId: number;
    params: any;
  }): Promise<any> {
    throw new Error('LlamaCpp: completion not supported on web platform');
  }

  async stopCompletion(options: { contextId: number }): Promise<void> {
    console.warn('LlamaCpp: stopCompletion not supported on web platform');
  }

  // Session management
  async loadSession(options: {
    contextId: number;
    filepath: string;
  }): Promise<any> {
    throw new Error('LlamaCpp: loadSession not supported on web platform');
  }

  async saveSession(options: {
    contextId: number;
    filepath: string;
    size: number;
  }): Promise<number> {
    throw new Error('LlamaCpp: saveSession not supported on web platform');
  }

  // Tokenization
  async tokenize(options: {
    contextId: number;
    text: string;
    imagePaths?: Array<string>;
  }): Promise<any> {
    throw new Error('LlamaCpp: tokenize not supported on web platform');
  }

  async detokenize(options: {
    contextId: number;
    tokens: number[];
  }): Promise<string> {
    throw new Error('LlamaCpp: detokenize not supported on web platform');
  }

  // Embeddings and reranking
  async embedding(options: {
    contextId: number;
    text: string;
    params: any;
  }): Promise<any> {
    throw new Error('LlamaCpp: embedding not supported on web platform');
  }

  async rerank(options: {
    contextId: number;
    query: string;
    documents: Array<string>;
    params?: any;
  }): Promise<Array<any>> {
    throw new Error('LlamaCpp: rerank not supported on web platform');
  }

  // Benchmarking
  async bench(options: {
    contextId: number;
    pp: number;
    tg: number;
    pl: number;
    nr: number;
  }): Promise<string> {
    throw new Error('LlamaCpp: bench not supported on web platform');
  }

  // LoRA adapters
  async applyLoraAdapters(options: {
    contextId: number;
    loraAdapters: Array<{ path: string; scaled?: number }>;
  }): Promise<void> {
    console.warn('LlamaCpp: applyLoraAdapters not supported on web platform');
  }

  async removeLoraAdapters(options: { contextId: number }): Promise<void> {
    console.warn('LlamaCpp: removeLoraAdapters not supported on web platform');
  }

  async getLoadedLoraAdapters(options: {
    contextId: number;
  }): Promise<Array<{ path: string; scaled?: number }>> {
    console.warn('LlamaCpp: getLoadedLoraAdapters not supported on web platform');
    return [];
  }

  // Multimodal methods
  async initMultimodal(options: {
    contextId: number;
    params: {
      path: string;
      use_gpu: boolean;
    };
  }): Promise<boolean> {
    console.warn('LlamaCpp: initMultimodal not supported on web platform');
    return false;
  }

  async isMultimodalEnabled(options: {
    contextId: number;
  }): Promise<boolean> {
    console.warn('LlamaCpp: isMultimodalEnabled not supported on web platform');
    return false;
  }

  async getMultimodalSupport(options: {
    contextId: number;
  }): Promise<{
    vision: boolean;
    audio: boolean;
  }> {
    console.warn('LlamaCpp: getMultimodalSupport not supported on web platform');
    return { vision: false, audio: false };
  }

  async releaseMultimodal(options: {
    contextId: number;
  }): Promise<void> {
    console.warn('LlamaCpp: releaseMultimodal not supported on web platform');
  }

  // TTS methods
  async initVocoder(options: {
    contextId: number;
    params: {
      path: string;
      n_batch?: number;
    };
  }): Promise<boolean> {
    console.warn('LlamaCpp: initVocoder not supported on web platform');
    return false;
  }

  async isVocoderEnabled(options: { contextId: number }): Promise<boolean> {
    console.warn('LlamaCpp: isVocoderEnabled not supported on web platform');
    return false;
  }

  async getFormattedAudioCompletion(options: {
    contextId: number;
    speakerJsonStr: string;
    textToSpeak: string;
  }): Promise<{
    prompt: string;
    grammar?: string;
  }> {
    throw new Error('LlamaCpp: getFormattedAudioCompletion not supported on web platform');
  }

  async getAudioCompletionGuideTokens(options: {
    contextId: number;
    textToSpeak: string;
  }): Promise<Array<number>> {
    throw new Error('LlamaCpp: getAudioCompletionGuideTokens not supported on web platform');
  }

  async decodeAudioTokens(options: {
    contextId: number;
    tokens: number[];
  }): Promise<Array<number>> {
    throw new Error('LlamaCpp: decodeAudioTokens not supported on web platform');
  }

  async releaseVocoder(options: { contextId: number }): Promise<void> {
    console.warn('LlamaCpp: releaseVocoder not supported on web platform');
  }

  // Events
  async addListener(eventName: string, listenerFunc: (data: any) => void): Promise<void> {
    console.warn('LlamaCpp: addListener not supported on web platform');
  }

  async removeAllListeners(eventName: string): Promise<void> {
    console.warn('LlamaCpp: removeAllListeners not supported on web platform');
  }
}
