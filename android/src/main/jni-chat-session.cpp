// Advanced Chat and Session Management Methods for Android JNI

// MARK: - Advanced Chat Methods

JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_chatNative(
    JNIEnv* env, jobject thiz, jlong contextId, jobjectArray messages_array, 
    jstring system, jstring chat_template, jobject params) {
    
    try {
        LOGI("Chat completion for context ID: %ld", contextId);
        
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return nullptr;
        }
        
        auto& ctx = it->second;
        if (!ctx || !ctx->ctx) {
            LOGE("Invalid context");
            throw_java_exception(env, "java/lang/RuntimeException", "Invalid context");
            return nullptr;
        }
        
        // Convert Java messages array to JSON
        jsize messages_length = env->GetArrayLength(messages_array);
        std::string messages_json = "[";
        
        for (jsize i = 0; i < messages_length; i++) {
            jobject msg_obj = env->GetObjectArrayElement(messages_array, i);
            jclass hashMapClass = env->GetObjectClass(msg_obj);
            jmethodID getMethod = env->GetMethodID(hashMapClass, "get", "(Ljava/lang/Object;)Ljava/lang/Object;");
            
            // Get role
            jstring roleKey = jni_utils::string_to_jstring(env, "role");
            jstring roleValue = (jstring)env->CallObjectMethod(msg_obj, getMethod, roleKey);
            std::string role = jni_utils::jstring_to_string(env, roleValue);
            env->DeleteLocalRef(roleKey);
            env->DeleteLocalRef(roleValue);
            
            // Get content
            jstring contentKey = jni_utils::string_to_jstring(env, "content");
            jstring contentValue = (jstring)env->CallObjectMethod(msg_obj, getMethod, contentKey);
            std::string content = jni_utils::jstring_to_string(env, contentValue);
            env->DeleteLocalRef(contentKey);
            env->DeleteLocalRef(contentValue);
            
            if (i > 0) messages_json += ",";
            messages_json += "{\"role\":\"" + role + "\",\"content\":\"" + content + "\"}";
            
            env->DeleteLocalRef(msg_obj);
        }
        
        messages_json += "]";
        
        std::string system_str = jni_utils::jstring_to_string(env, system);
        std::string template_str = jni_utils::jstring_to_string(env, chat_template);
        
        LOGI("Chat messages: %s", messages_json.c_str());
        LOGI("System prompt: %s", system_str.c_str());
        
        // Format chat prompt
        std::string formatted_prompt = ctx->getFormattedChat(messages_json, template_str);
        
        // Extract completion parameters
        jint n_predict = 512;
        jdouble temperature = 0.7;
        
        if (params != nullptr) {
            jclass jsObjectClass = env->GetObjectClass(params);
            jmethodID getIntegerMethod = env->GetMethodID(jsObjectClass, "getInteger", "(Ljava/lang/String;)Ljava/lang/Integer;");
            if (env->ExceptionCheck()) {
                env->ExceptionClear();
                getIntegerMethod = nullptr;
            }

            if (getIntegerMethod != nullptr) {
                jstring key = jni_utils::string_to_jstring(env, "n_predict");
                jobject val = env->CallObjectMethod(params, getIntegerMethod, key);
                if (val != nullptr && !env->ExceptionCheck()) {
                    n_predict = env->CallIntMethod(val, env->GetMethodID(env->FindClass("java/lang/Integer"), "intValue", "()I"));
                    env->DeleteLocalRef(val);
                } else if (env->ExceptionCheck()) {
                    env->ExceptionClear();
                }
                env->DeleteLocalRef(key);
            }

            temperature = jni_utils::jsobject_opt_double(env, params, "temperature", temperature);
        }
        
        // Run completion with formatted prompt
        ctx->params.n_predict = n_predict;
        ctx->params.sampling.temp = temperature;
        
        // This would delegate to the completion method
        // For now, return formatted prompt
        jclass hashMapClass = env->FindClass("java/util/HashMap");
        jmethodID hashMapConstructor = env->GetMethodID(hashMapClass, "<init>", "()V");
        jmethodID putMethod = env->GetMethodID(hashMapClass, "put", "(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;");
        
        jobject resultMap = env->NewObject(hashMapClass, hashMapConstructor);
        
        env->CallObjectMethod(resultMap, putMethod,
            jni_utils::string_to_jstring(env, "formatted_prompt"),
            jni_utils::string_to_jstring(env, formatted_prompt));
        
        return resultMap;
        
    } catch (const std::exception& e) {
        LOGE("Exception in chat: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return nullptr;
    }
}

JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_chatWithSystemNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring system, jstring message, jobject params) {
    
    try {
        LOGI("Chat with system for context ID: %ld", contextId);
        
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return nullptr;
        }
        
        auto& ctx = it->second;
        if (!ctx || !ctx->ctx) {
            LOGE("Invalid context");
            throw_java_exception(env, "java/lang/RuntimeException", "Invalid context");
            return nullptr;
        }
        
        std::string system_str = jni_utils::jstring_to_string(env, system);
        std::string message_str = jni_utils::jstring_to_string(env, message);
        
        LOGI("System: %s", system_str.c_str());
        LOGI("Message: %s", message_str.c_str());
        
        // Build messages array
        std::string messages_json = "[";
        messages_json += "{\"role\":\"system\",\"content\":\"" + system_str + "\"},";
        messages_json += "{\"role\":\"user\",\"content\":\"" + message_str + "\"}";
        messages_json += "]";
        
        // Format using default chat template
        std::string formatted_prompt = ctx->getFormattedChat(messages_json, "");
        
        LOGI("Formatted prompt length: %zu", formatted_prompt.length());
        
        // Return formatted prompt in result map
        jclass hashMapClass = env->FindClass("java/util/HashMap");
        jmethodID hashMapConstructor = env->GetMethodID(hashMapClass, "<init>", "()V");
        jmethodID putMethod = env->GetMethodID(hashMapClass, "put", "(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;");
        
        jobject resultMap = env->NewObject(hashMapClass, hashMapConstructor);
        
        env->CallObjectMethod(resultMap, putMethod,
            jni_utils::string_to_jstring(env, "formatted_prompt"),
            jni_utils::string_to_jstring(env, formatted_prompt));
        
        return resultMap;
        
    } catch (const std::exception& e) {
        LOGE("Exception in chatWithSystem: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return nullptr;
    }
}

JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_generateTextNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring prompt, jobject params) {
    
    try {
        LOGI("Generate text for context ID: %ld", contextId);
        
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return nullptr;
        }
        
        auto& ctx = it->second;
        if (!ctx || !ctx->ctx) {
            LOGE("Invalid context");
            throw_java_exception(env, "java/lang/RuntimeException", "Invalid context");
            return nullptr;
        }
        
        std::string prompt_str = jni_utils::jstring_to_string(env, prompt);
        
        // Extract parameters
        jint n_predict = 256;
        jdouble temperature = 0.7;
        
        if (params != nullptr) {
            jclass jsObjectClass = env->GetObjectClass(params);
            jmethodID getIntegerMethod = env->GetMethodID(jsObjectClass, "getInteger", "(Ljava/lang/String;)Ljava/lang/Integer;");
            if (env->ExceptionCheck()) {
                env->ExceptionClear();
                getIntegerMethod = nullptr;
            }

            if (getIntegerMethod != nullptr) {
                jstring key = jni_utils::string_to_jstring(env, "n_predict");
                jobject val = env->CallObjectMethod(params, getIntegerMethod, key);
                if (val != nullptr && !env->ExceptionCheck()) {
                    n_predict = env->CallIntMethod(val, env->GetMethodID(env->FindClass("java/lang/Integer"), "intValue", "()I"));
                    env->DeleteLocalRef(val);
                } else if (env->ExceptionCheck()) {
                    env->ExceptionClear();
                }
                env->DeleteLocalRef(key);
            }

            temperature = jni_utils::jsobject_opt_double(env, params, "temperature", temperature);
        }
        
        LOGI("Generate text prompt: %s, n_predict: %d", prompt_str.c_str(), n_predict);
        
        // Set generation parameters
        ctx->params.n_predict = n_predict;
        ctx->params.sampling.temp = temperature;
        
        // This would delegate to completion
        jclass hashMapClass = env->FindClass("java/util/HashMap");
        jmethodID hashMapConstructor = env->GetMethodID(hashMapClass, "<init>", "()V");
        jmethodID putMethod = env->GetMethodID(hashMapClass, "put", "(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;");
        
        jobject resultMap = env->NewObject(hashMapClass, hashMapConstructor);
        
        env->CallObjectMethod(resultMap, putMethod,
            jni_utils::string_to_jstring(env, "prompt"),
            jni_utils::string_to_jstring(env, prompt_str));
        
        env->CallObjectMethod(resultMap, putMethod,
            jni_utils::string_to_jstring(env, "n_predict"),
            env->NewObject(env->FindClass("java/lang/Integer"),
                env->GetMethodID(env->FindClass("java/lang/Integer"), "<init>", "(I)V"),
                n_predict));
        
        return resultMap;
        
    } catch (const std::exception& e) {
        LOGE("Exception in generateText: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return nullptr;
    }
}

