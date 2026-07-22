#!/usr/bin/env bash
# Build llama-cpp sidecar for Linux (x64) with Vulkan default; optional variant arg.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VARIANT="${1:-vulkan-openblas}"
exec "${ROOT}/scripts/build-sidecar.sh" "${VARIANT}"
