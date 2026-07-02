// Extended LlamaCppPlugin methods for Android (add these to LlamaCppPlugin.java)

// This file contains the additional Java wrapper methods for the new Android features.
// Copy these methods into the LlamaCppPlugin.java file in the appropriate sections.

// ============================================
// MARK: - LoRA Adapter Methods
// ============================================

/**
 * Apply LoRA adapters to the model
 */
public void applyLoraAdapters(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        JSArray loraAdaptersArray = call.getArray("loraAdapters");
        
        // Convert JSArray to jobjectArray
        List<Map<String, Object>> adapters = new ArrayList<>();
        if (loraAdaptersArray != null) {
            for (int i = 0; i < loraAdaptersArray.length(); i++) {
                JSObject adapter = loraAdaptersArray.getJSObject(i);
                Map<String, Object> adapterMap = new HashMap<>();
                adapterMap.put("path", adapter.getString("path"));
                adapterMap.put("scale", adapter.getDouble("scale", 1.0));
                adapters.add(adapterMap);
            }
        }
        
        int result = applyLoraAdaptersNative(contextId, adapters.toArray(new Map[0]));
        
        if (result >= 0) {
            JSObject ret = new JSObject();
            ret.put("adaptersApplied", result);
            call.resolve(ret);
        } else {
            call.reject("Failed to apply LoRA adapters");
        }
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

/**
 * Remove all LoRA adapters from the model
 */
public void removeLoraAdapters(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        removeLoraAdaptersNative(contextId);
        call.resolve();
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

/**
 * Get list of currently loaded LoRA adapters
 */
public void getLoadedLoraAdapters(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        List<Map<String, Object>> adapters = getLoadedLoraAdaptersNative(contextId);
        
        JSArray adaptersArray = new JSArray();
        for (Map<String, Object> adapter : adapters) {
            JSObject adapterObj = new JSObject();
            adapterObj.put("path", adapter.get("path"));
            adapterObj.put("scale", adapter.get("scale"));
            adaptersArray.put(adapterObj);
        }
        
        JSObject ret = new JSObject();
        ret.put("adapters", adaptersArray);
        call.resolve(ret);
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

// Native methods
private native int applyLoraAdaptersNative(int contextId, Map<String, Object>[] adapters);
private native void removeLoraAdaptersNative(int contextId);
private native List<Map<String, Object>> getLoadedLoraAdaptersNative(int contextId);

// ============================================
// MARK: - Multimodal Methods
// ============================================

/**
 * Initialize multimodal support with vision/audio projection
 */
public void initMultimodal(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        String mmproj_path = call.getString("path", "");
        boolean use_gpu = call.getBoolean("use_gpu", true);
        
        if (mmproj_path.isEmpty()) {
            call.reject("Multimodal projection path is required");
            return;
        }
        
        boolean success = initMultimodalNative(contextId, mmproj_path, use_gpu);
        
        if (success) {
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("Failed to initialize multimodal");
        }
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

/**
 * Check if multimodal is enabled
 */
public void isMultimodalEnabled(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        boolean enabled = isMultimodalEnabledNative(contextId);
        
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

/**
 * Get multimodal capabilities (vision, audio support)
 */
public void getMultimodalSupport(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        Map<String, Boolean> support = getMultimodalSupportNative(contextId);
        
        JSObject ret = new JSObject();
        ret.put("vision", support.get("vision"));
        ret.put("audio", support.get("audio"));
        call.resolve(ret);
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

/**
 * Release multimodal resources
 */
public void releaseMultimodal(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        releaseMultimodalNative(contextId);
        call.resolve();
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

// Native methods
private native boolean initMultimodalNative(int contextId, String mmproj_path, boolean use_gpu);
private native boolean isMultimodalEnabledNative(int contextId);
private native Map<String, Boolean> getMultimodalSupportNative(int contextId);
private native void releaseMultimodalNative(int contextId);

// ============================================
// MARK: - TTS/Vocoder Methods
// ============================================

/**
 * Initialize TTS vocoder model
 */
public void initVocoder(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        String vocoder_path = call.getString("path", "");
        int n_batch = call.getInt("n_batch", 512);
        
        if (vocoder_path.isEmpty()) {
            call.reject("Vocoder model path is required");
            return;
        }
        
        boolean success = initVocoderNative(contextId, vocoder_path, n_batch);
        
        if (success) {
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("Failed to initialize vocoder");
        }
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

/**
 * Check if vocoder is enabled
 */
public void isVocoderEnabled(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        boolean enabled = isVocoderEnabledNative(contextId);
        
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

/**
 * Get formatted audio completion prompt
 */
public void getFormattedAudioCompletion(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        String speakerJsonStr = call.getString("speakerJsonStr", "");
        String textToSpeak = call.getString("textToSpeak", "");
        
        Map<String, String> result = getFormattedAudioCompletionNative(contextId, speakerJsonStr, textToSpeak);
        
        JSObject ret = new JSObject();
        ret.put("prompt", result.get("prompt"));
        if (result.containsKey("grammar")) {
            ret.put("grammar", result.get("grammar"));
        }
        call.resolve(ret);
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

/**
 * Get audio completion guide tokens
 */
public void getAudioCompletionGuideTokens(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        String textToSpeak = call.getString("textToSpeak", "");
        
        int[] tokens = getAudioCompletionGuideTokensNative(contextId, textToSpeak);
        
        JSArray tokensArray = new JSArray();
        for (int token : tokens) {
            tokensArray.put(token);
        }
        
        JSObject ret = new JSObject();
        ret.put("tokens", tokensArray);
        call.resolve(ret);
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

/**
 * Decode audio tokens to audio samples
 */
public void decodeAudioTokens(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        JSArray tokensArray = call.getArray("tokens");
        
        int[] tokens = new int[tokensArray.length()];
        for (int i = 0; i < tokensArray.length(); i++) {
            tokens[i] = tokensArray.getInt(i);
        }
        
        float[] audioSamples = decodeAudioTokensNative(contextId, tokens);
        
        JSArray samplesArray = new JSArray();
        for (float sample : audioSamples) {
            samplesArray.put(sample);
        }
        
        JSObject ret = new JSObject();
        ret.put("audioSamples", samplesArray);
        call.resolve(ret);
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

/**
 * Release vocoder resources
 */
public void releaseVocoder(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        releaseVocoderNative(contextId);
        call.resolve();
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

// Native methods
private native boolean initVocoderNative(int contextId, String vocoder_path, int n_batch);
private native boolean isVocoderEnabledNative(int contextId);
private native Map<String, String> getFormattedAudioCompletionNative(int contextId, String speakerJsonStr, String textToSpeak);
private native int[] getAudioCompletionGuideTokensNative(int contextId, String textToSpeak);
private native float[] decodeAudioTokensNative(int contextId, int[] tokens);
private native void releaseVocoderNative(int contextId);

// ============================================
// MARK: - Advanced Chat Methods
// ============================================

/**
 * Chat with messages array
 */
public void chat(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        JSArray messagesArray = call.getArray("messages");
        String system = call.getString("system", "");
        String chatTemplate = call.getString("chatTemplate", "");
        JSObject params = call.getObject("params");
        
        Map<String, Object> result = chatNative(contextId, messagesArray, system, chatTemplate, params);
        
        JSObject ret = new JSObject();
        ret.put("formattedPrompt", result.get("prompt"));
        call.resolve(ret);
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

/**
 * Chat with system prompt
 */
public void chatWithSystem(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        String system = call.getString("system", "");
        String message = call.getString("message", "");
        JSObject params = call.getObject("params");
        
        Map<String, Object> result = chatWithSystemNative(contextId, system, message, params);
        
        JSObject ret = new JSObject();
        ret.put("formattedPrompt", result.get("prompt"));
        call.resolve(ret);
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

/**
 * Generate text from prompt
 */
public void generateText(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        String prompt = call.getString("prompt", "");
        JSObject params = call.getObject("params");
        
        Map<String, Object> result = generateTextNative(contextId, prompt, params);
        
        JSObject ret = new JSObject();
        ret.put("prompt", result.get("prompt"));
        ret.put("n_predict", result.get("n_predict"));
        call.resolve(ret);
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

// Native methods
private native Map<String, Object> chatNative(int contextId, JSArray messagesArray, String system, String chatTemplate, JSObject params);
private native Map<String, Object> chatWithSystemNative(int contextId, String system, String message, JSObject params);
private native Map<String, Object> generateTextNative(int contextId, String prompt, JSObject params);

// ============================================
// MARK: - Session Management Methods
// ============================================

/**
 * Load a saved inference session
 */
public void loadSession(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        String filepath = call.getString("filepath", "");
        
        if (filepath.isEmpty()) {
            call.reject("Session file path is required");
            return;
        }
        
        Map<String, Object> result = loadSessionNative(contextId, filepath);
        
        JSObject ret = new JSObject();
        ret.put("success", (boolean) result.get("success"));
        call.resolve(ret);
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

/**
 * Save current inference session
 */
public void saveSession(PluginCall call) {
    try {
        int contextId = call.getInt("contextId", 0);
        String filepath = call.getString("filepath", "");
        int size = call.getInt("size", -1);
        
        if (filepath.isEmpty()) {
            call.reject("Session file path is required");
            return;
        }
        
        int tokensSaved = saveSessionNative(contextId, filepath, size);
        
        if (tokensSaved >= 0) {
            JSObject ret = new JSObject();
            ret.put("tokensSaved", tokensSaved);
            call.resolve(ret);
        } else {
            call.reject("Failed to save session");
        }
    } catch (Exception e) {
        call.reject(e.getMessage());
    }
}

// Native methods
private native Map<String, Object> loadSessionNative(int contextId, String filepath);
private native int saveSessionNative(int contextId, String filepath, int size);

// ============================================
// Add these to the pluginMethods array
// ============================================

/*
Add these entries to the pluginMethods array:

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
*/
