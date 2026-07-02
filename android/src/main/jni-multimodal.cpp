// Multimodal Methods for Android JNI

JNIEXPORT jboolean JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_initMultimodalNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring mmproj_path, jboolean use_gpu) {
    
    try {
        LOGI("Initializing multimodal for context ID: %ld", contextId);
        
        std::string path = jni_utils::jstring_to_string(env, mmproj_path);
        LOGI("Multimodal projection path: %s", path.c_str());
        
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return JNI_FALSE;
        }
        
        auto& ctx = it->second;
        if (!ctx || !ctx->ctx || !ctx->model) {
            LOGE("Invalid context, llama context, or model is null");
            throw_java_exception(env, "java/lang/RuntimeException", "Invalid context or model not loaded");
            return JNI_FALSE;
        }
        
        // Check if model file exists
        std::ifstream mmproj_file(path, std::ios::binary);
        if (!mmproj_file.good()) {
            LOGE("Multimodal projection file not found: %s", path.c_str());
            throw_java_exception(env, "java/lang/RuntimeException", "Multimodal projection file not found");
            return JNI_FALSE;
        }
        mmproj_file.close();
        
        // Initialize multimodal
        bool result = ctx->initMultimodal(path, jni_utils::jboolean_to_bool(use_gpu));
        
        if (!result) {
            LOGE("Failed to initialize multimodal");
            throw_java_exception(env, "java/lang/RuntimeException", "Failed to initialize multimodal");
            return JNI_FALSE;
        }
        
        LOGI("Multimodal initialized successfully");
        return JNI_TRUE;
        
    } catch (const std::exception& e) {
        LOGE("Exception in initMultimodal: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return JNI_FALSE;
    }
}

JNIEXPORT jboolean JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_isMultimodalEnabledNative(
    JNIEnv* env, jobject thiz, jlong contextId) {
    
    try {
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return JNI_FALSE;
        }
        
        auto& ctx = it->second;
        if (!ctx) {
            LOGE("Invalid context");
            throw_java_exception(env, "java/lang/RuntimeException", "Invalid context");
            return JNI_FALSE;
        }
        
        bool enabled = ctx->isMultimodalEnabled();
        LOGI("Multimodal enabled: %s", enabled ? "true" : "false");
        return enabled ? JNI_TRUE : JNI_FALSE;
        
    } catch (const std::exception& e) {
        LOGE("Exception in isMultimodalEnabled: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return JNI_FALSE;
    }
}

JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_getMultimodalSupportNative(
    JNIEnv* env, jobject thiz, jlong contextId) {
    
    try {
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return nullptr;
        }
        
        auto& ctx = it->second;
        if (!ctx) {
            LOGE("Invalid context");
            throw_java_exception(env, "java/lang/RuntimeException", "Invalid context");
            return nullptr;
        }
        
        // Create result HashMap
        jclass hashMapClass = env->FindClass("java/util/HashMap");
        jmethodID hashMapConstructor = env->GetMethodID(hashMapClass, "<init>", "()V");
        jmethodID putMethod = env->GetMethodID(hashMapClass, "put", "(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;");
        
        jobject resultMap = env->NewObject(hashMapClass, hashMapConstructor);
        
        bool supports_vision = ctx->isMultimodalSupportVision();
        bool supports_audio = ctx->isMultimodalSupportAudio();
        
        env->CallObjectMethod(resultMap, putMethod,
            jni_utils::string_to_jstring(env, "vision"),
            env->NewObject(env->FindClass("java/lang/Boolean"),
                env->GetMethodID(env->FindClass("java/lang/Boolean"), "<init>", "(Z)V"),
                supports_vision ? JNI_TRUE : JNI_FALSE));
        
        env->CallObjectMethod(resultMap, putMethod,
            jni_utils::string_to_jstring(env, "audio"),
            env->NewObject(env->FindClass("java/lang/Boolean"),
                env->GetMethodID(env->FindClass("java/lang/Boolean"), "<init>", "(Z)V"),
                supports_audio ? JNI_TRUE : JNI_FALSE));
        
        LOGI("Multimodal support - vision: %s, audio: %s",
             supports_vision ? "true" : "false",
             supports_audio ? "true" : "false");
        
        return resultMap;
        
    } catch (const std::exception& e) {
        LOGE("Exception in getMultimodalSupport: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return nullptr;
    }
}

JNIEXPORT void JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_releaseMultimodalNative(
    JNIEnv* env, jobject thiz, jlong contextId) {
    
    try {
        LOGI("Releasing multimodal for context ID: %ld", contextId);
        
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return;
        }
        
        auto& ctx = it->second;
        if (!ctx) {
            LOGE("Invalid context");
            throw_java_exception(env, "java/lang/RuntimeException", "Invalid context");
            return;
        }
        
        ctx->releaseMultimodal();
        LOGI("Multimodal released successfully");
        
    } catch (const std::exception& e) {
        LOGE("Exception in releaseMultimodal: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
    }
}
