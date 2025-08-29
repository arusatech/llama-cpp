# LlamaCpp Capacitor Plugin

A native Capacitor plugin that embeds llama.cpp directly into mobile apps, enabling offline AI inference without requiring external servers. This plugin provides a comprehensive interface to llama.cpp functionality, similar to the React Native implementation.

## Features

- **Offline AI Inference**: Run large language models directly on device
- **Cross-Platform**: Works on iOS, Android, and Web (with limitations)
- **Comprehensive API**: Full access to llama.cpp functionality
- **Multimodal Support**: Image and audio processing capabilities
- **TTS Support**: Text-to-speech functionality
- **LoRA Adapters**: Support for LoRA fine-tuning adapters
- **Session Management**: Save and load conversation states
- **Embeddings & Reranking**: Advanced text processing capabilities
- **Benchmarking**: Model performance testing tools

## Installation

### 1. Install the Plugin

```bash
npm install llama-cpp
```

### 2. Add to Your Capacitor Project

```bash
npx cap add llama-cpp
```

### 3. Sync Native Projects

```bash
npx cap sync
```

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| iOS | ✅ Supported | Full native implementation |
| Android | ✅ Supported | Full native implementation |
| Web | ⚠️ Limited | Placeholder implementation only |

## Basic Usage

### Initialize a Model

```typescript
import { initLlama, LlamaContext } from 'llama-cpp';

// Initialize a llama.cpp model
const context = await initLlama({
  model: '/path/to/your/model.gguf',
  n_ctx: 2048,
  n_threads: 4,
  n_gpu_layers: 0, // Set to > 0 for GPU acceleration on iOS
});

console.log('Model loaded:', context.model.desc);
console.log('GPU available:', context.gpu);
```

### Generate Text Completions

```typescript
// Simple text completion
const result = await context.completion({
  prompt: "Hello, how are you?",
  n_predict: 100,
  temperature: 0.8,
  top_p: 0.9,
});

console.log('Generated text:', result.text);

// Chat-style completion with messages
const chatResult = await context.completion({
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "What is the capital of France?" }
  ],
  n_predict: 100,
  temperature: 0.7,
});

console.log('Chat response:', chatResult.content);
```

### Streaming Completions

```typescript
let fullText = '';

const result = await context.completion({
  prompt: "Write a short story about a robot:",
  n_predict: 200,
  temperature: 0.8,
}, (tokenData) => {
  // Called for each token as it's generated
  fullText += tokenData.token;
  console.log('Token:', tokenData.token);
  console.log('Accumulated text:', fullText);
});

console.log('Final result:', result.text);
```

### Multimodal Support

```typescript
// Initialize multimodal support
await context.initMultimodal({
  path: '/path/to/mmproj.gguf',
  use_gpu: true,
});

// Check multimodal capabilities
const support = await context.getMultimodalSupport();
console.log('Vision support:', support.vision);
console.log('Audio support:', support.audio);

// Generate text with image context
const result = await context.completion({
  messages: [
    { role: "user", content: "Describe this image" },
    { 
      role: "user", 
      content: [
        { type: "text", text: "What do you see in this image?" },
        { type: "image_url", image_url: { url: "file:///path/to/image.jpg" } }
      ]
    }
  ],
  n_predict: 150,
});
```

### TTS (Text-to-Speech)

```typescript
// Initialize TTS support
await context.initVocoder({
  path: '/path/to/vocoder.gguf',
  n_batch: 512,
});

// Generate audio completion
const audioCompletion = await context.getFormattedAudioCompletion(
  speaker, // Speaker configuration object
  "Hello, this is a test of text-to-speech."
);

// Get guide tokens for audio generation
const guideTokens = await context.getAudioCompletionGuideTokens(
  "Hello, this is a test of text-to-speech."
);

// Generate audio tokens
const audioResult = await context.completion({
  prompt: audioCompletion.prompt,
  grammar: audioCompletion.grammar,
  guide_tokens: guideTokens,
  n_predict: 1000,
});

// Decode audio tokens to audio data
const audioData = await context.decodeAudioTokens(audioResult.audio_tokens);
```

### Session Management

```typescript
// Save current conversation state
await context.saveSession('/path/to/session.gguf', { tokenSize: 1000 });

// Load previous conversation state
const session = await context.loadSession('/path/to/session.gguf');
console.log('Loaded tokens:', session.tokens_loaded);
console.log('Previous prompt:', session.prompt);
```

### Embeddings and Reranking

