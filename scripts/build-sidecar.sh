#!/usr/bin/env bash
# Build the llama-cpp desktop sidecar for the current host platform.
#
# Usage:
#   ./scripts/build-sidecar.sh [variant]
#   ./scripts/build-sidecar.sh [variant] --arch arm64|x64|host
#   ./scripts/build-sidecar.sh darwin-x64          # cross-build Intel Mac binary
#   ./scripts/build-sidecar.sh universal           # arm64 + x64 on macOS
#
# Variants: metal-coreml | metal | vulkan-openblas | cuda | rocm | cpu | openblas | vulkan
#
# Optional env:
#   LLAMA_CPP_UPSTREAM=/path/to/llama.cpp  — also build ggml GPU backend plugins
#   OPENBLAS_ROOT=/path/to/openblas
#   SIDECAR_ARCH=arm64|x64                 — same as --arch

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VARIANT=""
ARCH_OPT="${SIDECAR_ARCH:-host}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --arch)
      shift
      ARCH_OPT="${1:-}"
      if [[ -z "${ARCH_OPT}" ]]; then
        echo "error: --arch requires arm64|x64|host" >&2
        exit 1
      fi
      ;;
    --arch=*)
      ARCH_OPT="${1#--arch=}"
      ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      if [[ -z "${VARIANT}" ]]; then
        VARIANT="$1"
      else
        echo "error: unexpected argument: $1" >&2
        exit 1
      fi
      ;;
  esac
  shift
done

# Aliases that imply arch + Metal backend on macOS
if [[ "${VARIANT}" == "darwin-x64" ]]; then
  VARIANT="metal"
  ARCH_OPT="x64"
elif [[ "${VARIANT}" == "darwin-arm64" ]]; then
  if [[ "$(uname -m)" == "arm64" ]]; then
    VARIANT="metal-coreml"
  else
    VARIANT="metal"
  fi
  ARCH_OPT="arm64"
elif [[ "${VARIANT}" == "universal" ]]; then
  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "error: universal sidecar builds are only supported on macOS" >&2
    exit 1
  fi
  echo "==> Building universal macOS sidecars (arm64 + x64)"
  "$0" metal-coreml --arch=arm64
  "$0" metal --arch=x64
  echo "==> Universal sidecar binaries:"
  ls -la "${ROOT}/sidecar/bin"/darwin-* || true
  exit 0
fi

if [[ -z "${VARIANT}" ]]; then
  case "$(uname -s)" in
    Darwin)
      if [[ "$(uname -m)" == "arm64" && "${ARCH_OPT}" != "x64" ]]; then
        VARIANT="metal-coreml"
      else
        VARIANT="metal"
      fi
      ;;
    Linux) VARIANT="vulkan-openblas" ;;
    *) VARIANT="cpu" ;;
  esac
fi

# Resolve arch → CMAKE_OSX_ARCHITECTURES / build dir suffix
HOST_ARCH="$(uname -m)"
case "${ARCH_OPT}" in
  host|"")
    if [[ "${HOST_ARCH}" == "arm64" ]]; then
      TARGET_ARCH="arm64"
      OSX_ARCH="arm64"
    else
      TARGET_ARCH="x64"
      OSX_ARCH="x86_64"
    fi
    ;;
  arm64)
    TARGET_ARCH="arm64"
    OSX_ARCH="arm64"
    ;;
  x64|x86_64|amd64)
    TARGET_ARCH="x64"
    OSX_ARCH="x86_64"
    ;;
  *)
    echo "error: unknown arch '${ARCH_OPT}' (use arm64|x64|host)" >&2
    exit 1
    ;;
esac

# metal-coreml is Apple Silicon only
if [[ "${VARIANT}" == "metal-coreml" && "${TARGET_ARCH}" == "x64" ]]; then
  echo "==> Note: metal-coreml is arm64-only; using metal for darwin-x64"
  VARIANT="metal"
fi

BUILD_DIR="${ROOT}/sidecar/build-${TARGET_ARCH}"
BIN_DIR="${ROOT}/sidecar/bin"
mkdir -p "${BIN_DIR}"

CMAKE_ARGS=(
  -B "${BUILD_DIR}"
  -S "${ROOT}/sidecar"
  -DCMAKE_BUILD_TYPE=Release
  "-DSIDECAR_VARIANT=${VARIANT}"
)

