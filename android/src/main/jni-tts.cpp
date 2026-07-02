// TTS/Vocoder Methods for Android JNI

JNIEXPORT jboolean JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_initVocoderNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring vocoder_model_path, jint n_batch) {
    
    try {
        LOGI("Initializing vocoder for context ID: %ld", contextId);
        
        std::string path = jni_utils::jstring_to_string(env, vocoder_model_path);
        LOGI("Vocoder model path: %s", path.c_str());
        
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
        
        // Check if vocoder model file exists
        std::ifstream vocoder_file(path, std::ios::binary);
        if (!vocoder_file.good()) {
            LOGE("Vocoder model file not found: %s", path.c_str());
            throw_java_exception(env, "java/lang/RuntimeException", "Vocoder model file not found");
            return JNI_FALSE;
        }
        vocoder_file.close();
        
        // Initialize vocoder with batch size (-1 means use default)
        int batch_size = (n_batch > 0) ? static_cast<int>(n_batch) : -1;
        bool result = ctx->initVocoder(path, batch_size);
        
        if (!result) {
            LOGE("Failed to initialize vocoder");
            throw_java_exception(env, "java/lang/RuntimeException", "Failed to initialize vocoder");
            return JNI_FALSE;
        }
        
        LOGI("Vocoder initialized successfully with batch size: %d", batch_size);
        return JNI_TRUE;
        
    } catch (const std::exception& e) {
        LOGE("Exception in initVocoder: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return JNI_FALSE;
    }
}

JNIEXPORT jboolean JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_isVocoderEnabledNative(
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
        
        bool enabled = ctx->isVocoderEnabled();
        LOGI("Vocoder enabled: %s", enabled ? "true" : "false");
        return enabled ? JNI_TRUE : JNI_FALSE;
        
    } catch (const std::exception& e) {
        LOGE("Exception in isVocoderEnabled: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return JNI_FALSE;
    }
}

JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_getFormattedAudioCompletionNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring speaker_json_str, jstring text_to_speak) {
    
    try {
        LOGI("Getting formatted audio completion for context ID: %ld", contextId);
        
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return nullptr;
        }
        
        auto& ctx = it->second;
        if (!ctx || !ctx->tts_wrapper) {
            LOGE("Context or vocoder not initialized");
            throw_java_exception(env, "java/lang/RuntimeException", "Vocoder not initialized");
            return nullptr;
        }
        
        std::string speaker_json = jni_utils::jstring_to_string(env, speaker_json_str);
        std::string text = jni_utils::jstring_to_string(env, text_to_speak);
        
        LOGI("Text to synthesize: %s", text.c_str());
        
        // Get formatted audio completion
        capllama::llama_cap_audio_completion_result result = 
            ctx->tts_wrapper->getFormattedAudioCompletion(ctx.get(), speaker_json, text);
        
        // Create result HashMap
        jclass hashMapClass = env->FindClass("java/util/HashMap");
        jmethodID hashMapConstructor = env->GetMethodID(hashMapClass, "<init>", "()V");
        jmethodID putMethod = env->GetMethodID(hashMapClass, "put", "(Ljava/lang/Object;Ljava/lang/Object;)Ljava/lang/Object;");
        
        jobject resultMap = env->NewObject(hashMapClass, hashMapConstructor);
        
        env->CallObjectMethod(resultMap, putMethod,
            jni_utils::string_to_jstring(env, "prompt"),
            jni_utils::string_to_jstring(env, result.prompt));
        
        if (result.grammar != nullptr) {
            env->CallObjectMethod(resultMap, putMethod,
                jni_utils::string_to_jstring(env, "grammar"),
                jni_utils::string_to_jstring(env, result.grammar));
        }
        
        LOGI("Audio completion formatted successfully");
        return resultMap;
        
    } catch (const std::exception& e) {
        LOGE("Exception in getFormattedAudioCompletion: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return nullptr;
    }
}

JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_getAudioCompletionGuideTokensNative(
    JNIEnv* env, jobject thiz, jlong contextId, jstring text_to_speak) {
    
    try {
        LOGI("Getting audio completion guide tokens for context ID: %ld", contextId);
        
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return nullptr;
        }
        
        auto& ctx = it->second;
        if (!ctx || !ctx->tts_wrapper) {
            LOGE("Context or vocoder not initialized");
            throw_java_exception(env, "java/lang/RuntimeException", "Vocoder not initialized");
            return nullptr;
        }
        
        std::string text = jni_utils::jstring_to_string(env, text_to_speak);
        LOGI("Text for guide tokens: %s", text.c_str());
        
        // Get guide tokens
        std::vector<llama_token> guide_tokens = 
            ctx->tts_wrapper->getAudioCompletionGuideTokens(ctx.get(), text);
        
        // Create Java ArrayList for tokens
        jclass arrayListClass = env->FindClass("java/util/ArrayList");
        jmethodID arrayListConstructor = env->GetMethodID(arrayListClass, "<init>", "()V");
        jmethodID addMethod = env->GetMethodID(arrayListClass, "add", "(Ljava/lang/Object;)Z");
        
        jobject tokenList = env->NewObject(arrayListClass, arrayListConstructor);
        
        // Add tokens
        jclass integerClass = env->FindClass("java/lang/Integer");
        jmethodID integerConstructor = env->GetMethodID(integerClass, "<init>", "(I)V");
        
        for (llama_token token : guide_tokens) {
            jobject jToken = env->NewObject(integerClass, integerConstructor, static_cast<jint>(token));
            env->CallBooleanMethod(tokenList, addMethod, jToken);
            env->DeleteLocalRef(jToken);
        }
        
        LOGI("Retrieved %zu guide tokens", guide_tokens.size());
        return tokenList;
        
    } catch (const std::exception& e) {
        LOGE("Exception in getAudioCompletionGuideTokens: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return nullptr;
    }
}

JNIEXPORT jobject JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_decodeAudioTokensNative(
    JNIEnv* env, jobject thiz, jlong contextId, jintArray tokens_array) {
    
    try {
        LOGI("Decoding audio tokens for context ID: %ld", contextId);
        
        auto it = contexts.find(contextId);
        if (it == contexts.end()) {
            LOGE("Context not found: %ld", contextId);
            throw_java_exception(env, "java/lang/RuntimeException", "Context not found");
            return nullptr;
        }
        
        auto& ctx = it->second;
        if (!ctx || !ctx->tts_wrapper) {
            LOGE("Context or vocoder not initialized");
            throw_java_exception(env, "java/lang/RuntimeException", "Vocoder not initialized");
            return nullptr;
        }
        
        // Convert Java int array to C++ vector
        jsize length = env->GetArrayLength(tokens_array);
        jint* tokenArray = env->GetIntArrayElements(tokens_array, nullptr);
        
        std::vector<llama_token> tokens;
        for (jsize i = 0; i < length; i++) {
            tokens.push_back(static_cast<llama_token>(tokenArray[i]));
        }
        
        env->ReleaseIntArrayElements(tokens_array, tokenArray, JNI_ABORT);
        
        LOGI("Decoding %zu audio tokens", tokens.size());
        
        // Decode audio tokens
        std::vector<float> audio_samples = ctx->tts_wrapper->decodeAudioTokens(ctx.get(), tokens);
        
        // Create Java ArrayList for audio samples
        jclass arrayListClass = env->FindClass("java/util/ArrayList");
        jmethodID arrayListConstructor = env->GetMethodID(arrayListClass, "<init>", "()V");
        jmethodID addMethod = env->GetMethodID(arrayListClass, "add", "(Ljava/lang/Object;)Z");
        
        jobject audioList = env->NewObject(arrayListClass, arrayListConstructor);
        
        // Add audio samples
        jclass floatClass = env->FindClass("java/lang/Float");
        jmethodID floatConstructor = env->GetMethodID(floatClass, "<init>", "(F)V");
        
        for (float sample : audio_samples) {
            jobject jSample = env->NewObject(floatClass, floatConstructor, sample);
            env->CallBooleanMethod(audioList, addMethod, jSample);
            env->DeleteLocalRef(jSample);
        }
        
        LOGI("Decoded %zu audio samples", audio_samples.size());
        return audioList;
        
    } catch (const std::exception& e) {
        LOGE("Exception in decodeAudioTokens: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
        return nullptr;
    }
}

JNIEXPORT void JNICALL
Java_ai_annadata_plugin_capacitor_LlamaCpp_releaseVocoderNative(
    JNIEnv* env, jobject thiz, jlong contextId) {
    
    try {
        LOGI("Releasing vocoder for context ID: %ld", contextId);
        
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
        
        ctx->releaseVocoder();
        LOGI("Vocoder released successfully");
        
    } catch (const std::exception& e) {
        LOGE("Exception in releaseVocoder: %s", e.what());
        throw_java_exception(env, "java/lang/RuntimeException", e.what());
    }
}