```typescript
// Generate embeddings
const embedding = await context.embedding("Hello, world!", {
  embd_normalize: 1.0
});

console.log('Embedding vector:', embedding.embedding);

// Rerank documents
const documents = [
  "Document about cats",
  "Document about dogs", 
  "Document about birds"
];

const rerankResults = await context.rerank(
  "Tell me about pets",
  documents,
  { normalize: 1.0 }
);

console.log('Reranked results:', rerankResults);
```

### LoRA Adapters

```typescript
// Apply LoRA adapters
await context.applyLoraAdapters([
  { path: '/path/to/adapter1.gguf', scaled: 1.0 },
  { path: '/path/to/adapter2.gguf', scaled: 0.5 }
]);

// Check loaded adapters
const adapters = await context.getLoadedLoraAdapters();
console.log('Loaded adapters:', adapters);

// Remove all adapters
await context.removeLoraAdapters();
```

### Benchmarking

```typescript
// Run performance benchmarks
const benchResult = await context.bench(128, 128, 128, 10);
console.log('Benchmark results:', benchResult);
```

## API Reference

### Core Functions

#### `initLlama(params: ContextParams, onProgress?: (progress: number) => void): Promise<LlamaContext>`

Initialize a new llama.cpp context with the specified model and parameters.

**Parameters:**
- `params`: Context initialization parameters
- `onProgress`: Optional progress callback (0-100)

**Returns:** Promise resolving to a `LlamaContext` instance

#### `releaseAllLlama(): Promise<void>`

Release all active contexts and free resources.

### LlamaContext Class

#### `completion(params: CompletionParams, callback?: (data: TokenData) => void): Promise<NativeCompletionResult>`

Generate text completions based on the provided parameters.

#### `stopCompletion(): Promise<void>`

Stop any ongoing completion generation.

#### `tokenize(text: string, options?: { media_paths?: string[] }): Promise<NativeTokenizeResult>`

Tokenize text (and optionally images) using the model's tokenizer.

#### `detokenize(tokens: number[]): Promise<string>`

Convert tokens back to text.

#### `embedding(text: string, params?: EmbeddingParams): Promise<NativeEmbeddingResult>`

Generate embeddings for the given text.

#### `rerank(query: string, documents: string[], params?: RerankParams): Promise<RerankResult[]>`

Rerank documents based on relevance to the query.

#### `bench(pp: number, tg: number, pl: number, nr: number): Promise<BenchResult>`

Run performance benchmarks.

### Multimodal Methods

#### `initMultimodal(params: { path: string; use_gpu?: boolean }): Promise<boolean>`

Initialize multimodal support with a projector file.

#### `isMultimodalEnabled(): Promise<boolean>`

Check if multimodal support is enabled.

#### `getMultimodalSupport(): Promise<{ vision: boolean; audio: boolean }>`

Get multimodal capabilities.

#### `releaseMultimodal(): Promise<void>`

Release multimodal resources.

### TTS Methods

#### `initVocoder(params: { path: string; n_batch?: number }): Promise<boolean>`

Initialize TTS support with a vocoder model.

#### `isVocoderEnabled(): Promise<boolean>`

Check if TTS support is enabled.

#### `getFormattedAudioCompletion(speaker: object | null, textToSpeak: string): Promise<{ prompt: string; grammar?: string }>`

Get formatted audio completion prompt.

#### `getAudioCompletionGuideTokens(textToSpeak: string): Promise<number[]>`

Get guide tokens for audio generation.

#### `decodeAudioTokens(tokens: number[]): Promise<number[]>`

Decode audio tokens to audio data.

#### `releaseVocoder(): Promise<void>`

Release TTS resources.

### Session Management

#### `saveSession(filepath: string, options?: { tokenSize: number }): Promise<number>`

Save current conversation state to file.

#### `loadSession(filepath: string): Promise<NativeSessionLoadResult>`

Load conversation state from file.

### LoRA Adapters

#### `applyLoraAdapters(adapters: Array<{ path: string; scaled?: number }>): Promise<void>`

Apply LoRA adapters to the model.

#### `removeLoraAdapters(): Promise<void>`

Remove all LoRA adapters.

#### `getLoadedLoraAdapters(): Promise<Array<{ path: string; scaled?: number }>>`

Get list of currently loaded LoRA adapters.

## Configuration

### Context Parameters

