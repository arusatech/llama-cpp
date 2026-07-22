#!/usr/bin/env bash
# Copy the correct llama-cpp.xcframework slice into App.app/Frameworks for dlopen.
# Invoked from the iOS app Xcode target (Run Script) or manually with Xcode env vars set.
set -euo pipefail

if [ -z "${TARGET_BUILD_DIR:-}" ] || [ -z "${FRAMEWORKS_FOLDER_PATH:-}" ]; then
  echo "embed-llama-ios-app-framework: skip (not running inside an Xcode build)."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
XCF="$PLUGIN_DIR/ios/Frameworks/llama-cpp.xcframework"

if [ ! -d "$XCF" ]; then
  echo "error: missing $XCF" >&2
  echo "  From your app root run: npm run ios:prepare-llama-cpp" >&2
  exit 1
fi

pick_slice() {
  case "${PLATFORM_NAME:-}" in
    iphoneos)
      echo "ios-arm64"
      ;;
    iphonesimulator)
      if [ -d "$XCF/ios-arm64-simulator" ]; then
        echo "ios-arm64-simulator"
      elif [ -d "$XCF/ios-x86_64-simulator" ]; then
        echo "ios-x86_64-simulator"
      else
        echo "error: no simulator slice in $XCF" >&2
        exit 1
      fi
      ;;
    *)
      echo "error: unsupported PLATFORM_NAME=${PLATFORM_NAME:-}" >&2
      exit 1
      ;;
  esac
}

SLICE="$(pick_slice)"
SRC_FW="$XCF/$SLICE/llama-cpp.framework"
DEST_DIR="${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}"
DEST_FW="$DEST_DIR/llama-cpp.framework"
DEST_BIN="$DEST_FW/llama-cpp"

if [ ! -f "$SRC_FW/llama-cpp" ]; then
  echo "error: xcframework slice binary missing: $SRC_FW/llama-cpp" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
rm -rf "$DEST_FW"
ditto "$SRC_FW" "$DEST_FW"

if [ -n "${EXPANDED_CODE_SIGN_IDENTITY:-}" ] && [ "${CODE_SIGNING_ALLOWED:-}" != "NO" ]; then
  /usr/bin/codesign --force --sign "${EXPANDED_CODE_SIGN_IDENTITY}" \
    --preserve-metadata=identifier,entitlements,flags "$DEST_BIN" 2>/dev/null || true
fi

echo "Embedded llama-cpp.framework ($SLICE) -> $DEST_FW"
