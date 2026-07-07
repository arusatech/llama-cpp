package ai.annadata.plugin.capacitor;

import android.util.Log;
import com.getcapacitor.JSObject;
import java.util.HashMap;
import java.util.Map;
import java.util.Iterator;
import java.util.concurrent.CompletableFuture;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import android.content.Context;
import android.os.Environment;
import java.util.ArrayList;

// MARK: - Result Types
class LlamaResult<T> {
    private final T data;
    private final LlamaError error;
    private final boolean isSuccess;

    private LlamaResult(T data, LlamaError error, boolean isSuccess) {
        this.data = data;
        this.error = error;
        this.isSuccess = isSuccess;
    }

    public static <T> LlamaResult<T> success(T data) {
        return new LlamaResult<>(data, null, true);
    }

    public static <T> LlamaResult<T> failure(LlamaError error) {
        return new LlamaResult<>(null, error, false);
    }

    public boolean isSuccess() {
        return isSuccess;
    }

    public T getData() {
        return data;
    }

    public LlamaError getError() {
        return error;
    }
}

class LlamaError extends Exception {
    public LlamaError(String message) {
        super(message);
    }
}

// MARK: - Context Management
class LlamaContext {
    private final int id;
    private LlamaModel model;
    private boolean isMultimodalEnabled = false;
    private boolean isVocoderEnabled = false;
    private long nativeContextId = -1;

    public LlamaContext(int id) {
        this.id = id;
    }

    public int getId() {
        return id;
    }

    public LlamaModel getModel() {
        return model;
    }

    public void setModel(LlamaModel model) {
        this.model = model;
    }

    public boolean isMultimodalEnabled() {
        return isMultimodalEnabled;
    }

    public void setMultimodalEnabled(boolean multimodalEnabled) {
        isMultimodalEnabled = multimodalEnabled;
    }

    public boolean isVocoderEnabled() {
        return isVocoderEnabled;
    }

    public void setVocoderEnabled(boolean vocoderEnabled) {
        isVocoderEnabled = vocoderEnabled;
    }

    public long getNativeContextId() {
        return nativeContextId;
    }

    public void setNativeContextId(long nativeContextId) {
        this.nativeContextId = nativeContextId;
    }
}

class LlamaModel {
    private final String path;
    private final String desc;
    private final int size;
    private final int nEmbd;
    private final int nParams;
    private final ChatTemplates chatTemplates;
    private final Map<String, Object> metadata;

    public LlamaModel(String path, String desc, int size, int nEmbd, int nParams, ChatTemplates chatTemplates, Map<String, Object> metadata) {
        this.path = path;
        this.desc = desc;
        this.size = size;
        this.nEmbd = nEmbd;
        this.nParams = nParams;
        this.chatTemplates = chatTemplates;
        this.metadata = metadata;
    }

    public String getPath() {
        return path;
    }

    public String getDesc() {
        return desc;
    }

    public int getSize() {
        return size;
    }

    public int getNEmbd() {
        return nEmbd;
    }

    public int getNParams() {
        return nParams;
    }

    public ChatTemplates getChatTemplates() {
        return chatTemplates;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }
}

class ChatTemplates {
    private final boolean llamaChat;
    private final MinjaTemplates minja;

    public ChatTemplates(boolean llamaChat, MinjaTemplates minja) {
        this.llamaChat = llamaChat;
        this.minja = minja;
    }

    public boolean isLlamaChat() {
        return llamaChat;
    }

    public MinjaTemplates getMinja() {
        return minja;
    }
}

class MinjaTemplates {
    private final boolean default_;
    private final MinjaCaps defaultCaps;
    private final boolean toolUse;
    private final MinjaCaps toolUseCaps;

    public MinjaTemplates(boolean default_, MinjaCaps defaultCaps, boolean toolUse, MinjaCaps toolUseCaps) {
        this.default_ = default_;
        this.defaultCaps = defaultCaps;
        this.toolUse = toolUse;
        this.toolUseCaps = toolUseCaps;
    }

    public boolean isDefault() {
        return default_;
    }

    public MinjaCaps getDefaultCaps() {
        return defaultCaps;
    }

    public boolean isToolUse() {
        return toolUse;
    }

    public MinjaCaps getToolUseCaps() {
        return toolUseCaps;
    }
}

class MinjaCaps {
    private final boolean tools;
    private final boolean toolCalls;
    private final boolean toolResponses;
    private final boolean systemRole;
    private final boolean parallelToolCalls;
    private final boolean toolCallId;

    public MinjaCaps(boolean tools, boolean toolCalls, boolean toolResponses, boolean systemRole, boolean parallelToolCalls, boolean toolCallId) {
        this.tools = tools;
        this.toolCalls = toolCalls;
        this.toolResponses = toolResponses;
        this.systemRole = systemRole;
        this.parallelToolCalls = parallelToolCalls;
        this.toolCallId = toolCallId;
    }

    public boolean isTools() {
        return tools;
    }

    public boolean isToolCalls() {
        return toolCalls;
    }

    public boolean isToolResponses() {
        return toolResponses;
    }

    public boolean isSystemRole() {
        return systemRole;
    }

    public boolean isParallelToolCalls() {
        return parallelToolCalls;
    }

    public boolean isToolCallId() {
        return toolCallId;
    }
}

