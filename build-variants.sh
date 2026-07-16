#!/bin/bash

###############################################################################
# Build Variants Script for llama-cpp-capacitor / llama-cpp-pro
#
# Builds optimized variants for different use cases:
# - minimal: Production npm release (~20 MB, no sources)
# - core: Balanced (~30-35 MB, includes C++ sources)
# - development: Full debug build (~50-60 MB, all architectures)
# - ios-only: iOS framework only
# - android-only: Android library only
# - desktop: TypeScript + PWA/WASM + desktop sidecar (Electron)
# - desktop-only: Sidecar + stage only (fast Electron iteration)
# - full: Complete build (not recommended)
#
# Usage:
#   ./build-variants.sh --variant desktop
#   ./build-variants.sh --variant desktop --desktop-backend metal-coreml
#   ./build-variants.sh --variant full --with-desktop --desktop-backend cuda
#   ./build-variants.sh --help
###############################################################################

set -e

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VARIANT="minimal"
WITH_DESKTOP=0
DESKTOP_BACKEND="${DESKTOP_BACKEND:-auto}"
DESKTOP_ARCH="${DESKTOP_ARCH:-host}"

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

print_usage() {
    cat <<'EOF'
Usage: ./build-variants.sh [options]

Options:
  --variant <name>              Build variant (default: minimal)
  --with-desktop                Also build + stage the desktop sidecar
  --desktop-backend <backend>   GPU backend for sidecar (implies --with-desktop)
  --desktop-arch <arch>         host|arm64|x64|universal (macOS; default: host)
  -h, --help                    Show this help

Variants:
  minimal         Production (~20 MB, no sources) + PWA
  core            Balanced (~30-35 MB, with sources) + PWA
  development     Debug (~50-60 MB, all architectures) + PWA
  ios-only        iOS only (~8-10 MB)
  android-only    Android only (~25-30 MB)
  desktop         TypeScript + PWA + desktop sidecar (Electron)
  desktop-only    Sidecar + stage only (fast Electron rebuild)
  full            Everything (~70+ MB, NOT recommended)

Desktop backends (passed to scripts/build-sidecar.sh):
  auto              Host default (metal-coreml/metal on macOS, vulkan-openblas on Linux)
  metal-coreml      macOS arm64 Metal + CoreML
  metal             macOS Metal
  vulkan            Vulkan only
  vulkan-openblas   Vulkan + OpenBLAS (default Linux)
  cuda              NVIDIA CUDA
  rocm              AMD ROCm/HIP
  intel             Alias for vulkan (Intel Arc via Vulkan; no SYCL yet)
  cpu               CPU only
  openblas          CPU + OpenBLAS
  universal         macOS only: build both darwin-arm64 + darwin-x64 (via --desktop-arch)

Examples:
  ./build-variants.sh --variant desktop
  ./build-variants.sh --variant desktop --desktop-backend metal-coreml
  ./build-variants.sh --variant desktop --desktop-arch=universal
  ./build-variants.sh --variant desktop-only --desktop-arch=x64
  ./build-variants.sh --variant desktop --desktop-backend cuda
  ./build-variants.sh --variant desktop --desktop-backend intel
  ./build-variants.sh --variant full --with-desktop --desktop-backend vulkan
  ./build-variants.sh --variant desktop-only --desktop-backend cpu
EOF
}

parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --variant)
                shift
                if [ -z "${1:-}" ]; then
                    print_error "--variant requires a value"
                    print_usage
                    exit 1
                fi
                VARIANT="$1"
                ;;
            --variant=*)
                VARIANT="${1#--variant=}"
                ;;
            --with-desktop)
                WITH_DESKTOP=1
                ;;
            --desktop-backend)
                shift
                if [ -z "${1:-}" ]; then
                    print_error "--desktop-backend requires a value"
                    print_usage
                    exit 1
                fi
                DESKTOP_BACKEND="$1"
                WITH_DESKTOP=1
                ;;
            --desktop-backend=*)
                DESKTOP_BACKEND="${1#--desktop-backend=}"
                WITH_DESKTOP=1
                ;;
            --desktop-arch)
                shift
                if [ -z "${1:-}" ]; then
                    print_error "--desktop-arch requires host|arm64|x64|universal"
                    print_usage
                    exit 1
                fi
                DESKTOP_ARCH="$1"
                WITH_DESKTOP=1
                ;;
            --desktop-arch=*)
                DESKTOP_ARCH="${1#--desktop-arch=}"
                WITH_DESKTOP=1
                ;;
            -h|--help)
                print_usage
                exit 0
                ;;
            minimal|core|development|ios-only|android-only|full|desktop|desktop-only)
                # Legacy positional: ./build-variants.sh desktop
                VARIANT="$1"
                ;;
            *)
                print_error "Unknown argument: $1"
                echo ""
                print_usage
                exit 1
                ;;
        esac
        shift
    done

    case "$VARIANT" in
        desktop|desktop-only)
            WITH_DESKTOP=1
            ;;
    esac
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

build_typescript() {
    print_status "Building TypeScript..."
    
    if ! command -v npm &> /dev/null; then
        print_warning "npm not found. Skipping TypeScript build."
        return 0
    fi
    
    # Compile TypeScript (without cleaning)
    if npm run docgen 2>/dev/null && tsc && npx rollup -c rollup.config.mjs 2>/dev/null; then
        print_success "TypeScript compiled successfully"
        return 0
    else
        print_warning "TypeScript build failed"
        return 0
    fi
}

# ============================================================================
# Desktop / Electron sidecar
# ============================================================================

resolve_desktop_backend() {
    local requested="${1:-auto}"
    local resolved=""

    case "$requested" in
        auto|"")
            case "$(uname -s)" in
                Darwin)
                    if [[ "$(uname -m)" == "arm64" ]]; then
                        resolved="metal-coreml"
                    else
                        resolved="metal"
                    fi
                    ;;
                Linux)
                    resolved="vulkan-openblas"
                    ;;
                *)
                    resolved="cpu"
                    ;;
            esac
            ;;
        intel)
            # Intel Arc / iGPU: use Vulkan. SYCL/oneAPI is not wired in sidecar yet.
            resolved="vulkan"
            print_status "Desktop backend 'intel' maps to 'vulkan' (no SYCL backend yet)" >&2
            ;;
        metal|metal-coreml|vulkan|vulkan-openblas|cuda|rocm|cpu|openblas)
            resolved="$requested"
            ;;
        metal+coreml|coreml)
            resolved="metal-coreml"
            ;;
        nvidia)
            resolved="cuda"
            ;;
        amd|hip)
            resolved="rocm"
            ;;
        *)
            print_error "Unknown desktop backend: $requested"
            echo "Valid: auto metal metal-coreml vulkan vulkan-openblas cuda rocm intel cpu openblas"
            return 1
            ;;
    esac

    echo "$resolved"
}

build_desktop() {
    local include_pwa="${1:-0}"
    local backend

    print_header "Building Desktop Sidecar (Electron)"

    backend="$(resolve_desktop_backend "$DESKTOP_BACKEND")" || return 1
    print_status "Desktop backend: $backend (requested: $DESKTOP_BACKEND)"
    print_status "Desktop arch: $DESKTOP_ARCH"

    if [ "$include_pwa" = "1" ]; then
        build_pwa || print_warning "PWA build skipped"
    fi

    if [ ! -x "./scripts/build-sidecar.sh" ]; then
        print_error "scripts/build-sidecar.sh not found or not executable"
        return 1
    fi

    case "$DESKTOP_ARCH" in
        universal|all)
            if ! ./scripts/build-sidecar.sh universal; then
                print_error "Universal sidecar build failed"
                return 1
            fi
            ;;
        host|"")
            if ! ./scripts/build-sidecar.sh "$backend"; then
                print_error "Sidecar build failed for backend: $backend"
                print_warning "CUDA/ROCm must be built on Linux/Windows hosts with the toolkit installed."
                print_warning "GPU plugins may need: LLAMA_CPP_UPSTREAM=/path/to/llama.cpp"
                return 1
            fi
            ;;
        arm64|x64)
            if ! ./scripts/build-sidecar.sh "$backend" --arch="$DESKTOP_ARCH"; then
                print_error "Sidecar build failed for backend=$backend arch=$DESKTOP_ARCH"
                return 1
            fi
            ;;
        *)
            print_error "Unknown --desktop-arch: $DESKTOP_ARCH (use host|arm64|x64|universal)"
            return 1
            ;;
    esac
    print_success "Sidecar built (backend=$backend arch=$DESKTOP_ARCH)"

    if ! command -v npm &> /dev/null; then
        print_error "npm not found. Cannot stage desktop resources."
        return 1
    fi

    if ! npm run stage:desktop; then
        print_error "stage:desktop failed"
        return 1
    fi
    print_success "Desktop resources staged to extraResources/"
}

