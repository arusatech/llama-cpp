# Android Missing Features Implementation Guide

This document describes the implementation of missing Android features to achieve feature parity with iOS.

## Overview

The following 5 feature categories have been implemented for Android:

1. **LoRA Adapters** - Dynamic model fine-tuning
2. **Multimodal (Vision/Audio)** - Vision and audio input processing
3. **TTS/Vocoder** - Text-to-speech audio generation
4. **Session Management** - Save/load inference sessions
5. **Advanced Chat** - Enhanced chat methods

## Implementation Files

### New JNI Implementation Files

- `jni-lora.cpp` - LoRA adapter functionality (150 lines)
- `jni-multimodal.cpp` - Multimodal/vision functionality (180 lines)
- `jni-tts.cpp` - TTS/vocoder functionality (280 lines)
- `jni-chat-session.cpp` - Chat and session management (300 lines)

### Integration Steps

#### Step 1: Add JNI Method Declarations to jni.cpp

Add the following declarations to `android/src/main/jni.cpp` in the `extern "C"` block at the end of the file, before the closing brace:

```cpp
// ============================================
// LoRA Adapter Methods
// ============================================
// Include content from jni-lora.cpp here

// ============================================
// Multimodal Methods
// ============================================
// Include content from jni-multimodal.cpp here

// ============================================
// TTS/Vocoder Methods
// ============================================
// Include content from jni-tts.cpp here

// ============================================
// Advanced Chat and Session Methods
// ============================================
// Include content from jni-chat-session.cpp here
```

#### Step 2: Update CMakeLists.txt

Add the new files to your CMakeLists.txt if building as separate translation units:

```cmake
add_library(llama_cpp_jni SHARED
    jni.cpp
    jni-lora.cpp
    jni-multimodal.cpp
    jni-tts.cpp
    jni-chat-session.cpp
)
```

Or simply append the content of each `jni-*.cpp` file into the main `jni.cpp` file (recommended for simpler builds).

#### Step 3: Update Java Plugin Wrapper

Update `android/src/main/java/ai/annadata/plugin/capacitor/LlamaCppPlugin.java` with the new methods.

See below for the complete Java wrapper implementation.

## JNI Methods Reference

### LoRA Adapters

#### applyLoraAdaptersNative
```cpp
JNIEXPORT jint JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_applyLoraAdaptersNative(
    JNIEnv* env, jobject thiz, jlong contextId, jobjectArray loraAdaptersArray)
```

**Parameters:**
- `contextId`: The llama context ID
- `loraAdaptersArray`: Java array of HashMap objects with keys: `path` (String), `scale` (Double)

**Returns:** Number of adapters applied, or -1 on error

#### removeLoraAdaptersNative
```cpp
JNIEXPORT void JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_removeLoraAdaptersNative(
    JNIEnv* env, jobject thiz, jlong contextId)
```

#### getLoadedLoraAdaptersNative
```cpp
JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_getLoadedLoraAdaptersNative(
    JNIEnv* env, jobject thiz, jlong contextId)
```

**Returns:** ArrayList of HashMap objects containing adapter information

### Multimodal

#### initMultimodalNative
```cpp
JNIEXPORT jboolean JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_initMultimodalNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring mmproj_path, jboolean use_gpu)
```

**Parameters:**
- `mmproj_path`: Path to multimodal projection model
- `use_gpu`: Whether to use GPU acceleration

#### isMultimodalEnabledNative
```cpp
JNIEXPORT jboolean JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_isMultimodalEnabledNative(
    JNIEnv* env, jobject thiz, jlong contextId)
```

#### getMultimodalSupportNative
```cpp
JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_getMultimodalSupportNative(
    JNIEnv* env, jobject thiz, jlong contextId)
```

**Returns:** HashMap with keys `vision` (Boolean) and `audio` (Boolean)

#### releaseMultimodalNative
```cpp
JNIEXPORT void JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_releaseMultimodalNative(
    JNIEnv* env, jobject thiz, jlong contextId)
```

### TTS/Vocoder