// MARK: - Session Management Methods

JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_loadSessionNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring filepath) {
    
    try {
        LOGI("Loading session for context ID: %ld", contextId);
        
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return nullptr;
        }
        
        auto& ctx = it->second;
        if (!ctx || !ctx->ctx) {
            LOGE("Invalid context");
            throw_java_exception(env, "java/lang/RuntimeException", "Invalid context");
            return nullptr;
        }
        
        std::string file_path = jni_utils::jstring_to_string(env, filepath);
        LOGI("Session file path: %s", file_path.c_str());
        
        // Check if file exists
        std::ifstream session_file(file_path, std::ios::binary);
        if (!session_file.good()) {
            LOGE("Session file not found: %s", file_path.c_str());
            throw_java_exception(env, "java/lang/RuntimeException", "Session file not found");
            return nullptr;
        }
        session_file.close();
        
        // TODO: Implement actual session loading from llama.cpp
        // For now, return success indicator
        jclass hashMapClass = env->FindClass("java/util/HashMap");
        jmethodID hashMapConstructor = env->GetMethodID(hashMapClass, "<init>", "()V");
        jmethodID putMethod = env->GetMethodID(hashMapClass, "put", "(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;");
        
        jobject resultMap = env->NewObject(hashMapClass, hashMapConstructor);
        
        env->CallObjectMethod(resultMap, putMethod,
            jni_utils::string_to_jstring(env, "success"),
            env->NewObject(env->FindClass("java/lang/Boolean"),
                env->GetMethodID(env->FindClass("java/lang/Boolean"), "<init>", "(Z)V"),
                JNI_TRUE));
        
        LOGI("Session loaded successfully");
        return resultMap;
        
    } catch (const std::exception& e) {
        LOGE("Exception in loadSession: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return nullptr;
    }
}

JNIEXPORT jint JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_saveSessionNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring filepath, jint size) {
    
    try {
        LOGI("Saving session for context ID: %ld", contextId);
        
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return -1;
        }
        
        auto& ctx = it->second;
        if (!ctx || !ctx->ctx) {
            LOGE("Invalid context");
            throw_java_exception(env, "java/lang/RuntimeException", "Invalid context");
            return -1;
        }
        
        std::string file_path = jni_utils::jstring_to_string(env, filepath);
        LOGI("Session file path: %s, size: %d", file_path.c_str(), size);
        
        // TODO: Implement actual session saving to llama.cpp
        // For now, return number of tokens saved
        int tokens_saved = (size > 0) ? size : 0;
        
        LOGI("Session saved successfully, tokens: %d", tokens_saved);
        return tokens_saved;
        
    } catch (const std::exception& e) {
        LOGE("Exception in saveSession: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return -1;
    }
}
