# Build System Reference — llama-cpp-capacitor 0.2.1

Complete consolidated guide covering build variants, package configuration, and release procedures for all platforms: iOS, Android, Web/PWA, and Desktop (Electron).

---

## 📖 Table of Contents

1. [Quick Start](#quick-start)
2. [Platform Overview](#platform-overview)
3. [Prerequisites](#prerequisites)
4. [Build Variants](#build-variants)
5. [Platform-Specific Build Instructions](#platform-specific-build-instructions)
6. [Package Configuration](#package-configuration)
7. [Release Process](#release-process)
8. [Pre-Release Checklist](#pre-release-checklist)
9. [Environment Variables](#environment-variables)
10. [Common Issues](#common-issues)
11. [FAQ](#faq)

---

## Quick Start

### One-Command Production Release

```bash
npm publish
```

This automatically runs the `prepublishOnly` hook → `npm run build:package`:
1. TypeScript compilation → `dist/`
2. iOS native framework → `ios/Frameworks/llama-cpp.framework/`
3. Android JNI library → `android/src/main/jniLibs/arm64-v8a/`
4. Web/PWA WASM worker → `dist/wasm/` + `dist/workers/`
5. Artifact verification
6. npm packaging and publish

**Result:** Users receive iOS + Android + Web/PWA + Desktop in one `~35-40 MB` package ✅

### Manual Build Steps

```bash
# 1. Clean all previous builds
npm run clean:all

# 2. Build minimal variant (iOS + Android + WASM + TypeScript)
./build-variants.sh --variant minimal

# 3. Verify all artifacts
npm run verify:pack:artifacts

# 4. Create and inspect the tarball
npm pack --ignore-scripts

# 5. Publish
npm publish
```

> **⚠️ Important:** `build-variants.sh` handles TypeScript compilation. Do NOT run `npm run build` separately afterward — it invokes `npm run clean` first and deletes WASM artifacts.

---

## Platform Overview

| Platform | Runtime | Build output | GPU |
|----------|---------|--------------|-----|
| **iOS** | Native Metal + CPU | `ios/Frameworks/llama-cpp.framework/` | ✅ Metal |
| **Android** | JNI + CPU/Vulkan | `android/src/main/jniLibs/arm64-v8a/libllama-cpp-arm64.so` | ✅ Vulkan |
| **Web / PWA** | WebAssembly (Emscripten) | `dist/wasm/` + `dist/workers/` | ❌ CPU only |
| **Desktop** | Electron + native sidecar | `sidecar/bin/<os>-<arch>` + WASM fallback | ✅ CUDA/ROCm/Metal/Vulkan |

All four platforms share the same TypeScript API surface (`src/definitions.ts`). Every method is implemented on every platform — see the [Feature Coverage Matrix](README.md#-full-api-feature-coverage-matrix) for the full breakdown.

---

## Prerequisites

### All Platforms

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| npm | ≥ 9 | bundled with Node.js |
| CMake | ≥ 3.16 | `brew install cmake` / `apt install cmake` |

### iOS (macOS only)

| Tool | Version | Install |
|------|---------|---------|
| macOS | ≥ 13 Ventura | — |
| Xcode | ≥ 15 | App Store |
| Xcode CLI tools | — | `xcode-select --install` |

```bash
# Verify
xcode-select -p
cmake --version
```

### Android

| Tool | Version | Install |
|------|---------|---------|
| Android Studio | ≥ Flamingo | https://developer.android.com/studio |
| Android NDK | r26+ | Android Studio → SDK Manager → NDK |
| Java (JDK) | 17 | `brew install openjdk@17` |

```bash
# Required environment variables
export ANDROID_HOME=$HOME/Library/Android/sdk        # macOS
export ANDROID_HOME=$HOME/Android/Sdk               # Linux
export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/$(ls $ANDROID_HOME/ndk | tail -1)
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Verify
adb version
$ANDROID_NDK_HOME/ndk-build --version
```

### Web / PWA (WASM)

| Tool | Version | Install |
|------|---------|---------|
| Emscripten | ≥ 3.1.50 | `brew install emscripten` or see [emsdk](https://emscripten.org/docs/getting_started/downloads.html) |
| Rust | ≥ 1.75 | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm-bindgen-cli | matches Cargo.toml | `cargo install wasm-bindgen-cli` |

```bash
# Add wasm target
rustup target add wasm32-unknown-emscripten

# Verify
emcc --version
rustc --version
wasm-bindgen --version
cargo install wasm-pack   # optional, for standalone WASM builds
```

### Desktop (Electron sidecar)

| Tool | Needed for | Install |
|------|-----------|---------|
| CMake ≥ 3.20 | All sidecar builds | see above |
| NVIDIA CUDA Toolkit | `--cuda` variant | https://developer.nvidia.com/cuda-downloads |
| AMD ROCm | `--rocm` variant | https://rocm.docs.amd.com |
| Vulkan SDK | Vulkan backend | https://vulkan.lunarg.com/sdk/home |
| OpenBLAS | CPU-optimized Linux/Win | `apt install libopenblas-dev` |

---

## Build Variants

### Variant Comparison

| Variant | Size | iOS | Android | Web/WASM | Sources | Debug | Use |
|---------|------|-----|---------|---------|---------|-------|-----|
| **minimal** ⭐ | ~23-25 MB | arm64 stripped | arm64 stripped | ✅ | ❌ | ❌ | **Public npm** |
| **core** | ~33-40 MB | arm64 stripped | arm64 stripped | ✅ | ✅ | ❌ | Production + rebuild |
| **development** | ~55-70 MB | arm64+x86_64 | arm64+x86_64 | ✅ | ✅ | ✅ | Local dev/testing |
| **ios-only** | ~8-10 MB | arm64 stripped | ❌ | ❌ | ✅ | ❌ | iOS-only apps |
| **android-only** | ~25-30 MB | ❌ | arm64 stripped | ❌ | ✅ | ❌ | Android-only apps |
| **full** | ~75+ MB | All | All | ✅ | ✅ | ✅ | ❌ Not recommended |

### Build any variant

```bash
./build-variants.sh --variant [minimal|core|development|ios-only|android-only|full]
```

### Minimal Variant (Recommended for npm)

```bash
./build-variants.sh --variant minimal
```

**Size breakdown:**
```
iOS arm64 (stripped):         3–4 MB
Android arm64 (stripped):    15–16 MB
WASM + PWA worker:            2–3 MB
TypeScript dist:              1–2 MB
─────────────────────────────────────
Total:                      ~23–25 MB
```

---

## Platform-Specific Build Instructions

### iOS

The iOS build produces a universal `llama-cpp.framework` containing the C++ inference engine and exposes C symbols via `cap-ios-bridge.h`.

#### Build framework

```bash
# Device (arm64) — ships in the npm package
cd ios
cmake -B build-device -S . \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_OSX_ARCHITECTURES=arm64 \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=16.0
cmake --build build-device --config Release -j$(sysctl -n hw.ncpu)

# Simulator (arm64 + x86_64) — needed for Xcode Simulator
bash scripts/ensure-llama-ios-xcframework.sh
```

#### What gets built

| Symbol | Purpose |
|--------|---------|
| `llama_init_context` | Load GGUF model, returns context ID |
| `llama_run_completion` | Run inference, returns JSON result |
| `llama_run_embedding_json` | Generate embeddings |
| `llama_rerank_json` | Rerank documents |
| `llama_bench` | Benchmark pp/tg performance |
| `llama_load/save_session_file` | KV-cache session persistence |
| `llama_apply/remove_lora_adapters` | LoRA adapter management |
| `llama_init/release_multimodal` | Vision/audio multimodal |
| `llama_init/release_vocoder` | TTS vocoder |
| `llama_get/decode_audio_tokens` | TTS token synthesis |
| `llama_get_context_gpu_info` | Metal GPU usage reporting |
| `cap_llama_server_start/stop` | In-process HTTP server |

All symbols are declared in `cpp/cap-ios-bridge.h` and implemented in `cpp/cap-ios-bridge.cpp`.

#### Swift integration

```swift
// LlamaNativeBridge.swift — dlsym-based dynamic loading
let fn = try LlamaNativeBridge.sym("llama_run_completion", RunCompletionFn.self)
```

The Swift layer in `ios/Sources/LlamaCppCapacitor/LlamaCpp.swift` wraps every symbol with error handling and background `DispatchQueue` dispatch.

#### GPU support

Metal is used automatically when `n_gpu_layers > 0` is passed to `initContext`. The `llama_get_context_gpu_info` symbol returns `{"gpu": true/false, "reasonNoGPU": "..."}`.

---

### Android

The Android build produces a JNI shared library loaded by `LlamaCpp.java` via `System.loadLibrary()`.

#### Build library

```bash
cd android
./gradlew assembleRelease

# Or via CMake directly
cmake -B build-android -S src/main \
  -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK_HOME/build/cmake/android.toolchain.cmake \
  -DANDROID_ABI=arm64-v8a \
  -DANDROID_PLATFORM=android-26 \
  -DCMAKE_BUILD_TYPE=Release
cmake --build build-android --config Release -j$(nproc)
```

#### JNI file map

| JNI file | Methods |
|----------|---------|
| `jni.cpp` | `initContextNative`, `completionNative`, `tokenizeNative`, `embeddingNative`, `rerankNative`, `benchNative`, `loadSessionNative`, `saveSessionNative` |
| `jni-lora.cpp` | `applyLoraAdaptersNative`, `removeLoraAdaptersNative`, `getLoadedLoraAdaptersNative` |
| `jni-multimodal.cpp` | `initMultimodalNative`, `isMultimodalEnabledNative`, `getMultimodalSupportNative`, `releaseMultimodalNative` |
| `jni-tts.cpp` | `initVocoderNative`, `isVocoderEnabledNative`, `getFormattedAudioCompletionNative`, `getAudioCompletionGuideTokensNative`, `decodeAudioTokensNative`, `releaseVocoderNative` |
| `jni-chat-session.cpp` | (chat helper utilities, integrated into `jni.cpp` at link time) |

#### Completion param propagation

All 20+ sampling parameters from `NativeCompletionParams` are extracted in `completionNative` and mapped to `common_params::sampling`:

```
temperature, top_p, top_k, min_p, typical_p
penalty_repeat, penalty_freq, penalty_present, penalty_last_n
mirostat, mirostat_tau, mirostat_eta
dry_multiplier, dry_base, dry_allowed_length, dry_penalty_last_n
grammar, stop[], seed, n_probs, top_n_sigma, guide_tokens
```

#### GPU support

Vulkan layers are enabled when `n_gpu_layers > 0`. The context result reflects actual GPU availability. `n_gpu_layers=0` → CPU-only with explicit `reasonNoGPU` message.

---

### Web / PWA (WebAssembly)

The Web build compiles the C++ inference engine to WebAssembly via Emscripten + Rust FFI, running inside a dedicated Web Worker.

#### Build commands

```bash
# Standard WASM (single-threaded, JSPI async)
npm run build:wasm

# WASM with pthread (multi-threaded — requires COOP/COEP headers)
npm run build:wasm:pthreads

# Full WASM (JSPI + largest context support)
npm run build:wasm:full

# Build Web Worker bundle
npm run build:worker

# Copy WASM assets to dist/
npm run build:wasm:assets

# All three steps together
npm run build:pwa
```

#### Build output

```
dist/wasm/
├── llama_engine.js                   ← wasm-bindgen JS glue
├── llama_engine.wasm                 ← SIDE_MODULE (Rust FFI)
├── llama_engine_emscripten.mjs       ← ESM module (MAIN_MODULE with C++)
├── llama_engine_emscripten.wasm      ← WASM MAIN_MODULE binary
└── package.json

dist/workers/
└── llm.worker.js                     ← Web Worker bundle
```

#### Environment flags

```bash
LLAMA_WASM_JSPI=1    # Enable async/await JSPI (default: 1)
LLAMA_WASM_PTHREAD=0 # Disable pthreads (default: 0 — no SharedArrayBuffer needed)
LLAMA_WASM_PTHREAD=1 # Enable pthreads (requires COOP/COEP response headers)
```

#### Chat template support

On Web, `getFormattedChat` delegates to `provider.getFormattedChat` when available (WASM Jinja path). If not exposed by the WASM build, it falls back to four built-in client-side formatters: `chatml`, `llama3`, `mistral`, `gemma`.

#### OPFS model storage

Models are stored in the browser's Origin Private File System. Use `downloadModel` or `ensureModelInOpfs` to cache GGUF files:

```typescript
import { LlamaCpp } from 'llama-cpp-capacitor';
await LlamaCpp.downloadModel({ url: 'https://…/model.gguf', filename: 'model.gguf' });
```

#### PWA server headers (COOP/COEP)

Required only for the pthread build:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Single-threaded WASM (default) does **not** require these headers.

---

### Desktop (Electron + native sidecar)

The Desktop build wraps a native llama.cpp sidecar process behind an IPC bridge, with WASM as a fallback.

#### Build sidecar

```bash
# macOS (Metal + CoreML ANE) — recommended for macOS
npm run build:sidecar:metal

# macOS or Linux (CPU with OpenBLAS)
npm run build:sidecar:cpu

# Linux / Windows (Vulkan + CPU)
npm run build:sidecar

# NVIDIA CUDA
npm run build:sidecar:cuda

# AMD ROCm
npm run build:sidecar:rocm

# Auto-detect host (Metal on macOS, Vulkan on Linux, CPU elsewhere)
./scripts/build-sidecar.sh
```

#### Stage for Electron packaging

```bash
# Copies sidecar binary + WASM to extraResources/
npm run build:desktop
```

#### Electron integration

```javascript
// Main process (main.js / main.ts)
const { registerLlamaDesktopIpc } = require('llama-cpp-capacitor/desktop');
registerLlamaDesktopIpc({ ipcMain, app });

// Preload script
require('llama-cpp-capacitor/desktop/preload')(contextBridge, ipcRenderer);

// Renderer / Capacitor web layer — auto-selected via LlamaCppDesktop
import { LlamaCpp } from 'llama-cpp-capacitor';
const ctx = await LlamaCpp.initContext({ contextId: 0, params: { model: '/path/to/model.gguf' } });
```

#### Electron Builder config

```javascript
// electron-builder.config.js
const llama = require('llama-cpp-capacitor/desktop/electron-builder');
module.exports = llama.merge({
  appId: 'com.yourapp.id',
  // ...your config
});
```

#### Sidecar variant table

| OS / arch | Variant | Accelerator | Script |
|-----------|---------|-------------|--------|
| macOS arm64 | `metal-coreml` | Metal + CoreML | `npm run build:sidecar:metal` |
| macOS x64 | `metal` | Metal | `npm run build:sidecar` |
| Linux x64 | `vulkan-openblas` | Vulkan + CPU | `npm run build:sidecar:linux` |
| Windows x64 | `vulkan-openblas` | Vulkan + CPU | `npm run build:sidecar:win` |
| Any | `cuda` | NVIDIA CUDA | `npm run build:sidecar:cuda` |
| Linux | `rocm` | AMD ROCm | `npm run build:sidecar:rocm` |
| Any | `cpu` | CPU only | `npm run build:sidecar:cpu` |

---

## Package Configuration

### `files` array in `package.json` (0.2.1 — current)

The current `package.json` includes all platforms:

```json
{
  "files": [
    "android/src/main/",
    "android/build.gradle",
    "build-native.sh",
    "cpp/",
    "dist/",
    "ios/CMakeLists.txt",
    "ios/CMakeLists-arm64.txt",
    "ios/CMakeLists-x86_64.txt",
    "ios/metal-embed.cmake",
    "ios/embed-metal-shaders.sh",
    "ios/Sources",
    "ios/Frameworks",
    "scripts/ensure-llama-ios-xcframework.sh",
    "scripts/embed-llama-ios-app-framework.sh",
    "Package.swift",
    "LlamaCpp.podspec",
    "LlamaCppCapacitor.podspec",
    "types/",
    "desktop/",
    "sidecar/",
    "cmake/",
    "extraResources/",
    "scripts/stage-desktop-resources.cjs",
    "scripts/ensure-desktop-sidecar-bundle.cjs",
    "scripts/build-sidecar.sh",
    "scripts/build-sidecar-linux.sh",
    "scripts/build-sidecar-win.bat"
  ]
}
```

### Minimal variant override (smallest package, no C++ sources)

```json
{
  "files": [
    "android/src/main/jniLibs/",
    "android/build.gradle",
    "dist/",
    "ios/Sources",
    "ios/Frameworks",
    "Package.swift",
    "LlamaCpp.podspec",
    "LlamaCppCapacitor.podspec",
    "types/"
  ]
}
```

**Size:** ~23-25 MB (no `cpp/`, no `sidecar/`, no desktop scripts)

---

## Release Process

### Step 1 — Bump version

```bash
# Edit package.json "version" to "0.2.1"
# Or use npm:
npm version patch   # 0.2.0 → 0.2.1
```

### Step 2 — Clean

```bash
npm run clean:all
```

### Step 3 — Build all platforms

```bash
# Option A — full automated (recommended)
./build-variants.sh --variant minimal

# Option B — build each platform separately
npm run build              # TypeScript
npm run build:native       # iOS + Android
npm run build:pwa          # WASM + Web Worker
npm run build:desktop      # Desktop sidecar + staging (optional)
```

### Step 4 — Verify artifacts

```bash
npm run verify:pack:artifacts
# Expected: iOS framework ✅, Android .so ✅, WASM ✅, dist/ ✅
```

### Step 5 — Create tarball

```bash
npm pack --ignore-scripts
# Creates: llama-cpp-capacitor-0.2.1.tgz
```

### Step 6 — Inspect tarball

```bash
# Check contents
tar -tzf llama-cpp-capacitor-0.2.1.tgz | head -40

# Check size
du -h llama-cpp-capacitor-0.2.1.tgz

# Verify platform artifacts are present
tar -tzf llama-cpp-capacitor-0.2.1.tgz | grep -E "(ios|android|wasm|sidecar)"
```

### Step 7 — Publish

```bash
npm whoami      # confirm logged in
npm publish
npm view llama-cpp-capacitor@0.2.1
```

---

## Pre-Release Checklist

- [ ] `package.json` version set to `0.2.1`
- [ ] `CHANGELOG.md` updated with 0.2.1 release notes
- [ ] `npm run clean:all` completed
- [ ] Build completed successfully (iOS + Android + WASM)
- [ ] `npm run verify:pack:artifacts` — all green
- [ ] `npm pack --ignore-scripts` — tarball created
- [ ] `tar -tzf llama-cpp-capacitor-0.2.1.tgz | grep ios/Frameworks` — iOS framework present
- [ ] `tar -tzf llama-cpp-capacitor-0.2.1.tgz | grep libllama-cpp` — Android .so present
- [ ] `tar -tzf llama-cpp-capacitor-0.2.1.tgz | grep wasm` — WASM assets present
- [ ] `npm whoami` — logged in to npm
- [ ] `npm publish` — published
- [ ] `npm view llama-cpp-capacitor@0.2.1` — live on registry

---

## Environment Variables

```bash
# Native builds
STRIP_SYMBOLS=true     # Strip debug symbols (default: true for production variants)
BUILD_JOBS=16          # Parallel CMake jobs (default: CPU count)
VERBOSE=1              # Verbose build output

# Android
ANDROID_HOME=/path/to/sdk
ANDROID_NDK_HOME=/path/to/ndk

# WASM
LLAMA_WASM_JSPI=1      # Enable JSPI async (default: 1)
LLAMA_WASM_PTHREAD=0   # Enable pthreads (default: 0)

# Desktop sidecar
LLAMA_CPP_UPSTREAM=/path/to/upstream  # Sync upstream llama.cpp GPU backends
OPENBLAS_ROOT=/path/to/openblas       # Custom OpenBLAS for Linux/Windows CPU builds

# Combined example
BUILD_JOBS=16 STRIP_SYMBOLS=true VERBOSE=1 ./build-variants.sh --variant minimal
```

---

## Clean Scripts

```bash
npm run clean          # TypeScript dist only
npm run clean:native   # iOS/Android build artifacts + Frameworks
npm run clean:wasm     # Rust target, WASM pkg, dist/wasm
npm run clean:all      # Everything above
npm run clean:test     # Test output and coverage
```

---

## Common Issues

### "Binary not found" after build

```bash
npm run clean:native
./build-variants.sh --variant minimal
```

### iOS build skipped on non-macOS

iOS builds require macOS + Xcode. On Linux/Windows, iOS is automatically skipped — this is expected. Build iOS on macOS, then copy the framework to `ios/Frameworks/`.

### Android NDK not found

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/$(ls $ANDROID_HOME/ndk | sort -V | tail -1)
echo $ANDROID_NDK_HOME   # should print a path ending in a version number
```

### WASM build fails

```bash
# Check Emscripten is activated
source /path/to/emsdk/emsdk_env.sh
emcc --version

# Rebuild from scratch
npm run clean:wasm
npm run build:pwa
```

### Desktop sidecar not found

```bash
# Build for your host
npm run build:sidecar        # auto-detects OS
npm run stage:desktop        # copies to extraResources/
```

### Package larger than expected

```bash
# Check if C++ sources were accidentally included
tar -tzf llama-cpp-capacitor-0.2.1.tgz | grep "^package/cpp/" | wc -l
# Should be 0 for minimal variant
```

---

## FAQ

### Q: Why is there both `prepublishOnly` and `build:package`?

`prepublishOnly` runs automatically on `npm publish`. `build:package` is the same script you can call manually to test without publishing.

### Q: Can I build only one platform?

Yes:
```bash
npm run build:ios      # iOS only
npm run build:android  # Android only
npm run build:pwa      # Web/WASM only
npm run build:sidecar  # Desktop sidecar only
```

### Q: Which variant should I publish?

**Minimal** for the public npm package. It's ~23-25 MB, fully functional on all platforms, with no debug overhead.

### Q: How do I rebuild the iOS XCFramework for simulators?

```bash
bash scripts/ensure-llama-ios-xcframework.sh
npx cap sync ios
```

### Q: How do I add a new C++ API symbol to iOS?

1. Declare in `cpp/cap-ios-bridge.h`
2. Implement in `cpp/cap-ios-bridge.cpp` (add ABI alias at the bottom)
3. Add `typealias` + `trySymOpt` call in `ios/Sources/LlamaCppCapacitor/LlamaNativeBridge.swift`
4. Call from `ios/Sources/LlamaCppCapacitor/LlamaCpp.swift`
5. Rebuild iOS framework

### Q: How do I wire a new JNI method on Android?

1. Declare `private native ...` in `android/.../LlamaCpp.java`
2. Add `JNIEXPORT` function in `android/src/main/jni.cpp` (or relevant `jni-*.cpp`)
3. Call `nativeMethod(...)` from the Java method body
4. Rebuild Android

---

## Key Commands Reference

```bash
# Build all platforms
./build-variants.sh --variant minimal

# Build individual platforms
npm run build              # TypeScript
npm run build:native       # iOS + Android
npm run build:pwa          # Web/WASM + worker
npm run build:desktop      # Desktop sidecar
npm run build:ios:xcframework  # iOS Simulator XCFramework

# Verify and package
npm run verify:pack:artifacts
npm pack --ignore-scripts

# Release
npm version patch   # bump 0.2.0 → 0.2.1
npm publish

# Clean
npm run clean:all

# Inspect tarball
tar -tzf llama-cpp-capacitor-0.2.1.tgz | head -40
du -h llama-cpp-capacitor-0.2.1.tgz
```

---

## Document Info

- **Package:** llama-cpp-capacitor
- **Version:** 0.2.1
- **Updated:** 2025-07-07
- **Covers:** iOS, Android, Web/PWA, Desktop (Electron + sidecar)