#### initVocoderNative
```cpp
JNIEXPORT jboolean JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_initVocoderNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring vocoder_model_path, jint n_batch)
```

#### isVocoderEnabledNative
```cpp
JNIEXPORT jboolean JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_isVocoderEnabledNative(
    JNIEnv* env, jobject thiz, jlong contextId)
```

#### getFormattedAudioCompletionNative
```cpp
JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_getFormattedAudioCompletionNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring speaker_json_str, jstring text_to_speak)
```

#### getAudioCompletionGuideTokensNative
```cpp
JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_getAudioCompletionGuideTokensNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring text_to_speak)
```

**Returns:** ArrayList of Integer tokens

#### decodeAudioTokensNative
```cpp
JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_decodeAudioTokensNative(
    JNIEnv* env, jobject thiz, jlong contextId, jintArray tokens_array)
```

**Returns:** ArrayList of Float audio samples

#### releaseVocoderNative
```cpp
JNIEXPORT void JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_releaseVocoderNative(
    JNIEnv* env, jobject thiz, jlong contextId)
```

### Advanced Chat

#### chatNative
```cpp
JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_chatNative(
    JNIEnv* env, jobject thiz, jlong contextId, jobjectArray messages_array,
    jstring system, jstring chat_template, jobject params)
```

#### chatWithSystemNative
```cpp
JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_chatWithSystemNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring system, jstring message, jobject params)
```

#### generateTextNative
```cpp
JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_generateTextNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring prompt, jobject params)
```

### Session Management

#### loadSessionNative
```cpp
JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_loadSessionNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring filepath)
```

#### saveSessionNative
```cpp
JNIEXPORT jint JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_saveSessionNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring filepath, jint size)
```

**Returns:** Number of tokens saved, or -1 on error

## Java Wrapper Implementation

Update `LlamaCppPlugin.java` with the following methods (see separate section below for full implementation).

## Build Configuration

### CMakeLists.txt Update

```cmake
# Ensure TTS, multimodal, and session headers are included
target_include_directories(llama_cpp_jni PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../../cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../../cpp/tools/mtmd
)

# Link TTS and multimodal libraries if available
target_link_libraries(llama_cpp_jni PRIVATE
    llama
    mtmd  # If multimodal support is compiled
    tts   # If TTS support is compiled
)
```

## Testing Checklist

- [ ] LoRA adapters load and unload successfully
- [ ] Multimodal initialization works with valid projection models
- [ ] Vocoder TTS methods produce audio output
- [ ] Session save/load preserves inference state
- [ ] Advanced chat methods format prompts correctly
- [ ] Error handling for missing files/invalid contexts
- [ ] Memory management and cleanup

## Error Handling

All methods include comprehensive error handling:

1. **Context validation** - Checks if context exists and is valid
2. **File validation** - Checks if model files exist before loading
3. **Exception catching** - All exceptions are caught and converted to Java exceptions
4. **Logging** - All operations are logged using Android logging macros

## Performance Considerations

- LoRA adapters are loaded directly into the model
- Multimodal initialization may take time on first load
- TTS audio generation depends on vocoder model size
- Session save/load time depends on context size
- Advanced chat methods reuse existing infrastructure

## Future Enhancements

1. **Streaming chat** - Support for streaming chat responses
2. **Session resumption** - Better session state preservation
3. **Parallel inference** - Support for multiple parallel completions
4. **GPU acceleration** - Better GPU support for TTS and multimodal
5. **Audio input** - Support for audio input processing

## Dependencies

The implementation requires:

- `cap-llama.h` - Core llama context functionality
- `cap-tts.h` - TTS/vocoder functionality
- `cap-mtmd.hpp` - Multimodal functionality
- `jni-utils.h` - JNI utility functions
- Standard C++ libraries (cstring, memory, fstream, etc.)

## References

- [Android NDK JNI Programming Guide](https://developer.android.com/training/articles/jni)
- [llama.cpp API Documentation](https://github.com/ggerganov/llama.cpp)
- [Capacitor Native Plugin Development](https://capacitorjs.com/docs/plugins/android)