// MARK: - Main Implementation
public class LlamaCpp {
    private static final String TAG = "LlamaCpp";
    private final Map<Integer, LlamaContext> contexts = new HashMap<>();
    private int contextCounter = 0;
    // Default aligned with the isomorphic limit (parity with WASM_MAX_CONCURRENT_MODELS = 5).
    private int contextLimit = ModelAdmissionController.MAX_CONCURRENT_MODELS;
    private boolean nativeLogEnabled = false;
    private Context context;
    // Memory admission control (parity with the Web DefaultModelScheduler).
    private final ModelAdmissionController admissionController;

    // Constructor to receive context
    public LlamaCpp(Context context) {
        this.context = context;
        this.admissionController = new ModelAdmissionController(context);
    }

    // Native method declarations
    private native long initContextNative(String modelPath, String[] searchPaths, JSObject params);
    private native void releaseContextNative(long nativeContextId);
    private native Map<String, Object> completionNative(long contextId, JSObject params);
    private native Map<String, Object> modelInfoNative(String modelPath);
    private native void stopCompletionNative(long contextId);
    private native String getFormattedChatNative(long contextId, String messages, String chatTemplate);
    private native boolean toggleNativeLogNative(boolean enabled);

    // Tokenization methods
    private native Map<String, Object> tokenizeNative(long contextId, String text, String[] imagePaths);
    private native String detokenizeNative(long contextId, int[] tokens);

    // Embedding and reranking methods
    private native Map<String, Object> embeddingNative(long contextId, String text, JSObject params);
    private native List<Map<String, Object>> rerankNative(long contextId, String query, String[] documents, JSObject params);

    // Benchmarking
    private native String benchNative(long contextId, int pp, int tg, int pl, int nr);

    // Session management
    private native Map<String, Object> loadSessionNative(long contextId, String filepath);
    private native int saveSessionNative(long contextId, String filepath, int size);

    // LoRA adapter methods
    private native int applyLoraAdaptersNative(long contextId, Object[] loraAdapters);
    private native void removeLoraAdaptersNative(long contextId);
    private native List<Map<String, Object>> getLoadedLoraAdaptersNative(long contextId);

    // Multimodal methods
    private native boolean initMultimodalNative(long contextId, String mmProjPath, boolean useGpu);
    private native boolean isMultimodalEnabledNative(long contextId);
    private native Map<String, Object> getMultimodalSupportNative(long contextId);
    private native void releaseMultimodalNative(long contextId);

    // TTS / Vocoder methods
    private native boolean initVocoderNative(long contextId, String vocoderModelPath, int nBatch);
    private native boolean isVocoderEnabledNative(long contextId);
    private native Map<String, Object> getFormattedAudioCompletionNative(long contextId, String speakerJsonStr, String textToSpeak);
    private native List<Integer> getAudioCompletionGuideTokensNative(long contextId, String textToSpeak);
    private native List<Float> decodeAudioTokensNative(long contextId, int[] tokens);
    private native void releaseVocoderNative(long contextId);

    // Model download and management methods
    private native String downloadModelNative(String url, String filename);
    private native Map<String, Object> getDownloadProgressNative(String url);
    private native boolean cancelDownloadNative(String url);
    private native List<Map<String, Object>> getAvailableModelsNative();

    // Grammar utilities
    private native String convertJsonSchemaToGrammarNative(String schemaJson);

    /** In-process localhost HTTP server (native); see cap-native-server.cpp */
    private native boolean startLlamaServerNative(String modelPath, String host, int port, String paramsJson);
    private native void stopLlamaServerNative();
    private native boolean isLlamaServerRunningNative();

    static {
        try {

            // Detect the current architecture and load the appropriate library
            String arch = System.getProperty("os.arch");
            String abi = android.os.Build.SUPPORTED_ABIS[0]; // Get primary ABI
            String libraryName;
            
            // Map Android ABI to library name
            switch (abi) {
                case "arm64-v8a":
                    libraryName = "llama-cpp-arm64";
                    break;
                case "armeabi-v7a":
                    libraryName = "llama-cpp-armeabi";
                    break;
                case "x86":
                    libraryName = "llama-cpp-x86";
                    break;
                case "x86_64":
                    libraryName = "llama-cpp-x86_64";
                    break;
                default:
                    Log.w(TAG, "Unsupported ABI: " + abi + ", falling back to arm64-v8a");
                    libraryName = "llama-cpp-arm64";
                    break;
            }
            
            Log.i(TAG, "Loading native library for ABI: " + abi + " (library: " + libraryName + ")");
            System.loadLibrary(libraryName);
            Log.i(TAG, "Successfully loaded llama-cpp native library: " + libraryName);
        } catch (UnsatisfiedLinkError e) {
            Log.e(TAG, "Failed to load llama-cpp native library: " + e.getMessage());
            throw e;
        }
    }

    // MARK: - Core initialization and management

    public void toggleNativeLog(boolean enabled, LlamaCallback<Void> callback) {
        try {
            boolean result = toggleNativeLogNative(enabled);
            nativeLogEnabled = enabled;
            if (enabled) {
                Log.i(TAG, "Native logging enabled");
            } else {
                Log.i(TAG, "Native logging disabled");
            }
            callback.onResult(LlamaResult.success(null));
        } catch (Exception e) {
            callback.onResult(LlamaResult.failure(new LlamaError("Failed to toggle native log: " + e.getMessage())));
        }
    }

