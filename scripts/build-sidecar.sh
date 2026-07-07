#!/usr/bin/env bash
# Build the llama-cpp desktop sidecar for the current host platform.
#
# Usage:
#   ./scripts/build-sidecar.sh [variant]
#
# Variants: metal-coreml | metal | vulkan-openblas | cuda | rocm | cpu | openblas
#
# Optional env:
#   LLAMA_CPP_UPSTREAM=/path/to/llama.cpp  — also build ggml GPU backend plugins
#   OPENBLAS_ROOT=/path/to/openblas

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VARIANT="${1:-}"

if [[ -z "${VARIANT}" ]]; then
  case "$(uname -s)" in
    Darwin)
      if [[ "$(uname -m)" == "arm64" ]]; then
        VARIANT="metal-coreml"
      else
        VARIANT="metal"
      fi
      ;;
    Linux) VARIANT="vulkan-openblas" ;;
    *) VARIANT="cpu" ;;
  esac
fi

BUILD_DIR="${ROOT}/sidecar/build"
BIN_DIR="${ROOT}/sidecar/bin"
mkdir -p "${BIN_DIR}"

CMAKE_ARGS=(
  -B "${BUILD_DIR}"
  -S "${ROOT}/sidecar"
  -DCMAKE_BUILD_TYPE=Release
  "-DSIDECAR_VARIANT=${VARIANT}"
)

if [[ -n "${LLAMA_CPP_UPSTREAM:-}" ]]; then
  CMAKE_ARGS+=("-DLLAMA_CPP_UPSTREAM=${LLAMA_CPP_UPSTREAM}")
fi

echo "==> Configuring sidecar (variant=${VARIANT})"
cmake "${CMAKE_ARGS[@]}"

echo "==> Building sidecar"
cmake --build "${BUILD_DIR}" --config Release -j"$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)"

echo "==> Staging binaries to sidecar/bin/"
find "${BUILD_DIR}/bin" -maxdepth 1 -type f -perm +111 2>/dev/null | while read -r f; do
  cp -f "$f" "${BIN_DIR}/"
done
find "${BUILD_DIR}/bin" -maxdepth 1 -type f \( -name "*.exe" -o -name "*.dll" -o -name "*.so" -o -name "libggml-*" -o -name "ggml-*" \) 2>/dev/null | while read -r f; do
  cp -f "$f" "${BIN_DIR}/" || true
done

echo "==> Done. Binaries in ${BIN_DIR}:"
ls -la "${BIN_DIR}" || true
