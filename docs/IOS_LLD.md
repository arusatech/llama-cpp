# iOS Low-Level Design Document
## LlamaCpp Capacitor Plugin - iOS Platform Architecture

**Version:** 1.0.0  
**Platform:** iOS (arm64, x86_64)  
**Minimum Deployment:** iOS 13.0+  
**Author:** Annadata AI  
**Date:** July 2, 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Component Architecture](#component-architecture)
4. [TypeScript-to-Native Bridge](#typescript-to-native-bridge)
5. [Swift Plugin Implementation](#swift-plugin-implementation)
6. [C++ Core Integration](#c-core-integration)
7. [Feature Implementation Details](#feature-implementation-details)
8. [Memory Management & Optimization](#memory-management--optimization)
9. [Performance Considerations](#performance-considerations)
10. [GPU Acceleration (Metal)](#gpu-acceleration-metal)
11. [Error Handling & Debugging](#error-handling--debugging)
12. [Build & Deployment](#build--deployment)
13. [Integration Patterns](#integration-patterns)
14. [Security Considerations](#security-considerations)

---

## Executive Summary

The iOS implementation of LlamaCpp Capacitor Plugin provides offline LLM inference capabilities on Apple devices through a multi-layered architecture:

- **TypeScript API Layer**: High-level JavaScript/TypeScript interface via Capacitor framework
- **Swift Plugin Layer**: Capacitor plugin implementation bridging TypeScript to native code
- **C++ Core**: llama.cpp inference engine compiled as a dynamic framework
- **Metal Acceleration**: GPU acceleration via Apple Metal framework for supported devices

**Key Capabilities:**
- Full LLM inference (text generation, chat, embeddings)
- Multimodal processing (vision, audio)
- TTS/Vocoder integration
- LoRA adapter support
- Speculative decoding for 2-8x speedup
- Session persistence
- GPU-accelerated inference

---

## Architecture Overview

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│         TypeScript/JavaScript Application               │
│              (Capacitor Framework)                      │
├─────────────────────────────────────────────────────────┤
│              Capacitor Core Bridge                      │
│    (Plugin Registration & Message Routing)              │
├─────────────────────────────────────────────────────────┤
│          Swift Plugin Implementation                    │
│       (LlamaCppPlugin.swift - 37 Capacitor Methods)     │
├─────────────────────────────────────────────────────────┤
│     Objective-C++ Bridge Layer (cap-ios-bridge.cpp)     │
│         (Type Marshalling & FFI Conversion)             │
├─────────────────────────────────────────────────────────┤
│    C++ Core Engine (llama-cpp.framework)                │
│  - cap-llama.cpp (Context Management)                   │
│  - cap-completion.cpp (Inference Engine)                │
│  - cap-tts.cpp (Text-to-Speech)                         │
│  - cap-mtmd.hpp (Multimodal Support)                    │
├─────────────────────────────────────────────────────────┤
│   llama.cpp Foundation + GGML Backend                   │
│  - Model Loading & Tensor Operations                    │
│  - Tokenization & Sampling                              │
│  - KV Cache Management                                  │
├─────────────────────────────────────────────────────────┤
│     Apple Metal Framework Integration                   │
│          (GPU Acceleration Support)                     │
└─────────────────────────────────────────────────────────┘
```

### Build Output Structure

```
ios/
├── CMakeLists.txt              # Master CMake configuration
├── CMakeLists-arm64.txt        # ARM64-specific (real devices)
├── CMakeLists-x86_64.txt       # x86_64-specific (simulator)
├── Sources/
│   └── LlamaCppPlugin/
│       ├── LlamaCppPlugin.swift         # 37 plugin methods
│       ├── LlamaCpp.swift               # Native bridge utilities
│       ├── LlamaCppPluginExtension.swift
│       └── *.swift                      # Supporting classes
├── Frameworks/
│   └── llama-cpp.framework/     # Output: iOS dynamic framework
│       ├── llama-cpp           # Binary
│       ├── Headers/            # Public headers
│       └── Info.plist          # Framework metadata
└── build/                       # CMake build directory
```

---

## Component Architecture

### Component Dependency Graph

```
Application Layer (TypeScript)
         ↓
Capacitor Bridge (TypeScript)
         ↓
Plugin Registry (Capacitor Core)
         ↓
LlamaCppPlugin (Swift) ──────┐
         ↓                   │
Type Conversion Layer        │
(Objective-C++ Interop)      │
         ↓                   │
cap-ios-bridge.cpp           │
(JSON/Object Marshalling)────┤
         ↓                   │
C++ API Layer                │
├─ cap-llama.cpp ────────────┤
├─ cap-completion.cpp        │
├─ cap-tts.cpp               │
├─ cap-embedding.cpp         │
└─ cap-mtmd.hpp              │
         ↓                   │
llama.cpp Core ──────────────┤
├─ Model Management          │
├─ Context Management        │
├─ Inference Engine          │
└─ KV Cache                  │
         ↓                   │
GGML Backend                 │
├─ CPU Operations            │
├─ ARM64 NEON Ops            │
└─ Metal GPU Ops ────────────┘
```

---

## TypeScript-to-Native Bridge

### Plugin Registration & Message Routing

**File:** `src/index.ts`

```typescript
import { registerPlugin } from '@capacitor/core';

const LlamaCpp = registerPlugin<LlamaCppPlugin>('LlamaCpp');
```

**How it works:**

1. Capacitor's `registerPlugin` creates a JavaScript proxy object
2. Method calls on the proxy trigger the native implementation
3. Parameters are automatically serialized to JSON
4. Results are JSON-decoded and returned as Promises

### Supported Communication Patterns

**Pattern 1: Simple Request-Response**
```
TypeScript → JSON serialization → Capacitor Bridge → Swift method → C++ call → Result serialization → TypeScript
```

**Pattern 2: Streaming with Callbacks**
```
TypeScript → Setup listener → Native Event → JSON broadcast → Callback execution
```

**Supported Callback Events:**
- `@LlamaCpp_onInitContextProgress`: Model loading progress (0-100%)
- `@LlamaCpp_onToken`: Token-by-token generation stream
- `@LlamaCpp_onNativeLog`: Native logging output

---

## Swift Plugin Implementation

### Core Plugin Class: LlamaCppPlugin.swift

**Total Methods:** 37 Capacitor plugin methods

**Method Categories:**

#### 1. Context Management (6 methods)
- `toggleNativeLog({ enabled: boolean })`
- `setContextLimit({ limit: number })`
- `modelInfo({ path, skip })`
- `initContext({ contextId, params })`
- `releaseContext({ contextId })`
- `releaseAllContexts()`

#### 2. Completion & Chat (4 methods)
- `getFormattedChat({ contextId, messages, chatTemplate, params })`
- `chat({ contextId, messages, system, chatTemplate, params })`
- `chatWithSystem({ contextId, system, message, params })`
- `generateText({ contextId, prompt, params })`

#### 3. Text Generation (2 methods)
- `completion({ contextId, params })`
- `tokenize({ contextId, text, options })`

#### 4. Embeddings & Reranking (2 methods)
- `embedding({ contextId, text, params })`
- `rerank({ contextId, query, documents, params })`

#### 5. Session Management (2 methods)
- `saveSession({ contextId, filepath, size })`
- `loadSession({ contextId, filepath })`

#### 6. LoRA Adapters (3 methods)
- `applyLoraAdapters({ contextId, loraList })`
- `removeLoraAdapters({ contextId })`
- `getLoadedLoraAdapters({ contextId })`

#### 7. Multimodal Support (4 methods)
- `initMultimodal({ contextId, path, use_gpu })`
- `isMultimodalEnabled({ contextId })`
- `getMultimodalSupport({ contextId })`
- `releaseMultimodal({ contextId })`

#### 8. Text-to-Speech (6 methods)
- `initVocoder({ contextId, path, n_batch })`
- `isVocoderEnabled({ contextId })`
- `getFormattedAudioCompletion({ contextId, speaker, textToSpeak })`
- `getAudioCompletionGuideTokens({ contextId, textToSpeak })`
- `decodeAudioTokens({ contextId, tokens })`
- `releaseVocoder({ contextId })`

#### 9. Benchmarking (1 method)
- `bench({ contextId, pp, tg, pl, nr })`

#### 10. Utility Functions (2 methods)
- `detokenize({ contextId, tokens })`
- `convertJsonSchemaToGrammar({ schema })`

#### 11. Logging & Events (1 method)
- `addListener(eventName, callback)`

### Key Implementation Pattern

```swift
@objc func methodName(_ call: CAPPluginCall) {
  // 1. Parameter extraction
  guard let contextId = call.getNumber("contextId") else {
    call.reject("Missing contextId")
    return
  }
  
  // 2. Validation
  guard let context = contextManager.get(contextId) else {
    call.reject("Context not found")
    return
  }
  
  // 3. Native operation (on background thread for heavy work)
  DispatchQueue.global(qos: .userInitiated).async {
    do {
      // 4. Call C++ implementation via Objective-C++ bridge
      let result = try context.performOperation(params)
      
      // 5. Serialize result
      let jsonResult = try serializeToJSON(result)
      
      // 6. Return result to TypeScript
      call.resolve(jsonResult)
    } catch {
      call.reject("Operation failed: \(error.localizedDescription)")
    }
  }
}
```

---

## C++ Core Integration

### Cap-iOS-Bridge.cpp: FFI Conversion Layer

**Primary Functions:**

1. **JSON Parameter Parsing**
   - Accepts Capacitor JSON parameters
   - Converts to C++ native types
   - Validates parameter ranges

2. **Type Marshalling**
   - Swift Dictionary ↔ C++ std::map
   - Swift Array ↔ C++ std::vector
   - Swift String ↔ C++ std::string
   - Swift Number ↔ C++ numeric types

3. **Model Path Resolution**
   - Handles iOS app bundle paths (`file://` URLs)
   - Resolves relative paths to absolute paths
   - Validates file existence

4. **Context Registry Management**
   - Maps contextId (from TypeScript) to C++ context pointers
   - Thread-safe access via mutex

### Cap-llama.cpp: Context Management

**Responsibilities:**

- Context lifecycle: allocation, initialization, cleanup
- Model loading with progress callbacks
- Parameter validation and application
- KV cache configuration
- Draft model loading for speculative decoding

**Key Data Structure:**
```cpp
struct llama_cap_context {
  int64_t id;                          // Context ID
  llama_model* model;                  // Loaded model
  llama_context* ctx;                  // Inference context
  llama_context* draft_model_ctx;      // Speculative decoding
  common_params params;                // Configuration
  std::vector<struct llama_lora_weight> lora_weights;
  bool multimodal_enabled;
  bool vocoder_enabled;
  // ... additional fields
};
```

### Cap-completion.cpp: Inference Engine

**Core Functions:**

1. **Completion Generation**
   - Token-by-token inference loop
   - Sampling parameter application
   - Stop sequence detection
   - Streaming callbacks

2. **Speculative Decoding**
   - Draft token generation
   - Verification via main model
   - Automatic fallback if draft fails

3. **Chat Template Formatting**
   - Jinja template support
   - Legacy llama-chat format
   - Tool/function call parsing
   - Reasoning content extraction

4. **Grammar-Based Sampling**
   - GBNF grammar parsing
   - Token filtering during generation
   - JSON schema to grammar conversion
   - Lazy grammar evaluation

### Cap-tts.cpp: Text-to-Speech

**Features:**

- Vocoder model integration
- Audio token generation
- Speaker configuration
- Guide token support

### Cap-mtmd.hpp: Multimodal Processing

**Vision Processing:**
- Image tokenization via CLIP
- Image embedding extraction
- Integration with chat context

**Audio Processing:**
- Audio feature extraction
- Audio token generation
- Integr ation with completion

---

## Feature Implementation Details

### Feature 1: Text Generation

**Flow:**
```
1. TypeScript: completion({ contextId, params })
2. Swift: Extract parameters, call C++ method
3. C++: Apply sampling, run inference loop
4. C++: Stream tokens via callback
5. Swift: Emit `@LlamaCpp_onToken` events
6. TypeScript: Receive streamed tokens
```

**Supported Sampling Methods:**
- Top-K, Top-P, Temperature
- Typical Sampling
- Mirostat (v1, v2)
- DRY (Don't Repeat Yourself)
- XTC (eXtra Token Cuts)
- Min-P
- Repetition/Frequency/Presence penalties

### Feature 2: Speculative Decoding (Mobile Optimization)

**How it Works:**
```
1. Load draft model (small, fast)
2. For each position:
   a. Draft model generates N tokens speculatively
   b. Main model verifies draft tokens
   c. If accepted: use all N tokens at once
   d. If rejected at position i: use tokens 0..i-1, reset draft
3. Result: 2-8x speedup with identical output
```

**Mobile Optimizations:**
- Smaller draft models (1-1.5B vs 7B main)
- Reduced speculative samples (3 typical)
- Dynamic fallback if draft fails
- Memory-efficient batching

### Feature 3: Chat with Tool Calling

**Supports:**
- OpenAI-compatible message format
- Tool/function definitions
- Parallel tool calling
- Tool response injection
- Thinking/Reasoning modes

**Chat Template Compatibility:**
- Llama-Chat (legacy)
- Jinja (minja) for modern models
- Custom templates

### Feature 4: LoRA Adapter Integration

**Operation:**
```cpp
llama_lora_load(model, adapter_path, scale);
llama_lora_context_apply(ctx, lora_weights);
```

**Supported:**
- Single or multiple adapters
- Per-adapter scaling
- Dynamic loading/unloading

### Feature 5: Session Persistence

**Serialize to Disk:**
```cpp
// Save KV cache + completed tokens to file
llama_session_save(ctx, filepath);
// Returns: number of tokens saved
```

**Load from Disk:**
```cpp
// Restore KV cache + token state
llama_session_load(ctx, filepath);
// Returns: NativeSessionLoadResult with token count
```

---

## Memory Management & Optimization

### Memory Allocation Strategy

**Model Loading:**
- Memory-mapped file support (use_mmap = true)
- Lock-in-memory option (use_mlock = false for mobile)
- Quantization for smaller footprint
- GPU layer offloading (n_gpu_layers parameter)

**KV Cache Management:**
- Configurable cache types: f16, f32, q8_0, q4_0, etc.
- Unified vs. per-sequence cache
- SWA (Sliding Window Attention) support
- Context shifting for overflow handling

### GPU Memory Optimization

**Metal Framework Integration:**
- Automatic device detection
- Memory bandwidth estimation
- Adaptive layer offloading
- Fallback to CPU if needed

**Parameters:**
- `n_gpu_layers`: Number of model layers to load in VRAM (0-33 typical)
- `no_gpu_devices`: Force CPU-only mode
- `flash_attn`: Experimental flash attention

### Lifecycle Management

```
┌─────────────────────┐
│  Model File on Disk │
│   (.gguf format)    │
└──────────┬──────────┘
           │ Load
           ▼
┌─────────────────────────────────────┐
│   Loaded Model in System Memory     │
│  (Memory-mapped if mmap enabled)    │
│   (GPU layers in VRAM if Metal)     │
└──────────┬──────────────────────────┘
           │ Create Context
           ▼
┌─────────────────────────────────────┐
│    Inference Context                │
│  - KV Cache (allocated)             │
│  - Tokenizer state                  │
│  - LoRA weights                     │
└──────────┬──────────────────────────┘
           │ Generation
           ├──► Emit tokens
           └──► Save session
           │
           ▼
      Release
      Context
```

---

## Performance Considerations

### Threading Model

**Main Thread:**
- Plugin method entry/exit
- Capacitor message handling
- UI state updates

**Background Threads (GCD):**
- Model loading (heavy I/O)
- Context initialization
- Inference loops
- Sampling operations

### Optimization Techniques

1. **Batch Processing**
   - Process multiple tokens per iteration when possible
   - Reduce context switch overhead

2. **KV Cache Optimization**
   - Unified cache for sequences sharing prefix
   - Per-sequence cache when diverging
   - Token reduction for long context

3. **Sampling Efficiency**
   - Cache logit bias lookups
   - Pre-compute token probabilities for Top-K/Top-P

4. **I/O Optimization**
   - Asynchronous model loading
   - Stream progress callbacks
   - Non-blocking session save/load

### Benchmark Metrics

**Typical Performance (7B model, iPhone 15 Pro):**
- Prompt processing: 30-50 tokens/sec
- Token generation: 5-15 tokens/sec
- With speculative decoding: 10-30 tokens/sec
- Memory usage: 4-8 GB for 7B quantized model

---

## GPU Acceleration (Metal)

### Metal Framework Integration

**Automatic Detection:**
```swift
// Metal GPU automatically detected on supported devices
// Managed via GGML Metal backend
```

**Supported Devices:**
- iPhone 11 and newer (2x-4x speedup)
- iPad Pro (2020+) (3x-5x speedup)
- Mac with Apple Silicon (5x-10x speedup)

### Configuration

```typescript
// Example: GPU acceleration setup
const context = await initContext({
  contextId: 1,
  params: {
    model: "/models/llama-2-7b.gguf",
    n_gpu_layers: 24,          // GPU layers (GPU layer 24+ stays on GPU)
    n_threads: 6,               // CPU threads for offloaded ops
    use_mmap: true,            // Memory mapping
    use_mlock: false,          // Don't lock in memory
  }
});
```

### Memory Model

```
GPU Memory:
  Layer 1-24: Model weights (GPU compute)
  
CPU Memory:
  Remaining layers: Model weights (CPU fallback)
  KV Cache: Allocated in system memory (can use Metal if supported)
  
  Unified Memory Architecture (Apple Silicon):
    - Automatic coherency management
    - Efficient data sharing GPU ↔ CPU
```

---

## Error Handling & Debugging

### Error Categories

**1. Initialization Errors**
- Model file not found
- Invalid model format
- Insufficient memory
- GPU unavailable

**2. Runtime Errors**
- Context not found
- Invalid parameters
- Generation interrupted
- File I/O errors

**3. Recovery Strategies**
```swift
do {
  try performOperation()
} catch LlamaError.contextNotFound {
  // Gracefully handle missing context
} catch LlamaError.outOfMemory {
  // Suggest model unloading or quantization
} catch LlamaError.gpuNotAvailable {
  // Fall back to CPU-only inference
} catch {
  // Generic error handling
}
```

### Native Logging

**Enable Logging:**
```typescript
await toggleNativeLog(true);

// Listen for log events
const listener = addNativeLogListener((level, text) => {
  console.log(`[${level}] ${text}`);
});

// Stop listening
listener.remove();
```

**Log Levels:**
- `INFO`: General information
- `WARN`: Warnings (non-fatal)
- `ERROR`: Errors (operations failed)
- `DEBUG`: Detailed debug output

---

## Build & Deployment

### Build Process

**Step 1: CMake Configuration**
```bash
cd ios
cmake -B build -S . \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_OSX_SYSROOT=iphoneos \
  -DCMAKE_OSX_ARCHITECTURES="arm64" \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=13.0
```

**Step 2: Framework Compilation**
```bash
cmake --build build --config Release -j$(sysctl -n hw.ncpu)
```

**Step 3: Framework Output**
```
ios/build/llama-cpp.framework/
  ├── llama-cpp          # Binary
  ├── Headers/           # Public headers
  └── Info.plist         # Metadata
```

**Step 4: Package for Distribution**
```bash
# Flat framework for npm publishing
mkdir -p ios/Frameworks/llama-cpp.framework/Resources
cp ios/build/llama-cpp.framework/llama-cpp ios/Frameworks/llama-cpp.framework/
```

### Xcode Integration

**Framework Linking:**
1. Add `llama-cpp.framework` to target's Frameworks & Libraries
2. Set Framework Search Paths
3. Ensure Code Signing Identity is set
4. Verify bitcode disabled (`ENABLE_BITCODE=NO`)

### App Store Submission

**Requirements:**
- ARM64 architecture only
- Bitcode disabled
- Proper code signing
- Privacy manifest (for SDK disclosure)

**Size Considerations:**
- Typical framework size: 40-80 MB (depends on features compiled)
- Quantized model: 3-5 GB downloaded separately (not in app bundle)

---

## Integration Patterns

### Pattern 1: Simple Text Generation

```typescript
import { initContext, LlamaContext } from 'llama-cpp-capacitor';

const context = await initContext({
  contextId: 1,
  params: {
    model: "/path/to/model.gguf",
    n_ctx: 2048,
    n_gpu_layers: 20,
  }
});

const result = await context.completion({
  prompt: "Hello, write a story:",
  n_predict: 200,
  temperature: 0.8,
});

console.log(result.text);
```

### Pattern 2: Streaming with Callbacks

```typescript
let fullText = '';

const result = await context.completion(
  {
    prompt: "Write a poem:",
    n_predict: 100,
  },
  (tokenData) => {
    // Called for each token
    fullText += tokenData.token;
    updateUI(fullText);
  }
);
```

### Pattern 3: Speculative Decoding (2-8x speedup)

```typescript
const context = await initContext({
  contextId: 1,
  params: {
    model: "/models/llama-2-7b.gguf",
    draft_model: "/models/tinyllama-1b.gguf",
    speculative_samples: 3,
    mobile_speculative: true,
  }
});

// Use normally - speculative decoding is automatic
const result = await context.completion({
  prompt: "Write a story:",
  n_predict: 200,
});
```

### Pattern 4: Multimodal (Vision)

```typescript
await context.initMultimodal({
  path: "/path/to/mmproj.gguf",
  use_gpu: true,
});

const result = await context.completion({
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What's in this image?" },
        { type: "image_url", image_url: { url: "file:///path/to/image.jpg" } }
      ]
    }
  ],
  n_predict: 100,
});
```

### Pattern 5: Session Persistence

```typescript
// Save current state
const tokensCount = await context.saveSession("/tmp/session.bin");

// ... later ...

// Restore state
await context.loadSession("/tmp/session.bin");
// Continue generation from where we left off
```

---

## Security Considerations

### File Access Security

**Restricted Paths:**
- Models must be in app's Documents or Caches directory
- System paths (/System, /private) are not accessible
- Temporary files should use standard temp directory

**URL Scheme Handling:**
```typescript
// Properly handle file:// URLs
let path = filepath;
if (path.startsWith('file://')) {
  path = path.slice(7);  // Remove file:// prefix
}
```

### Memory Safety

**Bounds Checking:**
- All array accesses validated
- String buffers properly sized
- Integer overflow protection in calculations

**Buffer Overflow Prevention:**
- Fixed-size arrays with bounds enforcement
- std::string for dynamic string handling
- Sanitizer builds during development

### Model Security

**Model Validation:**
- GGUF format signature verification
- Model hash checking (optional)
- Sandboxed model loading

**Untrusted Model Handling:**
```cpp
// Validate model before loading
if (!llama_model_is_valid_gguf(path)) {
  throw std::runtime_error("Invalid model file");
}
```

---

## Advanced Topics

### Custom Chat Templates

```typescript
// Override default template
const result = await context.completion({
  messages: [...],
  chatTemplate: `[INST] {{prompt}} [/INST]`,
  n_predict: 100,
});
```

### Grammar-Constrained Generation

```typescript
// Generate structured JSON
const grammar = `
root ::= object
object ::= "{" "name" ":" string "," "age" ":" number "}"
string ::= "\\"" [a-z]+ "\\""
number ::= [0-9]+
`;

const result = await context.completion({
  prompt: "Generate a person:",
  grammar: grammar,
  n_predict: 100,
});
```

### Reranking for Retrieval Augmented Generation

```typescript
const documents = ["Document 1", "Document 2", "Document 3"];
const query = "relevant topic";

const ranked = await context.rerank(query, documents);
// Returns documents sorted by relevance score
```

---

## Troubleshooting

### Common Issues

**Issue: "Model not found"**
- Ensure model path is absolute or correctly resolved
- Check file permissions
- Verify model file integrity

**Issue: "Out of memory"**
- Use a smaller or quantized model
- Reduce `n_ctx` size
- Decrease `n_batch` parameter
- Use speculative decoding for better efficiency

**Issue: "GPU not available"**
- Fall back to CPU inference
- Check device compatibility
- Verify Metal drivers loaded

**Issue: Slow inference**
- Enable GPU acceleration (n_gpu_layers > 0)
- Use speculative decoding
- Reduce context size
- Optimize batch size

### Debug Checklist

```typescript
// Enable logging
await toggleNativeLog(true);

// Check GPU availability
const context = await initContext({...});
console.log(`GPU available: ${context.gpu}`);
console.log(`Reason if no GPU: ${context.reasonNoGPU}`);

// Monitor model info
const info = await modelInfo({ path: "/models/model.gguf" });
console.log(`Model: ${info.general.name}`);
console.log(`Parameters: ${info.parameters.vocab_size}`);
```

---

## Performance Tuning Guide

### For Maximum Speed

```typescript
const context = await initContext({
  contextId: 1,
  params: {
    model: "/path/to/model.gguf",
    n_ctx: 512,                    // Small context
    n_batch: 128,                  // Larger batch
    n_threads: 6,                  // All available cores
    n_gpu_layers: 33,              // Maximum GPU
    draft_model: "/path/draft.gguf", // Speculative decoding
    speculative_samples: 5,
  }
});
```

### For Maximum Accuracy

```typescript
const context = await initContext({
  contextId: 1,
  params: {
    model: "/path/to/model.gguf",
    n_ctx: 4096,                   // Large context
    n_batch: 32,                   // Conservative batch
    cache_type_k: "f16",           // High precision cache
    cache_type_v: "f16",
  }
});
```

### For Battery Efficiency (Mobile)

```typescript
const context = await initContext({
  contextId: 1,
  params: {
    model: "/path/to/model.q4_k_m.gguf", // Quantized
    draft_model: "/path/draft.q4_0.gguf",
    n_ctx: 1024,
    n_threads: 3,                  // Conservative threading
    n_gpu_layers: 20,              // Balanced GPU usage
    speculative_samples: 3,
    mobile_speculative: true,
    use_mmap: true,
    use_mlock: false,              // Don't lock memory
  }
});
```

---

## API Reference Summary

### Core Methods (37 total)

**Context Management:** 6 methods
**Completion & Chat:** 4 methods
**Text Generation:** 2 methods
**Embeddings & Reranking:** 2 methods
**Session Management:** 2 methods
**LoRA Adapters:** 3 methods
**Multimodal:** 4 methods
**TTS:** 6 methods
**Benchmarking:** 1 method
**Utilities:** 2 methods
**Event Handling:** 1 method

### Key Parameters

**Sampling:**
- `temperature`: 0.1-2.0 (default 0.8)
- `top_k`: 1-100 (default 40)
- `top_p`: 0.0-1.0 (default 0.95)
- `min_p`: 0.0-0.3 (default 0.05)

**Generation:**
- `n_predict`: 1-unlimited (default 128)
- `n_threads`: 1-CPU_COUNT (default 4)
- `n_gpu_layers`: 0-33 (default 0)

**Model:**
- `n_ctx`: 128-32768 (default 2048)
- `n_batch`: 1-1024 (default 512)
- `n_threads`: Threading count (default 4)

---

## Maintenance & Updates

### Updating llama.cpp Library

Use the bootstrap script to pull upstream llama.cpp updates:

```bash
./scripts/bootstrap.sh master  # or specific branch/tag
```

This preserves Capacitor-specific files (cap-*.cpp/h) while syncing upstream code.

### Testing

**Run Unit Tests:**
```bash
npm run test
```

**Run Integration Tests:**
```bash
npm run test:integration
```

**Verify iOS Build:**
```bash
npm run verify:ios
```

---

## Conclusion

The iOS implementation of LlamaCpp Capacitor Plugin provides a complete, optimized solution for offline LLM inference on Apple devices. Through careful architectural design, efficient native integration, and comprehensive feature support, it enables powerful AI capabilities on mobile and tablet platforms.