    public void setContextLimit(int limit, LlamaCallback<Void> callback) {
        int maxAllowed = admissionController.maxModels();
        if (limit < 1) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context limit must be at least 1")));
            return;
        }
        if (limit > maxAllowed) {
            // Clamp to the isomorphic hard cap rather than silently over-committing memory.
            Log.w(TAG, "Requested context limit " + limit + " exceeds max " + maxAllowed
                + "; clamping to " + maxAllowed);
            contextLimit = maxAllowed;
        } else {
            contextLimit = limit;
        }
        Log.i(TAG, "Context limit set to " + contextLimit);
        callback.onResult(LlamaResult.success(null));
    }

    public void downloadModel(String url, String filename, LlamaCallback<String> callback) {
        try {
            Log.i(TAG, "Starting download of model: " + filename + " from: " + url);
            String localPath = downloadModelNative(url, filename);
            
            // Start download in background thread
            new Thread(() -> {
                try {
                    downloadFile(url, localPath, callback);
                } catch (Exception e) {
                    Log.e(TAG, "Error in download thread: " + e.getMessage());
                    callback.onResult(LlamaResult.failure(new LlamaError("Download failed: " + e.getMessage())));
                }
            }).start();
            
            // Return the local path immediately
            callback.onResult(LlamaResult.success(localPath));
            
        } catch (Exception e) {
            Log.e(TAG, "Error preparing download: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("Download preparation failed: " + e.getMessage())));
        }
    }
    
    private void downloadFile(String url, String localPath, LlamaCallback<String> callback) {
        try {
            URL downloadUrl = new URL(url);
            HttpURLConnection connection = (HttpURLConnection) downloadUrl.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(0); // No timeout for large files
            
            int responseCode = connection.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw new IOException("HTTP error code: " + responseCode);
            }
            
            long fileSize = connection.getContentLengthLong();
            Log.i(TAG, "File size: " + fileSize + " bytes");
            
            try (InputStream inputStream = connection.getInputStream();
                 FileOutputStream outputStream = new FileOutputStream(localPath)) {
                
                byte[] buffer = new byte[8192];
                long downloadedBytes = 0;
                int bytesRead;
                
                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, bytesRead);
                    downloadedBytes += bytesRead;
                    
                    // Log progress every 1MB
                    if (downloadedBytes % (1024 * 1024) == 0) {
                        double progress = fileSize > 0 ? (double) downloadedBytes / fileSize * 100 : 0;
                        Log.i(TAG, String.format("Download progress: %.1f%% (%d/%d bytes)", 
                            progress, downloadedBytes, fileSize));
                    }
                }
            }
            
            Log.i(TAG, "Download completed successfully: " + localPath);
            callback.onResult(LlamaResult.success(localPath));
            
        } catch (Exception e) {
            Log.e(TAG, "Download failed: " + e.getMessage());
            // Clean up partial file
            try {
                new File(localPath).delete();
            } catch (Exception ignored) {}
            
            callback.onResult(LlamaResult.failure(new LlamaError("Download failed: " + e.getMessage())));
        }
    }

    public void getDownloadProgress(String url, LlamaCallback<Map<String, Object>> callback) {
        try {
            Map<String, Object> progress = getDownloadProgressNative(url);
            if (progress != null) {
                callback.onResult(LlamaResult.success(progress));
            } else {
                callback.onResult(LlamaResult.failure(new LlamaError("No download in progress for this URL")));
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting download progress: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("Failed to get progress: " + e.getMessage())));
        }
    }

    public void cancelDownload(String url, LlamaCallback<Boolean> callback) {
        try {
            boolean cancelled = cancelDownloadNative(url);
            callback.onResult(LlamaResult.success(cancelled));
        } catch (Exception e) {
            Log.e(TAG, "Error cancelling download: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("Failed to cancel download: " + e.getMessage())));
        }
    }

    public void getAvailableModels(LlamaCallback<List<Map<String, Object>>> callback) {
        try {
            List<Map<String, Object>> models = getAvailableModelsNative();
            callback.onResult(LlamaResult.success(models));
        } catch (Exception e) {
            Log.e(TAG, "Error getting available models: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("Failed to get models: " + e.getMessage())));
        }
    }

    public void startNativeLlamaServer(String modelPath, String host, int port, JSObject params, LlamaCallback<JSObject> callback) {
        try {
            String pj = (params != null) ? params.toString() : "{}";
            String h = (host != null && !host.isEmpty()) ? host : "127.0.0.1";
            boolean ok = startLlamaServerNative(modelPath, h, port, pj);
            JSObject r = new JSObject();
            r.put("running", ok);
            if (ok) {
                callback.onResult(LlamaResult.success(r));
            } else {
                callback.onResult(LlamaResult.failure(new LlamaError("startNativeLlamaServer failed")));
            }
        } catch (Exception e) {
            callback.onResult(LlamaResult.failure(new LlamaError(e.getMessage())));
        }
    }

    public void stopNativeLlamaServer(LlamaCallback<Void> callback) {
        try {
            stopLlamaServerNative();
            callback.onResult(LlamaResult.success(null));
        } catch (Exception e) {
            callback.onResult(LlamaResult.failure(new LlamaError(e.getMessage())));
        }
    }

    public void isNativeLlamaServerRunning(LlamaCallback<JSObject> callback) {
        try {
            boolean running = isLlamaServerRunningNative();
            JSObject r = new JSObject();
            r.put("running", running);
            callback.onResult(LlamaResult.success(r));
        } catch (Exception e) {
            callback.onResult(LlamaResult.failure(new LlamaError(e.getMessage())));
        }
    }

    public void convertJsonSchemaToGrammar(String schemaJson, LlamaCallback<String> callback) {
        try {
            String grammar = convertJsonSchemaToGrammarNative(schemaJson);
            callback.onResult(LlamaResult.success(grammar));
        } catch (Exception e) {
            Log.e(TAG, "Error converting JSON schema to grammar: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("Failed to convert schema: " + e.getMessage())));
        }
    }

    public void modelInfo(String path, String[] skip, LlamaCallback<Map<String, Object>> callback) {
        try {
            // Call native method to get actual model info
            Map<String, Object> modelInfo = modelInfoNative(path);
            if (modelInfo != null) {
                callback.onResult(LlamaResult.success(modelInfo));
            } else {
                // Fallback to basic info if native method fails
                Map<String, Object> fallbackInfo = new HashMap<>();
                fallbackInfo.put("path", path);
                fallbackInfo.put("desc", "Model file found but info unavailable");
                fallbackInfo.put("size", 0);
                fallbackInfo.put("nEmbd", 0);
                fallbackInfo.put("nParams", 0);
                callback.onResult(LlamaResult.success(fallbackInfo));
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting model info: " + e.getMessage());
            // Return error info
            Map<String, Object> errorInfo = new HashMap<>();
            errorInfo.put("path", path);
            errorInfo.put("desc", "Error reading model: " + e.getMessage());
            errorInfo.put("size", 0);
            errorInfo.put("nEmbd", 0);
            errorInfo.put("nParams", 0);
            callback.onResult(LlamaResult.success(errorInfo));
        }
    }

    public void initContext(int contextId, JSObject params, LlamaCallback<Map<String, Object>> callback) {
        try {
            // Extract parameters
            String modelPath = params.getString("model", "");
            if (modelPath == null || modelPath.isEmpty()) {
                callback.onResult(LlamaResult.failure(new LlamaError("Model path is required")));
                return;
            }

            // Memory admission control: enforce the concurrent-model slot limit AND a
            // device-memory guard before touching native code (parity with the Web path).
            boolean embedding = params.getBoolean("embedding", false);
            ModelAdmissionController.Decision decision =
                admissionController.canAdmit(contexts.size(), modelPath, embedding);
            if (!decision.allow) {
                String prefix = decision.deniedBy == ModelAdmissionController.DeniedBy.LIMIT
                    ? "MODEL_LIMIT_REACHED: "
                    : "INSUFFICIENT_MEMORY: ";
                Log.w(TAG, "Admission rejected for context " + contextId + " — " + decision.reason);
                callback.onResult(LlamaResult.failure(new LlamaError(prefix + decision.reason)));
                return;
            }

            String filename = new File(modelPath).getName();
            
            // Get dynamic search paths
            String[] searchPaths = getModelSearchPaths(filename);
            
            // Call native initialization
            long nativeContextId = initContextNative(modelPath, searchPaths, params);
            if (nativeContextId < 0) {
                callback.onResult(LlamaResult.failure(new LlamaError("Failed to initialize native context")));
                return;
            }

            // Create Java context wrapper
            LlamaContext context = new LlamaContext(contextId);
            context.setNativeContextId(nativeContextId);
            contexts.put(contextId, context);

            // Query actual model metadata from native layer
            Map<String, Object> modelInfoMap = modelInfoNative(modelPath);
            String modelDesc = "Loaded model";
            long modelSize = 0;
            int nEmbd = 0;
            int nParams = 0;
            boolean gpuEnabled = false;
            String reasonNoGPU = "GPU not requested";
            if (modelInfoMap != null) {
                Object d = modelInfoMap.get("desc");
                if (d instanceof String) modelDesc = (String) d;
                Object s = modelInfoMap.get("size");
                if (s instanceof Number) modelSize = ((Number) s).longValue();
                Object e = modelInfoMap.get("nEmbd");
                if (e instanceof Number) nEmbd = ((Number) e).intValue();
                Object np = modelInfoMap.get("nParams");
                if (np instanceof Number) nParams = ((Number) np).intValue();
                Object g = modelInfoMap.get("gpu");
                if (g instanceof Boolean) gpuEnabled = (Boolean) g;
                Object rng = modelInfoMap.get("reasonNoGPU");
                if (rng instanceof String) reasonNoGPU = (String) rng;
            }
            // Reflect whether n_gpu_layers > 0 was requested
            int requestedGpuLayers = 0;
            try { requestedGpuLayers = params.getInteger("n_gpu_layers", 0); } catch (Exception ignored) {}
            if (requestedGpuLayers > 0 && !gpuEnabled) {
                reasonNoGPU = "Vulkan/GPU backend not available on this device";
            } else if (requestedGpuLayers == 0) {
                reasonNoGPU = "n_gpu_layers=0 (CPU-only)";
            }

            Map<String, Object> modelInfo = new HashMap<>();
            modelInfo.put("desc", modelDesc);
            modelInfo.put("size", modelSize);
            modelInfo.put("nEmbd", nEmbd);
            modelInfo.put("nParams", nParams);
            modelInfo.put("path", modelPath);
            Map<String, Object> defaultCaps = new HashMap<>();
            defaultCaps.put("tools", true); defaultCaps.put("toolCalls", true);
            defaultCaps.put("toolResponses", true); defaultCaps.put("systemRole", true);
            defaultCaps.put("parallelToolCalls", true); defaultCaps.put("toolCallId", true);
            Map<String, Object> minja = new HashMap<>();
            minja.put("default", true); minja.put("defaultCaps", defaultCaps);
            minja.put("toolUse", true); minja.put("toolUseCaps", defaultCaps);
            Map<String, Object> chatTemplates = new HashMap<>();
            chatTemplates.put("llamaChat", true);
            chatTemplates.put("minja", minja);
            modelInfo.put("chatTemplates", chatTemplates);
            modelInfo.put("metadata", new HashMap<>());
            modelInfo.put("isChatTemplateSupported", true);

            Map<String, Object> contextInfo = new HashMap<>();
            contextInfo.put("contextId", contextId);
            contextInfo.put("gpu", gpuEnabled);
            contextInfo.put("reasonNoGPU", reasonNoGPU);
            contextInfo.put("model", modelInfo);
            contextInfo.put("androidLib", "llama-cpp");

            callback.onResult(LlamaResult.success(contextInfo));
            
        } catch (Exception e) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context initialization failed: " + e.getMessage())));
        }
    }

    public void releaseContext(int contextId, LlamaCallback<Void> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }

        try {
            // Release native context
            if (context.getNativeContextId() >= 0) {
                releaseContextNative(context.getNativeContextId());
            }
            
            // Remove from Java context map
            contexts.remove(contextId);
            
            callback.onResult(LlamaResult.success(null));
            
        } catch (Exception e) {
            callback.onResult(LlamaResult.failure(new LlamaError("Failed to release context: " + e.getMessage())));
        }
    }

    public void releaseAllContexts(LlamaCallback<Void> callback) {
        contexts.clear();
        callback.onResult(LlamaResult.success(null));
    }

    // MARK: - Chat and completion

    public void getFormattedChat(int contextId, String messages, String chatTemplate, JSObject params, LlamaCallback<Map<String, Object>> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }

        try {
            // Call native formatted chat
            String result = getFormattedChatNative(context.getNativeContextId(), messages, chatTemplate);
            
            // Build formatted chat result - use Lists instead of arrays
            Map<String, Object> formattedChat = new HashMap<>();
            formattedChat.put("type", "llama-chat");
            formattedChat.put("prompt", result);
            formattedChat.put("has_media", false);
            formattedChat.put("media_paths", new ArrayList<String>());

            callback.onResult(LlamaResult.success(formattedChat));
            
        } catch (Exception e) {
            callback.onResult(LlamaResult.failure(new LlamaError("Failed to format chat: " + e.getMessage())));
        }
    }

    public void completion(int contextId, JSObject params, LlamaCallback<Map<String, Object>> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }

        try {
            Log.i(TAG, "Starting completion for context: " + contextId);
            
            // Call native completion with full params
            Map<String, Object> result = completionNative(context.getNativeContextId(), params);
            
            if (result != null) {
                Log.i(TAG, "Completion completed successfully");
                callback.onResult(LlamaResult.success(result));
            } else {
                Log.e(TAG, "Completion returned null result");
                callback.onResult(LlamaResult.failure(new LlamaError("Completion failed")));
            }
            
        } catch (Exception e) {
            callback.onResult(LlamaResult.failure(new LlamaError("Completion failed: " + e.getMessage())));
        }
    }

    public void stopCompletion(int contextId, LlamaCallback<Void> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }

        try {
            stopCompletionNative(context.getNativeContextId());
            callback.onResult(LlamaResult.success(null));
        } catch (Exception e) {
            callback.onResult(LlamaResult.failure(new LlamaError("Failed to stop completion: " + e.getMessage())));
        }
    }

    // MARK: - Chat-first methods (like llama-cli -sys)

    public void chat(int contextId, String messagesJson, String system, String chatTemplate, JSObject params, LlamaCallback<Map<String, Object>> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }

        try {
            Log.i(TAG, "Starting chat for context: " + contextId);
            
            // Parse messages JSON
            List<Map<String, Object>> messages = parseMessagesJson(messagesJson);
            
            // Add system message if provided
            if (system != null && !system.isEmpty()) {
                Map<String, Object> systemMsg = new HashMap<>();
                systemMsg.put("role", "system");
                systemMsg.put("content", system);
                messages.add(0, systemMsg); // Add system message at the beginning
            }
            
            // Convert messages to JSON string for getFormattedChat
            String formattedMessages = convertMessagesToJson(messages);
            
            // First, format the chat
            String formattedPrompt = getFormattedChatNative(context.getNativeContextId(), formattedMessages, chatTemplate != null ? chatTemplate : "");
            
            // Then run completion with the formatted prompt
            JSObject completionParams = new JSObject();
            completionParams.put("prompt", formattedPrompt);
            
            // Copy other parameters from params
            if (params != null) {
                Iterator<String> keyIterator = params.keys();
                while (keyIterator.hasNext()) {
                    String key = keyIterator.next();
                    if (!key.equals("prompt") && !key.equals("messages")) {
                        completionParams.put(key, params.get(key));
                    }
                }
            }
            
            // Call native completion
            Map<String, Object> result = completionNative(context.getNativeContextId(), completionParams);
            
            if (result != null) {
                Log.i(TAG, "Chat completed successfully");
                callback.onResult(LlamaResult.success(result));
            } else {
                Log.e(TAG, "Chat returned null result");
                callback.onResult(LlamaResult.failure(new LlamaError("Chat failed")));
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Chat failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("Chat failed: " + e.getMessage())));
        }
    }

    public void chatWithSystem(int contextId, String system, String message, JSObject params, LlamaCallback<Map<String, Object>> callback) {
        try {
            // Create a simple message array
            List<Map<String, Object>> messages = new ArrayList<>();
            Map<String, Object> userMsg = new HashMap<>();
            userMsg.put("role", "user");
            userMsg.put("content", message);
            messages.add(userMsg);
            
            // Call the main chat method
            chat(contextId, convertMessagesToJson(messages), system, null, params, callback);
        } catch (Exception e) {
            callback.onResult(LlamaResult.failure(new LlamaError("Chat with system failed: " + e.getMessage())));
        }
    }

    public void generateText(int contextId, String prompt, JSObject params, LlamaCallback<Map<String, Object>> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }

        try {
            Log.i(TAG, "Starting text generation for context: " + contextId);
            
            // Create completion parameters
            JSObject completionParams = new JSObject();
            completionParams.put("prompt", prompt);
            
            // Copy other parameters from params
            if (params != null) {
                Iterator<String> keyIterator = params.keys();
                while (keyIterator.hasNext()) {
                    String key = keyIterator.next();
                    if (!key.equals("prompt") && !key.equals("messages")) {
                        completionParams.put(key, params.get(key));
                    }
                }
            }
            
            // Call native completion
            Map<String, Object> result = completionNative(context.getNativeContextId(), completionParams);
            
            if (result != null) {
                Log.i(TAG, "Text generation completed successfully");
                callback.onResult(LlamaResult.success(result));
            } else {
                Log.e(TAG, "Text generation returned null result");
                callback.onResult(LlamaResult.failure(new LlamaError("Text generation failed")));
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Text generation failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("Text generation failed: " + e.getMessage())));
        }
    }

    // Helper methods for message handling
    private List<Map<String, Object>> parseMessagesJson(String messagesJson) {
        List<Map<String, Object>> messages = new ArrayList<>();
        try {
            // Parse JSON string to extract messages
            org.json.JSONArray jsonArray = new org.json.JSONArray(messagesJson);
            for (int i = 0; i < jsonArray.length(); i++) {
                org.json.JSONObject jsonMessage = jsonArray.getJSONObject(i);
                Map<String, Object> message = new HashMap<>();
                message.put("role", jsonMessage.getString("role"));
                message.put("content", jsonMessage.getString("content"));
                messages.add(message);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing messages JSON: " + e.getMessage());
            // Return empty list on error
        }
        return messages;
    }

    private String convertMessagesToJson(List<Map<String, Object>> messages) {
        try {
            org.json.JSONArray jsonArray = new org.json.JSONArray();
            for (Map<String, Object> message : messages) {
                org.json.JSONObject jsonMessage = new org.json.JSONObject();
                jsonMessage.put("role", message.get("role"));
                jsonMessage.put("content", message.get("content"));
                jsonArray.put(jsonMessage);
            }
            return jsonArray.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error converting messages to JSON: " + e.getMessage());
            return "[]"; // Return empty array on error
        }
    }

    // MARK: - Session management

    public void loadSession(int contextId, String filepath, LlamaCallback<Map<String, Object>> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            Map<String, Object> result = loadSessionNative(context.getNativeContextId(), filepath);
            if (result != null) {
                callback.onResult(LlamaResult.success(result));
            } else {
                callback.onResult(LlamaResult.failure(new LlamaError("loadSession returned null")));
            }
        } catch (Exception e) {
            Log.e(TAG, "loadSession failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("loadSession failed: " + e.getMessage())));
        }
    }

    public void saveSession(int contextId, String filepath, int size, LlamaCallback<Integer> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            int tokensSaved = saveSessionNative(context.getNativeContextId(), filepath, size);
            callback.onResult(LlamaResult.success(tokensSaved));
        } catch (Exception e) {
            Log.e(TAG, "saveSession failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("saveSession failed: " + e.getMessage())));
        }
    }

    // MARK: - Tokenization

    public void tokenize(int contextId, String text, String[] imagePaths, LlamaCallback<Map<String, Object>> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }

        try {
            Log.i(TAG, "Tokenizing text: " + text);
            
            // Call native tokenization
            Map<String, Object> result = tokenizeNative(context.getNativeContextId(), text, imagePaths);
            
            if (result != null) {
                Log.i(TAG, "Tokenization completed successfully");
                callback.onResult(LlamaResult.success(result));
            } else {
                Log.e(TAG, "Tokenization returned null result");
                callback.onResult(LlamaResult.failure(new LlamaError("Tokenization failed")));
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Tokenization failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("Tokenization failed: " + e.getMessage())));
        }
    }

    public void detokenize(int contextId, Integer[] tokens, LlamaCallback<String> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }

        try {
            // Convert Integer[] to int[]
            int[] tokenArray = new int[tokens.length];
            for (int i = 0; i < tokens.length; i++) {
                tokenArray[i] = tokens[i];
            }
            
            String result = detokenizeNative(context.getNativeContextId(), tokenArray);
            callback.onResult(LlamaResult.success(result));
            
        } catch (Exception e) {
            Log.e(TAG, "Detokenization failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("Detokenization failed: " + e.getMessage())));
        }
    }

    // MARK: - Embeddings and reranking

    public void embedding(int contextId, String text, JSObject params, LlamaCallback<Map<String, Object>> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }

        try {
            Log.i(TAG, "Generating embeddings for text: " + text.substring(0, Math.min(50, text.length())));
            
            // Call native embedding method
            Map<String, Object> result = embeddingNative(context.getNativeContextId(), text, params);
            
            if (result != null && result.containsKey("embedding")) {
                Log.i(TAG, "Embedding generated successfully, size: " + 
                    (result.get("embedding") instanceof List ? ((List<?>) result.get("embedding")).size() : 0));
                callback.onResult(LlamaResult.success(result));
            } else {
                Log.e(TAG, "Embedding returned null or invalid result");
                callback.onResult(LlamaResult.failure(new LlamaError("Failed to generate embeddings")));
            }
            
        } catch (Exception e) {
            Log.e(TAG, "Error generating embeddings: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("Embedding failed: " + e.getMessage())));
        }
    }

    public void rerank(int contextId, String query, String[] documents, JSObject params, LlamaCallback<List<Map<String, Object>>> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            List<Map<String, Object>> results = rerankNative(context.getNativeContextId(), query, documents, params);
            if (results != null) {
                callback.onResult(LlamaResult.success(results));
            } else {
                callback.onResult(LlamaResult.failure(new LlamaError("rerank returned null")));
            }
        } catch (Exception e) {
            Log.e(TAG, "rerank failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("rerank failed: " + e.getMessage())));
        }
    }

    // MARK: - Benchmarking

    public void bench(int contextId, int pp, int tg, int pl, int nr, LlamaCallback<String> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            String result = benchNative(context.getNativeContextId(), pp, tg, pl, nr);
            callback.onResult(LlamaResult.success(result != null ? result : "[]"));
        } catch (Exception e) {
            Log.e(TAG, "bench failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("bench failed: " + e.getMessage())));
        }
    }

    // MARK: - LoRA adapters

    public void applyLoraAdapters(int contextId, List<Map<String, Object>> loraAdapters, LlamaCallback<Void> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            // Convert List<Map> to Object[] of HashMap for JNI (jni-lora.cpp expects HashMap[])
            Object[] adaptersArray = new Object[loraAdapters.size()];
            for (int i = 0; i < loraAdapters.size(); i++) {
                java.util.HashMap<String, Object> map = new java.util.HashMap<>(loraAdapters.get(i));
                adaptersArray[i] = map;
            }
            applyLoraAdaptersNative(context.getNativeContextId(), adaptersArray);
            callback.onResult(LlamaResult.success(null));
        } catch (Exception e) {
            Log.e(TAG, "applyLoraAdapters failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("applyLoraAdapters failed: " + e.getMessage())));
        }
    }

    public void removeLoraAdapters(int contextId, LlamaCallback<Void> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            removeLoraAdaptersNative(context.getNativeContextId());
            callback.onResult(LlamaResult.success(null));
        } catch (Exception e) {
            Log.e(TAG, "removeLoraAdapters failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("removeLoraAdapters failed: " + e.getMessage())));
        }
    }

    public void getLoadedLoraAdapters(int contextId, LlamaCallback<List<Map<String, Object>>> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            List<Map<String, Object>> adapters = getLoadedLoraAdaptersNative(context.getNativeContextId());
            callback.onResult(LlamaResult.success(adapters != null ? adapters : new ArrayList<>()));
        } catch (Exception e) {
            Log.e(TAG, "getLoadedLoraAdapters failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("getLoadedLoraAdapters failed: " + e.getMessage())));
        }
    }

    // MARK: - Multimodal methods

    public void initMultimodal(int contextId, String path, boolean useGpu, LlamaCallback<Boolean> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            boolean result = initMultimodalNative(context.getNativeContextId(), path, useGpu);
            if (result) context.setMultimodalEnabled(true);
            callback.onResult(LlamaResult.success(result));
        } catch (Exception e) {
            Log.e(TAG, "initMultimodal failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("initMultimodal failed: " + e.getMessage())));
        }
    }

    public void isMultimodalEnabled(int contextId, LlamaCallback<Boolean> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            boolean enabled = isMultimodalEnabledNative(context.getNativeContextId());
            callback.onResult(LlamaResult.success(enabled));
        } catch (Exception e) {
            callback.onResult(LlamaResult.success(context.isMultimodalEnabled()));
        }
    }

    public void getMultimodalSupport(int contextId, LlamaCallback<Map<String, Object>> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            Map<String, Object> support = getMultimodalSupportNative(context.getNativeContextId());
            callback.onResult(LlamaResult.success(support != null ? support : new HashMap<>()));
        } catch (Exception e) {
            Log.e(TAG, "getMultimodalSupport failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("getMultimodalSupport failed: " + e.getMessage())));
        }
    }

    public void releaseMultimodal(int contextId, LlamaCallback<Void> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            releaseMultimodalNative(context.getNativeContextId());
            context.setMultimodalEnabled(false);
            callback.onResult(LlamaResult.success(null));
        } catch (Exception e) {
            Log.e(TAG, "releaseMultimodal failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("releaseMultimodal failed: " + e.getMessage())));
        }
    }

    // MARK: - TTS methods

    public void initVocoder(int contextId, String path, Integer nBatch, LlamaCallback<Boolean> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            int batchSize = (nBatch != null && nBatch > 0) ? nBatch : 512;
            boolean result = initVocoderNative(context.getNativeContextId(), path, batchSize);
            if (result) context.setVocoderEnabled(true);
            callback.onResult(LlamaResult.success(result));
        } catch (Exception e) {
            Log.e(TAG, "initVocoder failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("initVocoder failed: " + e.getMessage())));
        }
    }

    public void isVocoderEnabled(int contextId, LlamaCallback<Boolean> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            boolean enabled = isVocoderEnabledNative(context.getNativeContextId());
            callback.onResult(LlamaResult.success(enabled));
        } catch (Exception e) {
            callback.onResult(LlamaResult.success(context.isVocoderEnabled()));
        }
    }

    public void getFormattedAudioCompletion(int contextId, String speakerJsonStr, String textToSpeak, LlamaCallback<Map<String, Object>> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            Map<String, Object> result = getFormattedAudioCompletionNative(
                    context.getNativeContextId(), speakerJsonStr, textToSpeak);
            callback.onResult(LlamaResult.success(result != null ? result : new HashMap<>()));
        } catch (Exception e) {
            Log.e(TAG, "getFormattedAudioCompletion failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("getFormattedAudioCompletion failed: " + e.getMessage())));
        }
    }

    public void getAudioCompletionGuideTokens(int contextId, String textToSpeak, LlamaCallback<List<Integer>> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            List<Integer> tokens = getAudioCompletionGuideTokensNative(
                    context.getNativeContextId(), textToSpeak);
            callback.onResult(LlamaResult.success(tokens != null ? tokens : new ArrayList<>()));
        } catch (Exception e) {
            Log.e(TAG, "getAudioCompletionGuideTokens failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("getAudioCompletionGuideTokens failed: " + e.getMessage())));
        }
    }

    public void decodeAudioTokens(int contextId, Integer[] tokens, LlamaCallback<List<Integer>> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            int[] tokenArray = new int[tokens.length];
            for (int i = 0; i < tokens.length; i++) tokenArray[i] = tokens[i];
            List<Float> floatSamples = decodeAudioTokensNative(context.getNativeContextId(), tokenArray);
            // Convert float PCM samples to integer representation (multiply by 32767 for 16-bit range)
            List<Integer> intSamples = new ArrayList<>();
            if (floatSamples != null) {
                for (Float f : floatSamples) {
                    intSamples.add((int) (f * 32767.0f));
                }
            }
            callback.onResult(LlamaResult.success(intSamples));
        } catch (Exception e) {
            Log.e(TAG, "decodeAudioTokens failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("decodeAudioTokens failed: " + e.getMessage())));
        }
    }

    public void releaseVocoder(int contextId, LlamaCallback<Void> callback) {
        LlamaContext context = contexts.get(contextId);
        if (context == null) {
            callback.onResult(LlamaResult.failure(new LlamaError("Context not found")));
            return;
        }
        try {
            releaseVocoderNative(context.getNativeContextId());
            context.setVocoderEnabled(false);
            callback.onResult(LlamaResult.success(null));
        } catch (Exception e) {
            Log.e(TAG, "releaseVocoder failed: " + e.getMessage());
            callback.onResult(LlamaResult.failure(new LlamaError("releaseVocoder failed: " + e.getMessage())));
        }
    }

    // MARK: - Callback Interface
    public interface LlamaCallback<T> {
        void onResult(LlamaResult<T> result);
    }

    // Add this method to get proper storage paths
    private String[] getModelSearchPaths(String filename) {
        List<String> paths = new ArrayList<>();
        
        // Internal storage (always available, no permissions needed)
        File internalFilesDir = context.getFilesDir();
        paths.add(internalFilesDir.getAbsolutePath() + "/" + filename);
        paths.add(internalFilesDir.getAbsolutePath() + "/Documents/" + filename);
        
        // External files directory (app-specific, no permissions needed on Android 10+)
        File externalFilesDir = context.getExternalFilesDir(null);
        if (externalFilesDir != null) {
            paths.add(externalFilesDir.getAbsolutePath() + "/" + filename);
            paths.add(externalFilesDir.getAbsolutePath() + "/Documents/" + filename);
        }
        
        // External storage (requires permissions, may not be available)
        if (Environment.getExternalStorageState().equals(Environment.MEDIA_MOUNTED)) {
            File externalStorage = Environment.getExternalStorageDirectory();
            paths.add(externalStorage.getAbsolutePath() + "/Documents/" + filename);
            paths.add(externalStorage.getAbsolutePath() + "/Download/" + filename);
            paths.add(externalStorage.getAbsolutePath() + "/Downloads/" + filename);
            paths.add(externalStorage.getAbsolutePath() + "/Downloads/models/" + filename);
        }
        
        return paths.toArray(new String[0]);
    }
}
