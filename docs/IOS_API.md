# iOS API Reference Guide
## LlamaCpp Capacitor Plugin - Complete iOS Implementation API

**Version:** 1.0.0  
**Platform:** iOS 13.0+  
**Author:** Annadata AI  
**Date:** July 2, 2026

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation & Setup](#installation--setup)
3. [Core API Methods](#core-api-methods)
4. [Context Management](#context-management)
5. [Text Generation](#text-generation)
6. [Chat & Conversations](#chat--conversations)
7. [Embeddings & Reranking](#embeddings--reranking)
8. [LoRA Adapters](#lora-adapters)
9. [Multimodal Processing](#multimodal-processing)
10. [Text-to-Speech](#text-to-speech)
11. [Session Management](#session-management)
12. [Error Handling](#error-handling)
13. [Advanced Topics](#advanced-topics)

---

## Quick Start

### Installation

```bash
# Install via npm
npm install llama-cpp-pro

# Add iOS platform
npx cap add ios
npx cap sync ios

# Open in Xcode
npx cap open ios
```

### Minimal Working Example

```typescript
import { initLlama, LlamaContext } from 'llama-cpp-pro';

// 1. Initialize model
const context = await initLlama({
  model: '/path/to/model.gguf',
  n_ctx: 2048,
  n_threads: 4,
  n_gpu_layers: 20,  // iOS specific: Metal GPU layers
});

// 2. Generate text
const result = await context.completion({
  prompt: 'Hello, how are you?',
  n_predict: 50,
  temperature: 0.8,
});

console.log('Generated:', result.text);

// 3. Release resources
await context.release();
```

---

## Installation & Setup

### Import Statement

```typescript
import {
  initLlama,
  LlamaContext,
  releaseAllLlama,
  toggleNativeLog,
  addNativeLogListener,
  modelInfo,
} from 'llama-cpp-pro';
```

### Type Imports

```typescript
import type {
  NativeContextParams,
  NativeLlamaContext,
  NativeCompletionParams,
  NativeCompletionResult,
  CompletionParams,
  ContextParams,
} from 'llama-cpp-pro';
```

### Initialization with Full Configuration

```typescript
const context = await initLlama({
  // Model path
  model: '/path/to/llama-2-7b-chat.gguf',
  
  // Context configuration
  n_ctx: 4096,              // Maximum context size
  n_batch: 512,             // Batch processing size
  n_threads: 6,             // CPU threads (default: 4)
  
  // GPU configuration (iOS Metal)
  n_gpu_layers: 24,         // Layers to offload to GPU
  no_gpu_devices: false,    // Force CPU-only if true
  flash_attn: false,        // Flash attention (experimental)
  
  // Speculative decoding (mobile optimization)
  draft_model: '/path/to/draft-model.gguf',
  speculative_samples: 3,   // Tokens to predict ahead
  mobile_speculative: true, // Enable mobile optimizations
  
  // Memory optimization
  use_mmap: true,           // Memory-map model file
  use_mlock: false,         // Lock in RAM (avoid on mobile)
  
  // LoRA adapters
  lora_list: [
    { path: '/path/adapter1.gguf', scaled: 1.0 },
    { path: '/path/adapter2.gguf', scaled: 0.5 }
  ],
  
  // Cache configuration
  cache_type_k: 'f16',      // Key cache type
  cache_type_v: 'f16',      // Value cache type
});
```

---

## Core API Methods

### 1. initLlama() - Initialize Model

```typescript
function initLlama(
  params: ContextParams,
  onProgress?: (progress: number) => void
): Promise<LlamaContext>
```

**Purpose:** Initialize and load a language model

**Parameters:**
- `params`: Model initialization configuration
- `onProgress`: Optional callback for loading progress (0-100)

**Returns:** Promise resolving to LlamaContext instance

**Example: Basic Initialization**

```typescript
const context = await initLlama({
  model: '/path/to/model.gguf',
  n_ctx: 2048,
  n_threads: 4,
});

console.log(`Model loaded: ${context.model.desc}`);
console.log(`GPU available: ${context.gpu}`);
```

**Example: With Progress Tracking**

```typescript
const context = await initLlama(
  {
    model: '/path/to/model.gguf',
    n_ctx: 2048,
    use_progress_callback: true,
  },
  (progress) => {
    console.log(`Loading: ${progress}%`);
    updateProgressBar(progress);
  }
);

console.log('Model loaded!');
```

**Example: With GPU Acceleration**

```typescript
const context = await initLlama({
  model: '/path/to/model.gguf',
  n_ctx: 4096,
  n_gpu_layers: 24,      // Offload layers to Metal GPU
  n_threads: 6,          // CPU threads for remaining layers
  use_mmap: true,        // Memory map for efficiency
});

console.log(`GPU enabled: ${context.gpu}`);
if (!context.gpu) {
  console.log(`Reason: ${context.reasonNoGPU}`);
}
```

---

### 2. releaseAllLlama() - Release All Contexts

```typescript
function releaseAllLlama(): Promise<void>
```

**Purpose:** Release all active model contexts and free memory

**Example:**

```typescript
// Clean shutdown
await releaseAllLlama();
console.log('All models released and memory freed');
```

---

### 3. toggleNativeLog() - Enable/Disable Logging

```typescript
function toggleNativeLog(enabled: boolean): Promise<void>
```

**Purpose:** Enable or disable native C++ logging

**Example:**

```typescript
// Enable native logging
await toggleNativeLog(true);
console.log('Native logging enabled');

// Disable native logging
await toggleNativeLog(false);
```

---

### 4. addNativeLogListener() - Listen to Logs

```typescript
function addNativeLogListener(
  listener: (level: string, text: string) => void
): { remove: () => void }
```

**Purpose:** Add a listener for native log events

**Example:**

```typescript
const listener = addNativeLogListener((level, text) => {
  console.log(`[${level}] ${text}`);
});

// ... later, stop listening
listener.remove();
```

---

### 5. modelInfo() - Get Model Metadata

```typescript
function modelInfo(
  options: { path: string; skip?: string[] }
): Promise<Object>
```

**Purpose:** Extract metadata from a GGUF model file

**Example:**

```typescript
const info = await modelInfo({
  path: '/path/to/model.gguf',
  skip: ['tokenizer.ggml.tokens']  // Skip large arrays
});

console.log(`Model: ${info.general.name}`);
console.log(`Context: ${info.parameters.context_length}`);
console.log(`Vocab size: ${info.parameters.vocab_size}`);
console.log(`Parameters: ${info.parameters.block_count} blocks`);
```

---

## Context Management

### context.completion() - Generate Text

```typescript
async completion(
  params: CompletionParams,
  callback?: (data: TokenData) => void
): Promise<NativeCompletionResult>
```

**Purpose:** Generate text with comprehensive control

**Basic Example:**

```typescript
const result = await context.completion({
  prompt: 'The meaning of life is',
  n_predict: 100,
  temperature: 0.8,
});

console.log('Generated:', result.text);
console.log('Tokens:', result.tokens_predicted);
console.log('Speed:', result.timings.predicted_per_second, 'tok/s');
```

**With Streaming Callback:**

```typescript
let fullText = '';

const result = await context.completion(
  {
    prompt: 'Write a poem about AI:',
    n_predict: 200,
    temperature: 0.9,
  },
  (tokenData) => {
    // Called for each generated token
    fullText += tokenData.token;
    console.log('Token:', tokenData.token);
    updateUI(fullText);  // Update UI in real-time
  }
);

console.log('Complete:', result.text);
```

**With Sampling Parameters:**

```typescript
const result = await context.completion({
  prompt: 'Complete this thought:',
  n_predict: 150,
  temperature: 0.7,      // Lower = more deterministic
  top_p: 0.9,            // Nucleus sampling
  top_k: 40,             // Top-K sampling
  penalty_repeat: 1.2,   // Penalize repetition
  mirostat: 2,           // Mirostat sampling v2
  mirostat_tau: 5.0,     // Target entropy
});
```

**With Stop Sequences:**

```typescript
const result = await context.completion({
  prompt: 'Q: What is AI?\nA:',
  n_predict: 100,
  stop: ['\n\nQ:', '\n\nUser:', 'Assistant:'],  // Stop at these
});
```

---

### context.chat() - Chat Conversation

```typescript
async chat(
  messages: Array<{ role: string; content: string }>,
  system?: string,
  params?: CompletionParams
): Promise<NativeCompletionResult>
```

**Purpose:** Chat with automatic message formatting

**Example:**

```typescript
const result = await context.chat(
  [
    { role: 'user', content: 'What is machine learning?' },
    { role: 'assistant', content: 'Machine learning is...' },
    { role: 'user', content: 'Tell me more about neural networks.' },
  ],
  'You are a helpful AI assistant focused on explaining technical concepts.',
  {
    n_predict: 200,
    temperature: 0.7,
  }
);

console.log('Assistant:', result.content);
```

---

### context.chatWithSystem() - Simple Chat

```typescript
async chatWithSystem(
  system: string,
  message: string,
  params?: CompletionParams
): Promise<NativeCompletionResult>
```

**Example:**

```typescript
const result = await context.chatWithSystem(
  'You are a helpful assistant.',
  'What is the capital of France?',
  { n_predict: 100, temperature: 0.7 }
);

console.log('Response:', result.content);
```

---

### context.generateText() - Simple Generation

```typescript
async generateText(
  prompt: string,
  params?: CompletionParams
): Promise<NativeCompletionResult>
```

**Example:**

```typescript
const result = await context.generateText(
  'Once upon a time, there was',
  {
    n_predict: 200,
    temperature: 0.8,
    top_p: 0.9,
  }
);

console.log('Story:', result.text);
```

---

## Chat & Conversations

### context.getFormattedChat() - Format Messages

```typescript
async getFormattedChat(
  messages: Array<{ role: string; content: string }>,
  template?: string,
  params?: {
    jinja?: boolean;
    response_format?: CompletionResponseFormat;
    enable_thinking?: boolean;
  }
): Promise<FormattedChatResult>
```

**Example:**

```typescript
const formatted = await context.getFormattedChat(
  [
    { role: 'system', content: 'You are a Python expert.' },
    { role: 'user', content: 'Write a function to sort a list.' },
  ],
  'chatml',  // or 'llama-chat', 'mistral', 'gemma'
  {
    jinja: true,
    enable_thinking: true,
  }
);

console.log('Formatted prompt:', formatted.prompt);
if (formatted.grammar) {
  console.log('Grammar:', formatted.grammar);
}
```

---

## Embeddings & Reranking

### context.embedding() - Generate Embeddings

```typescript
async embedding(
  text: string,
  params?: EmbeddingParams
): Promise<NativeEmbeddingResult>
```

**Purpose:** Generate vector embeddings for semantic search

**Example:**

```typescript
const embedding = await context.embedding(
  'This is a test sentence.'
);

console.log('Embedding vector:', embedding.embedding);
console.log('Embedding size:', embedding.embedding.length);
```

**With Multiple Texts:**

```typescript
const texts = [
  'The quick brown fox',
  'A fast russet dog',
  'The lazy cat sleeps'
];

const embeddings = await Promise.all(
  texts.map(text => context.embedding(text))
);

embeddings.forEach((emb, i) => {
  console.log(`Text ${i}: ${emb.embedding.length} dimensions`);
});
```

---

### context.rerank() - Rerank Documents

```typescript
async rerank(
  query: string,
  documents: string[],
  params?: RerankParams
): Promise<Array<{ index: number; score: number }>>
```

**Purpose:** Rank documents by relevance to query

**Example:**

```typescript
const query = 'How to learn machine learning';
const documents = [
  'Linear algebra is fundamental to ML',
  'Python is a programming language',
  'Neural networks are ML models',
  'iOS development guide',
];

const ranked = await context.rerank(query, documents);

ranked.forEach(({ index, score }) => {
  console.log(`${documents[index]}: ${score.toFixed(2)}`);
});

// Output:
// Neural networks are ML models: 0.95
// Linear algebra is fundamental to ML: 0.87
// Python is a programming language: 0.45
// iOS development guide: 0.12
```

---

## LoRA Adapters

### context.applyLoraAdapters() - Apply Adapters

```typescript
async applyLoraAdapters(
  loraList: Array<{ path: string; scaled?: number }>
): Promise<void>
```

**Purpose:** Apply LoRA adapters for model fine-tuning

**Example: Single Adapter**

```typescript
await context.applyLoraAdapters([
  { path: '/path/to/adapter.gguf', scaled: 1.0 }
]);

console.log('LoRA adapter applied');
```

**Example: Multiple Adapters with Scaling**

```typescript
await context.applyLoraAdapters([
  { path: '/path/to/domain-adapter.gguf', scaled: 1.0 },
  { path: '/path/to/style-adapter.gguf', scaled: 0.7 },
  { path: '/path/to/tone-adapter.gguf', scaled: 0.5 }
]);

console.log('Multiple LoRA adapters applied');
```

**Generate with Adapters:**

```typescript
// Apply adapters first
await context.applyLoraAdapters([
  { path: '/path/to/adapter.gguf', scaled: 1.0 }
]);

// Generate text (uses adapted model)
const result = await context.completion({
  prompt: 'Generate a poem in the style of...',
  n_predict: 150,
  temperature: 0.8,
});

console.log(result.text);
```

---

### context.getLoadedLoraAdapters() - List Adapters

```typescript
async getLoadedLoraAdapters(): Promise<Array<{
  path: string;
  scaled: number;
}>>
```

**Example:**

```typescript
const adapters = await context.getLoadedLoraAdapters();

adapters.forEach(adapter => {
  console.log(`${adapter.path} (scale: ${adapter.scaled})`);
});
```

---

### context.removeLoraAdapters() - Remove Adapters

```typescript
async removeLoraAdapters(): Promise<void>
```

**Example:**

```typescript
// Check loaded adapters
const loaded = await context.getLoadedLoraAdapters();
console.log(`Loaded ${loaded.length} adapters`);

// Remove all adapters
await context.removeLoraAdapters();
console.log('All adapters removed');

// Verify
const remaining = await context.getLoadedLoraAdapters();
console.log(`Remaining: ${remaining.length}`);
```

---

## Multimodal Processing

### context.initMultimodal() - Initialize Vision

```typescript
async initMultimodal(params: {
  path: string;
  use_gpu?: boolean;
}): Promise<boolean>
```

**Purpose:** Initialize multimodal support for image processing

**Example:**

```typescript
const initialized = await context.initMultimodal({
  path: '/path/to/mmproj.gguf',
  use_gpu: true,  // Use GPU for projector
});

console.log('Multimodal initialized:', initialized);
```

---

### context.completion() with Images

```typescript
const result = await context.completion({
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What do you see in this image?' },
        {
          type: 'image_url',
          image_url: { url: 'file:///path/to/image.jpg' }
        }
      ]
    }
  ],
  n_predict: 200,
});

console.log('Description:', result.content);
```

---

### context.getMultimodalSupport() - Check Capabilities

```typescript
async getMultimodalSupport(): Promise<{
  vision: boolean;
  audio: boolean;
}>
```

**Example:**

```typescript
const support = await context.getMultimodalSupport();

console.log('Vision support:', support.vision);
console.log('Audio support:', support.audio);
```

---

### context.isMultimodalEnabled() - Check Status

```typescript
async isMultimodalEnabled(): Promise<boolean>
```

**Example:**

```typescript
const enabled = await context.isMultimodalEnabled();

if (enabled) {
  console.log('Ready to process images');
} else {
  console.log('Initialize multimodal first');
}
```

---

### context.releaseMultimodal() - Release Resources

```typescript
async releaseMultimodal(): Promise<void>
```

**Example:**

```typescript
await context.releaseMultimodal();
console.log('Multimodal resources released');
```

---

## Text-to-Speech

### context.initVocoder() - Initialize TTS

```typescript
async initVocoder(params: {
  path: string;
  n_batch?: number;
}): Promise<boolean>
```

**Example:**

```typescript
const initialized = await context.initVocoder({
  path: '/path/to/vocoder.gguf',
  n_batch: 512,
});

console.log('Vocoder initialized:', initialized);
```

---

### context.getFormattedAudioCompletion() - Prepare Audio

```typescript
async getFormattedAudioCompletion(
  speaker: any,
  textToSpeak: string
): Promise<{ prompt: string; grammar?: string }>
```

**Example:**

```typescript
const audioParams = await context.getFormattedAudioCompletion(
  null,  // Speaker config
  'Hello, this is a test of text-to-speech.'
);

console.log('Audio prompt:', audioParams.prompt);
console.log('Grammar:', audioParams.grammar);
```

---

### context.getAudioCompletionGuideTokens() - Get Guide Tokens

```typescript
async getAudioCompletionGuideTokens(
  textToSpeak: string
): Promise<number[]>
```

**Example:**

```typescript
const guideTokens = await context.getAudioCompletionGuideTokens(
  'Hello, world!'
);

console.log('Guide tokens:', guideTokens);
console.log('Token count:', guideTokens.length);
```

---

### Generate Audio

```typescript
const audioCompletion = await context.getFormattedAudioCompletion(
  null,
  'Hello, this is text-to-speech.'
);

const guideTokens = await context.getAudioCompletionGuideTokens(
  'Hello, this is text-to-speech.'
);

const result = await context.completion({
  prompt: audioCompletion.prompt,
  grammar: audioCompletion.grammar,
  guide_tokens: guideTokens,
  n_predict: 1000,
});

const audioTokens = result.audio_tokens || [];
console.log('Generated audio tokens:', audioTokens.length);
```

---

### context.decodeAudioTokens() - Decode to Audio

```typescript
async decodeAudioTokens(tokens: number[]): Promise<number[]>
```

**Example:**

```typescript
const audioSamples = await context.decodeAudioTokens(audioTokens);

console.log('Audio samples:', audioSamples.length);
// Convert to WAV or playable format
```

---

### context.releaseVocoder() - Release TTS

```typescript
async releaseVocoder(): Promise<void>
```

**Example:**

```typescript
await context.releaseVocoder();
console.log('Vocoder released');
```

---

## Session Management

### context.saveSession() - Save State

```typescript
async saveSession(
  filepath: string,
  options?: { tokenSize?: number }
): Promise<number>
```

**Purpose:** Save inference session to disk

**Example:**

```typescript
// Generate some text first
await context.completion({
  prompt: 'The future of AI is',
  n_predict: 100,
});

// Save session
const tokensSaved = await context.saveSession(
  '/path/to/session.bin'
);

console.log(`Session saved: ${tokensSaved} tokens`);
```

---

### context.loadSession() - Restore State

```typescript
async loadSession(filepath: string): Promise<{
  tokens_loaded: number;
  status: string;
}>
```

**Example:**

```typescript
// Load previous session
const result = await context.loadSession(
  '/path/to/session.bin'
);

console.log(`Loaded ${result.tokens_loaded} tokens`);

// Continue generation from where we left off
const completion = await context.completion({
  prompt: '',  // Empty - continues from session
  n_predict: 50,
});

console.log(completion.text);
```

---

## Error Handling

### Try-Catch Pattern

```typescript
try {
  const context = await initLlama({
    model: '/path/to/model.gguf',
    n_ctx: 2048,
  });
  
  const result = await context.completion({
    prompt: 'Hello',
    n_predict: 100,
  });
  
  console.log(result.text);
  
} catch (error) {
  console.error('Error:', error.message);
}
```

### Specific Error Handling

```typescript
try {
  const context = await initLlama({
    model: '/nonexistent/model.gguf',
  });
} catch (error) {
  if (error.message.includes('not found')) {
    console.error('Model file not found');
  } else if (error.message.includes('memory')) {
    console.error('Out of memory');
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

## Advanced Topics

### Speculative Decoding (2-8x Speedup)

```typescript
const context = await initLlama({
  model: '/path/to/main-model.gguf',
  draft_model: '/path/to/draft-model.gguf',
  speculative_samples: 3,      // Predict 3 tokens ahead
  mobile_speculative: true,    // Mobile optimizations
  n_ctx: 1024,
  n_threads: 4,
});

// Use normally - speculative decoding is automatic
const result = await context.completion({
  prompt: 'Write a story:',
  n_predict: 200,
});

console.log('Generated with speculative decoding:', result.text);
console.log('Speed:', result.timings.predicted_per_second, 'tok/s');
```

---

### Benchmarking

```typescript
async bench(
  pp: number,      // Prompt processing
  tg: number,      // Token generation
  pl: number,      // Prompt length
  nr: number       // Number of runs
): Promise<BenchResult>
```

**Example:**

```typescript
const benchmark = await context.bench(
  512,             // Process 512 prompt tokens
  128,             // Generate 128 tokens
  2048,            // Prompt length
  3                // Run 3 times
);

console.log('Benchmark Results:');
console.log(`Prompt processing: ${benchmark.pp_per_second} tok/s`);
console.log(`Token generation: ${benchmark.tg_per_second} tok/s`);
```

---

### JSON Schema Generation

```typescript
const result = await context.completion({
  prompt: 'Generate a person profile:',
  n_predict: 200,
  response_format: {
    type: 'json_schema',
    json_schema: {
      strict: true,
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          city: { type: 'string' },
          hobbies: { type: 'array', items: { type: 'string' } }
        },
        required: ['name', 'age', 'city']
      }
    }
  }
});

const profile = JSON.parse(result.content);
console.log('Generated profile:', profile);
```

---

### Tokenization

```typescript
// Tokenize text
const tokenized = await context.tokenize('Hello, world!');
console.log('Tokens:', tokenized.tokens);
console.log('Token count:', tokenized.tokens.length);

// Detokenize
const text = await context.detokenize(tokenized.tokens);
console.log('Reconstructed:', text);
```

---

## Complete Example Application

```typescript
import {
  initLlama,
  releaseAllLlama,
  addNativeLogListener,
} from 'llama-cpp-pro';

class AIAssistant {
  private context: any;
  private conversationHistory: Array<{
    role: string;
    content: string;
  }> = [];

  async initialize() {
    // Enable logging
    addNativeLogListener((level, text) => {
      console.log(`[${level}] ${text}`);
    });

    // Load model
    this.context = await initLlama({
      model: '/path/to/model.gguf',
      n_ctx: 2048,
      n_threads: 4,
      n_gpu_layers: 20,
      speculative_samples: 3,
    });

    console.log('AI Assistant initialized');
  }

  async chat(userMessage: string): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    // Generate response
    const result = await this.context.chat(
      this.conversationHistory,
      'You are a helpful AI assistant.',
      {
        n_predict: 200,
        temperature: 0.7,
      }
    );

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: result.content
    });

    return result.content;
  }

  async cleanup() {
    await releaseAllLlama();
    console.log('AI Assistant cleaned up');
  }
}

// Usage
const assistant = new AIAssistant();
await assistant.initialize();

const response1 = await assistant.chat('What is AI?');
console.log('Response 1:', response1);

const response2 = await assistant.chat('Tell me more.');
console.log('Response 2:', response2);

await assistant.cleanup();
```

---

## Common Patterns

### Pattern 1: Loading with Progress

```typescript
const context = await initLlama(
  { model: '/models/model.gguf' },
  (progress) => {
    console.log(`${progress}%`);
  }
);
```

### Pattern 2: Streaming Generation

```typescript
let output = '';
await context.completion(
  { prompt: 'Hello', n_predict: 100 },
  (token) => {
    output += token.token;
    updateUI(output);
  }
);
```

### Pattern 3: Error Recovery

```typescript
try {
  // Try with GPU
  const ctx = await initLlama({
    model: '/model.gguf',
    n_gpu_layers: 24,
  });
} catch {
  // Fall back to CPU
  const ctx = await initLlama({
    model: '/model.gguf',
    n_gpu_layers: 0,
  });
}
```

---

## API Reference Table

| Method | Purpose | Platforms |
|--------|---------|-----------|
| `initLlama()` | Load model | All |
| `completion()` | Generate text | All |
| `chat()` | Chat interface | All |
| `embedding()` | Generate embeddings | All |
| `rerank()` | Rank documents | All |
| `applyLoraAdapters()` | Apply LoRA | All |
| `initMultimodal()` | Vision support | iOS, Android |
| `initVocoder()` | TTS support | iOS, Android |
| `saveSession()` | Persist state | All |
| `loadSession()` | Restore state | All |

---

## Performance Tips

1. **Use Speculative Decoding** - 2-8x speedup
2. **Enable GPU** - Set `n_gpu_layers` appropriately
3. **Quantize Models** - Use Q4_0 or Q4_1
4. **Batch Processing** - Increase `n_batch` for throughput
5. **Adjust Context** - Balance `n_ctx` with available memory

---

## Conclusion

This API reference provides all methods and examples needed to integrate LlamaCpp inference into iOS applications. For more details, refer to the complete Low-Level Design document.

