package ai.annadata.plugin.capacitor;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LlamaCpp")
public class LlamaCppPlugin extends Plugin {

    private LlamaCpp implementation = new LlamaCpp();

    // MARK: - Core initialization and management

    @PluginMethod
    public void toggleNativeLog(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        implementation.toggleNativeLog(enabled, result -> {
            if (result.isSuccess()) {
                call.resolve();
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void setContextLimit(PluginCall call) {
        int limit = call.getInt("limit", 10);
        implementation.setContextLimit(limit, result -> {
            if (result.isSuccess()) {
                call.resolve();
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void modelInfo(PluginCall call) {
        String path = call.getString("path", "");
        String[] skip = call.getArray("skip", String.class);
        if (skip == null) skip = new String[0];

        implementation.modelInfo(path, skip, result -> {
            if (result.isSuccess()) {
                call.resolve(result.getData());
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void initContext(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        JSObject params = call.getObject("params", new JSObject());

        implementation.initContext(contextId, params, result -> {
            if (result.isSuccess()) {
                call.resolve(result.getData());
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void releaseContext(PluginCall call) {
        int contextId = call.getInt("contextId", 0);

        implementation.releaseContext(contextId, result -> {
            if (result.isSuccess()) {
                call.resolve();
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void releaseAllContexts(PluginCall call) {
        implementation.releaseAllContexts(result -> {
            if (result.isSuccess()) {
                call.resolve();
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    // MARK: - Chat and completion

    @PluginMethod
    public void getFormattedChat(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        String messages = call.getString("messages", "");
        String chatTemplate = call.getString("chatTemplate");
        JSObject params = call.getObject("params");

        implementation.getFormattedChat(contextId, messages, chatTemplate, params, result -> {
            if (result.isSuccess()) {
                call.resolve(result.getData());
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void completion(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        JSObject params = call.getObject("params", new JSObject());

        implementation.completion(contextId, params, result -> {
            if (result.isSuccess()) {
                call.resolve(result.getData());
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void stopCompletion(PluginCall call) {
        int contextId = call.getInt("contextId", 0);

        implementation.stopCompletion(contextId, result -> {
            if (result.isSuccess()) {
                call.resolve();
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    // MARK: - Session management

    @PluginMethod
    public void loadSession(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        String filepath = call.getString("filepath", "");

        implementation.loadSession(contextId, filepath, result -> {
            if (result.isSuccess()) {
                call.resolve(result.getData());
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void saveSession(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        String filepath = call.getString("filepath", "");
        int size = call.getInt("size", -1);

        implementation.saveSession(contextId, filepath, size, result -> {
            if (result.isSuccess()) {
                JSObject ret = new JSObject();
                ret.put("tokensSaved", result.getData());
                call.resolve(ret);
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    // MARK: - Tokenization

    @PluginMethod
    public void tokenize(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        String text = call.getString("text", "");
        String[] imagePaths = call.getArray("imagePaths", String.class);
        if (imagePaths == null) imagePaths = new String[0];

        implementation.tokenize(contextId, text, imagePaths, result -> {
            if (result.isSuccess()) {
                call.resolve(result.getData());
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void detokenize(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        Integer[] tokens = call.getArray("tokens", Integer.class);
        if (tokens == null) tokens = new Integer[0];

        implementation.detokenize(contextId, tokens, result -> {
            if (result.isSuccess()) {
                JSObject ret = new JSObject();
                ret.put("text", result.getData());
                call.resolve(ret);
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    // MARK: - Embeddings and reranking

    @PluginMethod
    public void embedding(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        String text = call.getString("text", "");
        JSObject params = call.getObject("params", new JSObject());

        implementation.embedding(contextId, text, params, result -> {
            if (result.isSuccess()) {
                call.resolve(result.getData());
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void rerank(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        String query = call.getString("query", "");
        String[] documents = call.getArray("documents", String.class);
        if (documents == null) documents = new String[0];
        JSObject params = call.getObject("params");

        implementation.rerank(contextId, query, documents, params, result -> {
            if (result.isSuccess()) {
                JSObject ret = new JSObject();
                ret.put("results", result.getData());
                call.resolve(ret);
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    // MARK: - Benchmarking

    @PluginMethod
    public void bench(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        int pp = call.getInt("pp", 0);
        int tg = call.getInt("tg", 0);
        int pl = call.getInt("pl", 0);
        int nr = call.getInt("nr", 0);

        implementation.bench(contextId, pp, tg, pl, nr, result -> {
            if (result.isSuccess()) {
                JSObject ret = new JSObject();
                ret.put("result", result.getData());
                call.resolve(ret);
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    // MARK: - LoRA adapters

    @PluginMethod
    public void applyLoraAdapters(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        JSObject[] loraAdapters = call.getArray("loraAdapters", JSObject.class);
        if (loraAdapters == null) loraAdapters = new JSObject[0];

        implementation.applyLoraAdapters(contextId, loraAdapters, result -> {
            if (result.isSuccess()) {
                call.resolve();
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void removeLoraAdapters(PluginCall call) {
        int contextId = call.getInt("contextId", 0);

        implementation.removeLoraAdapters(contextId, result -> {
            if (result.isSuccess()) {
                call.resolve();
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void getLoadedLoraAdapters(PluginCall call) {
        int contextId = call.getInt("contextId", 0);

        implementation.getLoadedLoraAdapters(contextId, result -> {
            if (result.isSuccess()) {
                JSObject ret = new JSObject();
                ret.put("adapters", result.getData());
                call.resolve(ret);
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    // MARK: - Multimodal methods

    @PluginMethod
    public void initMultimodal(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        JSObject params = call.getObject("params", new JSObject());
        String path = params.getString("path", "");
        boolean useGpu = params.getBoolean("use_gpu", true);

        implementation.initMultimodal(contextId, path, useGpu, result -> {
            if (result.isSuccess()) {
                JSObject ret = new JSObject();
                ret.put("success", result.getData());
                call.resolve(ret);
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void isMultimodalEnabled(PluginCall call) {
        int contextId = call.getInt("contextId", 0);

        implementation.isMultimodalEnabled(contextId, result -> {
            if (result.isSuccess()) {
                JSObject ret = new JSObject();
                ret.put("enabled", result.getData());
                call.resolve(ret);
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void getMultimodalSupport(PluginCall call) {
        int contextId = call.getInt("contextId", 0);

        implementation.getMultimodalSupport(contextId, result -> {
            if (result.isSuccess()) {
                call.resolve(result.getData());
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void releaseMultimodal(PluginCall call) {
        int contextId = call.getInt("contextId", 0);

        implementation.releaseMultimodal(contextId, result -> {
            if (result.isSuccess()) {
                call.resolve();
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    // MARK: - TTS methods

    @PluginMethod
    public void initVocoder(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        JSObject params = call.getObject("params", new JSObject());
        String path = params.getString("path", "");
        Integer nBatch = params.getInteger("n_batch");

        implementation.initVocoder(contextId, path, nBatch, result -> {
            if (result.isSuccess()) {
                JSObject ret = new JSObject();
                ret.put("success", result.getData());
                call.resolve(ret);
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void isVocoderEnabled(PluginCall call) {
        int contextId = call.getInt("contextId", 0);

        implementation.isVocoderEnabled(contextId, result -> {
            if (result.isSuccess()) {
                JSObject ret = new JSObject();
                ret.put("enabled", result.getData());
                call.resolve(ret);
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void getFormattedAudioCompletion(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        String speakerJsonStr = call.getString("speakerJsonStr", "");
        String textToSpeak = call.getString("textToSpeak", "");

        implementation.getFormattedAudioCompletion(contextId, speakerJsonStr, textToSpeak, result -> {
            if (result.isSuccess()) {
                call.resolve(result.getData());
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void getAudioCompletionGuideTokens(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        String textToSpeak = call.getString("textToSpeak", "");

        implementation.getAudioCompletionGuideTokens(contextId, textToSpeak, result -> {
            if (result.isSuccess()) {
                JSObject ret = new JSObject();
                ret.put("tokens", result.getData());
                call.resolve(ret);
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void decodeAudioTokens(PluginCall call) {
        int contextId = call.getInt("contextId", 0);
        Integer[] tokens = call.getArray("tokens", Integer.class);
        if (tokens == null) tokens = new Integer[0];

        implementation.decodeAudioTokens(contextId, tokens, result -> {
            if (result.isSuccess()) {
                JSObject ret = new JSObject();
                ret.put("decodedTokens", result.getData());
                call.resolve(ret);
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    @PluginMethod
    public void releaseVocoder(PluginCall call) {
        int contextId = call.getInt("contextId", 0);

        implementation.releaseVocoder(contextId, result -> {
            if (result.isSuccess()) {
                call.resolve();
            } else {
                call.reject(result.getError().getMessage());
            }
        });
    }

    // MARK: - Events

    @PluginMethod
    public void addListener(PluginCall call) {
        String eventName = call.getString("eventName", "");
        // Note: In Capacitor, event listeners are typically handled differently
        // This is a placeholder for the event system
        call.resolve();
    }

    @PluginMethod
    public void removeAllListeners(PluginCall call) {
        String eventName = call.getString("eventName", "");
        // Note: In Capacitor, event listeners are typically handled differently
        // This is a placeholder for the event system
        call.resolve();
    }
}
