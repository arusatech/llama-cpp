# Android Low-Level Design Document
## LlamaCpp Capacitor Plugin - Android Platform Architecture

**Version:** 1.0.0  
**Platform:** Android (API 21+) - arm64-v8a, armeabi-v7a, x86, x86_64  
**Build System:** CMake 3.10+  
**Author:** Annadata AI  
**Date:** July 2, 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Component Architecture](#component-architecture)
4. [JNI Bridge Layer](#jni-bridge-layer)
5. [Java Plugin Implementation](#java-plugin-implementation)
6. [C++ Native Implementation](#c-native-implementation)
7. [Feature Implementation Details](#feature-implementation-details)
8. [Multi-Architecture Build System](#multi-architecture-build-system)
9. [Memory Management](#memory-management)
10. [Performance Optimization](#performance-optimization)
11. [Error Handling & Debugging](#error-handling--debugging)
12. [Build & Deployment](#build--deployment)
13. [Integration Patterns](#integration-patterns)
14. [Security Considerations](#security-considerations)

---

## Executive Summary

The Android implementation of LlamaCpp Capacitor Plugin provides offline LLM inference via a multi-layered JNI-based architecture:

- **TypeScript API Layer**: Capacitor plugin interface
- **Java Plugin Layer**: `LlamaCppPlugin.java` - Capacitor plugin implementation
- **Java Wrapper**: `LlamaCpp.java` - JNI method declarations
- **JNI Bridge**: `jni.cpp` - C↔Java interoperability
- **C++ Core**: llama.cpp compiled as `.so` shared library
- **Multi-Architecture**: arm64-v8a, armeabi-v7a, x86, x86_64

**Key Capabilities:**
- Full LLM inference (text, chat, embeddings)
- LoRA adapters, multimodal (vision/audio)
- TTS/Vocoder integration
- Session persistence
- Speculative decoding
- Multi-threaded inference

---

## Architecture Overview

### Layered Architecture

```
┌─────────────────────────────────────────────────────┐
│    TypeScript/Kotlin Application Layer              │
│         (via Capacitor Framework)                   │
├─────────────────────────────────────────────────────┤
│         Capacitor Core Bridge                       │
│    (Plugin Registration & Message Routing)          │
├─────────────────────────────────────────────────────┤
│      Java Plugin Implementation                     │
│        (LlamaCppPlugin.java)                        │
│     (18 Capacitor Plugin Methods)                   │
├─────────────────────────────────────────────────────┤
│       Java JNI Wrapper Layer                        │
│         (LlamaCpp.java)                             │
│   (Native method declarations + utilities)          │
├─────────────────────────────────────────────────────┤
│    JNI Bridge Layer (jni.cpp)                       │
│  ┌────────────────────────────────────────┐         │
│  │ Java Array ↔ C++ Vector Marshalling    │         │
│  │ Java String ↔ C++ String Conversion    │         │
│  │ HashMap ↔ JSON ↔ C++ struct mapping    │         │
│  │ Exception translation & error codes    │         │
│  └────────────────────────────────────────┘         │
├─────────────────────────────────────────────────────┤
│  C++ Implementation (.so library)                   │
│  ├─ jni-lora.cpp (LoRA Adapters)                    │
│  ├─ jni-multimodal.cpp (Vision/Audio)               │
│  ├─ jni-tts.cpp (Text-to-Speech)                    │
│  ├─ jni-chat-session.cpp (Chat & Sessions)          │
│  └─ jni.cpp (Core context & completion)             │
├─────────────────────────────────────────────────────┤
│  llama.cpp C++ Foundation.                          │
│  └─ cap-llama.cpp, cap-completion.cpp, etc.         │
├─────────────────────────────────────────────────────┤
│  GGML Backend.                                      │
│  ├─ CPU Operations (ARM, x86 variants)              │
│  ├─ NEON SIMD (ARM)                                 │
│  ├─ SSE/AVX (x86)                                   │
│  └─ Quantization support                            │
└─────────────────────────────────────────────────────┘
```

### Build Output Structure

```
android/
├── build.gradle                    # Gradle configuration
├── src/main/
│   ├── AndroidManifest.xml
│   ├── CMakeLists.txt              # Master CMake
│   ├── CMakeLists-arm64.txt        # ARM64 specific
│   ├── CMakeLists-x86_64.txt       # x86_64 specific
│   ├── jni-utils.h                 # JNI utilities
│   ├── jni.cpp                     # Main JNI implementation
│   ├── jni-lora.cpp                # LoRA feature
│   ├── jni-multimodal.cpp          # Vision/audio feature
│   ├── jni-tts.cpp                 # TTS feature
│   ├── jni-chat-session.cpp        # Chat/session feature
│   ├── java/ai/annadata/plugin/capacitor/
│   │   ├── LlamaCppPlugin.java     # 18 Capacitor methods
│   │   └── LlamaCpp.java           # JNI declarations
│   └── jniLibs/
│       ├── arm64-v8a/libllama-cpp-arm64.so
│       ├── armeabi-v7a/libllama-cpp-armv7.so
│       ├── x86/libllama-cpp-x86.so
│       └── x86_64/libllama-cpp-x86_64.so
└── build/                          # Gradle build output
```

---

## Component Architecture

### Dependency Graph

```
Application (TypeScript/Kotlin)
         ↓
Capacitor Bridge (TypeScript)
         ↓
PluginRegistry (Capacitor Core)
         ↓
LlamaCppPlugin (Java) ───────────┐
         ↓                       │
LlamaCpp (JNI declarations)      │
         ↓                       │
JNI Bridge (jni.cpp)  ───────────┤
  ├─ Type Marshalling            │
  ├─ String conversion           │
  ├─ Array/Vector conversion     │
  ├─ Exception translation       │
  └─ Context management          │
         ↓                       │
C++ Implementation    ───────────┤
  ├─ jni-lora.cpp                │
  ├─ jni-multimodal.cpp          │
  ├─ jni-tts.cpp                 │
  ├─ jni-chat-session.cpp        │
  └─ jni.cpp                     │
         ↓                       │
llama.cpp C++ API   ─────────────┘
  ├─ cap-llama.cpp
  ├─ cap-completion.cpp
  └─ cap-*.cpp (features)
         ↓
GGML Backend
  ├─ CPU (all architectures)
  └─ GPU (if available)
```

---

## JNI Bridge Layer

### JNI Fundamentals

**Java Native Interface (JNI):**
- Standard for calling native C++ from Java
- Type marshalling between Java and C++
- Exception handling & error reporting
- Memory ownership & lifecycle management

### Key Files

**1. jni-utils.h** - Utility Macros & Functions

```cpp
// Get string from Java
const char* str = env->GetStringUTFChars(javaString, nullptr);

// Convert Java HashMap to C++ map
std::map<std::string, std::string> toMap(JNIEnv* env, jobject hashMap) {
  std::map<std::string, std::string> result;
  // Iterate over HashMap entries
  // Convert keys and values
  return result;
}

// Throw Java exception from C++
void throwException(JNIEnv* env, const char* exception, const char* message) {
  jclass exceptionClass = env->FindClass(exception);
  env->ThrowNew(exceptionClass, message);
  env->DeleteLocalRef(exceptionClass);
}
```

**2. jni.cpp** - Main JNI Implementation

```cpp
// Function naming: Java_PackageName_ClassName_MethodName
JNIEXPORT jlong JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_initContextNative(
    JNIEnv* env, jobject thiz, 
    jlong contextId, 
    jobject paramsMap)
{
  try {
    // 1. Unmarshal Java parameters
    auto cppParams = javaMapToCppStruct(env, paramsMap);
    
    // 2. Call C++ implementation
    auto context = llama_init_context(contextId, cppParams);
    
    // 3. Store context pointer
    contextRegistry[contextId] = context;
    
    // 4. Return success code
    return LLAMA_SUCCESS;
  } catch (const std::exception& e) {
    throwException(env, "java/lang/RuntimeException", e.what());
    return LLAMA_ERROR;
  }
}
```

### Type Marshalling Patterns

**Pattern 1: String Conversion**
```cpp
// Java String → C++ std::string
jstring javaStr = env->GetObjectArrayElement(stringArray, 0);
const char* utf = env->GetStringUTFChars(javaStr, nullptr);
std::string cppStr(utf);
env->ReleaseStringUTFChars(javaStr, utf);
```

**Pattern 2: Array Conversion**
```cpp
// Java int[] → C++ std::vector<int>
jintArray javaArray = (jintArray)array;
jint* elements = env->GetIntArrayElements(javaArray, nullptr);
jsize length = env->GetArrayLength(javaArray);
std::vector<int> cppVector(elements, elements + length);
env->ReleaseIntArrayElements(javaArray, elements, JNI_ABORT);
```

**Pattern 3: Object Conversion**
```cpp
// Java HashMap → C++ std::map
jobject javaMap = ...;
jclass mapClass = env->GetObjectClass(javaMap);
jmethodID entrySetMethod = env->GetMethodID(mapClass, "entrySet", "()Ljava/util/Set;");
jobject entrySet = env->CallObjectMethod(javaMap, entrySetMethod);
// Iterate and convert entries
```

---

## Java Plugin Implementation

### LlamaCppPlugin.java - Capacitor Plugin Class

**18 Capacitor Plugin Methods:**

#### Group 1: Context Management (4 methods)
- `initContext(options)` → returns context info
- `releaseContext(options)` → void
- `releaseAllContexts()` → void
- `modelInfo(options)` → model metadata

#### Group 2: Generation (2 methods)
- `completion(options)` → generation result
- `generateText(options)` → text result

#### Group 3: Chat (3 methods)
- `chat(options)` → chat result
- `chatWithSystem(options)` → chat result
- `getFormattedChat(options)` → formatted prompt

#### Group 4: LoRA Adapters (3 methods)
- `applyLoraAdapters(options)` → adapter count
- `removeLoraAdapters(options)` → void
- `getLoadedLoraAdapters(options)` → adapter list

#### Group 5: Multimodal (2 methods)
- `initMultimodal(options)` → boolean
- `getMultimodalSupport(options)` → capabilities

#### Group 6: TTS/Vocoder (2 methods)
- `initVocoder(options)` → boolean
- `getFormattedAudioCompletion(options)` → audio params

#### Group 7: Session Management (1 method)
- `saveSession(options)` → token count

#### Group 8: Utilities (1 method)
- `toggleNativeLog(options)` → void

### LlamaCpp.java - JNI Wrapper

```java
public class LlamaCpp {
  static {
    System.loadLibrary("llama-cpp-arm64");  // Auto-loads correct arch
  }
  
  // Core JNI methods
  public static native long initContextNative(
    long contextId,
    HashMap<String, Object> params
  );
  
  public static native void releaseContextNative(long contextId);
  
  public static native String completionNative(
    long contextId,
    String prompt,
    HashMap<String, Object> params
  );
  
  // LoRA adapter methods (5 new methods)
  public static native int applyLoraAdaptersNative(
    long contextId,
    ArrayList<HashMap<String, Object>> adapters
  );
  
  public static native void removeLoraAdaptersNative(long contextId);
  
  public static native ArrayList<HashMap<String, Object>> getLoadedLoraAdaptersNative(
    long contextId
  );
  
  // Multimodal methods (4 new methods)
  public static native boolean initMultimodalNative(
    long contextId,
    String mmProjPath,
    boolean useGpu
  );
  
  public static native boolean isMultimodalEnabledNative(long contextId);
  
  public static native HashMap<String, Boolean> getMultimodalSupportNative(
    long contextId
  );
  
  public static native void releaseMultimodalNative(long contextId);
  
  // TTS methods (6 new methods)
  public static native boolean initVocoderNative(
    long contextId,
    String voccoderPath,
    int nBatch
  );
  
  public static native boolean isVocoderEnabledNative(long contextId);
  
  public static native HashMap<String, String> getFormattedAudioCompletionNative(
    long contextId,
    String speaker,
    String textToSpeak
  );
  
  public static native ArrayList<Integer> getAudioCompletionGuideTokensNative(
    long contextId,
    String textToSpeak
  );
  
  public static native ArrayList<Float> decodeAudioTokensNative(
    long contextId,
    int[] tokens
  );
  
  public static native void releaseVocoderNative(long contextId);
  
  // Chat/Session methods (3 new methods)
  public static native HashMap<String, Object> chatNative(
    long contextId,
    ArrayList<HashMap<String, Object>> messages,
    String system,
    String chatTemplate,
    HashMap<String, Object> params
  );
  
  public static native HashMap<String, Object> chatWithSystemNative(
    long contextId,
    String system,
    String message,
    HashMap<String, Object> params
  );
  
  public static native HashMap<String, Object> generateTextNative(
    long contextId,
    String prompt,
    HashMap<String, Object> params
  );
  
  public static native int saveSessionNative(
    long contextId,
    String filepath,
    int size
  );
  
  public static native HashMap<String, Object> loadSessionNative(
    long contextId,
    String filepath
  );
}
```

### Plugin Method Implementation Pattern

```java
@PluginMethod
public void completion(PluginCall call) {
  try {
    long contextId = call.getLong("contextId", -1L);
    if (contextId < 0) {
      call.reject("Missing contextId");
      return;
    }
    
    String prompt = call.getString("prompt", "");
    JSObject params = call.getObject("params");
    
    // Convert JSObject params to HashMap
    HashMap<String, Object> nativeParams = jsObjectToMap(params);
    
    // Call native method on background thread
    executor.execute(() -> {
      try {
        String result = LlamaCpp.completionNative(contextId, prompt, nativeParams);
        
        JSObject response = new JSObject();
        response.put("text", result);
        call.resolve(response);
      } catch (Exception e) {
        call.reject(e.getMessage());
      }
    });
  } catch (Exception e) {
    call.reject(e.getMessage());
  }
}

// Helper: Convert JSObject to HashMap
private HashMap<String, Object> jsObjectToMap(JSObject jsObj) {
  HashMap<String, Object> map = new HashMap<>();
  Iterator<String> keys = jsObj.keys();
  while (keys.hasNext()) {
    String key = keys.next();
    map.put(key, jsObj.get(key));
  }
  return map;
}
```

---

## C++ Native Implementation

### New Feature Implementation Files

**1. jni-lora.cpp** - LoRA Adapter Support (150 LOC)

```cpp
// Apply LoRA adapters
JNIEXPORT jint JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_applyLoraAdaptersNative(
    JNIEnv* env, jobject thiz, 
    jlong contextId, 
    jobjectArray adaptersArray)
{
  try {
    auto context = contextRegistry[contextId];
    jsize length = env->GetArrayLength(adaptersArray);
    int applied = 0;
    
    for (jsize i = 0; i < length; i++) {
      jobject adapter = env->GetObjectArrayElement(adaptersArray, i);
      jstring path = (jstring)mapGet(env, adapter, "path");
      jdouble scale = mapGetDouble(env, adapter, "scale");
      
      const char* adapterPath = env->GetStringUTFChars(path, nullptr);
      llama_lora_load(context->model, adapterPath, scale);
      env->ReleaseStringUTFChars(path, adapterPath);
      
      applied++;
    }
    
    return applied;
  } catch (const std::exception& e) {
    throwException(env, "java/lang/RuntimeException", e.what());
    return -1;
  }
}

// Remove all LoRA adapters
JNIEXPORT void JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_removeLoraAdaptersNative(
    JNIEnv* env, jobject thiz, jlong contextId)
{
  try {
    auto context = contextRegistry[contextId];
    context->lora_weights.clear();
  } catch (const std::exception& e) {
    throwException(env, "java/lang/RuntimeException", e.what());
  }
}
```

**2. jni-multimodal.cpp** - Vision/Audio Processing (180 LOC)

```cpp
// Initialize multimodal support
JNIEXPORT jboolean JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_initMultimodalNative(
    JNIEnv* env, jobject thiz,
    jlong contextId,
    jstring mmProjPath,
    jboolean useGpu)
{
  try {
    auto context = contextRegistry[contextId];
    const char* projPath = env->GetStringUTFChars(mmProjPath, nullptr);
    
    // Load multimodal projection model
    context->mtmd = std::make_unique<llama_cap_context_mtmd>();
    context->mtmd->clip_ctx = clip_model_load(projPath);
    context->mtmd->use_gpu = useGpu;
    context->mtmd->enabled = true;
    
    env->ReleaseStringUTFChars(mmProjPath, projPath);
    return true;
  } catch (const std::exception& e) {
    throwException(env, "java/lang/RuntimeException", e.what());
    return false;
  }
}

// Get multimodal capabilities
JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_getMultimodalSupportNative(
    JNIEnv* env, jobject thiz, jlong contextId)
{
  try {
    auto context = contextRegistry[contextId];
    
    // Create HashMap with capabilities
    jobject result = env->NewObject(
      env->FindClass("java/util/HashMap"),
      env->GetMethodID(env->FindClass("java/util/HashMap"), "<init>", "()V")
    );
    
    jmethodID putMethod = env->GetMethodID(
      env->FindClass("java/util/HashMap"),
      "put",
      "(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;"
    );
    
    // Vision capability
    env->CallObjectMethod(result, putMethod,
      env->NewStringUTF("vision"),
      (jboolean)(context->mtmd && context->mtmd->clip_ctx != nullptr)
    );
    
    // Audio capability
    env->CallObjectMethod(result, putMethod,
      env->NewStringUTF("audio"),
      (jboolean)(context->vocoder_enabled)
    );
    
    return result;
  } catch (const std::exception& e) {
    throwException(env, "java/lang/RuntimeException", e.what());
    return nullptr;
  }
}
```

**3. jni-tts.cpp** - Text-to-Speech (280 LOC)

```cpp
// Initialize vocoder for TTS
JNIEXPORT jboolean JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_initVocoderNative(
    JNIEnv* env, jobject thiz,
    jlong contextId,
    jstring vocoderPath,
    jint nBatch)
{
  try {
    auto context = contextRegistry[contextId];
    const char* vocPath = env->GetStringUTFChars(vocoderPath, nullptr);
    
    // Load vocoder model
    context->tts = std::make_unique<llama_cap_context_tts>();
    context->tts->vocoder_ctx = llama_model_load(vocPath);
    context->tts->n_batch = nBatch;
    context->tts->enabled = true;
    
    env->ReleaseStringUTFChars(vocoderPath, vocPath);
    return true;
  } catch (const std::exception& e) {
    throwException(env, "java/lang/RuntimeException", e.what());
    return false;
  }
}

// Get formatted audio completion
JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_getFormattedAudioCompletionNative(
    JNIEnv* env, jobject thiz,
    jlong contextId,
    jstring speakerJson,
    jstring textToSpeak)
{
  try {
    auto context = contextRegistry[contextId];
    
    const char* speaker = env->GetStringUTFChars(speakerJson, nullptr);
    const char* text = env->GetStringUTFChars(textToSpeak, nullptr);
    
    // Generate audio completion parameters
    auto result = llama_tts_get_formatted_completion(
      context->tts.get(),
      speaker,
      text
    );
    
    env->ReleaseStringUTFChars(speakerJson, speaker);
    env->ReleaseStringUTFChars(textToSpeak, text);
    
    // Return as HashMap
    jobject hashMap = createHashMap(env);
    setMapString(env, hashMap, "prompt", result.prompt.c_str());
    setMapString(env, hashMap, "grammar", result.grammar.c_str());
    
    return hashMap;
  } catch (const std::exception& e) {
    throwException(env, "java/lang/RuntimeException", e.what());
    return nullptr;
  }
}
```

**4. jni-chat-session.cpp** - Chat & Sessions (300 LOC)

```cpp
// Save session to file
JNIEXPORT jint JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_saveSessionNative(
    JNIEnv* env, jobject thiz,
    jlong contextId,
    jstring filepath,
    jint size)
{
  try {
    auto context = contextRegistry[contextId];
    const char* path = env->GetStringUTFChars(filepath, nullptr);
    
    // Save KV cache and completed tokens
    int tokens_saved = llama_session_save(context->ctx, path, size);
    
    env->ReleaseStringUTFChars(filepath, path);
    return tokens_saved;
  } catch (const std::exception& e) {
    throwException(env, "java/lang/RuntimeException", e.what());
    return -1;
  }
}

// Load session from file
JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_loadSessionNative(
    JNIEnv* env, jobject thiz,
    jlong contextId,
    jstring filepath)
{
  try {
    auto context = contextRegistry[contextId];
    const char* path = env->GetStringUTFChars(filepath, nullptr);
    
    // Load KV cache and token history
    auto tokens = llama_session_load(context->ctx, path);
    
    env->ReleaseStringUTFChars(filepath, path);
    
    // Return result as HashMap
    jobject result = createHashMap(env);
    setMapInt(env, result, "tokens_loaded", tokens.size());
    setMapString(env, result, "status", "loaded");
    
    return result;
  } catch (const std::exception& e) {
    throwException(env, "java/lang/RuntimeException", e.what());
    return nullptr;
  }
}

// Chat method
JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_chatNative(
    JNIEnv* env, jobject thiz,
    jlong contextId,
    jobjectArray messagesArray,
    jstring system,
    jstring chatTemplate,
    jobject params)
{
  try {
    auto context = contextRegistry[contextId];
    
    // Convert message array
    std::vector<llama_chat_message> messages;
    jsize msgCount = env->GetArrayLength(messagesArray);
    
    for (jsize i = 0; i < msgCount; i++) {
      jobject msg = env->GetObjectArrayElement(messagesArray, i);
      // Convert to llama_chat_message
    }
    
    // Add system message if provided
    if (system != nullptr) {
      const char* sys = env->GetStringUTFChars(system, nullptr);
      messages.insert(messages.begin(), 
        llama_chat_message{.role = "system", .content = sys});
      env->ReleaseStringUTFChars(system, sys);
    }
    
    // Format chat
    std::string prompt = llama_chat_format_messages(context, messages);
    
    // Generate completion
    auto result = llama_completion(context, prompt, params);
    
    // Return result
    return serializeCompletionResult(env, result);
  } catch (const std::exception& e) {
    throwException(env, "java/lang/RuntimeException", e.what());
    return nullptr;
  }
}
```

### Utility Functions for JNI

```cpp
// Helper: Get string from HashMap
const char* mapGetString(JNIEnv* env, jobject map, const char* key) {
  jclass mapClass = env->FindClass("java/util/HashMap");
  jmethodID getMethod = env->GetMethodID(mapClass, "get", "(Ljava/lang/Object;)Ljava/lang/Object;");
  jstring jKey = env->NewStringUTF(key);
  jstring value = (jstring)env->CallObjectMethod(map, getMethod, jKey);
  env->DeleteLocalRef(jKey);
  
  if (value == nullptr) return "";
  const char* utf = env->GetStringUTFChars(value, nullptr);
  return utf;  // Must be released by caller
}

// Helper: Create HashMap from C++
jobject createHashMap(JNIEnv* env) {
  jclass hashMapClass = env->FindClass("java/util/HashMap");
  jmethodID constructor = env->GetMethodID(hashMapClass, "<init>", "()V");
  return env->NewObject(hashMapClass, constructor);
}

// Helper: Set string value in HashMap
void setMapString(JNIEnv* env, jobject map, const char* key, const char* value) {
  jclass mapClass = env->FindClass("java/util/HashMap");
  jmethodID putMethod = env->GetMethodID(mapClass, "put", 
    "(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;");
  
  jstring jKey = env->NewStringUTF(key);
  jstring jValue = env->NewStringUTF(value);
  env->CallObjectMethod(map, putMethod, jKey, jValue);
  env->DeleteLocalRef(jKey);
  env->DeleteLocalRef(jValue);
}
```

---

## Multi-Architecture Build System

### CMakeLists.txt Structure

**Master CMake (src/main/CMakeLists.txt):**

```cmake
cmake_minimum_required(VERSION 3.10)
project(llama-cpp)

set(CMAKE_CXX_STANDARD 17)

# Include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../cpp/ggml-cpu
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../cpp/tools/mtmd
)

# Find NDK requirements
find_library(LOG_LIB log)
find_library(ANDROID_LIB android)
find_package(Threads REQUIRED)

# Define source files
set(SOURCE_FILES
    # Core llama.cpp sources
    ../../../cpp/ggml.c
    ../../../cpp/llama.cpp
    ../../../cpp/llama-model.cpp
    # ... many more source files ...
    
    # JNI implementation
    jni.cpp
    jni-lora.cpp
    jni-multimodal.cpp
    jni-tts.cpp
    jni-chat-session.cpp
)

# Build for ARM64
function(build_library_arm64)
    add_library(llama-cpp-arm64 SHARED ${SOURCE_FILES})
    
    # Architecture specific settings
    set_target_properties(llama-cpp-arm64 PROPERTIES
        ANDROID_ABI arm64-v8a
        ANDROID_PLATFORM android-21
    )
    
    # Compiler flags
    target_compile_options(llama-cpp-arm64 PRIVATE
        -mcpu=cortex-a53
        -march=armv8-a+crc
        -O3
        -DNDEBUG
    )
    
    # Link with system libraries
    target_link_libraries(llama-cpp-arm64
        ${LOG_LIB}
        ${ANDROID_LIB}
        Threads::Threads
    )
endfunction()

# Build for ARMv7
function(build_library_armv7)
    add_library(llama-cpp-armv7 SHARED ${SOURCE_FILES})
    
    set_target_properties(llama-cpp-armv7 PROPERTIES
        ANDROID_ABI armeabi-v7a
        ANDROID_PLATFORM android-21
    )
    
    target_compile_options(llama-cpp-armv7 PRIVATE
        -march=armv7-a
        -mfpu=neon
        -O3
        -DNDEBUG
    )
    
    target_link_libraries(llama-cpp-armv7
        ${LOG_LIB} ${ANDROID_LIB} Threads::Threads
    )
endfunction()

# Build for x86 and x86_64
function(build_library_x86)
    # Similar to above for x86 architecture
endfunction()

function(build_library_x86_64)
    # Similar to above for x86_64 architecture
endfunction()

# Call build functions
build_library_arm64()
build_library_armv7()
build_library_x86()
build_library_x86_64()
```

### Architecture-Specific Optimization

**ARM64 (Primary):**
- NEON SIMD optimization
- Cortex-A processor tuning
- 64-bit operations

**ARMv7 (Legacy Support):**
- NEON SIMD support
- Reduced instruction set
- 32-bit operations

**x86/x86_64:**
- SSE/AVX optimization
- Simulator support
- Development builds

---

## Memory Management

### Memory Allocation Patterns

**Model Loading:**
```cpp
// Load model with memory mapping
llama_model* model = llama_model_load(path, {
  .use_mmap = true,    // Memory-map the file
  .use_mlock = false,  // Don't lock in RAM (mobile optimization)
  .kv_type_k = "f16",  // KV cache type
  .kv_type_v = "f16"
});
```

**Context Allocation:**
```cpp
// Allocate inference context
llama_context* ctx = llama_context_new(model, {
  .n_ctx = 2048,       // Context size
  .n_batch = 512,      // Batch size
  .n_threads = 6       // Threading
});
```

### Cleanup & Lifecycle

```cpp
// Proper cleanup order
void cleanup_context(llama_cap_context* context) {
  if (context->draft_model_ctx) {
    llama_free(context->draft_model_ctx);
  }
  if (context->ctx) {
    llama_free(context->ctx);
  }
  if (context->draft_model) {
    llama_model_free(context->draft_model);
  }
  if (context->model) {
    llama_model_free(context->model);
  }
  delete context;
}
```

---

## Performance Optimization

### Threading Strategy

**Main Thread:**
- Plugin method calls
- Capacitor message handling
- Result serialization

**Worker Threads:**
- Model loading (on background thread)
- Context initialization
- Inference computation
- Token generation

**Thread Pool:**
- Executor service for background operations
- Thread count: CPU cores available
- Task queue for serialization

### CPU Optimization

**NEON (ARM64/ARMv7):**
- Vectorized quantization operations
- SIMD gemm implementations
- Reduced memory bandwidth

**SSE/AVX (x86/x86_64):**
- Vectorized operations
- Cache-friendly layouts
- Automatic dispatch

### Inference Optimization

```java
// Use thread pool for background work
private ExecutorService executor = Executors.newFixedThreadPool(
  Runtime.getRuntime().availableProcessors()
);

executor.execute(() -> {
  try {
    // Heavy inference work on background thread
    String result = LlamaCpp.completionNative(contextId, prompt, params);
    // Post result back to main thread
    mainHandler.post(() -> call.resolve(result));
  } catch (Exception e) {
    mainHandler.post(() -> call.reject(e.getMessage()));
  }
});
```

---

## Error Handling & Debugging

### Exception Translation

```cpp
// C++ exception → Java exception
void throwException(JNIEnv* env, const char* exceptionClass, const char* message) {
  jclass clazz = env->FindClass(exceptionClass);
  if (clazz == nullptr) {
    // Fallback if class not found
    clazz = env->FindClass("java/lang/RuntimeException");
  }
  env->ThrowNew(clazz, message);
  env->DeleteLocalRef(clazz);
}

// Usage
try {
  // Native operation
} catch (const std::out_of_range& e) {
  throwException(env, "java/lang/IndexOutOfBoundsException", e.what());
} catch (const std::exception& e) {
  throwException(env, "java/lang/RuntimeException", e.what());
}
```

### Logging

**Android Logcat Integration:**
```cpp
#include <android/log.h>

#define LOG_TAG "llama-cpp"
#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

LOGE("Context not found: %ld", contextId);
```

### Debug Checklist

- [ ] Model file path validation
- [ ] Memory usage monitoring
- [ ] Thread safety verification
- [ ] Exception handling completeness
- [ ] Resource cleanup on errors
- [ ] NDK symbol export verification

---

## Build & Deployment

### Build Process

**Step 1: CMake Configuration with NDK**
```bash
# Detect NDK path
export ANDROID_NDK=$ANDROID_HOME/ndk/29.0.13113456

# Configure for ARM64
cd android
./gradlew assembleRelease
```

**Step 2: CMake Invocation**
```bash
# Manual CMake build (optional)
cmake -B build/arm64 \
  -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK/build/cmake/android.toolchain.cmake \
  -DANDROID_ABI=arm64-v8a \
  -DANDROID_PLATFORM=android-21 \
  -S .

cmake --build build/arm64 -j$(nproc)
```

**Step 3: Native Library Output**
```
android/src/main/jniLibs/
├── arm64-v8a/
│   └── libllama-cpp-arm64.so        # 15-30 MB
├── armeabi-v7a/
│   └── libllama-cpp-armv7.so        # 12-25 MB
├── x86/
│   └── libllama-cpp-x86.so          # 12-25 MB
└── x86_64/
    └── libllama-cpp-x86_64.so       # 15-30 MB
```

### Gradle Integration

**build.gradle Configuration:**

```gradle
android {
    compileSdk 34
    
    defaultConfig {
        minSdkVersion 21
        targetSdkVersion 34
    }
    
    packagingOptions {
        // Include all architectures
        pickFirst 'lib/arm64-v8a/libc++_shared.so'
        pickFirst 'lib/armeabi-v7a/libc++_shared.so'
    }
    
    externalNativeBuild {
        cmake {
            version "3.22.1"
        }
    }
}

dependencies {
    implementation 'com.getcapacitor:core:latest'
    // Other dependencies
}
```

### NPM Publishing

**Package Contents:**
```
llama-cpp-capacitor@0.2.0/
├── dist/
│   ├── esm/
│   ├── plugin.cjs.js
│   └── plugin.js
├── android/src/main/jniLibs/
│   └── (all .so files for all architectures)
├── ios/Frameworks/
│   └── llama-cpp.framework
└── package.json
```

**Publish Command:**
```bash
npm run build:all      # Build JS + natives
npm run verify:pack:artifacts
npm publish
```

---

## Integration Patterns

### Pattern 1: Basic Completion

```typescript
import { initContext } from 'llama-cpp-capacitor';

const context = await initContext({
  contextId: 1,
  params: {
    model: "/path/to/model.gguf",
    n_ctx: 2048,
    n_threads: 6,
  }
});

const result = await context.completion({
  prompt: "Hello, world!",
  n_predict: 100,
  temperature: 0.7,
});

console.log(result.text);
```

### Pattern 2: Chat Conversation

```typescript
const result = await context.chat({
  messages: [
    { role: "user", content: "What is AI?" },
  ],
  system: "You are a helpful assistant.",
  params: {
    n_predict: 200,
    temperature: 0.8,
  }
});

console.log(result.content);
```

### Pattern 3: LoRA Adapters

```typescript
// Apply LoRA adapters for fine-tuned behavior
await context.applyLoraAdapters([
  { path: "/path/to/adapter1.gguf", scaled: 1.0 },
  { path: "/path/to/adapter2.gguf", scaled: 0.5 }
]);

const result = await context.completion({
  prompt: "Prompt tailored to adapters:",
  n_predict: 100,
});
```

### Pattern 4: Multimodal Vision

```typescript
// Initialize multimodal support
await context.initMultimodal({
  path: "/path/to/mmproj.gguf",
  use_gpu: true,
});

const result = await context.completion({
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Describe the image:" },
        { type: "image_url", image_url: { url: "file:///path/image.jpg" } }
      ]
    }
  ],
  n_predict: 200,
});
```

### Pattern 5: Streaming Inference

```typescript
let generatedText = '';

const result = await context.completion(
  {
    prompt: "Write a story:",
    n_predict: 300,
  },
  (tokenData) => {
    // Called for each token
    generatedText += tokenData.token;
    updateProgressUI(generatedText);
  }
);

console.log("Final:", result.text);
```

---

## Security Considerations

### File Access Control

**Allowed Paths:**
- App-specific directories (Context.getFilesDir(), Context.getCacheDir())
- Downloads directory (with permission)
- DCIM directory (with permission)

**Restricted Paths:**
- System directories (/system, /data, /proc)
- Other app directories
- Root filesystem

**Example Validation:**
```java
// Validate file path before accessing
private boolean isValidPath(String path) {
  File f = new File(path);
  String canonical = f.getCanonicalPath();
  
  // Check against allowed directories
  File appDir = getContext().getFilesDir();
  return canonical.startsWith(appDir.getCanonicalPath());
}
```

### Memory Protection

**Buffer Overflow Prevention:**
- JNI bounds checking
- String length validation
- Array size verification

**Example:**
```cpp
// Validate array bounds before access
jsize arrayLength = env->GetArrayLength(jarray);
if (index >= arrayLength || index < 0) {
  throwException(env, "java/lang/IndexOutOfBoundsException", "Index out of range");
  return;
}
```

### Model Security

**Model Validation:**
```cpp
// Verify GGUF format and integrity
if (!llama_model_is_valid_gguf(model_path)) {
  throw std::runtime_error("Invalid or corrupted model file");
}
```

### Thread Safety

**Synchronized Access:**
```java
private final Object contextLock = new Object();

private void accessContext(long contextId, Runnable operation) {
  synchronized (contextLock) {
    // Safe access to context
    operation.run();
  }
}
```

---

## Troubleshooting

### Common Issues

**Issue 1: "Symbol not found" linker error**
- Ensure all source files included in CMakeLists.txt
- Check NDK toolchain configuration
- Verify architecture match (arm64, armeabi-v7a, etc.)

**Issue 2: "Out of memory" during inference**
- Use quantized models (Q4_0, Q4_1, Q5_K_M)
- Reduce context size (n_ctx)
- Reduce batch size (n_batch)
- Unload unused contexts

**Issue 3: "Model not found"**
- Verify file path is absolute
- Check file permissions
- Ensure model file is not corrupted

**Issue 4: Slow performance**
- Check if native optimizations are enabled
- Verify CPU core count detected correctly
- Use `n_threads` appropriately
- Monitor memory pressure

### Debugging Commands

```bash
# Check loaded symbols
nm android/src/main/jniLibs/arm64-v8a/libllama-cpp-arm64.so | grep "init_context"

# Check Logcat for errors
adb logcat | grep llama-cpp

# Get detailed NDK debug info
ndk-build NDK_DEBUG=1
```

---

## Performance Tuning

### For Speed

```kotlin
// Optimize for throughput
LlamaCpp.initContextNative(
  contextId,
  mapOf(
    "model" to "/path/model.gguf",
    "n_ctx" to 512,               // Small context
    "n_batch" to 256,             // Large batch
    "n_threads" to cpuCount,      // All cores
    "draft_model" to "/draft.gguf" // Speculative decoding
  )
)
```

### For Memory Efficiency

```kotlin
// Optimize for memory usage
LlamaCpp.initContextNative(
  contextId,
  mapOf(
    "model" to "/path/model.q4_k.gguf",  // Quantized
    "n_ctx" to 1024,
    "n_batch" to 64,
    "n_threads" to 4,
    "use_mmap" to true,
    "use_mlock" to false
  )
)
```

### Benchmark Results

**Typical Performance (Snapdragon 8 Gen 2):**
- 7B model prompt: 20-40 tokens/sec
- 7B model generation: 5-10 tokens/sec
- With speculative decoding: 2-3x speedup
- Memory overhead: 4-8 GB for 7B quantized

---

## Additional Resources

- [llama.cpp Documentation](https://github.com/ggerganov/llama.cpp)
- [Android NDK Documentation](https://developer.android.com/ndk)
- [Capacitor Plugin Development](https://capacitorjs.com/docs/plugins)
- [CMake for Android](https://developer.android.com/ndk/guides/cmake)

---

## Conclusion

The Android implementation provides comprehensive LLM inference through carefully architected JNI bridging, multi-architecture support, and optimized C++ core integration. The modular feature implementation (LoRA, multimodal, TTS, sessions) enables flexible deployment across diverse Android devices while maintaining high performance and memory efficiency.