```typescript
interface ContextParams {
  model: string;                    // Path to GGUF model file
  n_ctx?: number;                   // Context size (default: 512)
  n_batch?: number;                 // Batch size (default: 512)
  n_threads?: number;               // Number of threads (default: 1)
  n_gpu_layers?: number;            // GPU layers (iOS only, default: 0)
  use_mlock?: boolean;              // Use mlock (default: false)
  use_mmap?: boolean;               // Use mmap (default: true)
  vocab_only?: boolean;             // Load vocabulary only (default: false)
  embedding?: boolean;              // Enable embedding mode (default: false)
  flash_attn?: boolean;             // Enable flash attention (default: false)
  cache_type_k?: string;            // KV cache K type
  cache_type_v?: string;            // KV cache V type
  pooling_type?: 'none' | 'mean' | 'cls' | 'last' | 'rank';
  lora?: string;                    // Single LoRA adapter path
  lora_list?: Array<{ path: string; scaled?: number }>;
  rope_freq_base?: number;          // RoPE frequency base
  rope_freq_scale?: number;         // RoPE frequency scale
  ctx_shift?: boolean;              // Enable context shifting
  kv_unified?: boolean;             // Use unified KV buffer
  swa_full?: boolean;               // Use full-size SWA cache
  n_cpu_moe?: number;               // CPU MoE layers
}
```

### Completion Parameters

```typescript
interface CompletionParams {
  prompt?: string;                  // Text prompt
  messages?: LlamaCppOAICompatibleMessage[]; // Chat messages
  n_predict?: number;               // Max tokens to predict (-1 = unlimited)
  n_probs?: number;                 // Number of token probabilities
  top_k?: number;                   // Top-k sampling (default: 40)
  top_p?: number;                   // Top-p sampling (default: 0.95)
  min_p?: number;                   // Min-p sampling (default: 0.05)
  temperature?: number;             // Temperature (default: 0.8)
  penalty_last_n?: number;          // Repetition penalty window
  penalty_repeat?: number;          // Repetition penalty (default: 1.0)
  penalty_freq?: number;            // Frequency penalty (default: 0.0)
  penalty_present?: number;         // Presence penalty (default: 0.0)
  mirostat?: number;                // Mirostat mode (0, 1, 2)
  mirostat_tau?: number;            // Mirostat tau (default: 5.0)
  mirostat_eta?: number;            // Mirostat eta (default: 0.1)
  stop?: string[];                  // Stop sequences
  ignore_eos?: boolean;             // Ignore EOS token
  seed?: number;                    // Random seed (-1 = random)
  logit_bias?: number[][];          // Logit bias
  grammar?: string;                 // Grammar string
  grammar_lazy?: boolean;           // Lazy grammar parsing
  json_schema?: string;             // JSON schema for structured output
  media_paths?: string[];           // Image/audio file paths
  response_format?: CompletionResponseFormat;
}
```

## Model Compatibility

This plugin supports GGUF format models that are compatible with llama.cpp. Popular models include:

- **Llama 2** (7B, 13B, 70B variants)
- **Code Llama** (7B, 13B, 34B variants)
- **Mistral** (7B, 8x7B variants)
- **Phi-2** and **Phi-3**
- **Gemma** (2B, 7B variants)
- **Qwen** (1.5B, 7B, 14B, 72B variants)
- **Custom fine-tuned models**

## Performance Considerations

### Memory Usage
- Model size directly affects memory usage
- Consider using quantized models (Q4_K_M, Q5_K_M, etc.)
- Adjust `n_ctx` based on available memory

### Speed Optimization
- Use GPU acceleration on iOS with `n_gpu_layers > 0`
- Adjust `n_threads` based on device capabilities
- Use `n_batch` to balance memory and speed

### Battery Life
- Lower `n_threads` for better battery life
- Use smaller models for mobile devices
- Consider `use_mlock: false` to allow memory swapping

## Troubleshooting

### Common Issues

**"Context not found" error**
- Ensure the context was properly initialized
- Check that the context ID is valid

**"Model not found" error**
- Verify the model file path is correct
- Ensure the model file is accessible to the app

**"Context limit reached" error**
- Increase the context limit with `setContextLimit()`
- Release unused contexts with `releaseContext()`

**Performance issues**
- Use quantized models for better performance
- Adjust `n_threads` and `n_batch` parameters
- Enable GPU acceleration on iOS if available

### Debugging

Enable native logging to see detailed information:

```typescript
import { toggleNativeLog } from 'llama-cpp';

await toggleNativeLog(true);
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [llama.cpp](https://github.com/ggerganov/llama.cpp) - The core inference engine
- [llama.rn](https://github.com/mybigday/llama.rn) - React Native implementation that inspired this plugin
- [Capacitor](https://capacitorjs.com/) - The cross-platform native runtime

## Support

For support, please open an issue on GitHub or check the documentation.
