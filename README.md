# llama-cpp-pro

[![Actions Status](https://github.com/arusatech/llama-cpp-pro/workflows/CI/badge.svg)](https://github.com/arusatech/llama-cpp-pro/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/llama-cpp-pro.svg)](https://www.npmjs.com/package/llama-cpp-pro/)
[![Support: ANNADATA.AI](https://img.shields.io/badge/AI-ANNADATA.AI-orange.svg)](https://annadata.ai/)
[![Principal Engineer / Architect: Mr. Yakub Mohammad](https://img.shields.io/badge/Principal%20Architect-Mr.%20Yakub%20Mohammad-blue.svg)](https://annadata.ai/)

A native Capacitor plugin that embeds [llama.cpp](https://github.com/ggerganov/llama.cpp) directly into mobile apps, enabling offline AI inference with comprehensive support for text generation, multimodal processing, TTS, LoRA adapters, and more.

[Annadata.ai](https://annadata.ai): Inference of [LLaMA](https://arxiv.org/abs/2302.13971) model in pure C/C++ used in [Annadata.ai](https://annadata.ai)

## 🚀 Features

- **Offline AI Inference**: Run large language models completely offline on mobile devices
- **Text Generation**: Complete text completion with streaming support
- **Chat Conversations**: Multi-turn conversations with context management
- **Multimodal Support**: Process images and audio alongside text
- **Text-to-Speech (TTS)**: Generate speech from text using vocoder models
- **LoRA Adapters**: Fine-tune models with LoRA adapters
- **Embeddings**: Generate vector embeddings for semantic search
- **Reranking**: Rank documents by relevance to queries
- **Session Management**: Save and load conversation states
- **Benchmarking**: Performance testing and optimization tools
- **Structured Output**: Generate JSON with schema validation
- **Cross-Platform**: iOS, Android, **Web/PWA**, and **Desktop** (Windows, macOS, Linux) with native optimizations



## 📱 Platform Support


| Feature            | iOS   | Android    | Web (PWA) | Desktop                |
| ------------------ | ----- | ---------- | --------- | ---------------------- |
| Text Generation    | ✅     | ✅          | ✅         | ✅                      |
| Chat Conversations | ✅     | ✅          | ✅         | ✅                      |
| Streaming          | ✅     | ✅          | ✅         | ✅¹                     |
| Multimodal         | ✅     | ✅          | ✅²        | ✅                      |
| TTS                | ✅     | ✅          | ✅²        | ✅                      |
| LoRA Adapters      | ✅     | ✅          | ✅²        | ✅                      |
| Embeddings         | ✅     | ✅          | ✅         | ✅                      |
| Reranking          | ✅     | ✅          | ✅³        | ✅                      |
| Session Management | ✅     | ✅          | ✅⁴        | ✅                      |
| Benchmarking       | ✅     | ✅          | ✅         | ✅                      |
| GPU Acceleration   | Metal | CPU/Adreno | —         | Vulkan/CUDA/ROCm/Metal |


¹ **Desktop:** SSE streaming from the native sidecar (`/v1/chat/completions`, `/v1/completions` with `stream: true`).  
² **Web:** auxiliary GGUF files must be staged in WASM VFS.  
³ **Web:** requires rank-pooling embedding model.  
⁴ **Web:** sessions persist in worker MEMFS for tab lifetime.

---

## Builds

### Mobile + PWA (Capacitor / npm JS+native)

```bash
# iOS + Android + PWA (npm release / Capacitor)
./build-variants.sh --variant minimal

# iOS only / Android only
./build-variants.sh --variant ios-only
./build-variants.sh --variant android-only
```

### Desktop / Electron (macOS + Windows + Linux)

Desktop sidecars and GPU plugins are **built on each OS**, then staged into this repo under `extraResources/` so they ship inside the npm package.

| Host | Default sidecar | GPU path |
|------|-----------------|----------|
| **macOS** | Metal / Metal+CoreML | built into sidecar (no separate Vulkan plugin) |
| **Windows** | `vulkan-openblas` → `win32-x64.exe` | `ggml-plugins/win32-x64/ggml-vulkan.dll` |
| **Linux** | `vulkan-openblas` → `linux-x64` | `ggml-plugins/linux-x64/libggml-vulkan.so` |

#### Desktop prerequisites (Windows / Linux)

These are **separate checkouts / installs** — not vendored inside `llama-cpp-pro`:

1. **Vulkan SDK** — e.g. `C:\VulkanSDK\1.4.x.x` or `/path/to/VulkanSDK`  
   Set: `VULKAN_SDK`
2. **OpenBLAS** — e.g. `C:\OpenBLAS` or system `libopenblas`  
   Set: `OPENBLAS_ROOT` (Windows) / install `libopenblas-dev` (Linux)
3. **Upstream [llama.cpp](https://github.com/ggerganov/llama.cpp)** — full clone used only to build ggml GPU backend DLLs/SOs  
   Set: `LLAMA_CPP_UPSTREAM` (must contain `ggml/CMakeLists.txt`)

```bash
# Example layout (sibling of llama-cpp-pro)
#   ../llama-cpp-pro
#   ../llama.cpp          ← LLAMA_CPP_UPSTREAM

export VULKAN_SDK=/path/to/VulkanSDK          # or C:\VulkanSDK\1.4.350.0
export OPENBLAS_ROOT=/path/to/OpenBLAS        # or C:\OpenBLAS
export LLAMA_CPP_UPSTREAM=/path/to/llama.cpp  # or C:\Users\...\Project\llama.cpp
```

macOS desktop builds use Metal and do **not** require Vulkan / OpenBLAS / `LLAMA_CPP_UPSTREAM`.

#### macOS desktop

```bash
# Desktop / Electron (macOS universal sidecar: arm64 + x64)
./build-variants.sh --variant desktop
./build-variants.sh --variant minimal --with-desktop --desktop-arch=universal

# Or step-by-step
npm run build:sidecar:universal
npm run stage:desktop
npm run verify:desktop:bundle -- --arch=universal
```

#### Windows desktop

```powershell
$env:VULKAN_SDK = "C:\VulkanSDK\1.4.350.0"
$env:OPENBLAS_ROOT = "C:\OpenBLAS"
$env:LLAMA_CPP_UPSTREAM = "C:\Users\arusa\Project\llama.cpp"

npm run build:sidecar:win          # default: vulkan-openblas + ggml-vulkan.dll
npm run stage:desktop
npm run verify:desktop:bundle -- --platform=win32
```

#### Linux desktop

```bash
export VULKAN_SDK=...              # if not system-packaged
export OPENBLAS_ROOT=...           # optional if pkg-config finds OpenBLAS
export LLAMA_CPP_UPSTREAM=/path/to/llama.cpp

npm run build:sidecar:linux        # or: ./scripts/build-sidecar.sh vulkan-openblas
npm run stage:desktop
npm run verify:desktop:bundle -- --platform=linux
```

#### What gets staged into `llama-cpp-pro` (npm package)

After `npm run stage:desktop`, artifacts live under this repo and are published via the `extraResources/` / package `files` list:

```text
extraResources/sidecar/
  darwin-arm64                 # macOS
  darwin-x64
  linux-x64                    # Linux
  win32-x64.exe                # Windows
  libopenblas.dll              # Windows OpenBLAS runtime (when used)
  ggml-plugins/
    win32-x64/ggml-vulkan.dll
    linux-x64/libggml-vulkan.so
    # (+ ggml-*.dll / .so runtime deps as produced by the build)
extraResources/llama-wasm/     # WASM fallback (from PWA build)
```

Cross-OS npm releases are usually assembled on one machine by combining:

- **Mac** `minimal --with-desktop --desktop-arch=universal` (iOS + Android + PWA + darwin sidecars)
- **Windows** `build:sidecar:win` + `stage:desktop` (win32 + ggml-vulkan)
- **Linux** (optional) `build:sidecar:linux` + `stage:desktop`

Then pack/publish from the tree that contains all staged binaries:

```bash
npm run release:assemble    # or: node scripts/assemble-npm-release.mjs --bump
npm run release:publish     # requires npm login
```

See [BUILD_GUIDE.md](BUILD_GUIDE.md) and [README_BUILD_SYSTEM.md](README_BUILD_SYSTEM.md) for full build, API, and troubleshooting details.


## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [llama.cpp](https://github.com/ggerganov/llama.cpp) - The core inference engine
- [Capacitor](https://capacitorjs.com/) - The cross-platform runtime
- [Annadata.ai](https://annadata.ai) - Complete system developed and powered by [npm](https://www.npmjs.com/package/llama-cpp-pro/)



## 📞 Support

- 📧 Email: [support@arusatech.com](mailto:support@arusatech.com) ; [yakub@annadata.ai](mailto:yakub@annadata.ai)
- 🐛 Issues: [GitHub Issues](https://github.com/arusatech/llama-cpp-pro/issues)
- 📖 Documentation: [GitHub Wiki](https://github.com/arusatech/llama-cpp-pro/wiki)