build_desktop_variant() {
    print_header "Building DESKTOP Variant (Electron)"
    print_status "Contents: TypeScript + PWA/WASM + sidecar + staged extraResources"

    build_typescript || print_warning "TypeScript build skipped"
    build_desktop 1 || return 1

    print_success "Desktop variant ready"
}

build_desktop_only() {
    print_header "Building DESKTOP-ONLY Variant"
    print_status "Contents: Sidecar + staged extraResources (no TS / no mobile)"

    build_desktop 0 || return 1

    print_success "Desktop-only variant ready"
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
    
    # Build TypeScript
    build_typescript || print_warning "TypeScript build skipped"
    
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
    
    # Build TypeScript
    build_typescript || print_warning "TypeScript build skipped"
    
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
    
    # Build TypeScript
    build_typescript || print_warning "TypeScript build skipped"
    
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
    
    # Build TypeScript
    build_typescript || print_warning "TypeScript build skipped"
    
    print_warning "Full variant ready (NOT recommended for production)"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    parse_args "$@"

    print_header "llama-cpp-pro Build Variants v0.2.0"
    
    echo "Variant: $VARIANT"
    echo "Strip symbols: $STRIP_SYMBOLS"
    echo "Build jobs: $BUILD_JOBS"
    echo "With desktop: $WITH_DESKTOP"
    echo "Desktop backend: $DESKTOP_BACKEND"
    echo "Desktop arch: $DESKTOP_ARCH"
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
        desktop)
            build_desktop_variant
            ;;
        desktop-only)
            build_desktop_only
            ;;
        full)
            build_full
            ;;
        *)
            print_error "Unknown variant: $VARIANT"
            echo ""
            print_usage
            exit 1
            ;;
    esac

    # Optional desktop sidecar on mobile/package variants
    case "$VARIANT" in
        minimal|core|development|full)
            if [ "$WITH_DESKTOP" = "1" ]; then
                build_desktop 0 || print_warning "Desktop sidecar build failed"
            fi
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
    if [ -d "sidecar/bin" ]; then
        echo "Desktop sidecar: $(get_dir_size 'sidecar/bin')"
    fi
    if [ -d "extraResources/sidecar" ]; then
        echo "Staged desktop: $(get_dir_size 'extraResources/sidecar')"
    fi
    if [ -d "cpp" ]; then
        echo "C++ Sources: $(get_dir_size 'cpp')"
    fi
    
    print_success "Build variant '$VARIANT' completed successfully!"
    echo ""
    if [ "$VARIANT" = "desktop" ] || [ "$VARIANT" = "desktop-only" ] || [ "$WITH_DESKTOP" = "1" ]; then
        echo "Next steps (Electron):"
        echo "  1. Point electron-builder extraResources at extraResources/"
        echo "  2. Use: require('llama-cpp-pro/desktop') in main process"
        echo "  3. Optional: npm run verify:desktop:bundle"
        echo ""
    else
        echo "Next steps:"
        echo "  1. Run: npm run verify:pack:artifacts"
        echo "  2. Run: npm pack --ignore-scripts"
        echo "  3. Run: npm publish"
        echo "  Tip: add --with-desktop for Electron sidecar"
        echo ""
    fi
}

# Run main
main "$@"
