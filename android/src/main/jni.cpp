#include "jni-utils.h"
#include "rn-llama.h"
#include <android/log.h>
#include <cstring>
#include <memory>

// Add missing symbol
namespace rnllama {
    bool rnllama_verbose = false;
}

#define LOG_TAG "LlamaCpp"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace jni_utils {

std::string jstring_to_string(JNIEnv* env, jstring jstr) {
    if (jstr == nullptr) return "";
    const char* chars = env->GetStringUTFChars(jstr, nullptr);
    std::string str(chars);
    env->ReleaseStringUTFChars(jstr, chars);
    return str;
}

jstring string_to_jstring(JNIEnv* env, const std::string& str) {
    return env->NewStringUTF(str.c_str());
}

std::vector<std::string> jstring_array_to_string_vector(JNIEnv* env, jobjectArray jarray) {
    std::vector<std::string> result;
    if (jarray == nullptr) return result;
    
    jsize length = env->GetArrayLength(jarray);
    for (jsize i = 0; i < length; i++) {
        jstring jstr = (jstring)env->GetObjectArrayElement(jarray, i);
        result.push_back(jstring_to_string(env, jstr));
        env->DeleteLocalRef(jstr);
    }
    return result;
}

jobjectArray string_vector_to_jstring_array(JNIEnv* env, const std::vector<std::string>& vec) {
    jclass stringClass = env->FindClass("java/lang/String");
    jobjectArray result = env->NewObjectArray(vec.size(), stringClass, nullptr);
    
    for (size_t i = 0; i < vec.size(); i++) {
        jstring jstr = string_to_jstring(env, vec[i]);
        env->SetObjectArrayElement(result, i, jstr);
        env->DeleteLocalRef(jstr);
    }
    return result;
}

bool jboolean_to_bool(jboolean jbool) {
    return jbool == JNI_TRUE;
}

jboolean bool_to_jboolean(bool b) {
    return b ? JNI_TRUE : JNI_FALSE;
}

int jint_to_int(jint jint_val) {
    return static_cast<int>(jint_val);
}

jint int_to_jint(int val) {
    return static_cast<jint>(val);
}

float jfloat_to_float(jfloat jfloat_val) {
    return static_cast<float>(jfloat_val);
}

jfloat float_to_jfloat(float val) {
    return static_cast<jfloat>(val);
}

long jlong_to_long(jlong jlong_val) {
    return static_cast<long>(jlong_val);
}

jlong long_to_jlong(long val) {
    return static_cast<jlong>(val);
}

double jdouble_to_double(jdouble jdouble_val) {
    return static_cast<double>(jdouble_val);
}

jdouble double_to_jdouble(double val) {
    return static_cast<jdouble>(val);
}

void throw_java_exception(JNIEnv* env, const char* class_name, const char* message) {
    jclass exceptionClass = env->FindClass(class_name);
    if (exceptionClass != nullptr) {
        env->ThrowNew(exceptionClass, message);
    }
}

bool check_exception(JNIEnv* env) {
    return env->ExceptionCheck() == JNI_TRUE;
}

jfieldID get_field_id(JNIEnv* env, jclass clazz, const char* name, const char* sig) {
    jfieldID fieldID = env->GetFieldID(clazz, name, sig);
    if (check_exception(env)) {
        return nullptr;
    }
    return fieldID;
}

jmethodID get_method_id(JNIEnv* env, jclass clazz, const char* name, const char* sig) {
    jmethodID methodID = env->GetMethodID(clazz, name, sig);
    if (check_exception(env)) {
        return nullptr;
    }
    return methodID;
}

jclass find_class(JNIEnv* env, const char* name) {
    jclass clazz = env->FindClass(name);
    if (check_exception(env)) {
        return nullptr;
    }
    return clazz;
}

// Global context storage
static std::map<jlong, std::unique_ptr<rnllama::llama_rn_context>> contexts;
static jlong next_context_id = 1;

