#!/usr/bin/env bash
# Build llama-cpp.xcframework (device + simulator) for Capacitor iOS / SPM consumers.
# Run from the plugin repo root, or from a consumer app via:
#   bash node_modules/llama-cpp-capacitor/scripts/ensure-llama-ios-xcframework.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Plugin root: this script lives in scripts/ inside the npm package.
if [ -f "$SCRIPT_DIR/../ios/CMakeLists.txt" ] && [ -f "$SCRIPT_DIR/../package.json" ]; then
  PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  echo "Error: could not locate llama-cpp-capacitor plugin root (expected ios/CMakeLists.txt next to package.json)."
  exit 1
fi

IOS_DIR="$PLUGIN_DIR/ios"
FRAMEWORK_DIR="$IOS_DIR/Frameworks"
XCFRAMEWORK_DIR="$FRAMEWORK_DIR/llama-cpp.xcframework"
BUILD_PROFILE_FILE="$FRAMEWORK_DIR/.llama-cpp-build-profile"
# Bump when native sources change (e.g. Metal embed) so cached xcframework is rebuilt.
EXPECTED_BUILD_PROFILE="metal-embed-cpu-fallback-v1"
DEVICE_BUILD_DIR="$IOS_DIR/build-device"
SIM_BUILD_DIR="$IOS_DIR/build-simulator"

if [[ "$OSTYPE" != darwin* ]]; then
  echo "Skipping llama-cpp xcframework build: macOS with Xcode is required."
  exit 0
fi

if [ -d "$XCFRAMEWORK_DIR" ]; then
  if [ -f "$BUILD_PROFILE_FILE" ] && [ "$(cat "$BUILD_PROFILE_FILE")" = "$EXPECTED_BUILD_PROFILE" ]; then
    echo "llama-cpp iOS xcframework is already present at $XCFRAMEWORK_DIR"
    exit 0
  fi
  echo "Rebuilding llama-cpp iOS xcframework (build profile changed or missing)."
  rm -rf "$XCFRAMEWORK_DIR"
fi

rm -rf "$DEVICE_BUILD_DIR" "$SIM_BUILD_DIR"

if ! command -v cmake >/dev/null 2>&1; then
  echo "Error: cmake is required to build llama-cpp for iOS."
  exit 1
fi

build_framework() {
  local build_dir="$1"
  local sdk="$2"
  local architectures="$3"

  rm -rf "$build_dir"
  mkdir -p "$build_dir"
  cmake -S "$IOS_DIR" -B "$build_dir" \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_OSX_SYSROOT="$sdk" \
    -DCMAKE_OSX_ARCHITECTURES="$architectures" \
    -DCMAKE_OSX_DEPLOYMENT_TARGET=15.0 \
    -DCMAKE_XCODE_ATTRIBUTE_ENABLE_BITCODE=NO \
    >&2

  local jobs
  jobs="$(sysctl -n hw.ncpu 2>/dev/null || echo 4)"
  cmake --build "$build_dir" --config Release -- -j"$jobs" >&2

  if [ -d "$build_dir/llama-cpp.framework" ]; then
    printf '%s\n' "$build_dir/llama-cpp.framework"
    return 0
  fi

  echo "Error: llama-cpp.framework was not produced in $build_dir" >&2
  exit 1
}

echo "Building llama-cpp for iOS device (arm64)..."
DEVICE_FRAMEWORK="$(build_framework "$DEVICE_BUILD_DIR" iphoneos arm64)"

echo "Building llama-cpp for iOS simulator..."
SIM_ARCHITECTURES="arm64"
if [ "$(uname -m)" = "x86_64" ]; then
  SIM_ARCHITECTURES="x86_64"
fi
SIM_FRAMEWORK="$(build_framework "$SIM_BUILD_DIR" iphonesimulator "$SIM_ARCHITECTURES")"

rm -rf "$XCFRAMEWORK_DIR"
xcodebuild -create-xcframework \
  -framework "$DEVICE_FRAMEWORK" \
  -framework "$SIM_FRAMEWORK" \
  -output "$XCFRAMEWORK_DIR"

if [ ! -d "$XCFRAMEWORK_DIR" ]; then
  echo "Error: failed to create $XCFRAMEWORK_DIR"
  exit 1
fi

mkdir -p "$FRAMEWORK_DIR"
printf '%s' "$EXPECTED_BUILD_PROFILE" > "$BUILD_PROFILE_FILE"

# Keep a flat device framework copy for CocoaPods / dlopen (arm64 slice).
rm -rf "$FRAMEWORK_DIR/llama-cpp.framework"
cp -R "$DEVICE_FRAMEWORK" "$FRAMEWORK_DIR/llama-cpp.framework"

echo "Created llama-cpp xcframework at $XCFRAMEWORK_DIR"
echo "Updated device framework at $FRAMEWORK_DIR/llama-cpp.framework"