if [[ "$(uname -s)" == "Darwin" ]]; then
  CMAKE_ARGS+=("-DCMAKE_OSX_ARCHITECTURES=${OSX_ARCH}")
fi

if [[ -n "${LLAMA_CPP_UPSTREAM:-}" ]]; then
  CMAKE_ARGS+=("-DLLAMA_CPP_UPSTREAM=${LLAMA_CPP_UPSTREAM}")
fi
if [[ -n "${OPENBLAS_ROOT:-}" ]]; then
  CMAKE_ARGS+=("-DOPENBLAS_ROOT=${OPENBLAS_ROOT}" "-DCMAKE_PREFIX_PATH=${OPENBLAS_ROOT}")
fi
if [[ -n "${VULKAN_SDK:-}" ]]; then
  CMAKE_ARGS+=("-DVULKAN_SDK=${VULKAN_SDK}" "-DCMAKE_PREFIX_PATH=${VULKAN_SDK};${OPENBLAS_ROOT:-}")
fi

echo "==> Configuring sidecar (variant=${VARIANT} arch=${TARGET_ARCH})"
cmake "${CMAKE_ARGS[@]}"

echo "==> Building sidecar"
cmake --build "${BUILD_DIR}" --config Release -j"$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)"

echo "==> Staging binaries to sidecar/bin/"
# Prefer the expected named binary; fall back to copying executables from build/bin
EXPECTED_NAME=""
if [[ "$(uname -s)" == "Darwin" ]]; then
  EXPECTED_NAME="darwin-${TARGET_ARCH}"
elif [[ "$(uname -s)" == "Linux" ]]; then
  if [[ "${VARIANT}" == "vulkan-openblas" ]]; then
    EXPECTED_NAME="linux-${TARGET_ARCH}"
  else
    EXPECTED_NAME="linux-${TARGET_ARCH}-${VARIANT}"
  fi
fi

if [[ -n "${EXPECTED_NAME}" && -f "${BUILD_DIR}/bin/${EXPECTED_NAME}" ]]; then
  cp -f "${BUILD_DIR}/bin/${EXPECTED_NAME}" "${BIN_DIR}/"
elif [[ -n "${EXPECTED_NAME}" && -f "${BUILD_DIR}/bin/${EXPECTED_NAME}.exe" ]]; then
  cp -f "${BUILD_DIR}/bin/${EXPECTED_NAME}.exe" "${BIN_DIR}/"
else
  find "${BUILD_DIR}/bin" -maxdepth 1 -type f -perm +111 2>/dev/null | while read -r f; do
    cp -f "$f" "${BIN_DIR}/"
  done
fi

find "${BUILD_DIR}/bin" -maxdepth 1 -type f \( -name "*.exe" -o -name "*.dll" -o -name "*.so" -o -name "libggml-*" -o -name "ggml-*" \) 2>/dev/null | while read -r f; do
  cp -f "$f" "${BIN_DIR}/" || true
done

# Stage ggml GPU plugins into electron-expected layout
if [[ "$(uname -s)" == "Linux" ]]; then
  PLUGIN_DST="${BIN_DIR}/ggml-plugins/linux-${TARGET_ARCH}"
  mkdir -p "${PLUGIN_DST}"
  if [[ -d "${BUILD_DIR}/ggml-plugins" ]]; then
    cp -f "${BUILD_DIR}/ggml-plugins/"* "${PLUGIN_DST}/" 2>/dev/null || true
  fi
  find "${BUILD_DIR}" -type f \( -name 'libggml-vulkan.so*' -o -name 'ggml-vulkan.so*' \) 2>/dev/null | while read -r f; do
    cp -f "$f" "${PLUGIN_DST}/" || true
    cp -f "$f" "${BIN_DIR}/" || true
  done
fi

if [[ -n "${EXPECTED_NAME}" ]]; then
  STAGED="${BIN_DIR}/${EXPECTED_NAME}"
  if [[ -f "${STAGED}" ]]; then
    if command -v file >/dev/null 2>&1; then
      echo "==> Built $(file "${STAGED}")"
    else
      echo "==> Built ${STAGED}"
    fi
  else
    echo "warning: expected ${EXPECTED_NAME} not found in ${BIN_DIR}" >&2
  fi
fi

echo "==> Done. Binaries in ${BIN_DIR}:"
ls -la "${BIN_DIR}" || true
ls -la "${BIN_DIR}/ggml-plugins" 2>/dev/null || true
