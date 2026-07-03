#!/bin/bash

###############################################################################
# Build Variants Script for llama-cpp-capacitor
# 
# Builds optimized variants for different use cases:
# - minimal: Production npm release (~20 MB, no sources)
# - core: Balanced (~30-35 MB, includes C++ sources)
# - development: Full debug build (~50-60 MB, all architectures)
# - ios-only: iOS framework only
# - android-only: Android library only
# - full: Complete build (not recommended)
#
# Usage: ./build-variants.sh --variant [minimal|core|development|ios-only|android-only|full]
###############################################################################

set -e

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Build configuration
VARIANT="${1##--variant }"
if [ -z "$VARIANT" ] || [ "$VARIANT" = "--variant" ]; then
    VARIANT="minimal"
fi

# Environment overrides
STRIP_SYMBOLS="${STRIP_SYMBOLS:-true}"
BUILD_JOBS="${BUILD_JOBS:-$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)}"
VERBOSE="${VERBOSE:-0}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# ============================================================================
# Helper Functions
# ============================================================================

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓ SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠ WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗ ERROR]${NC} $1"
}

print_header() {
    echo -e "\n${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}$1${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

bytes_to_mb() {
    awk -v bytes="$1" 'BEGIN { printf "%.2f", bytes / 1048576 }'
}

get_dir_size() {
    if [ -d "$1" ]; then
        du -sh "$1" | cut -f1
    else
        echo "0 MB"
    fi
}

# ============================================================================
# Platform Detection
# ============================================================================

check_macos() {
    if [[ "$OSTYPE" != "darwin"* ]]; then
        return 1
    fi
    return 0
}

check_android_sdk() {
    if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
        return 1
    fi
    return 0
}

detect_ndk() {
    local sdk="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
    local ndk_root="$sdk/ndk"
    if [ ! -d "$ndk_root" ]; then
        return 1
    fi
    local latest=""
    local latest_ver=0
    for v in "$ndk_root"/*; do
        [ -d "$v" ] || continue
        local base=$(basename "$v")
        if [[ "$base" =~ ^[0-9] ]]; then
            local ver=$(echo "$base" | sed 's/[^0-9]//g' | head -c 10)
            ver=${ver:-0}
            if [ "$ver" -gt "$latest_ver" ] 2>/dev/null; then
                latest_ver=$ver
                latest=$v
            fi
        fi
    done
    if [ -n "$latest" ] && [ -f "$latest/build/cmake/android.toolchain.cmake" ]; then
        echo "$latest"
        return 0
    fi
    return 1
}

# ============================================================================
# Build Functions
# ============================================================================

build_ios() {
    local architectures="$1"
    local keep_debug="$2"
    
    print_status "Building iOS for architectures: $architectures"
    
    if ! check_macos; then
        print_warning "iOS builds require macOS. Skipping."
        return 0
    fi
    
    rm -rf ios/build
    mkdir -p ios/build
    cd ios/build
    
    cmake .. \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_OSX_SYSROOT=iphoneos \
        -DCMAKE_OSX_ARCHITECTURES="$architectures" \
        -DCMAKE_OSX_DEPLOYMENT_TARGET=13.0 \
        -DCMAKE_XCODE_ATTRIBUTE_ENABLE_BITCODE=NO
    
    cmake --build . --config Release -- -j"$BUILD_JOBS"
    
    if [ -d "llama-cpp.framework" ]; then
        local binary=""
        if [ -f "llama-cpp.framework/llama-cpp" ]; then
            binary="llama-cpp.framework/llama-cpp"
        elif [ -f "llama-cpp.framework/Versions/A/llama-cpp" ]; then
            binary="llama-cpp.framework/Versions/A/llama-cpp"
        fi
        
        if [ -n "$binary" ] && [ "$keep_debug" = "false" ]; then
            if xcrun strip -x -S "$binary" 2>/dev/null; then
                print_status "Stripped iOS framework debug symbols"
            fi
        fi
        
        rm -rf ../Frameworks/llama-cpp.framework
        mkdir -p ../Frameworks/llama-cpp.framework/Resources
        
        if [ -n "$binary" ]; then
            cp "$binary" ../Frameworks/llama-cpp.framework/llama-cpp
        fi
        [ -f llama-cpp.framework/Info.plist ] && cp llama-cpp.framework/Info.plist ../Frameworks/llama-cpp.framework/
        [ -f llama-cpp.framework/Versions/A/Resources/Info.plist ] && cp llama-cpp.framework/Versions/A/Resources/Info.plist ../Frameworks/llama-cpp.framework/Resources/
        
        print_success "iOS framework ready"
    else
        print_error "iOS framework not found"
        cd ../..
        return 1
    fi
    
    cd ../..
}

build_android() {
    local architectures="$1"
    local keep_debug="$2"
    
    print_status "Building Android for architectures: $architectures"
    
    if ! check_android_sdk; then
        print_warning "Android SDK not found. Skipping Android build."
        return 0
    fi
    
    local android_ndk=$(detect_ndk)
    if [ -z "$android_ndk" ]; then
        print_error "Android NDK not found"
        return 1
    fi
    
    print_status "Using NDK: $android_ndk"
    
    local toolchain_file="$android_ndk/build/cmake/android.toolchain.cmake"
    if [ ! -f "$toolchain_file" ]; then
        print_error "Toolchain file not found: $toolchain_file"
        return 1
    fi
    
    rm -rf android/build
    mkdir -p android/build
    cd android/build
    
    # Build each architecture
    for arch in $architectures; do
        print_status "Building for $arch..."
        
        local arch_name=""
        local abi=""
        case "$arch" in
            "arm64")
                arch_name="arm64-v8a"
                abi="arm64-v8a"
                ;;
            "x86_64")
                arch_name="x86_64"
                abi="x86_64"
                ;;
            *)
                print_error "Unknown architecture: $arch"
                return 1
                ;;
        esac
        
        rm -rf CMakeCache.txt CMakeFiles Makefile cmake_install.cmake 2>/dev/null || true
        
        cmake ../src/main \
            -DCMAKE_BUILD_TYPE=Release \
            -DANDROID_ABI="$abi" \
            -DANDROID_PLATFORM=android-21 \
            -DCMAKE_TOOLCHAIN_FILE="$toolchain_file" \
            -DANDROID_STL=c++_shared
        
        cmake --build . --config Release -- -j"$BUILD_JOBS"
        
        local so_path="../src/main/jniLibs/$arch_name/libllama-cpp-arm64.so"
        if [ "$arch" = "x86_64" ]; then
            so_path="../src/main/jniLibs/$arch_name/libllama-cpp-x86_64.so"
        fi
        
        if [ -f "$so_path" ]; then
            if [ "$keep_debug" = "false" ] && [ "$STRIP_SYMBOLS" = "true" ]; then
                local prebuilt="$android_ndk/toolchains/llvm/prebuilt"
                local tool_bin=""
                
                if [ -d "$prebuilt/darwin-x86_64" ]; then
                    tool_bin="$prebuilt/darwin-x86_64/bin"
                elif [ -d "$prebuilt/darwin-aarch64" ]; then
                    tool_bin="$prebuilt/darwin-aarch64/bin"
                elif [ -d "$prebuilt/linux-x86_64" ]; then
                    tool_bin="$prebuilt/linux-x86_64/bin"
                fi
                
                if [ -n "$tool_bin" ]; then
                    local strip_tool="$tool_bin/llvm-strip"
                    if [ -f "$strip_tool" ]; then
                        "$strip_tool" --strip-unneeded "$so_path"
                        print_status "Stripped $arch_name symbols"
                    fi
                fi
            fi
            
            print_success "Built for $arch_name"
        else
            print_warning "Library not found at $so_path"
        fi
    done
    
    cd ../..
    print_success "Android build complete"
}

# ============================================================================
# Variant Builders
# ============================================================================

build_pwa() {
    print_status "Building PWA/WASM assets..."
    
    if ! command -v npm &> /dev/null; then
        print_warning "npm not found. Skipping PWA build."
        return 0
    fi
    
    # Run npm script for PWA
    if npm run build:pwa 2>/dev/null; then
        print_success "PWA/WASM built successfully"
        return 0
    else
        print_warning "PWA build failed or npm run build:pwa not available"
        return 0
    fi
}

build_minimal() {
    print_header "Building MINIMAL Variant (~25-30 MB)"
    print_status "Contents: iOS arm64 + Android arm64 + PWA/WASM, stripped, no sources"
    
    # Clean previous builds
    rm -rf ios/build ios/Frameworks android/build
    
    # Build iOS arm64 only
    if check_macos; then
        build_ios "arm64" "false" || print_warning "iOS build skipped"
    fi
    
    # Build Android arm64 only
    if check_android_sdk; then
        build_android "arm64" "false" || print_warning "Android build skipped"
    fi
    
    # Build PWA/WASM
    build_pwa || print_warning "PWA build skipped"
    
    # Remove C++ sources
    print_status "C++ sources excluded for minimal size..."
    
    print_success "Minimal variant ready"
    print_status "Size will be optimized in package.json files array"
}

build_core() {
    print_header "Building CORE Variant (~30-35 MB)"
    print_status "Contents: iOS arm64 + Android arm64, stripped, with C++ sources + PWA/WASM"
    
    # Clean previous builds
    rm -rf ios/build ios/Frameworks android/build
    
    # Build iOS arm64 only
    if check_macos; then
        build_ios "arm64" "false" || print_warning "iOS build skipped"
    fi
    
    # Build Android arm64 only
    if check_android_sdk; then
        build_android "arm64" "false" || print_warning "Android build skipped"
    fi
    
    # Build PWA/WASM
    build_pwa || print_warning "PWA build skipped"
    
    # Keep C++ sources
    print_status "C++ sources included for flexibility"
    
    print_success "Core variant ready"
}

build_development() {
    print_header "Building DEVELOPMENT Variant (~50-60 MB)"
    print_status "Contents: iOS (arm64+x86_64) + Android (arm64+x86_64) + PWA/WASM, WITH debug symbols"
    
    # Clean previous builds
    rm -rf ios/build ios/Frameworks android/build
    
    # Build iOS arm64+x86_64 (keep debug symbols)
    if check_macos; then
        build_ios "arm64;x86_64" "true" || print_warning "iOS build skipped"
    fi
    
    # Build Android both architectures (keep debug symbols)
    if check_android_sdk; then
        build_android "arm64 x86_64" "true" || print_warning "Android build skipped"
    fi
    
    # Build PWA/WASM
    build_pwa || print_warning "PWA build skipped"
    
    # Keep everything
    print_status "Full sources and debug symbols included for development"
    
    print_success "Development variant ready"
}

build_ios_only() {
    print_header "Building iOS-ONLY Variant (~8-10 MB)"
    print_status "Contents: iOS arm64 framework only, stripped"
    
    # Clean previous builds
    rm -rf ios/build ios/Frameworks android/build
    
    # Build iOS only
    if check_macos; then
        build_ios "arm64" "false" || print_error "iOS build failed"
    else
        print_error "iOS builds require macOS"
        return 1
    fi
    
    print_success "iOS-only variant ready"
}

build_android_only() {
    print_header "Building Android-ONLY Variant (~25-30 MB)"
    print_status "Contents: Android arm64 library only, stripped"
    
    # Clean previous builds
    rm -rf ios/build ios/Frameworks android/build
    
    # Build Android only
    if check_android_sdk; then
        build_android "arm64" "false" || print_error "Android build failed"
    else
        print_error "Android SDK not found"
        return 1
    fi
    
    print_success "Android-only variant ready"
}

build_full() {
    print_header "Building FULL Variant (~70+ MB)"
    print_warning "Full builds are NOT recommended for production!"
    print_status "Contents: Everything, all architectures, debug symbols, PWA/WASM"
    
    # Clean previous builds
    rm -rf ios/build ios/Frameworks android/build
    
    # Build iOS all architectures
    if check_macos; then
        build_ios "arm64;x86_64" "true" || print_warning "iOS build skipped"
    fi
    
    # Build Android all architectures
    if check_android_sdk; then
        build_android "arm64 x86_64" "true" || print_warning "Android build skipped"
    fi
    
    # Build PWA/WASM
    build_pwa || print_warning "PWA build skipped"
    
    print_warning "Full variant ready (NOT recommended for production)"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    print_header "llama-cpp-capacitor Build Variants v0.2.0"
    
    echo "Variant: $VARIANT"
    echo "Strip symbols: $STRIP_SYMBOLS"
    echo "Build jobs: $BUILD_JOBS"
    echo ""
    
    # Validate variant
    case "$VARIANT" in
        minimal)
            build_minimal
            ;;
        core)
            build_core
            ;;
        development)
            build_development
            ;;
        ios-only)
            build_ios_only
            ;;
        android-only)
            build_android_only
            ;;
        full)
            build_full
            ;;
        *)
            print_error "Unknown variant: $VARIANT"
            echo ""
            echo "Available variants:"
            echo "  minimal       - Production (~20 MB, no sources)"
            echo "  core          - Balanced (~30-35 MB, with sources)"
            echo "  development   - Debug (~50-60 MB, all architectures)"
            echo "  ios-only      - iOS only (~8-10 MB)"
            echo "  android-only  - Android only (~25-30 MB)"
            echo "  full          - Everything (~70+ MB, NOT recommended)"
            echo ""
            exit 1
            ;;
    esac
    
    # Report sizes
    print_header "Build Summary"
    if [ -d "ios/Frameworks" ]; then
        echo "iOS: $(get_dir_size 'ios/Frameworks')"
    fi
    if [ -d "android/src/main/jniLibs" ]; then
        echo "Android: $(get_dir_size 'android/src/main/jniLibs')"
    fi
    if [ -d "cpp" ]; then
        echo "C++ Sources: $(get_dir_size 'cpp')"
    fi
    
    print_success "Build variant '$VARIANT' completed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Run: npm run build"
    echo "  2. Run: npm run verify:pack:artifacts"
    echo "  3. Run: npm pack --ignore-scripts"
    echo ""
}

# Run main
main "$@"