extern "C" {

JNIEXPORT jlong JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_initContext(
    JNIEnv* env, jobject thiz, jstring model_path, jobject params) {
    
    try {
        std::string model_path_str = jstring_to_string(env, model_path);
        
        // Create new context
        auto context = std::make_unique<rnllama::llama_rn_context>();
        
        // Initialize common parameters
        common_params cparams;
        cparams.model.path = model_path_str;
        cparams.n_ctx = 2048;
        cparams.n_batch = 512;
        cparams.n_gpu_layers = 0;
        cparams.rope_freq_base = 10000.0f;
        cparams.rope_freq_scale = 1.0f;
        cparams.use_mmap = true;
        cparams.use_mlock = false;
        cparams.numa = LM_GGML_NUMA_STRATEGY_DISABLED;
        
        // Load model
        if (!context->loadModel(cparams)) {
            throw_java_exception(env, "java/lang/RuntimeException", "Failed to load model");
            return -1;
        }
        
        // Store context
        jlong context_id = next_context_id++;
        contexts[context_id] = std::move(context);
        
        LOGI("Initialized context %ld with model: %s", context_id, model_path_str.c_str());
        return context_id;
        
    } catch (const std::exception& e) {
        LOGE("Exception in initContext: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return -1;
    }
}

JNIEXPORT void JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_releaseContext(
    JNIEnv* env, jobject thiz, jlong context_id) {
    
    try {
        auto it = contexts.find(context_id);
        if (it != contexts.end()) {
            contexts.erase(it);
            LOGI("Released context %ld", context_id);
        }
    } catch (const std::exception& e) {
        LOGE("Exception in releaseContext: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
    }
}

JNIEXPORT jstring JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_completion(
    JNIEnv* env, jobject thiz, jlong context_id, jstring prompt, jobject params) {
    
    try {
        auto it = contexts.find(context_id);
        if (it == contexts.end()) {
            throw_java_exception(env, "java/lang/IllegalArgumentException", "Invalid context ID");
            return nullptr;
        }
        
        std::string prompt_str = jstring_to_string(env, prompt);
        
        // Get the context
        rnllama::llama_rn_context* context = it->second.get();
        
        // For now, return a simple completion
        // In a full implementation, this would use the actual llama.cpp completion logic
        std::string result = "Generated response for: " + prompt_str;
        
        LOGI("Completion for context %ld: %s", context_id, prompt_str.c_str());
        return string_to_jstring(env, result);
        
    } catch (const std::exception& e) {
        LOGE("Exception in completion: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return nullptr;
    }
}

JNIEXPORT void JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_stopCompletion(
    JNIEnv* env, jobject thiz, jlong context_id) {
    
    try {
        auto it = contexts.find(context_id);
        if (it != contexts.end()) {
            // Stop completion logic would go here
            LOGI("Stopped completion for context %ld", context_id);
        }
    } catch (const std::exception& e) {
        LOGE("Exception in stopCompletion: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
    }
}

JNIEXPORT jstring JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_getFormattedChat(
    JNIEnv* env, jobject thiz, jlong context_id, jstring messages, jstring chat_template) {
    
    try {
        auto it = contexts.find(context_id);
        if (it == contexts.end()) {
            throw_java_exception(env, "java/lang/IllegalArgumentException", "Invalid context ID");
            return nullptr;
        }
        
        std::string messages_str = jstring_to_string(env, messages);
        std::string template_str = jstring_to_string(env, chat_template);
        
        rnllama::llama_rn_context* context = it->second.get();
        
        // Format chat using the context's method
        std::string result = context->getFormattedChat(messages_str, template_str);
        
        LOGI("Formatted chat for context %ld", context_id);
        return string_to_jstring(env, result);
        
    } catch (const std::exception& e) {
        LOGE("Exception in getFormattedChat: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return nullptr;
    }
}

JNIEXPORT jboolean JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_toggleNativeLog(
    JNIEnv* env, jobject thiz, jboolean enabled) {
    
    try {
        rnllama::rnllama_verbose = jboolean_to_bool(enabled);
        LOGI("Native logging %s", enabled ? "enabled" : "disabled");
        return bool_to_jboolean(true);
    } catch (const std::exception& e) {
        LOGE("Exception in toggleNativeLog: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return bool_to_jboolean(false);
    }
}

} // extern "C"

} // namespace jni_utils
