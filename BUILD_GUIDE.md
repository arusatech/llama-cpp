# Build Guide — llama-cpp-pro 0.2.1

Complete build documentation for all four platforms: iOS, Android, Web/PWA, and Desktop (Electron).

---

## Table of Contents

- [Quick Start](#quick-start)
- [Platform Architecture](#platform-architecture)
- [iOS Build](#ios-build)
- [Android Build](#android-build)
- [Web / PWA Build](#web--pwa-build)
- [Desktop Build](#desktop-build)
- [Full Cross-Platform Build](#full-cross-platform-build)
- [Size Optimization](#size-optimization)
- [Release Workflow](#release-workflow)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# Build all platforms in one command (recommended for npm release)
./build-variants.sh --variant minimal

# Electron / desktop sidecar (Metal on macOS by default)
./build-variants.sh --variant desktop

# Or step-by-step
npm run clean:all
npm run build              # TypeScript
npm run build:native       # iOS + Android
npm run build:pwa          # Web/WASM + worker
npm run verify:pack:artifacts
npm pack --ignore-scripts  # Creates llama-cpp-pro-0.2.1.tgz
```

---

## Platform Architecture

```
llama-cpp-pro
├── iOS  ──────────────► llama-cpp.framework (Metal + CPU)
│                           └── cap-ios-bridge.cpp (C ABI)
│                           └── LlamaCpp.swift (Swift wrapper)
│                           └── LlamaNativeBridge.swift (dlsym loader)
│
├── Android ──────────► libllama-cpp-arm64.so (JNI)
│                           └── jni.cpp (core)
│                           └── jni-lora.cpp
│                           └── jni-multimodal.cpp
│                           └── jni-tts.cpp
│                           └── LlamaCpp.java (Java bridge)
│
├── Web/PWA ──────────► llama_engine_emscripten.wasm (Emscripten + Rust FFI)
│                           └── llm.worker.js (Web Worker)
│                           └── WebProvider (TypeScript scheduler)
│
└── Desktop ──────────► sidecar binary (native GPU)
                            └── LlamaCppDesktop.ts (IPC bridge)
                            └── WASM fallback (inherits Web)
```

All four share the same TypeScript API in `src/definitions.ts`. The full [Feature Coverage Matrix](README.md#-full-api-feature-coverage-matrix) documents which native call backs each method.

---

## iOS Build

### Prerequisites

- macOS ≥ 13 Ventura
- Xcode ≥ 15 (`xcode-select --install`)
- CMake ≥ 3.16 (`brew install cmake`)

### Build device framework (arm64)

```bash
cd ios
cmake -B build -S . \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_OSX_ARCHITECTURES=arm64 \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0
cmake --build build --config Release -j$(sysctl -n hw.ncpu)

# Copy to Frameworks/
cp -R build/llama-cpp.framework ../ios/Frameworks/
```

### Build XCFramework (device + simulator)

Needed for Xcode Simulator support:

```bash
# From repo root
bash scripts/ensure-llama-ios-xcframework.sh
npx cap sync ios
```

### Rebuild from a Capacitor app

```bash
bash node_modules/llama-cpp-pro/scripts/ensure-llama-ios-xcframework.sh
npx cap sync ios
```

### C API surface

All public symbols are declared in `cpp/cap-ios-bridge.h`. Swift loads them at runtime via `dlopen` + `dlsym` (`LlamaNativeBridge.swift`). The full list:

| Symbol | Description |
|--------|-------------|
| `llama_init_context` | Load GGUF, return context ID |
| `llama_release_context` | Free context |
| `llama_run_completion` | Inference (returns heap-allocated JSON) |
| `llama_free_completion_result` | Free result from above |
| `llama_run_embedding_json` | Embedding vector |
| `llama_stop_completion` | Interrupt ongoing inference |
| `llama_get_formatted_chat` | Jinja/llama-chat format |
| `llama_rerank_json` | Document reranking |
| `llama_bench` | pp/tg benchmark |
| `llama_load_session_file` | Restore KV-cache from file |
| `llama_save_session_file` | Persist KV-cache to file |
| `llama_apply_lora_adapters` | Apply LoRA adapters (JSON array) |
| `llama_remove_lora_adapters` | Remove all LoRA adapters |
| `llama_get_loaded_lora_adapters` | List loaded adapters |
| `llama_init_multimodal` | Load mmproj for vision/audio |
| `llama_is_multimodal_enabled` | Check multimodal state |
| `llama_get_multimodal_support` | `{vision, audio}` capabilities |
| `llama_release_multimodal` | Free multimodal resources |
| `llama_init_vocoder` | Load TTS vocoder |
| `llama_is_vocoder_enabled` | Check vocoder state |
| `llama_get_formatted_audio_completion` | TTS prompt format |
| `llama_get_audio_completion_guide_tokens` | TTS guide tokens |
| `llama_decode_audio_tokens` | Decode TTS tokens to PCM |
| `llama_release_vocoder` | Free vocoder |
| `llama_get_context_gpu_info` | `{gpu, reasonNoGPU}` |
| `cap_llama_server_start/stop/is_running` | In-process HTTP server |
| `llama_toggle_native_log` | Enable/disable C++ logging |
| `llama_model_info` | GGUF file metadata |
| `llama_cap_tokenize` | Tokenize text |
| `llama_cap_detokenize` | Tokens → text |
| `llama_convert_json_schema_to_grammar` | JSON schema → GBNF |
| `llama_embedding_register/unregister_context` | Embedding context registration |

### Adding a new iOS native method

1. Declare in `cpp/cap-ios-bridge.h`
2. Implement in `cpp/cap-ios-bridge.cpp` — add an ABI alias at the bottom of the file
3. Add `typealias` + `trySymOpt` call in `LlamaNativeBridge.swift`
4. Add public method in `LlamaCpp.swift` with `DispatchQueue.global` dispatch
5. Add `CAPPluginMethod` entry in `LlamaCppPlugin.swift`
6. Rebuild: `cmake --build ios/build --config Release`

---

## Android Build

### Prerequisites

- Android Studio ≥ Flamingo
- Android NDK r26+ (`$ANDROID_NDK_HOME`)
- JDK 17
- CMake ≥ 3.16

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk          # macOS
export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/$(ls $ANDROID_HOME/ndk | sort -V | tail -1)
```

### Build via Gradle (recommended)

```bash
cd android
./gradlew assembleRelease
# Output: build/outputs/aar/android-release.aar
# .so:   src/main/jniLibs/arm64-v8a/libllama-cpp-arm64.so
```

### Build via CMake directly

```bash
cmake -B android/build -S android/src/main \
  -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK_HOME/build/cmake/android.toolchain.cmake \
  -DANDROID_ABI=arm64-v8a \
  -DANDROID_PLATFORM=android-26 \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_CXX_FLAGS="-O3"
cmake --build android/build -j$(nproc)
```

### JNI source map

```
android/src/main/
├── jni.cpp              ← initContext, completion, tokenize, embed, rerank, bench, sessions
├── jni-lora.cpp         ← LoRA adapter methods (_impl variants)
├── jni-multimodal.cpp   ← multimodal methods (_impl variants)
├── jni-tts.cpp          ← TTS/vocoder methods
├── jni-utils.h          ← JNI helper utilities (string conversions, etc.)
├── jni-chat-session.cpp ← Chat/session helper stubs
└── CMakeLists.txt       ← Build configuration
```

### Native method declarations (LlamaCpp.java)

Every native method is declared as `private native` in `LlamaCpp.java`. The Java → JNI wiring:

```java
// Session management
private native Map<String, Object> loadSessionNative(long contextId, String filepath);
private native int saveSessionNative(long contextId, String filepath, int size);

// Rerank (calls completion::rerank() via JNI — not Math.random())
private native List<Map<String, Object>> rerankNative(long contextId, String query, String[] docs, JSObject params);

// Bench (calls completion::bench() via JNI)
private native String benchNative(long contextId, int pp, int tg, int pl, int nr);

// LoRA
private native int applyLoraAdaptersNative(long contextId, Object[] loraAdapters);
private native void removeLoraAdaptersNative(long contextId);
private native List<Map<String, Object>> getLoadedLoraAdaptersNative(long contextId);

// Multimodal
private native boolean initMultimodalNative(long contextId, String mmProjPath, boolean useGpu);
private native boolean isMultimodalEnabledNative(long contextId);
private native Map<String, Object> getMultimodalSupportNative(long contextId);
private native void releaseMultimodalNative(long contextId);

// TTS/Vocoder
private native boolean initVocoderNative(long contextId, String path, int nBatch);
private native boolean isVocoderEnabledNative(long contextId);
private native Map<String, Object> getFormattedAudioCompletionNative(long contextId, String speaker, String text);
private native List<Integer> getAudioCompletionGuideTokensNative(long contextId, String text);
private native List<Float> decodeAudioTokensNative(long contextId, int[] tokens);
private native void releaseVocoderNative(long contextId);
```

### Adding a new Android JNI method

1. Declare `private native ReturnType methodNative(...)` in `LlamaCpp.java`
2. Implement `JNIEXPORT ... JNICALL Java_ai_annadata_plugin_capacitor_LlamaCpp_methodNative(...)` in `jni.cpp` or a new `jni-<feature>.cpp`
3. Add the Java calling method (delegates to `methodNative`)
4. Add `@PluginMethod` in `LlamaCppPlugin.java`
5. Rebuild: `cd android && ./gradlew assembleRelease`

---

## Web / PWA Build

### Prerequisites

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-emscripten

# Emscripten
brew install emscripten      # macOS
# OR follow https://emscripten.org/docs/getting_started/downloads.html

# wasm-bindgen
cargo install wasm-bindgen-cli

# Verify
emcc --version    # ≥ 3.1.50
rustc --version   # ≥ 1.75
wasm-bindgen --version
```

### Build commands

```bash
# Recommended: single-threaded WASM (no COOP/COEP needed)
npm run build:pwa
# equivalent to:
npm run build:wasm        # WASM binary
npm run build:worker      # Web Worker bundle
npm run build:wasm:assets # Copy to dist/

# Multi-threaded (requires COOP/COEP server headers)
npm run build:pwa:full
# equivalent to:
npm run build:wasm:pthreads
npm run build:worker
npm run build:wasm:assets
```

### Environment flags

| Variable | Default | Purpose |
|----------|---------|---------|
| `LLAMA_WASM_JSPI` | `1` | Enable JSPI async (recommended) |
| `LLAMA_WASM_PTHREAD` | `0` | Multi-threading (requires COOP/COEP) |
| `LLAMA_WASM_EMBED_CPP` | `0` | Embed full C++ sources into WASM |

### WASM output

```
dist/wasm/
├── llama_engine.js                 ← wasm-bindgen JS glue (side module)
├── llama_engine.wasm               ← Rust SIDE_MODULE
├── llama_engine_emscripten.mjs     ← ESM entry point (full C++ embedded)
├── llama_engine_emscripten.wasm    ← Emscripten MAIN_MODULE
└── package.json

dist/workers/
└── llm.worker.js                   ← Web Worker (imports llama_engine_emscripten.mjs)
```

### Model storage (OPFS)

```typescript
// Download and cache a GGUF model to OPFS
import { LlamaCpp } from 'llama-cpp-pro';

await LlamaCpp.downloadModel({
  url: 'https://huggingface.co/.../model.gguf',
  filename: 'model.gguf'
});

// Track progress
const progress = await LlamaCpp.getDownloadProgress({ url: '...' });
console.log(progress.downloadedBytes, '/', progress.totalBytes);

// Cancel if needed
await LlamaCpp.cancelDownload({ url: '...' });
```

### Jinja template support

`getFormattedChat` first tries the WebProvider's native Jinja path. If unavailable, it falls back to these client-side formatters:

| Template name | Models |
|---------------|--------|
| `chatml` (default) | Qwen, Phi, Hermes, OpenChat |
| `llama3` / `llama-3` | Meta Llama 3.x |
| `mistral` | Mistral 7B / Mixtral |
| `gemma` / `gemma2` | Google Gemma |

To use the model's embedded template, the WASM build must expose a `getFormattedChat` symbol — this is enabled with `LLAMA_WASM_EMBED_CPP=1`.

### PWA server headers

Required for the pthread build only:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Not required for single-threaded WASM (default).

---

## Desktop Build

### Architecture

```
Electron renderer  ←→  IPC bridge  ←→  Native sidecar process
                                         ├── llama.cpp (C++)
                                         └── HTTP API (/v1/chat/completions)
         ↓ (fallback if sidecar unavailable)
       WASM worker (same as PWA)
```

### Prerequisites

**All desktop hosts**

- CMake ≥ 3.20
- Node.js 18+ (for `stage:desktop` / verify scripts)

**macOS**

- Xcode / Metal toolchain (default backends: `metal` / `metal-coreml`)
- No Vulkan SDK, OpenBLAS, or upstream `llama.cpp` checkout required for the default Mac sidecar

**Windows / Linux (Vulkan + OpenBLAS release path)**

These must be installed **outside** this repo and pointed at via env vars:

| Dependency | Purpose | Env |
|------------|---------|-----|
| **Vulkan SDK** | Headers/libs + `glslc` for `ggml-vulkan` plugin | `VULKAN_SDK` |
| **OpenBLAS** | Faster CPU BLAS path linked into the sidecar | `OPENBLAS_ROOT` |
| **Upstream [llama.cpp](https://github.com/ggerganov/llama.cpp)** | Separate clone used to build GPU backend DLLs/SOs (`ggml-vulkan`, etc.) | `LLAMA_CPP_UPSTREAM` |

```bash
# Clone upstream once (sibling of llama-cpp-pro is fine)
git clone https://github.com/ggerganov/llama.cpp.git ../llama.cpp

export VULKAN_SDK=/path/to/VulkanSDK
export OPENBLAS_ROOT=/path/to/OpenBLAS
export LLAMA_CPP_UPSTREAM=/absolute/path/to/llama.cpp
```

PowerShell (Windows):

```powershell
$env:VULKAN_SDK = "C:\VulkanSDK\1.4.350.0"
$env:OPENBLAS_ROOT = "C:\OpenBLAS"
$env:LLAMA_CPP_UPSTREAM = "C:\Users\arusa\Project\llama.cpp"
```

Optional / alternate backends:

- CUDA Toolkit → `cuda` variant
- AMD ROCm → `rocm` variant
- CPU-only smoke builds → `cpu` (skips Vulkan plugin)

Generated libraries are copied into **this** package (`extraResources/sidecar/` and `ggml-plugins/…`) by `npm run stage:desktop` so Electron apps and npm consumers do not need those external trees at runtime.


### Build sidecar

```bash
# Auto-detect host (recommended)
./scripts/build-sidecar.sh

# Specific variants
./scripts/build-sidecar.sh metal-coreml     # macOS Metal + CoreML
./scripts/build-sidecar.sh vulkan-openblas  # Linux/Windows Vulkan
./scripts/build-sidecar.sh cuda            # NVIDIA CUDA
./scripts/build-sidecar.sh rocm            # AMD ROCm
./scripts/build-sidecar.sh cpu             # CPU only

# npm scripts
npm run build:sidecar             # auto-detect
npm run build:sidecar:metal       # macOS
npm run build:sidecar:linux       # Linux Vulkan
npm run build:sidecar:win         # Windows Vulkan
npm run build:sidecar:vulkan      # Vulkan + OpenBLAS
npm run build:sidecar:intel       # Intel via Vulkan (alias)
npm run build:sidecar:cuda        # CUDA
npm run build:sidecar:rocm        # ROCm
npm run build:sidecar:cpu         # CPU
```

### Build via build-variants.sh (recommended for Electron)

```bash
# Mac Electron (auto Metal / metal-coreml on arm64)
./build-variants.sh --variant desktop

# Fast sidecar-only rebuild while iterating on the Electron app
./build-variants.sh --variant desktop-only

# Explicit backends
./build-variants.sh --variant desktop --desktop-backend metal-coreml
./build-variants.sh --variant desktop --desktop-backend cuda
./build-variants.sh --variant desktop --desktop-backend vulkan
./build-variants.sh --variant desktop --desktop-backend intel   # → vulkan
./build-variants.sh --variant desktop --desktop-backend rocm

# Universal Mac (arm64 + x64 sidecars)
./build-variants.sh --variant desktop --desktop-arch=universal
# or:
npm run build:sidecar:universal && npm run stage:desktop
npm run verify:desktop:bundle -- --arch=universal

# Add desktop sidecar onto another variant
./build-variants.sh --variant full --with-desktop --desktop-backend vulkan
```

`intel` is an alias for `vulkan` (Intel Arc / iGPU). A dedicated SYCL/oneAPI backend is not wired yet. CUDA and ROCm sidecars must be built on Linux/Windows hosts with the toolkit installed; set `LLAMA_CPP_UPSTREAM=/path/to/llama.cpp` when building ggml GPU plugins.

### Stage for packaging

```bash
# Copies sidecar binary + OpenBLAS/Vulkan runtime libs + WASM assets into extraResources/
npm run stage:desktop
# Full desktop convenience target:
npm run build:desktop
# equivalent (via variants script on macOS):
./build-variants.sh --variant desktop
```

Staged layout (shipped with the npm package):

```text
extraResources/sidecar/
  darwin-arm64 | darwin-x64 | linux-x64 | win32-x64.exe
  libopenblas.dll                    # Windows, when OpenBLAS was linked
  ggml-plugins/<platform>-<arch>/    # e.g. win32-x64/ggml-vulkan.dll
extraResources/llama-wasm/           # from PWA/WASM build
```

Verify before packaging:

```bash
npm run verify:desktop:bundle -- --arch=universal          # macOS
npm run verify:desktop:bundle -- --platform=win32          # Windows
npm run verify:desktop:bundle -- --platform=linux          # Linux
```

### Electron integration (3 files to add)

**Main process:**

```javascript
// main.js
const { registerLlamaDesktopIpc } = require('llama-cpp-pro/desktop');
registerLlamaDesktopIpc({ ipcMain, app });
```

**Preload script:**

```javascript
// preload.js
require('llama-cpp-pro/desktop/preload')(contextBridge, ipcRenderer);
```

**electron-builder config:**

```javascript
// electron-builder.config.js
const llama = require('llama-cpp-pro/desktop/electron-builder');
module.exports = llama.merge({
  appId: 'com.yourapp.id',
  productName: 'My App',
});
```

### GPU support on Desktop

The `LlamaCppDesktop` class reports GPU usage from the sidecar's `gpuEnabled` field:

```typescript
const ctx = await LlamaCpp.initContext({
  contextId: 0,
  params: {
    model: '/path/to/model.gguf',
    n_gpu_layers: 99,   // offload all layers to GPU
  }
});
console.log(ctx.gpu);          // true if Metal/CUDA/ROCm active
console.log(ctx.reasonNoGPU);  // "" if GPU active, reason string if CPU fallback
```

---

## Full Cross-Platform Build

Build all platforms in sequence:

```bash
# 1. Clean
npm run clean:all

# 2. TypeScript
npm run build

# 3. iOS (macOS only)
npm run build:native
# OR individually:
# bash scripts/ensure-llama-ios-xcframework.sh   # device + simulator
# cmake -B ios/build -S ios && cmake --build ios/build --config Release

# 4. Android
cd android && ./gradlew assembleRelease && cd ..

# 5. Web/WASM
npm run build:pwa

# 6. Desktop sidecar (optional — needed for Electron apps)
npm run build:sidecar
npm run stage:desktop

# 7. Verify all artifacts
npm run verify:pack:artifacts

# 8. Package
npm pack --ignore-scripts
```

---

## Size Optimization

### Stripping debug symbols

Default for all non-development builds. Controlled by `STRIP_SYMBOLS`:

```bash
STRIP_SYMBOLS=true ./build-variants.sh --variant minimal   # default
STRIP_SYMBOLS=false ./build-variants.sh --variant development
```

**Impact:**
```
Android .so:       48 MB → 15–16 MB  (saves ~32 MB)
iOS framework:      5 MB → 3–4 MB    (saves ~1.5 MB)
```

### Architecture targeting

| Target | Included ABIs |
|--------|--------------|
| `minimal` / `core` | `arm64-v8a` only (covers >95 % of devices) |
| `development` | `arm64-v8a` + `x86_64` (adds emulator support) |

### Excluding C++ sources

```json
// Minimal: no cpp/ directory → saves ~13 MB
"files": ["android/src/main/jniLibs/", "dist/", "ios/Frameworks", ...]

// Core: includes cpp/ for rebuild capability
"files": ["android/src/main/", "cpp/", "dist/", "ios/", ...]
```

### Size history

| Version | Variant | Size |
|---------|---------|------|
| 0.1.0 | (original) | ~70 MB |
| 0.2.0 | minimal | ~23 MB |
| 0.2.1 | minimal | ~23-25 MB |

---

## Release Workflow

```bash
# 1. Bump version
npm version patch    # 0.2.0 → 0.2.1
# OR edit package.json manually

# 2. Update CHANGELOG.md

# 3. Build
npm run clean:all
./build-variants.sh --variant minimal

# 4. Verify
npm run verify:pack:artifacts

# 5. Package
npm pack --ignore-scripts
# → llama-cpp-pro-0.2.1.tgz

# 6. Inspect
tar -tzf llama-cpp-pro-0.2.1.tgz | grep -E "(ios/Frameworks|jniLibs|wasm)"
du -h llama-cpp-pro-0.2.1.tgz

# 7. Publish
npm whoami
npm publish

# 8. Verify on registry
npm view llama-cpp-pro@0.2.1
```

---

## Troubleshooting

### iOS framework not found

```bash
ls ios/Frameworks/llama-cpp.framework/llama-cpp
# If missing:
npm run build:native
# or: bash scripts/ensure-llama-ios-xcframework.sh
```

### Android .so not found

```bash
ls android/src/main/jniLibs/arm64-v8a/libllama-cpp-arm64.so
# If missing:
cd android && ./gradlew assembleRelease && cd ..
```

### WASM artifacts missing

```bash
ls dist/wasm/llama_engine_emscripten.wasm
# If missing:
npm run build:pwa
```

### "loadLibrary failed" on Android

- Verify ABI matches device: `adb shell getprop ro.product.cpu.abi`
- Check `System.loadLibrary("llama-cpp-arm64")` matches the `.so` filename

### iOS "dylib not found"

```bash
# Rebuild and re-sync
npm run build:native
npx cap sync ios
```

### Desktop sidecar not responding

```bash
# Verify sidecar binary exists
ls sidecar/bin/
# Rebuild
npm run build:sidecar
npm run stage:desktop
```

---

## Related Documentation

| Document | Contents |
|----------|---------|
| [README.md](README.md) | Plugin overview, API examples, Feature Coverage Matrix |
| [README_BUILD_SYSTEM.md](README_BUILD_SYSTEM.md) | Build system reference, variant guide, CI/CD |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |
| [cpp/README.md](cpp/README.md) | Syncing upstream llama.cpp |

---

## Document Info

- **Package:** llama-cpp-pro
- **Version:** 0.2.1
- **Updated:** 2025-07-07
- **Covers:** iOS (Metal), Android (JNI), Web/PWA (WASM), Desktop (Electron + native sidecar)
