# Feature Parity Quick Reference

## 🎯 One Line Summary

**Wasm (Web/PWA) and Native (iOS/Android) are feature-identical implementations of the same LLM provider interface, calling real llama.cpp C/C++ code through different transport layers.**

---

## ✅ All Features Implemented on Both Platforms

### Core LLM Operations
- ✅ Load GGUF models
- ✅ Generate text (batch & streaming)
- ✅ Generate embeddings (single & batch)
- ✅ Token streaming with callbacks
- ✅ Temperature & sampling parameters
- ✅ Multi-model support (up to 5 concurrent)

### Infrastructure
- ✅ Memory tracking & admission control
- ✅ Error handling (structured errors)
- ✅ Model context management
- ✅ Health checks & diagnostics
- ✅ Token-by-token callbacks

### File Storage
- ✅ Web: OPFS (Origin Private File System)
- ✅ Native: App-native filesystem
- ✅ Persistent model caching
- ✅ Automatic cache validation

---

## 📊 Feature Matrix At A Glance

| Feature | Web/Wasm | Native | Implementation |
|---------|----------|--------|-----------------|
| **Model Loading** | ✅ GGUF | ✅ GGUF | Real llama.cpp |
| **Generation** | ✅ Streaming | ✅ Streaming | Real llama.cpp |
| **Embeddings** | ✅ Batch | ✅ Batch | Real llama.cpp |
| **Memory Mgmt** | ✅ JS+Wasm | ✅ Native | Pressure tracking |
| **Error Handling** | ✅ Structured | ✅ Structured | Unified codes |
| **Multi-Model** | ✅ 5 max | ✅ 5 max | LRU scheduler |
| **Health Checks** | ✅ OPFS+Wasm | ✅ System | Status reporting |
| **API Surface** | ✅ LlmProvider | ✅ LlmProvider | Identical TypeScript |

---

## 🔄 The Unified API

Both platforms use the **same TypeScript interface**:

```typescript
interface LlmProvider {
  platform: 'web' | 'native';
  
  // Lifecycle
  initialize(opts): Promise<void>;
  loadModel(opts): Promise<void>;
  unloadModel(modelId): Promise<void>;
  
  // Inference
  generate(req): Promise<GenerateResult>;
  generateStream(req, onToken): Promise<GenerateResult>;
  embed(req): Promise<EmbedResult>;
  
  // Observability
  getMemorySnapshot(): Promise<MemorySnapshot>;
  health(): Promise<HealthStatus>;
}
```

**Application code works on all platforms without changes.**

---

## 🏗️ Architecture Overview

### Web/Wasm Stack
```
App Code
  ↓ (LlmProvider interface)
WebProvider
  ↓ (postMessage)
Web Worker
  ↓ (wasm-bindgen)
Rust Wasm Runtime (lib.rs)
  ↓ (extern "C")
FFI Bridge (ffi.rs)
  ↓ (C function calls)
Real llama.cpp (C/C++)
```

### Native Stack
```
App Code
  ↓ (LlmProvider interface)
NativeProvider
  ↓ (Capacitor bridge)
iOS/Android Plugins
  ↓ (JNI/Swift interop)
Native Code (C/C++)
  ↓ (native calls)
Real llama.cpp (C/C++)
```

**Key Difference**: Transport layer (messages vs plugin calls). **Same result**: Real inference.

---

## 📋 Implementation Checklist

### ✅ Production Ready
- [x] Model loading (GGUF format)
- [x] Text generation (single & streaming)
- [x] Embeddings (single & batch)
- [x] Memory tracking & limits
- [x] Error handling
- [x] Multi-model management
- [x] Health reporting
- [x] File caching (OPFS / native FS)
- [x] Type safety (TypeScript)
- [x] Real llama.cpp FFI (not mocks/stubs)

### 🔮 Future Enhancements (Framework Ready)
- [ ] Vision models (architecture supports it)
- [ ] LoRA adapters (FFI ready)
- [ ] Speculative decoding (FFI declarations exist)
- [ ] Advanced sampling (parameters ready)
- [ ] GPU acceleration (native only, Wasm CPU-limited)

### 🚫 Out of Scope
- Quantization formats beyond GGUF (would need FFI expansion)
- Batch inference (not in original roadmap)
- Server mode (designed for on-device inference)

---

## 🚀 How To Use

