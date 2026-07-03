# Build System Guide for llama-cpp-capacitor 0.2.0

Complete, consolidated build documentation covering all variants, optimization techniques, and release procedures.

---

## 📖 Table of Contents

- [Quick Start](#quick-start)
- [Build Variants](#build-variants)
- [Optimization Techniques](#optimization-techniques)
- [WASM/PWA Building](#wasmpwa-building)
- [Package Configuration](#package-configuration)
- [Release Process](#release-process)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Quick Start

### For Immediate Production Release

```bash
# 1. Clean all previous builds
npm run clean:all

# 2. Build minimal variant (complete: iOS + Android + PWA/WASM + TypeScript)
./build-variants.sh --variant minimal

# 3. Verify all artifacts exist (checks iOS, Android, PWA/WASM files)
npm run verify:pack:artifacts

# 4. Publish to npm
npm publish
```

**Expected result:** ~23-25 MB package ready on npm ✅

**What happens when you run `npm publish`:**
- Automatically runs prepack hook to verify everything
- Packages all artifacts into .tgz file
- Publishes to npm registry
- **No manual `npm pack` needed!**

**✅ Complete build in ONE variant command - no separate steps needed!**

**If you want to preview package contents before publishing:**
```bash
npm pack --ignore-scripts    # Creates package file and shows npm notice with size
npm publish                  # Then publish to npm
```

**⚠️ DO NOT use `npm pack --dry-run` - it triggers a full rebuild!**

### Size Reference

| Command | Size | Build Time | Use Case |
|---------|------|-----------|----------|
| `--variant minimal` | ~23-25 MB | ~5 min | ✅ Production (default) |
| `--variant core` | ~33-40 MB | ~5 min | Production + rebuild |
| `--variant development` | ~55-70 MB | ~10 min | Dev/testing |
| `--variant ios-only` | ~8-10 MB | ~3 min | iOS only |
| `--variant android-only` | ~25-30 MB | ~5 min | Android only |
| `--variant full` | ~75+ MB | ~10 min | ❌ Not recommended |

---

## Build Variants

### Variant Comparison Table

| Aspect | Minimal | Core | Development | iOS-Only | Android-Only | Full |
|--------|---------|------|-------------|----------|--------------|------|
| **Size** | ~23-25 MB | ~33-40 MB | ~55-70 MB | ~8-10 MB | ~25-30 MB | ~75+ MB |
| **iOS** | arm64 stripped | arm64 stripped | arm64+x86_64 debug | arm64 | ✗ | All |
| **Android** | arm64 stripped | arm64 stripped | arm64+x86_64 debug | ✗ | arm64 | All |
| **Sources** | ✗ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Debug Symbols** | ✗ | ✗ | ✅ | ✗ | ✗ | ✅ |
| **PWA/WASM** | ✅ Included* | ✅ Included* | ✅ Included* | ✗ | ✗ | ✅ Included* |
| **Use Case** | Public npm | Rebuild flex | Local dev | iOS apps | Android apps | ❌ Never |

*PWA/WASM automatically attempted, may fail gracefully if prerequisites missing

### 1. Minimal Variant (20-25 MB) ⭐ RECOMMENDED

**Best for:** Production npm releases

**Contents:**
- iOS framework: arm64 only, debug symbols stripped
- Android .so: arm64-v8a only, stripped
- **WASM files** for web/PWA (automatic)
- JavaScript/TypeScript dist files
- **No** C++ sources
- **No** debug symbols

**Build:**
```bash
./build-variants.sh --variant minimal
```

**Size breakdown:**
- iOS framework (arm64, stripped): ~3-4 MB
- Android .so (arm64, stripped): ~15-16 MB
- WASM + PWA assets: ~2-3 MB (automatic)
- JS/TS dist: ~1-2 MB
- Total: **~23-25 MB**

---

### 2. Core Variant (33-40 MB)

**Best for:** Production with rebuild capability

**Contents:**
- iOS framework: arm64 only, stripped
- Android .so: arm64-v8a only, stripped
- **WASM files** for web/PWA (automatic)
- **WITH** C++ sources for rebuild
- JavaScript/TypeScript dist files

**Build:**
```bash
./build-variants.sh --variant core
```

**When to use:**
- When users might need to rebuild with custom options
- Production releases where flexibility matters
- Complete web support with WASM
- Good balance between size and functionality

---

### 3. Development Variant (55-70 MB)

**Best for:** Local development and testing

**Contents:**
- iOS: arm64 + x86_64, **with** debug symbols
- Android: arm64-v8a + x86_64, **with** debug symbols
- **WASM files** for web/PWA (automatic)
- C++ sources
- All debug information

**Build:**
```bash
./build-variants.sh --variant development
```

**Important:** NOT for public release

**When to use:**
- Local development
- CI/CD testing
- Debugging crashes
- Testing on simulators/emulators

---

### 4. iOS-Only Variant (8-10 MB)

**Best for:** iOS-specific updates

**Contents:**
- iOS arm64 framework, stripped
- C++ sources
- **No** Android files

**Build:**
```bash
./build-variants.sh --variant ios-only
```

---

### 5. Android-Only Variant (25-30 MB)

**Best for:** Android-specific updates

**Contents:**
- Android arm64-v8a .so, stripped
- C++ sources
- **No** iOS files

**Build:**
```bash
./build-variants.sh --variant android-only
```

---

### 6. Full Variant (70+ MB)

**Do NOT use for production.** Included only for backwards compatibility.

Contains everything: all platforms, all architectures, debug symbols, etc.

---

## Optimization Techniques

### 1. Strip Debug Symbols ✅ PRIMARY OPTIMIZATION

**Effect:** Reduces binary size by 30-50%

**How it works:**
- Debug symbols are metadata for debugging, not needed in production
- `llvm-strip --strip-unneeded` removes all non-essential symbols
- Symbols are saved separately (not included in package)

**Savings:**
- Android .so: 48 MB → 15-16 MB (**saves ~32 MB**)
- iOS framework: 5.3 MB → 3-4 MB (**saves ~1.5 MB**)

**Status:** ✅ Enabled by default in all production builds

**Control via environment variable:**
```bash
# Enable stripping (default)
STRIP_SYMBOLS=true ./build-variants.sh --variant minimal

# Keep symbols (for development)
STRIP_SYMBOLS=false ./build-variants.sh --variant development
```

---

### 2. Single Architecture (arm64 for production)

**Effect:** Cuts binary size in half

**How it works:**
- Most production Android devices are 64-bit arm64-v8a
- Removing 32-bit and emulator architectures saves space
- Development builds include x86_64 for emulator/simulator

**Architecture breakdown:**
- arm64-v8a: ~15-16 MB (primary, most devices)
- armeabi-v7a: ~10-12 MB (legacy 32-bit)
- x86_64: ~20-25 MB (emulator only)
- x86: ~15 MB (old emulator)

**Strategy:**
- Production releases (minimal/core): arm64 only
- Development: arm64 + x86_64 for flexibility

---

### 3. Exclude C++ Sources

**Effect:** Reduces package by ~13 MB

**How it works:**
- C++ sources only needed if users want to rebuild
- Minimal variant excludes sources for smallest size
- Core variant includes sources for flexibility

**Comparison:**
```
Minimal (no sources):  ~20 MB  (readonly use)
Core (with sources):   ~30 MB  (rebuild capability)
```

**In package.json:**
```json
// Minimal: exclude cpp/
{
  "files": [
    "android/src/main/jniLibs/",
    "dist/",
    "ios/Frameworks",
    "types/"
    // No cpp/ directory
  ]
}

// Core: include cpp/
{
  "files": [
    "android/src/main/",
    "cpp/",
    "dist/",
    "ios/Frameworks",
    "types/"
  ]
}
```

---

### 4. Release Build Type

**Effect:** Small optimization (~5-10%)

**How it works:**
- CMake `Release` mode enables optimizations: `-O3`, link-time optimization
- Default in all builds

**Configuration:**
```cmake
-DCMAKE_BUILD_TYPE=Release  # Used in all builds
```

---

### 5. Link-Time Optimization (Advanced)

**Effect:** ~10-15% additional reduction (slower build)

**Trade-off:** Slower build (20-50%), smaller binary (~10%)

**Enable in CMakeLists.txt:**
```cmake
set(CMAKE_INTERPROCEDURAL_OPTIMIZATION ON)
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -flto -ffunction-sections -fdata-sections")
```

---

### 6. Remove Unnecessary Files

**Effect:** Saves ~2-5 MB

**Excluded files:**
- `test/` - Test files
- `scripts/` - Build scripts
- `docs/` - Documentation
- `.github/` - CI/CD workflows

**In package.json `files` array:**
```json
{
  "files": [
    "android/src/main/jniLibs/",
    "dist/",
    "ios/Frameworks",
    "types/",
    // No test/, scripts/, docs/, .github/
  ]
}
```

---

## WASM/PWA Building

### WASM Build System

Your project supports multiple build types:

| Build Type | Target | Use |
|-----------|--------|-----|
| **Native** | iOS + Android | Mobile apps (this guide) |
| **WASM** | Browser + Workers | Web/PWA |
| **TypeScript** | Node.js + Browser | Core library |

### WASM Build Prerequisites

Before building WASM, install:

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add wasm target
rustup target add wasm32-unknown-emscripten

# Install Emscripten
brew install emscripten  # macOS
# OR
sudo apt install emscripten  # Linux

# Install wasm-bindgen CLI
cargo install wasm-bindgen-cli
```

**Verify:**
```bash
emcc --version
rustc --version
wasm-bindgen --version
```

### WASM Build Variants

```bash
# Standard WASM (recommended)
npm run build:wasm

# WASM with async file I/O support
npm run build:wasm:jspi

# WASM with multi-threading (requires SharedArrayBuffer)
npm run build:wasm:pthreads

# Full WASM build
npm run build:wasm:full
```

### WASM Build Process (4 Stages)

1. **Cargo Build:** Rust code → WebAssembly (SIDE_MODULE)
2. **wasm-bindgen:** Generate JavaScript glue code
3. **Patch:** Fix compatibility issues
4. **emcc Re-link:** Embed C++ code (SIDE_MODULE → MAIN_MODULE)

**Output:**
```
dist/wasm/
├── llama_engine.js              (JavaScript wrapper)
├── llama_engine.wasm            (SIDE_MODULE binary)
├── llama_engine_emscripten.mjs  (ESM module)
├── llama_engine_emscripten.wasm (MAIN_MODULE binary)
└── llama_engine.d.ts            (TypeScript definitions)
```

### WASM Configuration

```bash
# Control async support
LLAMA_WASM_JSPI=1 npm run build:wasm      # Enable async (default)
LLAMA_WASM_JSPI=0 npm run build:wasm      # Disable async

# Control threading
LLAMA_WASM_PTHREAD=1 npm run build:wasm:pthreads  # Enable pthreads
LLAMA_WASM_PTHREAD=0 npm run build:wasm           # Disable pthreads
```

### Complete Build with PWA

Build native (iOS/Android) + WASM together:

```bash
# 1. Clean
npm run clean
npm run clean:native

# 2. Build everything
npm run build:package

# This runs:
# - Native builds (iOS + Android)
# - WASM builds
# - TypeScript compilation

# 3. Verify
npm run verify:pack:artifacts

# 4. Pack
npm pack --ignore-scripts
```

**Result:** Complete package with iOS + Android + WASM (~35-40 MB)

### WASM Browser Usage

```typescript
import { LlamaEngine } from './dist/wasm/llama_engine_emscripten.mjs';

const engine = await LlamaEngine.create();
await engine.loadModel('/path/to/model.gguf');
const output = await engine.complete('Hello ');
```

### WASM in Web Workers

```typescript
// worker.ts
import { LlamaEngine } from './dist/wasm/llama_engine_emscripten.mjs';

const engine = await LlamaEngine.create();

self.onmessage = async (event) => {
  const result = await engine.complete(event.data);
  self.postMessage(result);
};
```

### WASM with Pthreads (SharedArrayBuffer)

Must include these headers for multi-threading support:

```html
<meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin">
<meta http-equiv="Cross-Origin-Embedder-Policy" content="require-corp">
```

---

## Package Configuration

### package.json Setup for Minimal Variant

```json
{
  "name": "llama-cpp-capacitor",
  "version": "0.2.0",
  "description": "High-performance LLM inference library for iOS, Android, and Web",
  
  "files": [
    "android/src/main/jniLibs/",
    "android/build.gradle",
    "build-native.sh",
    "build-variants.sh",
    "cpp/",
    "dist/",
    "ios/CMakeLists.txt",
    "ios/CMakeLists-arm64.txt",
    "ios/CMakeLists-x86_64.txt",
    "ios/Sources",
    "ios/Frameworks",
    "Package.swift",
    "LlamaCpp.podspec",
    "LlamaCppCapacitor.podspec",
    "types/"
  ],
  
  "scripts": {
    "clean": "rm -rf dist",
    "clean:native": "rm -rf ios/build android/build ios/Frameworks",
    "build": "tsc",
    "build:native": "./build-native.sh",
    "build:pwa": "npm run build:wasm && npm run build:worker && npm run build:wasm:assets",
    "build:wasm": "./scripts/build-wasm.sh",
    "build:wasm:jspi": "LLAMA_WASM_JSPI=1 ./scripts/build-wasm.sh",
    "build:wasm:pthreads": "LLAMA_WASM_PTHREAD=1 ./scripts/build-wasm.sh",
    "build:wasm:full": "LLAMA_WASM_JSPI=1 ./scripts/build-wasm.sh --full",
    "build:worker": "node scripts/build-worker.mjs",
    "build:wasm:assets": "node scripts/copy-wasm-assets.mjs",
    "build:package": "npm run build && npm run build:native && npm run build:pwa",
    "verify:pack:artifacts": "node scripts/verify-pack-artifacts.mjs",
    "pack:full": "npm run build:package && npm pack --ignore-scripts",
    "test": "jest",
    "test:integration": "jest --testPathPattern=integration",
    "test:pwa:smoke": "jest --testPathPattern=pwa"
  }
}
```

### .npmignore Configuration

```
# Source files (not needed in package)
src/
src-rust/
scripts/
tests/
jest.config.js
tsconfig.json

# Build artifacts (not needed)
*.tsbuildinfo
.eslintrc.js
.prettierrc

# Documentation
README.md
CHANGELOG.md
CONTRIBUTING.md
QUICKSTART.md

# CI/CD
.github/
.gitlab-ci.yml

# Development
.DS_Store
.vscode/
.idea/
node_modules/
```

---

## Release Process

### Step 1: Verify System

```bash
# Check Node.js
node --version
npm --version

# Check build tools
./build-variants.sh --help
```

### Step 2: Clean and Build

```bash
# Clean previous builds
npm run clean
npm run clean:native

# Build minimal variant
./build-variants.sh --variant minimal

# Build TypeScript
npm run build
```

### Step 3: Verify Artifacts

```bash
# Verify build artifacts
npm run verify:pack:artifacts

# List package contents after packing
npm pack --ignore-scripts
tar -tzf llama-cpp-capacitor-0.2.0.tgz | head -20
```

### Step 4: Verify Installation

```bash
# Create test installation
npm pack --ignore-scripts

# Test install
npm install llama-cpp-capacitor-0.2.0.tgz

# Verify files exist
ls -la node_modules/llama-cpp-capacitor/
```

### Step 5: Update Documentation

Before publishing, update:

1. **package.json**
   - Update `"version": "0.2.0"`
   - Verify `"files"` array is correct for minimal variant

2. **CHANGELOG.md**
   - Document size improvements
   - List new variants
   - Note optimization techniques

3. **README.md**
   - Update package size from ~70 MB to ~20 MB
   - Add link to BUILD_GUIDE.md
   - Note variant availability

### Step 6: Publish

```bash
# Publish to npm
npm publish

# Verify on npm registry
npm view llama-cpp-capacitor@0.2.0 dist
npm view llama-cpp-capacitor@0.2.0 files
```

### Step 7: Verify Published Package

```bash
# Install from npm
npm install llama-cpp-capacitor

# Verify installation
npm list llama-cpp-capacitor
ls node_modules/llama-cpp-capacitor/
```

---

## Environment Variables

Control build behavior:

```bash
# Strip debug symbols (default: true)
STRIP_SYMBOLS=true ./build-variants.sh --variant minimal

# Parallel build jobs (default: CPU count)
BUILD_JOBS=16 ./build-variants.sh --variant minimal

# Verbose output
VERBOSE=1 ./build-variants.sh --variant minimal

# WASM async support
LLAMA_WASM_JSPI=1 npm run build:wasm

# WASM threading
LLAMA_WASM_PTHREAD=1 npm run build:wasm:pthreads

# Combine multiple
BUILD_JOBS=16 STRIP_SYMBOLS=true VERBOSE=1 ./build-variants.sh --variant minimal
```

---

## Troubleshooting

### "Binary not found" error

```bash
# Solution: Clean and rebuild
npm run clean:native
./build-variants.sh --variant minimal

# Check for CMake errors in output
```

### Package size larger than expected

```bash
# Verify no C++ sources in minimal
tar -tzf llama-cpp-capacitor-0.2.0.tgz | grep "cpp/" | wc -l

# Should output: 0

# Verify stripping was applied
file ios/Frameworks/llama-cpp.framework/llama-cpp
# Should show: no symbols
```

### iOS build failed

```bash
# iOS requires macOS
# On Linux/Windows: iOS build is automatically skipped

# Verify Xcode is installed
xcode-select --install

# Verify CMake
cmake --version
```

### Android SDK not found

```bash
# Set Android SDK path
export ANDROID_HOME=/path/to/android/sdk
export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/VERSION

# Verify path
ls $ANDROID_HOME/ndk

# Then rebuild
./build-variants.sh --variant minimal
```

### WASM build failed

```bash
# Check prerequisites
emcc --version
rustc --version
wasm-bindgen --version

# Install missing tools
cargo install wasm-bindgen-cli

# Clear cache and rebuild
rm -rf src-rust/target
npm run build:wasm
```

---

## FAQ

### Q: Should I publish minimal or core variant?

**A:** Start with **minimal** (20 MB) for the smallest download. If users report issues rebuilding, switch to **core**. Most npm packages don't include source code.

### Q: Why exclude C++ sources in minimal?

**A:** Users typically just want to use the library, not rebuild it. Sources add 13 MB. For rebuild capability, use `core` variant.

### Q: Can users customize the build?

**A:** Yes! The build scripts are included in the package. After install:
```bash
cd node_modules/llama-cpp-capacitor
./build-variants.sh --variant core
```

### Q: Will this break my app?

**A:** No. Same APIs, same functionality, just smaller binaries (stripped debug symbols).

### Q: Can I offer multiple variants on npm?

**A:** Yes, but more complex:
- `llama-cpp-capacitor` (minimal, default)
- `llama-cpp-capacitor-full` (core, with sources)

For simplicity, stick to one variant per release.

### Q: How long does a build take?

**A:** Roughly:
- Minimal: ~5 minutes
- Core: ~5 minutes  
- Development: ~10 minutes
- Full: ~15 minutes

Depends on CPU and machine load. Set `BUILD_JOBS` for faster builds.

### Q: Is stripping debug symbols safe?

**A:** Yes, completely safe. Debug symbols are only for developers debugging crashes. Production doesn't need them.

### Q: What if the build fails halfway through?

**A:** Run:
```bash
npm run clean:native
./build-variants.sh --variant minimal
```

The script will restart from the beginning.

### Q: Can I add a custom variant?

**A:** Yes! Edit `build-variants.sh` and add a new case:

```bash
build_custom() {
    print_header "Custom Variant"
    build_ios "arm64" "false"
    build_android "arm64" "false"
    build_pwa
    print_success "Custom variant ready"
}
```

Then run: `./build-variants.sh --variant custom`

### Q: How do I track build size over time?

**A:** Create a SIZE_HISTORY.md:
```bash
echo "=== llama-cpp-capacitor 0.2.0 ===" >> SIZE_HISTORY.md
npm pack --ignore-scripts && du -h llama-cpp-capacitor-*.tgz >> SIZE_HISTORY.md
```

### Q: What's the difference between stripped and debug versions?

**A:** Stripped removes debug symbols (metadata), making binaries ~30-50% smaller. Debug versions keep symbols for crash debugging.

```
Stripped (production):  3-4 MB iOS, 15-16 MB Android
Debug (development):    5 MB iOS, 48 MB Android
```

---

## Size Reduction Summary

### Before (0.1.0)
```
iOS framework (all, debug):     5.3 MB
Android arm64 (debug):          48 MB
C++ sources:                    13 MB
JS/TS + misc:                   3.7 MB
─────────────────────────────────────
Total:                          ~70 MB
```

### After (0.2.0 minimal)
```
iOS framework (arm64, stripped):    3-4 MB
Android arm64 (stripped):           15-16 MB
JS/TS + misc:                       1-2 MB
─────────────────────────────────────
Total:                              ~20 MB
```

### Achievement: **71% reduction** (70 MB → 20 MB) ✅

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Publish

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: macos-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Clean
        run: npm run clean:native
      
      - name: Build minimal variant
        run: ./build-variants.sh --variant minimal
      
      - name: Build TypeScript
        run: npm run build
      
      - name: Verify artifacts
        run: npm run verify:pack:artifacts
      
      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Next Steps

1. **Review** this guide carefully
2. **Run locally** to test the build process
3. **Verify** package size (~20 MB for minimal)
4. **Test** installation: `npm install llama-cpp-capacitor-*.tgz`
5. **Publish** when ready: `npm publish`

---

## File Locations

After successful build:

```
iOS Framework:
  ios/Frameworks/llama-cpp.framework/llama-cpp  (~3-4 MB)

Android Library:
  android/src/main/jniLibs/arm64-v8a/libllama-cpp-arm64.so  (~15-16 MB)

TypeScript Compiled:
  dist/esm/
  dist/plugin.cjs.js

WASM (optional):
  dist/wasm/llama_engine.wasm  (~2-3 MB)
  dist/wasm/llama_engine_emscripten.mjs
```

---

## Related Files

### Build Scripts
- **build-variants.sh** - Main build script (executable)
- **build-native.sh** - Original native build (still works)
- **scripts/build-wasm.sh** - WASM build script
- **scripts/build-worker.mjs** - Web worker compilation
- **scripts/copy-wasm-assets.mjs** - Asset copying

### Configuration
- **package.json** - npm scripts and metadata
- **.npmignore** - Files excluded from npm package
- **CMakeLists.txt** - C++ build configuration
- **Cargo.toml** - Rust dependency configuration

### Documentation  
- **README.md** - Main project documentation
- **CHANGELOG.md** - Version history and changes
- **CONTRIBUTING.md** - Contribution guidelines

---

## Document Version

- **Package:** llama-cpp-capacitor
- **Version:** 0.2.0
- **Updated:** January 31, 2025
- **Consolidation:** All BUILD_*.md files combined into this single guide

---

## Summary of Commands

```bash
# Quick production build and publish
npm run clean:native
./build-variants.sh --variant minimal
npm run build
npm run verify:pack:artifacts
npm pack --ignore-scripts
npm publish

# Build with all details visible
BUILD_JOBS=16 VERBOSE=1 ./build-variants.sh --variant minimal

# Development variant with debug symbols
./build-variants.sh --variant development

# WASM only
npm run build:wasm

# Complete package (iOS + Android + WASM)
npm run build:package
```

---

**You're ready to release! 🚀**

