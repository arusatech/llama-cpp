// LoRA Adapter Methods for Android JNI
// Note: These are defined as _impl variants; the public JNI entry points in
// jni.cpp forward to them. This avoids duplicate-symbol conflicts at link time.

JNIEXPORT jint JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_applyLoraAdaptersNative_impl(
    JNIEnv* env, jobject thiz, jlong contextId, jobjectArray loraAdaptersArray) {
    
    try {
        LOGI("Applying LoRA adapters for context ID: %ld", contextId);
        
        // Find the context
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return -1;
        }
        
        auto& ctx = it->second;
        if (!ctx || !ctx->ctx || !ctx->model) {
            LOGE("Invalid context, llama context, or model is null");
            throw_java_exception(env, "java/lang/RuntimeException", "Invalid context or model not loaded");
            return -1;
        }
        
        // Convert Java array of HashMap to C++ vector of LoRA info
        std::vector<common_adapter_lora_info> lora_adapters;
        
        if (loraAdaptersArray != nullptr) {
            jsize array_length = env->GetArrayLength(loraAdaptersArray);
            LOGI("Processing %d LoRA adapters", array_length);
            
            for (jsize i = 0; i < array_length; i++) {
                jobject adapter_obj = env->GetObjectArrayElement(loraAdaptersArray, i);
                if (adapter_obj == nullptr) {
                    LOGW("LoRA adapter at index %d is null", i);
                    continue;
                }
                
                // Get HashMap class
                jclass hashMapClass = env->GetObjectClass(adapter_obj);
                jmethodID getMethod = env->GetMethodID(hashMapClass, "get", "(Ljava/lang/Object;)Ljava/lang/Object;");
                
                // Get path from HashMap
                jstring pathKey = jni_utils::string_to_jstring(env, "path");
                jstring pathValue = (jstring)env->CallObjectMethod(adapter_obj, getMethod, pathKey);
                env->DeleteLocalRef(pathKey);
                
                if (pathValue == nullptr) {
                    LOGE("LoRA adapter at index %d has no path", i);
                    env->DeleteLocalRef(adapter_obj);
                    continue;
                }
                
                std::string path = jni_utils::jstring_to_string(env, pathValue);
                env->DeleteLocalRef(pathValue);
                
                // Get scale from HashMap if provided
                float scale = 1.0f;
                jstring scaleKey = jni_utils::string_to_jstring(env, "scale");
                jobject scaleValue = env->CallObjectMethod(adapter_obj, getMethod, scaleKey);
                env->DeleteLocalRef(scaleKey);
                
                if (scaleValue != nullptr) {
                    jclass doubleClass = env->FindClass("java/lang/Double");
                    jmethodID doubleValueMethod = env->GetMethodID(doubleClass, "doubleValue", "()D");
                    scale = static_cast<float>(env->CallDoubleMethod(scaleValue, doubleValueMethod));
                    env->DeleteLocalRef(scaleValue);
                    LOGI("LoRA adapter %d scale: %.2f", i, scale);
                }
                
                // Create LoRA info struct
                common_adapter_lora_info lora_info;
                lora_info.path = path;
                lora_info.scale = scale;
                lora_adapters.push_back(lora_info);
                
                LOGI("LoRA adapter %d added: path=%s, scale=%.2f", i, path.c_str(), scale);
                env->DeleteLocalRef(adapter_obj);
            }
        }
        
        // Apply LoRA adapters
        LOGI("Calling applyLoraAdapters with %zu adapters", lora_adapters.size());
        int result = ctx->applyLoraAdapters(lora_adapters);
        
        if (result != 0) {
            LOGE("Failed to apply LoRA adapters: %d", result);
            throw_java_exception(env, "java/lang/RuntimeException", "Failed to apply LoRA adapters");
            return -1;
        }
        
        LOGI("LoRA adapters applied successfully");
        return static_cast<jint>(lora_adapters.size());
        
    } catch (const std::exception& e) {
        LOGE("Exception in applyLoraAdapters: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return -1;
    }
}

JNIEXPORT void JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_removeLoraAdaptersNative_impl(
    JNIEnv* env, jobject thiz, jlong contextId) {
    
    try {
        LOGI("Removing LoRA adapters for context ID: %ld", contextId);
        
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return;
        }
        
        auto& ctx = it->second;
        if (!ctx || !ctx->ctx) {
            LOGE("Invalid context or llama context is null");
            throw_java_exception(env, "java/lang/RuntimeException", "Invalid context");
            return;
        }
        
        ctx->removeLoraAdapters();
        LOGI("LoRA adapters removed successfully");
        
    } catch (const std::exception& e) {
        LOGE("Exception in removeLoraAdapters: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
    }
}

JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_getLoadedLoraAdaptersNative_impl(
    JNIEnv* env, jobject thiz, jlong contextId) {
    
    try {
        LOGI("Getting loaded LoRA adapters for context ID: %ld", contextId);
        
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return nullptr;
        }
        
        auto& ctx = it->second;
        if (!ctx || !ctx->ctx) {
            LOGE("Invalid context or llama context is null");
            throw_java_exception(env, "java/lang/RuntimeException", "Invalid context");
            return nullptr;
        }
        
        // Get loaded adapters
        std::vector<common_adapter_lora_info> adapters = ctx->getLoadedLoraAdapters();
        
        // Create Java ArrayList for result
        jclass arrayListClass = env->FindClass("java/util/ArrayList");
        jmethodID arrayListConstructor = env->GetMethodID(arrayListClass, "<init>", "()V");
        jmethodID addMethod = env->GetMethodID(arrayListClass, "add", "(Ljava/lang/Object;)Z");
        
        jobject resultList = env->NewObject(arrayListClass, arrayListConstructor);
        
        // Add each adapter to ArrayList
        jclass hashMapClass = env->FindClass("java/util/HashMap");
        jmethodID hashMapConstructor = env->GetMethodID(hashMapClass, "<init>", "()V");
        jmethodID putMethod = env->GetMethodID(hashMapClass, "put", "(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;");
        
        for (const auto& adapter : adapters) {
            jobject adapterMap = env->NewObject(hashMapClass, hashMapConstructor);
            
            env->CallObjectMethod(adapterMap, putMethod,
                jni_utils::string_to_jstring(env, "path"),
                jni_utils::string_to_jstring(env, adapter.path));
            
            env->CallObjectMethod(adapterMap, putMethod,
                jni_utils::string_to_jstring(env, "scale"),
                env->NewObject(env->FindClass("java/lang/Double"),
                    env->GetMethodID(env->FindClass("java/lang/Double"), "<init>", "(D)V"),
                    static_cast<jdouble>(adapter.scale)));
            
            env->CallBooleanMethod(resultList, addMethod, adapterMap);
            env->DeleteLocalRef(adapterMap);
            
            LOGI("LoRA adapter: path=%s, scale=%.2f", adapter.path.c_str(), adapter.scale);
        }
        
        LOGI("Retrieved %zu loaded LoRA adapters", adapters.size());
        return resultList;
        
    } catch (const std::exception& e) {
        LOGE("Exception in getLoadedLoraAdapters: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return nullptr;
    }
}
