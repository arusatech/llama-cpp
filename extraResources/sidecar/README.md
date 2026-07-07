# Pre-built desktop sidecar binaries are placed here for electron-builder packaging.
#
# Expected layout (after `npm run build:sidecar`):
#   darwin-arm64
#   darwin-x64
#   linux-x64
#   win32-x64.exe
#   win32-x64-rocm.exe   (optional AMD variant)
#   libggml-vulkan.so    (optional GPU plugins, same directory as sidecar)
#
# CI release workflows copy from sidecar/bin/ — see docs/DESKTOP_ARCHITECTURE.md
