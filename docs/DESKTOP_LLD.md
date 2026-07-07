# Desktop Low-Level Design (LLD)

**Platform:** Windows 10+, macOS 13+, Linux (glibc)  
**Shell:** Electron 35+ (recommended)  
**Native:** `llama-cpp-sidecar` executable

---

## 1. Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Renderer (TypeScript)                                       │
│  createLlmProvider() → DesktopProvider                      │
│    ├─ fetch → 127.0.0.1:{port}/v1/chat/completions         │
│    └─ fallback → WebProvider (WASM worker)                  │
├─────────────────────────────────────────────────────────────┤
│ Main Process (Node / CommonJS)                              │
│  desktop/src/main/index.cjs                                 │
│    ├─ gpu-probe.cjs                                         │
│    ├─ backend-selector.cjs                                  │
│    └─ sidecar-manager.cjs → spawn sidecar binary            │
├─────────────────────────────────────────────────────────────┤
│ Sidecar Process (C++)                                       │
│  cap-sidecar-main.cpp                                       │
│    ├─ lm_ggml_backend_load_all_from_path()                  │
│    └─ cap_llama_server_main() → cap-native-server.cpp       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Sidecar Binary

### Entry point

`sidecar/cap-sidecar-main.cpp`:

1. `llama_backend_init()`
2. `lm_ggml_backend_load_all_from_path(--backend-dir)` — loads `libggml-vulkan.so`, `libggml-cuda.so`, etc.
3. `cap_llama_server_main(argc, argv)` — parses `-m`, `--host`, `--port`, `-c`
4. Event loop until SIGINT/SIGTERM
5. `cap_llama_server_stop()` + `llama_backend_free()`

### CMake variants (`SIDECAR_VARIANT`)

| Variant | Static backends | Dynamic plugins |
|---------|-----------------|-----------------|
| `metal-coreml` | CPU + Metal (macOS arm64) | — |
| `metal` | CPU + Metal (macOS x64) | — |
| `vulkan-openblas` | CPU | libggml-vulkan |
| `cuda` | CPU | libggml-cuda |
| `rocm` | CPU | libggml-hip |
| `cpu` / `openblas` | CPU only | optional libggml-blas |

GPU plugin `.so`/`.dll` files are built via `cmake/ggml-backends.cmake` when `LLAMA_CPP_UPSTREAM` is set.

### HTTP API (existing)

From `cpp/cap-native-server.cpp`:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/v1/models` | Model list |
| POST | `/v1/chat/completions` | Chat (OpenAI format) |
| POST | `/v1/completions` | Text completion |
| POST | `/v1/embeddings` | Embeddings |

---

## 3. GPU Detection (`gpu-probe.cjs`)

Filesystem-only probes (no GPU SDK required at runtime):

**Windows:** `nvcuda.dll`, `amdhip64.dll`, `vulkan-1.dll`, `openvino.dll`  
**macOS:** Metal (always), CoreML.framework  
**Linux:** `libcuda.so`, `libamdhip64.so`, `libvulkan.so`, `libopenvino.so`

---

## 4. Backend Selection (`backend-selector.cjs`)

Auto priority: `coreml-npu` → `openvino-npu` → GPU rank → native CPU → WASM

GPU rank:
- **darwin:** metal → cuda → rocm → openvino-gpu → vulkan
- **win32/linux:** vulkan → cuda → rocm → openvino-gpu

Maps to sidecar variant via `backendToVariant()`.

Settings: `{settingsDir}/settings.json` → `backendOverride`.

---

## 5. Sidecar Manager (`sidecar-manager.cjs`)

- Resolves binary: `extraResources/sidecar/{platform}-{arch}[-{variant}]`
- Spawns with `--model`, `--host 127.0.0.1`, `--port`, `--backend-dir`
- Health poll: `GET /health` × 20
- Max 2 restarts → `permanentWasmFallback`
- Optional CPU retry on GPU init failure (`forceCpu`)

---

## 6. TypeScript Provider (`provider.desktop.ts`)

- `platform: 'desktop'`
- Uses `globalThis.__annadataSidecarPort` or `process.env.LLAMA_SIDECAR_PORT`
- Delegates to `WebProvider` when port unavailable
- Implements: `initialize`, `loadModel`, `generate`, `embed`, `health`

---

## 7. Model Storage (`model-store.cjs`)

| OS | Primary path | Fallback |
|----|--------------|----------|
| Windows | `%PROGRAMDATA%\annadata\llama-cpp\models` | `~/annadata/llama-cpp/models` |
| macOS | `/Users/Shared/annadata/llama-cpp/models` | `~/annadata/llama-cpp/models` |
| Linux | `/var/lib/annadata/llama-cpp/models` | `~/annadata/llama-cpp/models` |

---

## 8. Packaging

Pre-built sidecars committed under `extraResources/sidecar/` for CI (same pattern as vad-dt).

electron-builder `extraResources` copies binaries next to the app; `resolveBinaryPath()` reads `process.resourcesPath/sidecar/`.

---

## 9. Testing

```bash
npm run test:unit -- --testPathPattern=desktop
```

Unit tests mock filesystem for `gpu-probe` and `backend-selector` (no GPU required).
