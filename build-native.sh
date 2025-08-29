#!/bin/bash

# Build script for llama-cpp Capacitor plugin
# This script compiles the native llama.cpp library for iOS and Android

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're on macOS for iOS builds
check_macos() {
    if [[ "$OSTYPE" != "darwin"* ]]; then
        print_warning "iOS builds require macOS. Skipping iOS build."
        return 1
    fi
    return 0
}

# Check if Android SDK is available
check_android_sdk() {
    if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
        print_warning "Android SDK not found. Please set ANDROID_HOME or ANDROID_SDK_ROOT."
        print_warning "Skipping Android build."
        return 1
    fi
    return 0
}

# Build iOS library
build_ios() {
    print_status "Building iOS library..."
    
    if ! check_macos; then
        return 1
    fi
    
    # Create build directory
    mkdir -p ios/build
    cd ios/build
    
    # Configure with CMake
    cmake .. \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \
        -DCMAKE_OSX_DEPLOYMENT_TARGET=13.0 \
        -DCMAKE_XCODE_ATTRIBUTE_ENABLE_BITCODE=NO \
        -DCMAKE_XCODE_ATTRIBUTE_ONLY_ACTIVE_ARCH=NO
    
    # Build
    cmake --build . --config Release
    
    # Create framework
    mkdir -p LlamaCpp.framework/Versions/A/Headers
    mkdir -p LlamaCpp.framework/Versions/A/Resources
    
    # Copy library
    cp libllama-cpp.dylib LlamaCpp.framework/Versions/A/LlamaCpp
    
    # Create symbolic links
    cd LlamaCpp.framework/Versions
    ln -sf A Current
    cd ..
    ln -sf Versions/Current/LlamaCpp LlamaCpp
    ln -sf Versions/Current/Headers Headers
    ln -sf Versions/Current/Resources Resources
    
    # Copy headers
    cp ../../cpp/rn-llama.h Versions/A/Headers/
    cp ../../cpp/rn-completion.h Versions/A/Headers/
    cp ../../cpp/rn-tts.h Versions/A/Headers/
    cp ../../cpp/llama.h Versions/A/Headers/
    cp ../../cpp/ggml.h Versions/A/Headers/
    
    # Create Info.plist
    cat > Versions/A/Resources/Info.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>LlamaCpp</string>
    <key>CFBundleIdentifier</key>
    <string>com.arusatech.llama-cpp</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>LlamaCpp</string>
    <key>CFBundlePackageType</key>
    <string>FMWK</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
</dict>
</plist>
EOF
    
    print_success "iOS library built successfully"
    cd ../..
}

# Build Android library
build_android() {
    print_status "Building Android library..."
    
    if ! check_android_sdk; then
        return 1
    fi
    
    # Set Android SDK path
    ANDROID_SDK=${ANDROID_HOME:-$ANDROID_SDK_ROOT}
    ANDROID_NDK="$ANDROID_SDK/ndk"
    
    if [ ! -d "$ANDROID_NDK" ]; then
        print_error "Android NDK not found at $ANDROID_NDK"
        print_error "Please install Android NDK via Android Studio or download manually"
        return 1
    fi
    
    # Create build directory
    mkdir -p android/build
    cd android/build
    
    # Build for each architecture
    for arch in arm64-v8a armeabi-v7a x86 x86_64; do
        print_status "Building for $arch..."
        
        # Configure with CMake
        cmake ../src/main \
            -DCMAKE_BUILD_TYPE=Release \
            -DANDROID_ABI=$arch \
            -DANDROID_PLATFORM=android-21 \
            -DCMAKE_TOOLCHAIN_FILE="$ANDROID_NDK/build/cmake/android.toolchain.cmake" \
            -DANDROID_STL=c++_shared
        
        # Build
        cmake --build . --config Release
        
        # Create output directory
        mkdir -p ../src/main/jniLibs/$arch
        
        # Copy library
        cp libllama-cpp-$arch.so ../src/main/jniLibs/$arch/
        
        print_success "Built for $arch"
    done
    
    print_success "Android library built successfully"
    cd ../..
}

# Main build function
main() {
    print_status "Starting llama-cpp Capacitor plugin build..."
    
    # Check dependencies
    if ! command -v cmake &> /dev/null; then
        print_error "CMake is required but not installed"
        exit 1
    fi
    
    if ! command -v make &> /dev/null; then
        print_error "Make is required but not installed"
        exit 1
    fi
    
    # Build iOS
    if check_macos; then
        build_ios
    fi
    
    # Build Android
    if check_android_sdk; then
        build_android
    fi
    
    print_success "Build completed successfully!"
}

# Run main function
main "$@"
