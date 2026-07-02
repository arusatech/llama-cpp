# Quick Android Feature Integration Guide

**Time Estimate: 20 minutes**

## Files Provided

```
android/
├── src/main/
│   ├── jni.cpp (existing - to be updated)
│   ├── jni-lora.cpp (NEW - 150 lines)
│   ├── jni-multimodal.cpp (NEW - 180 lines)
│   ├── jni-tts.cpp (NEW - 280 lines)
│   ├── jni-chat-session.cpp (NEW - 300 lines)
│   └── java/ai/annadata/plugin/capacitor/
│       ├── LlamaCppPlugin.java (existing - to be updated)
│       └── LlamaCppPluginExtended.java (NEW - Java wrapper methods)
├── ANDROID_IMPLEMENTATION_GUIDE.md (detailed reference)
└── CMakeLists.txt (to verify dependencies)
```

## Integration Steps

### Step 1: Merge C++ JNI Code (5 minutes)

**Location:** `android/src/main/jni.cpp`

Find the end of the `extern "C"` block (around line 1680), and paste the contents of all four new JNI files before the closing brace `}`:

```cpp
// Around line 1680 in jni.cpp

extern "C" {
    // ... [all existing code] ...

    // ADD HERE - Copy all content from the four jni-*.cpp files
    
    // From jni-lora.cpp
    JNIEXPORT jint JNICALL
    Java_ai_annadata_plugin_capacitor_LlamaCpp_applyLoraAdaptersNative(...)
    { ... }
    
    // From jni-multimodal.cpp
    JNIEXPORT jboolean JNICALL
    Java_ai_annadata_plugin_capacitor_LlamaCpp_initMultimodalNative(...)
    { ... }
    
    // From jni-tts.cpp
    JNIEXPORT jboolean JNICALL
    Java_ai_annadata_plugin_capacitor_LlamaCpp_initVocoderNative(...)
    { ... }
    
    // From jni-chat-session.cpp
    JNIEXPORT jobject JNICALL
    Java_ai_annadata_plugin_capacitor_LlamaCpp_chatNative(...)
    { ... }

} // extern "C"
} // namespace jni_utils
```

### Step 2: Update Java Plugin Wrapper (5 minutes)

**Location:** `android/src/main/java/ai/annadata/plugin/capacitor/LlamaCppPlugin.java`

#### Option A: Copy Full Methods (Recommended for first integration)

1. Open `LlamaCppPluginExtended.java`
2. Copy everything from the `// MARK:` comments into `LlamaCppPlugin.java`
3. Place methods in corresponding sections:
   - LoRA methods after existing adapter code
   - Multimodal methods after existing context methods
   - TTS methods after existing completion code
   - Chat methods after completion methods
   - Session methods at the end

#### Option B: Manual Integration (if merging with custom code)

Search for these sections in `LlamaCppPluginExtended.java` and copy them into `LlamaCppPlugin.java`:

1. Section: `// MARK: - LoRA Adapter Methods`
2. Section: `// MARK: - Multimodal Methods`
3. Section: `// MARK: - TTS/Vocoder Methods`
4. Section: `// MARK: - Advanced Chat Methods`
5. Section: `// MARK: - Session Management Methods`

### Step 3: Update Plugin Method Registry (2 minutes)

**Location:** `LlamaCppPlugin.java` - `pluginMethods` array

Find the array definition and add these entries:

```java
public let pluginMethods: [CAPPluginMethod] = [
    // ... existing methods ...
    
    // LoRA adapters
    CAPPluginMethod(name: "applyLoraAdapters", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "removeLoraAdapters", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "getLoadedLoraAdapters", returnType: CAPPluginReturnPromise),
    
    // Multimodal
    CAPPluginMethod(name: "initMultimodal", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "isMultimodalEnabled", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "getMultimodalSupport", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "releaseMultimodal", returnType: CAPPluginReturnPromise),
    
    // TTS/Vocoder
    CAPPluginMethod(name: "initVocoder", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "isVocoderEnabled", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "getFormattedAudioCompletion", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "getAudioCompletionGuideTokens", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "decodeAudioTokens", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "releaseVocoder", returnType: CAPPluginReturnPromise),
    
    // Advanced Chat
    CAPPluginMethod(name: "chat", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "chatWithSystem", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "generateText", returnType: CAPPluginReturnPromise),
    
    // Session Management
    CAPPluginMethod(name: "loadSession", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "saveSession", returnType: CAPPluginReturnPromise),
]
```

### Step 4: Verify Dependencies (2 minutes)

**Location:** `android/src/main/CMakeLists.txt`

Ensure these sections exist:

```cmake
# Include directories
target_include_directories(llama_cpp_jni PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../../cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../../cpp/tools/mtmd
)

# Link libraries
target_link_libraries(llama_cpp_jni PRIVATE
    llama
    mtmd      # For multimodal support
)
```

