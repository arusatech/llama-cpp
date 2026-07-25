# Native builds: upstream llama.cpp + project adapters

## Layout

| Path | Role |
|------|------|
| `third_party/llama.cpp` | **Pinned git submodule** — sole ggml / llama / common / mtmd source ([ggml-org/llama.cpp](https://github.com/ggml-org/llama.cpp)). |
| `native/` | Project adapters (`cap-*`, `anyascii`, optional local httplib fallback). |
| `sidecar/` | Desktop sidecar CMake, `cap-sidecar-main.cpp`, `abi-guard.cpp`. |

The legacy flat `cpp/` tree (llama.rn fork with `lm_ggml_*`) has been **removed**. Do not reintroduce it.

Override the upstream path with env or CMake:

```bash
export LLAMA_CPP_UPSTREAM=/path/to/llama.cpp
# or: cmake -DLLAMA_CPP_UPSTREAM=/path/to/llama.cpp ...
```

Default: `third_party/llama.cpp`.

## Desktop sidecar

```bash
# Windows
scripts\build-sidecar-win.bat vulkan          # or cpu / openvino / vulkan-openblas
# Linux (Docker from Windows host)
scripts\build-sidecar-linux-docker.bat
```

GPU plugins are staged under `sidecar/bin/ggml-plugins/<platform>-<arch>/` only — never next to the exe (loading Vulkan twice registers duplicate devices and corrupts the heap). Shared runtime DLLs (`ggml*.dll`, `llama.dll`, …) stay next to the exe.

### OpenVINO / NPU

Requires the Intel OpenVINO Toolkit at build time (`GGML_OPENVINO=ON`, variant `openvino`). Stage redistributables:

```bash
node scripts/stage-openvino-runtime.cjs sidecar/bin/openvino-runtime
```

Auto-selection prefers Vulkan GPU over OpenVINO NPU on Windows/Linux unless the user overrides to `sidecar-npu` and an `openvino` binary exists.

## Mobile / WASM

| Platform | Entry |
|----------|--------|
| Android | `android/src/main/CMakeLists.txt` (`add_subdirectory` upstream + `native/` + JNI) |
| iOS | `ios/CMakeLists.txt` + `scripts/ensure-llama-ios-xcframework.sh` |
| WASM | `src-rust/build.rs` + `scripts/build-wasm.sh` |

All compile against `third_party/llama.cpp` + `native/`.
