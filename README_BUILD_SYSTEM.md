# Build System Reference - llama-cpp-capacitor 0.2.0

Complete consolidated guide covering build variants, package configuration, and release procedures.

---

## 📖 Table of Contents

1. [Quick Start](#quick-start)
2. [Build Variants](#build-variants)
3. [Package Configuration](#package-configuration)
4. [Release Process](#release-process)
5. [Pre-Release Checklist](#pre-release-checklist)
6. [Environment Variables](#environment-variables)
7. [Common Issues](#common-issues)
8. [FAQ](#faq)

---

## Quick Start

### The Simplest Release (One Command)

```bash
npm publish
```

**This automatically:**
1. Runs prepack hook → `npm run build:package`
2. Builds TypeScript → `npm run build`
3. Builds iOS + Android → `npm run build:native`
4. Builds WASM + PWA → `npm run build:pwa`
5. Verifies all artifacts
6. Packages everything
7. Publishes to npm

**Result:** Users get iOS + Android + PWA + WASM (~35-40 MB) ✅

**Note:** The `./build-variants.sh --variant minimal` command attempts to build PWA/WASM, but this step may be optional and can fail gracefully.

### Manual Build Steps

```bash
# 1. Clean previous builds
npm run clean:native

# 2. Build minimal variant (iOS + Android only)
./build-variants.sh --variant minimal

# 3. Build TypeScript
npm run build

# 4. Build PWA/WASM separately (if needed)
npm run build:pwa

# 5. Verify artifacts
npm run verify:pack:artifacts

# 6. Check size
npm pack --dry-run

# 7. Publish
npm publish
```

**Note:** If you want PWA/WASM included, build it separately after the variant build.

### For Development Only

```bash
# Full debug build (all architectures, debug symbols)
./build-variants.sh --variant development
npm run build
```

---

## Build Variants

### 6 Optimized Variants

| Variant | Size | iOS | Android | Sources | Debug | PWA/WASM | Best For |
|---------|------|-----|---------|---------|-------|----------|----------|
| **minimal** ⭐ | ~20-23 MB | arm64 stripped | arm64 stripped | ❌ | ❌ | ✅ Included* | Public npm (default) |
| **core** | ~33-40 MB | arm64 stripped | arm64 stripped | ✅ | ❌ | ✅ Included* | Production + rebuild |
| **development** | ~55-70 MB | arm64+x86_64 | arm64+x86_64 | ✅ | ✅ | ✅ Included* | Local dev/testing |
| **ios-only** | ~8-10 MB | arm64 stripped | ❌ | ✅ | ❌ | ❌ Not included | iOS only |
| **android-only** | ~25-30 MB | ❌ | arm64 stripped | ✅ | ❌ | ❌ Not included | Android only |
| **full** | ~75+ MB | All | All | ✅ | ✅ | ✅ Included* | ❌ Not recommended |

**PWA/WASM Status:**
- ✅ **minimal, core, development, full**: Attempt to build PWA/WASM automatically (optional, may fail gracefully)
- ❌ **ios-only, android-only**: PWA/WASM not included (platform-specific builds)

*Size estimates include optional PWA/WASM if build succeeds. Without PWA, subtract 2-3 MB.

### Build Any Variant

```bash
./build-variants.sh --variant [minimal|core|development|ios-only|android-only|full]
```

### Minimal Variant (Recommended)

**When to use:** Public npm release, app stores, production deployments

**What it builds:**
- ✅ iOS arm64 (stripped)
- ✅ Android arm64 (stripped)
- ✅ PWA/WASM assets (automatic, optional)
- ❌ NO C++ sources

**Contents:**
- iOS framework: arm64 only, debug symbols stripped (~3-4 MB)
- Android .so: arm64-v8a only, stripped (~15-16 MB)
- JavaScript/TypeScript dist (~1-2 MB)
- PWA/WASM assets (~2-3 MB if successful)
- **NO** C++ sources
- **NO** debug symbols

**Size breakdown:**
```
iOS arm64 (stripped):      3-4 MB
Android arm64 (stripped):  15-16 MB
WASM + PWA assets:         2-3 MB (automatic)
JS/TS dist:               1-2 MB
────────────────────
Total:                     ~23-25 MB
```

**Build:**
```bash
./build-variants.sh --variant minimal
# PWA/WASM is automatically attempted (may fail - that's OK)
```

### Core Variant (Balanced)

**When to use:** Production with flexibility for users who need to rebuild

**What it builds:**
- ✅ iOS arm64 (stripped)
- ✅ Android arm64 (stripped)
- ✅ PWA/WASM assets (automatic, optional)
- ✅ C++ sources included

**Contents:**
- iOS framework: arm64 only, stripped (~3-4 MB)
- Android .so: arm64-v8a only, stripped (~15-16 MB)
- **WITH** C++ sources (~13 MB)
- JavaScript/TypeScript dist (~1-2 MB)
- PWA/WASM assets (~2-3 MB if successful)

**Benefits:**
- Users can rebuild with custom options
- Complete web support with WASM
- Good balance: comprehensive but not huge

**Size:** ~33-40 MB (including automatic PWA/WASM attempt)

**Build:**
```bash
./build-variants.sh --variant core
# PWA/WASM is automatically attempted (may fail - that's OK)
```

### Development Variant

**When to use:** Local development, CI/CD testing, debugging

**What it builds:**
- ✅ iOS arm64+x86_64 (WITH debug symbols)
- ✅ Android arm64+x86_64 (WITH debug symbols)
- ✅ PWA/WASM assets (automatic, optional)
- ✅ C++ sources included

**Contents:**
- iOS: arm64 + x86_64, **with** debug symbols
- Android: arm64-v8a + x86_64, **with** debug symbols
- C++ sources
- PWA/WASM assets (~2-3 MB if successful)
- All debug information

**Important:** NOT for public release

**Size:** ~55-70 MB (including automatic PWA/WASM attempt)

```bash
./build-variants.sh --variant development
# PWA/WASM is automatically attempted (may fail - that's OK)
```

### Platform-Specific Variants

```bash
# iOS only (8-10 MB)
./build-variants.sh --variant ios-only

# Android only (25-30 MB)
./build-variants.sh --variant android-only
```

---

## Package Configuration

### Configure package.json for Each Variant

The `files` array controls what gets included in the npm package.

### Minimal Variant (Smallest, Recommended)

**For public npm release:**

```json
{
  "files": [
    "android/src/main/jniLibs/",
    "android/build.gradle",
    "build-native.sh",
    "build-variants.sh",
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
  ]
}
```

**What's excluded:** `cpp/` (C++ sources) - saves ~13 MB

**Size:** ~20 MB

### Core Variant (With Sources)

**For production with rebuild capability:**

```json
{
  "files": [
    "android/src/main/",
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
  ]
}
```

**What's included:** `cpp/` - C++ sources for optional rebuilds

**Size:** ~30-35 MB

### Development Variant (Full)

**For local development (NOT for npm):**

```json
{
  "files": [
    "android/",
    "build-native.sh",
    "build-variants.sh",
    "cpp/",
    "dist/",
    "ios/",
    "Package.swift",
    "LlamaCpp.podspec",
    "LlamaCppCapacitor.podspec",
    "types/",
    "scripts/",
    "test/"
  ]
}
```

**Size:** ~50-60 MB

### Switch Variants

```bash
# 1. Run build script
./build-variants.sh --variant minimal

# 2. Update package.json "files" array (use config above)

# 3. Build
npm run build

# 4. Verify
npm run verify:pack:artifacts

# 5. Pack and publish
npm pack --ignore-scripts
npm publish
```

---

## Release Process

### Pre-Release Steps

1. **Update Version**
   ```bash
   npm version minor  # 0.2.0-rc.0 → 0.2.0
   # or manually: edit package.json version to "0.2.0"
   ```

2. **Update Documentation**
   - CHANGELOG.md: Add release notes and size info
   - README.md: Update package size

3. **Test Build Locally**
   ```bash
   npm run build:package
   ```

4. **Verify Artifacts**
   ```bash
   npm run verify:pack:artifacts
   ```

### Release Steps

1. **Check npm Login**
   ```bash
   npm whoami
   ```

2. **Publish**
   ```bash
   npm publish
   ```

3. **Verify on npm Registry**
   ```bash
   npm view llama-cpp-capacitor@0.2.0
   npm view llama-cpp-capacitor@0.2.0 dist
   ```

### Expected Timeline

| Step | Time |
|------|------|
| Build (TypeScript + Native + WASM) | 10-15 min |
| Verify artifacts | 1-2 min |
| Publish to npm | 1-2 min |
| **Total** | **15-20 min** |

---

## Pre-Release Checklist

Before publishing to npm:

- [ ] `package.json` version updated to `0.2.0`
- [ ] `package.json` `files` array configured for chosen variant
- [ ] `CHANGELOG.md` updated with release notes
- [ ] Local build successful: `npm run build:package`
- [ ] Artifacts verified: `npm run verify:pack:artifacts`
- [ ] Package size correct: `npm pack --dry-run` (~20 MB for minimal)
- [ ] Package contents correct: `tar -tzf llama-cpp-capacitor-0.2.0.tgz | head -30`
- [ ] npm login verified: `npm whoami`
- [ ] Ready to publish: `npm publish`
- [ ] Published successfully
- [ ] Verified on npm registry: `npm view llama-cpp-capacitor@0.2.0`

---

## Environment Variables

Control build behavior:

```bash
# Strip debug symbols (default: true)
STRIP_SYMBOLS=true ./build-variants.sh --variant minimal

# Keep debug symbols (for development)
STRIP_SYMBOLS=false ./build-variants.sh --variant development

# Parallel build jobs (default: CPU count)
BUILD_JOBS=16 ./build-variants.sh --variant minimal

# Verbose output
VERBOSE=1 ./build-variants.sh --variant minimal

# Combine variables
BUILD_JOBS=16 STRIP_SYMBOLS=true VERBOSE=1 ./build-variants.sh --variant minimal
```

---

## Common Issues

### "Binary not found" error

```bash
# Solution: Clean and rebuild
npm run clean:native
./build-variants.sh --variant minimal
```

### Package size larger than expected

```bash
# Check what's included
npm pack --dry-run

# Verify C++ sources not included for minimal
tar -tzf llama-cpp-capacitor-0.2.0.tgz | grep "cpp/" | wc -l
# Should output: 0
```

### Android SDK not found

```bash
# Set environment
export ANDROID_HOME=/path/to/android/sdk
export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/VERSION

# Verify
ls $ANDROID_HOME/ndk

# Rebuild
./build-variants.sh --variant minimal
```

### iOS build failed (macOS only)

```bash
# iOS requires macOS with Xcode
# On Linux/Windows: automatically skipped

# Verify Xcode installed
xcode-select --install
```

### WASM build failed

```bash
# Check prerequisites
emcc --version
rustc --version
wasm-bindgen --version

# Install missing
cargo install wasm-bindgen-cli

# Clear and rebuild
rm -rf src-rust/target
npm run build:wasm
```

---

## FAQ

### Q: Should I publish minimal or core?

**A:** Start with **minimal** (20 MB) for smallest download. It's production-standard. Most npm packages don't include source code. Use core only if you want rebuild flexibility.

### Q: Why exclude C++ sources in minimal?

**A:** Users typically just use the library, not rebuild it. Sources add ~13 MB. Keep package small for faster downloads.

### Q: Can users customize their build?

**A:** Yes! Include build scripts in the package. After install:
```bash
cd node_modules/llama-cpp-capacitor
./build-variants.sh --variant core
```

### Q: Will this break my application?

**A:** No. Same APIs, same functionality. Only difference: smaller binaries (debug symbols removed).

### Q: How long does building take?

**A:** Roughly:
- Minimal: ~5 minutes
- Core: ~5 minutes
- Development: ~10 minutes

Depends on CPU. Increase `BUILD_JOBS` for faster builds.

### Q: Is stripping debug symbols safe for production?

**A:** Yes, completely safe. Debug symbols are only for crash debugging. Production doesn't need them.

### Q: Can I offer multiple variants on npm?

**A:** Yes, but complex. You could publish:
- `llama-cpp-capacitor` (minimal)
- `llama-cpp-capacitor-full` (core)

For simplicity, stick to one variant per release.

### Q: What happens if I run npm publish directly?

**A:** npm automatically runs the prepack hook, which builds everything:
1. TypeScript
2. iOS + Android
3. WASM + PWA

Everything gets packaged and published automatically. You can literally just run `npm publish` and you're done!

### Q: Why is the package size different from what I expected?

**A:** Check:
1. Which variant you built: `./build-variants.sh --variant [name]`
2. That strip symbols was enabled: `STRIP_SYMBOLS=true` (default)
3. What's in the files array of package.json
4. Run `npm pack --dry-run` to see actual size

### Q: How do I track size changes over releases?

**A:** After publishing each version:
```bash
npm view llama-cpp-capacitor@0.1.0 dist
npm view llama-cpp-capacitor@0.2.0 dist
# Compare the sizes
```

---

## What Gets Published

### When Users Run: `npm install llama-cpp-capacitor`

They receive:

```
node_modules/llama-cpp-capacitor/
├── dist/                       ← TypeScript compiled
│   ├── esm/
│   ├── plugin.cjs.js
│   ├── wasm/                   ← WASM/PWA files
│   └── ...
│
├── ios/
│   ├── Frameworks/
│   │   └── llama-cpp.framework/ ← iOS framework
│   ├── Sources/
│   └── ...
│
├── android/
│   └── src/main/
│       ├── jniLibs/arm64-v8a/
│       │   └── libllama-cpp-arm64.so ← Android library
│       └── ...
│
├── cpp/                         ← (for core variant only)
│   └── [C++ sources]
│
├── types/
│   └── llama-cpp-capacitor.d.ts
│
├── package.json
├── build-variants.sh
└── ...
```

### Estimated Sizes by Variant

```
Minimal:      ~20 MB    ✅ (No sources, stripped)
Core:         ~30-35 MB ✅ (With sources, stripped)
Development:  ~50-60 MB ❌ (Debug, not for npm)
Full:         ~70+ MB   ❌ (Everything, not recommended)
```

---

## Size Reduction: Before vs After

### 0.1.0 (Before Optimization)

```
iOS framework (all archs, debug):  5.3 MB
Android library (all archs, debug): 48 MB
C++ sources:                        13 MB
JS/TS + metadata:                   3.7 MB
───────────────────────────────────────
Total:                              ~70 MB
```

### 0.2.0 Minimal (After Optimization)

```
iOS framework (arm64, stripped):    3-4 MB
Android library (arm64, stripped):  15-16 MB
JS/TS + metadata:                   1-2 MB
───────────────────────────────────────
Total (without PWA):                ~20 MB

With optional PWA/WASM:             ~23-25 MB
```

### Achievement: **71% Reduction** ✅

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

## Key Commands Reference

### Build Commands

```bash
# Build any variant
./build-variants.sh --variant minimal    # ~20 MB (recommended)
./build-variants.sh --variant core       # ~30-35 MB
./build-variants.sh --variant development # ~50-60 MB

# Compile TypeScript
npm run build

# Verify everything is correct
npm run verify:pack:artifacts
```

### Package Commands

```bash
# See what gets packaged (dry run)
npm pack --dry-run

# Create package file
npm pack --ignore-scripts

# Check contents
tar -tzf llama-cpp-capacitor-0.2.0.tgz | head -30

# Count files
tar -tzf llama-cpp-capacitor-0.2.0.tgz | wc -l
```

### Release Commands

```bash
# Update version
npm version minor  # or patch, major

# Publish to npm
npm publish

# Verify on npm registry
npm view llama-cpp-capacitor@0.2.0
npm view llama-cpp-capacitor@0.2.0 dist
```

---

## Next Steps

1. **Decide on variant:** minimal (default) or core?
2. **Update package.json:** `files` array for your variant
3. **Update version:** Change to `0.2.0` from `0.2.0-rc.0`
4. **Update docs:** CHANGELOG.md, README.md
5. **Test build:** `npm run build:package`
6. **Verify size:** `npm pack --dry-run`
7. **Publish:** `npm publish`
8. **Verify:** `npm view llama-cpp-capacitor@0.2.0`

---

## Summary

**One Line:** `npm publish`

**Recommended:** Minimal variant (~20 MB) for public npm release

**Timeline:** 15-20 minutes from build start to published on npm

**Result:** Users get iOS + Android + WASM in one package

---

## Document Info

- **Package:** llama-cpp-capacitor
- **Version:** 0.2.0
- **Updated:** January 31, 2025
- **Consolidation:** RELEASE_0.2.0_FINAL.md + PACKAGE_CONFIG_VARIANTS.md + README_BUILD_SYSTEM.md

---

**Ready to release! 🚀**

