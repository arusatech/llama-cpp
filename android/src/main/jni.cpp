#include "jni-utils.h"
#include "rn-llama.h"
#include <android/log.h>
#include <cstring>
#include <memory>
#include <fstream> // Added for file existence and size checks

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
Java_ai_annadata_plugin_capacitor_LlamaCpp_initContextNative(
    JNIEnv* env, jobject thiz, jstring model_path, jobject params) {
    
    try {
        std::string model_path_str = jstring_to_string(env, model_path);
        LOGI("Attempting to load model from path: %s", model_path_str.c_str());

        // List all possible paths we should check
        std::vector<std::string> paths_to_check = {
            model_path_str,
            "/data/data/ai.annadata.app/files/" + model_path_str,
            "/data/data/ai.annadata.app/files/Documents/" + model_path_str,
            "/storage/emulated/0/Android/data/ai.annadata.app/files/" + model_path_str,
            "/storage/emulated/0/Android/data/ai.annadata.app/files/Documents/" + model_path_str,
            "/storage/emulated/0/Documents/" + model_path_str
        };

        // Check each path and log what we find
        std::string full_model_path;
        bool file_found = false;
        
        for (const auto& path : paths_to_check) {
            LOGI("Checking path: %s", path.c_str());
            std::ifstream file_check(path);
            if (file_check.good()) {
                file_check.seekg(0, std::ios::end);
                std::streamsize file_size = file_check.tellg();
                file_check.close();
                LOGI("Found file at: %s, size: %ld bytes", path.c_str(), file_size);
                
                // Validate file size
                if (file_size < 1024 * 1024) { // Less than 1MB
                    LOGE("Model file is too small, likely corrupted: %s", path.c_str());
                    continue; // Try next path
                }
                
                // Check if it's a valid GGUF file by reading the magic number
                std::ifstream magic_file(path, std::ios::binary);
                if (magic_file.good()) {
                    char magic[4];
                    if (magic_file.read(magic, 4)) {
                        if (magic[0] == 'G' && magic[1] == 'G' && magic[2] == 'U' && magic[3] == 'F') {
                            LOGI("Valid GGUF file detected at: %s", path.c_str());
                            full_model_path = path;
                            file_found = true;
                            break;
                        } else {
                            LOGI("File does not appear to be a GGUF file (magic: %c%c%c%c) at: %s", 
                                 magic[0], magic[1], magic[2], magic[3], path.c_str());
                        }
                    }
                    magic_file.close();
                }
            } else {
                LOGI("File not found at: %s", path.c_str());
            }
            file_check.close();
        }

        if (!file_found) {
            LOGE("Model file not found in any of the checked paths");
            throw_java_exception(env, "java/lang/RuntimeException", "Model file not found in any expected location");
            return -1;
        }

        // Create new context
        auto context = std::make_unique<rnllama::llama_rn_context>();
        LOGI("Created llama_rn_context");
        
        // Initialize common parameters
        common_params cparams;
        cparams.model.path = full_model_path;
        cparams.n_ctx = 2048;
        cparams.n_batch = 512;
        cparams.n_gpu_layers = 0;
        cparams.rope_freq_base = 10000.0f;
        cparams.rope_freq_scale = 1.0f;
        cparams.use_mmap = true;
        cparams.use_mlock = false;
        cparams.numa = LM_GGML_NUMA_STRATEGY_DISABLED;
        cparams.ctx_shift = false;
        cparams.chat_template = "";
        cparams.embedding = false;
        cparams.cont_batching = false;
        cparams.parallel = false;
        cparams.grammar = "";
        cparams.grammar_penalty.clear();
        cparams.antiprompt.clear();
        cparams.lora_adapter.clear();
        cparams.lora_base = "";
        cparams.mul_mat_q = true;
        cparams.f16_kv = true;
        cparams.logits_all = false;
        cparams.vocab_only = false;
        cparams.rope_scaling_type = LLAMA_ROPE_SCALING_TYPE_UNSPECIFIED;
        cparams.rope_scaling_factor = 0.0f;
        cparams.rope_scaling_orig_ctx_len = 0;
        cparams.yarn_ext_factor = -1.0f;
        cparams.yarn_attn_factor = 1.0f;
        cparams.yarn_beta_fast = 32.0f;
        cparams.yarn_beta_slow = 1.0f;
        cparams.yarn_orig_ctx = 0;
        cparams.offload_kqv = true;
        cparams.flash_attn = false;
        cparams.flash_attn_kernel = false;
        cparams.flash_attn_causal = true;
        cparams.mmproj = "";
        cparams.image = "";
        cparams.export = "";
        cparams.export_path = "";
        cparams.seed = -1;
        cparams.n_keep = 0;
        cparams.n_discard = -1;
        cparams.n_draft = 0;
        cparams.n_chunks = -1;
        cparams.n_parallel = 1;
        cparams.n_sequences = 1;
        cparams.p_accept = 0.5f;
        cparams.p_split = 0.1f;
        cparams.n_gqa = 8;
        cparams.rms_norm_eps = 5e-6f;
        cparams.model_alias = "unknown";
        cparams.ubatch_size = 512;
        cparams.ubatch_seq_len_max = 1;
        
        LOGI("Initialized common parameters, attempting to load model from: %s", full_model_path.c_str());
        LOGI("Model parameters: n_ctx=%d, n_batch=%d, n_gpu_layers=%d", 
             cparams.n_ctx, cparams.n_batch, cparams.n_gpu_layers);
        
        // Try to load the model with error handling
        bool load_success = false;
        try {
            load_success = context->loadModel(cparams);
        } catch (const std::exception& e) {
            LOGE("Exception during model loading: %s", e.what());
            load_success = false;
        } catch (...) {
            LOGE("Unknown exception during model loading");
            load_success = false;
        }
        
        if (!load_success) {
            LOGE("context->loadModel() returned false - model loading failed");
            
            // Try with minimal parameters as fallback
            LOGI("Trying with minimal parameters...");
            common_params minimal_params;
            minimal_params.model.path = full_model_path;
            minimal_params.n_ctx = 512;
            minimal_params.n_batch = 256;
            minimal_params.n_gpu_layers = 0;
            minimal_params.use_mmap = true;
            minimal_params.use_mlock = false;
            minimal_params.numa = LM_GGML_NUMA_STRATEGY_DISABLED;
            minimal_params.ctx_shift = false;
            minimal_params.chat_template = "";
            minimal_params.embedding = false;
            minimal_params.cont_batching = false;
            minimal_params.parallel = false;
            minimal_params.grammar = "";
            minimal_params.grammar_penalty.clear();
            minimal_params.antiprompt.clear();
            minimal_params.lora_adapter.clear();
            minimal_params.lora_base = "";
            minimal_params.mul_mat_q = true;
            minimal_params.f16_kv = true;
            minimal_params.logits_all = false;
            minimal_params.vocab_only = false;
            minimal_params.rope_scaling_type = LLAMA_ROPE_SCALING_TYPE_UNSPECIFIED;
            minimal_params.rope_scaling_factor = 0.0f;
            minimal_params.rope_scaling_orig_ctx_len = 0;
            minimal_params.yarn_ext_factor = -1.0f;
            minimal_params.yarn_attn_factor = 1.0f;
            minimal_params.yarn_beta_fast = 32.0f;
            minimal_params.yarn_beta_slow = 1.0f;
            minimal_params.yarn_orig_ctx = 0;
            minimal_params.offload_kqv = true;
            minimal_params.flash_attn = false;
            minimal_params.flash_attn_kernel = false;
            minimal_params.flash_attn_causal = true;
            minimal_params.mmproj = "";
            minimal_params.image = "";
            minimal_params.export = "";
            minimal_params.export_path = "";
            minimal_params.seed = -1;
            minimal_params.n_keep = 0;
            minimal_params.n_discard = -1;
            minimal_params.n_draft = 0;
            minimal_params.n_chunks = -1;
            minimal_params.n_parallel = 1;
            minimal_params.n_sequences = 1;
            minimal_params.p_accept = 0.5f;
            minimal_params.p_split = 0.1f;
            minimal_params.n_gqa = 8;
            minimal_params.rms_norm_eps = 5e-6f;
            minimal_params.model_alias = "unknown";
            minimal_params.ubatch_size = 256;
            minimal_params.ubatch_seq_len_max = 1;
            
            try {
                load_success = context->loadModel(minimal_params);
            } catch (const std::exception& e) {
                LOGE("Exception during minimal model loading: %s", e.what());
                load_success = false;
            } catch (...) {
                LOGE("Unknown exception during minimal model loading");
                load_success = false;
            }
            
            if (!load_success) {
                LOGE("Model loading failed even with minimal parameters");
                throw_java_exception(env, "java/lang/RuntimeException", "Failed to load model - possible model corruption or incompatibility");
                return -1;
            }
        }
        
        LOGI("Model loaded successfully!");
        
        // Store context
        jlong context_id = next_context_id++;
        contexts[context_id] = std::move(context);
        
        LOGI("Initialized context %ld with model: %s", context_id, full_model_path.c_str());
        return context_id;
        
    } catch (const std::exception& e) {
        LOGE("Exception in initContext: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return -1;
    }
}

JNIEXPORT void JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_releaseContextNative(
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
Java_ai_annadata_plugin_capacitor_LlamaCpp_completionNative(
    JNIEnv* env, jobject thiz, jlong context_id, jstring prompt) {
    
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
Java_ai_annadata_plugin_capacitor_LlamaCpp_stopCompletionNative(
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
Java_ai_annadata_plugin_capacitor_LlamaCpp_getFormattedChatNative(
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
Java_ai_annadata_plugin_capacitor_LlamaCpp_toggleNativeLogNative(
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