If not present, add them to the existing `target_include_directories` and `target_link_libraries` blocks.

### Step 5: Build (5-10 minutes)

```bash
cd android
./gradlew clean build
```

### Step 6: Test (Optional but recommended)

```bash
# Build with test support
./gradlew clean build connectedAndroidTest

# Or run specific tests
./gradlew testDebugUnitTest
```

## Verification Checklist

After integration:

- [ ] `jni.cpp` compiles without errors
- [ ] `LlamaCppPlugin.java` compiles without errors
- [ ] All new methods appear in plugin methods list
- [ ] `.so` files generated for all ABIs (arm64-v8a, armeabi-v7a, x86, x86_64)
- [ ] No linker warnings about missing symbols
- [ ] App starts and loads plugin successfully

## Quick Testing

```typescript
// TypeScript/JavaScript test code
import { LlamaCpp } from '@annadata/capacitor-llama-cpp';

// Test 1: LoRA Adapters
const loraResult = await LlamaCpp.applyLoraAdapters({
  contextId: 1,
  loraAdapters: [
    { path: "/path/to/adapter.gguf", scale: 1.0 }
  ]
});
console.log(`Applied ${loraResult.adaptersApplied} adapters`);

// Test 2: Multimodal
const mmResult = await LlamaCpp.initMultimodal({
  contextId: 1,
  path: "/path/to/mmproj.gguf",
  use_gpu: true
});
console.log(`Multimodal initialized: ${mmResult.success}`);

// Test 3: TTS
const ttsResult = await LlamaCpp.initVocoder({
  contextId: 1,
  path: "/path/to/vocoder.gguf",
  n_batch: 512
});
console.log(`Vocoder initialized: ${ttsResult.success}`);

// Test 4: Chat
const chatResult = await LlamaCpp.chatWithSystem({
  contextId: 1,
  system: "You are a helpful assistant.",
  message: "Hello!",
  params: { n_predict: 256 }
});
console.log(`Chat prompt formatted: ${chatResult.formattedPrompt.length} chars`);

// Test 5: Sessions
const saveResult = await LlamaCpp.saveSession({
  contextId: 1,
  filepath: "/path/to/session.bin",
  size: -1
});
console.log(`Session saved: ${saveResult.tokensSaved} tokens`);
```

## Troubleshooting

### Compilation Errors

**Problem:** `undefined reference to 'Java_ai_annadata_plugin_capacitor_LlamaCpp_applyLoraAdaptersNative'`

**Solution:** Ensure all JNI code from `jni-*.cpp` files is properly copied into `jni.cpp` extern "C" block.

**Problem:** `undefined reference to 'mtmd_init_from_file'`

**Solution:** Verify MTMD library is linked in CMakeLists.txt and headers are in correct path.

### Runtime Errors

**Problem:** `Context not found: -1`

**Solution:** Ensure context is initialized with `initContext()` before calling new methods.

**Problem:** `Vocoder model file not found`

**Solution:** Verify model file path exists and is readable on device:
```bash
adb shell ls -la /path/to/vocoder.gguf
```

### Performance Issues

**Problem:** Slow multimodal initialization

**Solution:** This is normal for first load. Subsequent initializations are cached. Use GPU if available:
```javascript
await LlamaCpp.initMultimodal({
  contextId: 1,
  path: "/path/to/mmproj.gguf",
  use_gpu: true  // Enable GPU
});
```

## Next Steps

1. **Test Features** - Try each feature with appropriate models
2. **Optimize Performance** - Profile with Android Profiler
3. **Handle Edge Cases** - Test with invalid inputs
4. **Document Usage** - Add to plugin documentation
5. **Deploy** - Push changes to repository

## Support Files

For detailed information, see:
- `ANDROID_IMPLEMENTATION_GUIDE.md` - Complete technical reference
- `ANDROID_FEATURE_IMPLEMENTATION_SUMMARY.md` - Architecture overview
- `jni-*.cpp` files - Source code with inline documentation
- `LlamaCppPluginExtended.java` - Annotated Java wrapper

## Success Indicators

After successful integration, you should see:

✅ Plugin loads without crashes
✅ New methods available via `LlamaCpp.` namespace
✅ No linker or runtime errors
✅ Multimodal/TTS/LoRA features work as expected
✅ Session save/load persists state
✅ Chat methods format prompts correctly

## Questions?

Refer to:
1. Inline code comments (comprehensive documentation)
2. `ANDROID_IMPLEMENTATION_GUIDE.md` (detailed technical docs)
3. Original C++ headers (`cpp/cap-*.h`) for API details
4. iOS implementation (`ios/Sources/LlamaCppPlugin/LlamaCppPlugin.swift`) for comparison

---

**Happy integrating!** 🚀
