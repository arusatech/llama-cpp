# Desktop sidecar binaries (staged for electron-builder / npm)

Built on each host, then copied here by `npm run stage:desktop` so they **ship inside llama-cpp-pro**.

## Prerequisites (Windows / Linux)

Install separately (not part of this git tree):

- `VULKAN_SDK` — Vulkan SDK
- `OPENBLAS_ROOT` — OpenBLAS
- `LLAMA_CPP_UPSTREAM` — full [llama.cpp](https://github.com/ggerganov/llama.cpp) checkout (for `ggml-vulkan` plugins)

macOS Metal sidecars do not need those three.

## Expected layout (after build + stage)

```text
extraResources/sidecar/
  darwin-arm64
  darwin-x64
  linux-x64
  win32-x64.exe
  libopenblas.dll                    # Windows OpenBLAS runtime (optional but typical)
  ggml.dll / ggml-base.dll / …       # Windows plugin runtime deps (as produced)
  ggml-plugins/
    win32-x64/ggml-vulkan.dll
    linux-x64/libggml-vulkan.so
    darwin-arm64/…                   # if/when Metal plugins are staged separately
```

## Commands

```bash
# macOS universal
npm run build:sidecar:universal && npm run stage:desktop

# Windows
npm run build:sidecar:win && npm run stage:desktop

# Linux
npm run build:sidecar:linux && npm run stage:desktop
```

See root [README.md](../../README.md#builds) and [BUILD_GUIDE.md](../../BUILD_GUIDE.md#desktop-build).