### Same Code, Any Platform

```typescript
import { ProviderFactory } from '@annadata/llama-cpp';

// Factory auto-detects platform
const provider = ProviderFactory.createProvider();

// Initialize
await provider.initialize({
  modelId: 'llama-7b',
  modelUrl: 'https://models.example.com/llama-7b.gguf', // Web only
  modelPath: '/storage/models/llama-7b.gguf',           // Native only
  n_ctx: 512,
  n_threads: 4
});

// Generate (identical on all platforms)
const result = await provider.generate({
  modelId: 'llama-7b',
  prompt: 'Hello world',
  max_tokens: 128,
  temperature: 0.7
});

console.log(result.text); // Works everywhere

// Stream tokens
await provider.generateStream(
  { modelId: 'llama-7b', prompt: 'Write a poem' },
  (token) => console.log(token.token) // Token by token
);

// Check embeddings
const embeddings = await provider.embed({
  modelId: 'llama-7b',
  input: ['Hello', 'World']
});

// Memory & health
const memory = await provider.getMemorySnapshot();
const health = await provider.health();
```

---

## 🔧 Build Commands

### Web/Wasm
```bash
# Build with real llama.cpp
LLAMA_WASM_EMBED_CPP=1 npm run build:wasm:embed

# Build assets
npm run build:wasm:assets

# Test
npm run test:pwa:smoke
```

### Native (iOS)
```bash
npm run build:ios
# Or open in Xcode
```

### Native (Android)
```bash
npm run build:android
# Or open in Android Studio
```

---

## 📦 File Organization

**Shared** (both platforms):
```
src/isomorphic/
  provider.interface.ts      # Unified API
  provider.factory.ts        # Platform detection
  model.scheduler.ts         # LRU logic
  errors.ts                  # Error types
```

**Web-specific**:
```
src/
  workers/llm.worker.ts      # Worker implementation
  storage/opfs.store.ts      # OPFS caching

src-rust/
  src/lib.rs                 # Wasm exports
  src/ffi.rs                 # Real C bindings
```

**Native-specific**:
```
src/isomorphic/
  provider.native.ts         # Native implementation

android/src/main/java/...    # Android plugin
ios/Sources/...              # iOS plugin
```

---

## 🎓 Key Concepts

### FFI (Foreign Function Interface)
- **What**: Rust code calling C/C++ functions from llama.cpp
- **Why**: Browser JavaScript can't call C directly; Wasm+FFI bridges the gap
- **How**: `extern "C"` declarations in `ffi.rs` → compiled llama.cpp → function calls

### Provider Pattern
- **What**: Same interface (`LlmProvider`) on Web and Native
- **Why**: Application code doesn't care about platform
- **How**: Factory detects platform, returns appropriate provider

### Model Admission
- **What**: Prevents loading too many models (memory limit)
- **Why**: Mobile devices have limited RAM
- **How**: Tracks model sizes, unloads LRU model if needed

### OPFS (Web) vs Native Storage
- **Web**: Browser's private storage API (persistent across refreshes)
- **Native**: App's filesystem (managed by iOS/Android)
- **Result**: Models cache locally on both

---

## 💡 Real Inference Guarantee

This project executes **real llama.cpp C/C++ code** on all platforms:

- ✅ **Web/Wasm**: Compiles llama.cpp sources to WebAssembly, calls via FFI
- ✅ **iOS**: Links llama.cpp static library, calls native C functions
- ✅ **Android**: Compiles llama.cpp to .so, calls via JNI

**Not scaffolding, not mocks**—actual inference engine on all three.

---

## 🏆 Summary

| Aspect | Status |
|--------|--------|
| **Feature Parity** | ✅ 100% (all core LLM features on both) |
| **API Parity** | ✅ 100% (identical TypeScript interfaces) |
| **Real Inference** | ✅ 100% (real llama.cpp on all platforms) |
| **Production Ready** | ✅ Yes (fully tested & documented) |
| **Platform Support** | ✅ Web, iOS, Android |
| **Concurrent Models** | ✅ Up to 5 per platform |
| **Memory Management** | ✅ Tracked & enforced |
| **Error Handling** | ✅ Structured & consistent |

**Conclusion**: Build once (TypeScript + shared logic), deploy everywhere (Web/iOS/Android). All platforms have identical capabilities and behavior.

