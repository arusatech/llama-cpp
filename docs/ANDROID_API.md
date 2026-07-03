# Android API Reference Guide
## LlamaCpp Capacitor Plugin - Complete Android Implementation API

**Version:** 1.0.0  
**Platform:** Android 5.0+ (API Level 21+)  
**Author:** Annadata AI  
**Date:** July 2, 2026

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation & Setup](#installation--setup)
3. [Core API Methods](#core-api-methods)
4. [Context Management](#context-management)
5. [Text Generation](#text-generation)
6. [Chat & Conversations](#chat--conversations)
7. [Embeddings & Reranking](#embeddings--reranking)
8. [LoRA Adapters](#lora-adapters)
9. [Multimodal Processing](#multimodal-processing)
10. [Text-to-Speech](#text-to-speech)
11. [Session Management](#session-management)
12. [Error Handling](#error-handling)
13. [Android-Specific Features](#android-specific-features)

---

## Quick Start

### Installation

```bash
# Install via npm
npm install llama-cpp-capacitor

# Add Android platform
npx cap add android
npx cap sync android

# Open in Android Studio
npx cap open android
```

### Gradle Configuration

```gradle
android {
    compileSdkVersion 34
    defaultConfig {
        applicationId "com.example.llama"
        minSdkVersion 21
        targetSdkVersion 34
        versionCode 1
        versionName "1.0"
    }
    
    // Enable C++ support
    externalNativeBuild {
        cmake {
            path "src/main/CMakeLists.txt"
            version "3.22.1"
        }
    }
    
    packagingOptions {
        exclude 'lib/arm64-v8a/libopenblas.so.0'
    }
}

// Dependencies
dependencies {
    implementation 'com.getcapacitor:core:5.0.0'
    implementation 'com.getcapacitor:android:5.0.0'
}
```

### AndroidManifest.xml Permissions

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    
    <application>
        <!-- Activities here -->
    </application>
</manifest>
```

### Minimal Working Example

```java
import com.getcapacitor.JSObject;
import ai.annadata.plugin.capacitor.LlamaCpp;

public class MainActivity extends AppCompatActivity {
    private JSObject llamaContext;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        // Initialize model
        initializeModel();
    }
    
    private void initializeModel() {
        JSObject params = new JSObject();
        params.put("model", "/path/to/model.gguf");
        params.put("n_ctx", 2048);
        params.put("n_threads", 4);
        params.put("n_gpu_layers", 20);
        
        LlamaCpp.getInstance().initContext(params, result -> {
            if (result.isSuccess()) {
                llamaContext = result.getData();
                generateText();
            }
        });
    }
    
    private void generateText() {
        JSObject params = new JSObject();
        params.put("prompt", "Hello, how are you?");
        params.put("n_predict", 50);
        params.put("temperature", 0.8);
        
        LlamaCpp.getInstance().completion(params, result -> {
            if (result.isSuccess()) {
                String generated = result.getData().getString("text");
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "Generated: " + generated, 
                        Toast.LENGTH_LONG).show();
                });
            }
        });
    }
}
```

### Minimal Working Example (Kotlin)

```kotlin
import ai.annadata.plugin.capacitor.LlamaCpp
import android.widget.Toast
import com.getcapacitor.JSObject

class MainActivity : AppCompatActivity() {
    private var llamaContext: JSObject? = null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        initializeModel()
    }
    
    private fun initializeModel() {
        val params = JSObject().apply {
            put("model", "/path/to/model.gguf")
            put("n_ctx", 2048)
            put("n_threads", 4)
            put("n_gpu_layers", 20)
        }
        
        LlamaCpp.getInstance().initContext(params) { result ->
            if (result.isSuccess) {
                llamaContext = result.data
                generateText()
            }
        }
    }
    
    private fun generateText() {
        val params = JSObject().apply {
            put("prompt", "Hello, how are you?")
            put("n_predict", 50)
            put("temperature", 0.8)
        }
        
        LlamaCpp.getInstance().completion(params) { result ->
            if (result.isSuccess) {
                val generated = result.data?.getString("text")
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Generated: $generated", 
                        Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
```



---

## Installation & Setup

### Import Statements (Java)

```java
import ai.annadata.plugin.capacitor.LlamaCpp;
import ai.annadata.plugin.capacitor.LlamaCppPlugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import android.util.Log;
```

### Import Statements (Kotlin)

```kotlin
import ai.annadata.plugin.capacitor.LlamaCpp
import ai.annadata.plugin.capacitor.LlamaCppPlugin
import com.getcapacitor.JSObject
import com.getcapacitor.JSArray
import android.util.Log
```

### Thread Safety

All LlamaCpp operations are thread-safe. Use background threads for long-running operations:

```java
// Java - Background thread example
new Thread(() -> {
    JSObject result = LlamaCpp.getInstance().completion(params);
    runOnUiThread(() -> {
        // Update UI with result
    });
}).start();
```

```kotlin
// Kotlin - Coroutine example
lifecycleScope.launch(Dispatchers.Default) {
    val result = LlamaCpp.getInstance().completion(params)
    withContext(Dispatchers.Main) {
        // Update UI with result
    }
}
```

### Initialization with Full Configuration

```java
JSObject contextParams = new JSObject();

// Model path
contextParams.put("model", "/data/local/tmp/llama-2-7b-chat.gguf");

// Context configuration
contextParams.put("n_ctx", 4096);      // Maximum context size
contextParams.put("n_batch", 512);     // Batch processing size
contextParams.put("n_threads", 4);     // CPU threads

// GPU configuration (Qualcomm Adreno)
contextParams.put("n_gpu_layers", 20); // Layers to offload to GPU
contextParams.put("no_gpu_devices", false);

// Speculative decoding
contextParams.put("draft_model", "/path/to/draft-model.gguf");
contextParams.put("speculative_samples", 3);
contextParams.put("mobile_speculative", true);

// Memory optimization
contextParams.put("use_mmap", true);   // Memory-map model file
contextParams.put("use_mlock", false); // Lock in RAM (avoid on mobile)

// LoRA adapters
JSArray loraList = new JSArray();
JSObject lora1 = new JSObject();
lora1.put("path", "/path/adapter1.gguf");
lora1.put("scaled", 1.0);
loraList.put(lora1);
contextParams.put("lora_list", loraList);

// Cache configuration
contextParams.put("cache_type_k", "f16");
contextParams.put("cache_type_v", "f16");

LlamaCpp.getInstance().initContext(contextParams, result -> {
    if (result.isSuccess()) {
        Log.i("LlamaCpp", "Model loaded successfully");
        Log.i("LlamaCpp", "GPU available: " + result.getData().getBoolean("gpu"));
    }
});
```



---

## Core API Methods

### 1. initContext() - Initialize Model

**Java Signature:**
```java
void initContext(JSObject params, ResultCallback callback);
```

**Kotlin Signature:**
```kotlin
fun initContext(params: JSObject, callback: ResultCallback)
```

**Purpose:** Initialize and load a language model

**Parameters:**
- `params`: Model initialization configuration (JSObject)
- `callback`: Callback with success/failure result

**Example: Basic Initialization (Java)**

```java
JSObject params = new JSObject();
params.put("model", "/data/local/tmp/model.gguf");
params.put("n_ctx", 2048);
params.put("n_threads", 4);

LlamaCpp.getInstance().initContext(params, result -> {
    if (result.isSuccess()) {
        JSObject data = result.getData();
        String modelDesc = data.getString("desc");
        boolean gpuEnabled = data.getBoolean("gpu");
        
        Log.i("LlamaCpp", "Model: " + modelDesc);
        Log.i("LlamaCpp", "GPU: " + gpuEnabled);
    } else {
        Log.e("LlamaCpp", "Error: " + result.getError().getMessage());
    }
});
```

**Example: Basic Initialization (Kotlin)**

```kotlin
val params = JSObject().apply {
    put("model", "/data/local/tmp/model.gguf")
    put("n_ctx", 2048)
    put("n_threads", 4)
}

LlamaCpp.getInstance().initContext(params) { result ->
    if (result.isSuccess) {
        val modelDesc = result.data?.getString("desc")
        val gpuEnabled = result.data?.getBoolean("gpu")
        
        Log.i("LlamaCpp", "Model: $modelDesc")
        Log.i("LlamaCpp", "GPU: $gpuEnabled")
    } else {
        Log.e("LlamaCpp", "Error: ${result.error?.message}")
    }
}
```

**Example: With GPU Acceleration (Java)**

```java
JSObject params = new JSObject();
params.put("model", "/data/local/tmp/model.gguf");
params.put("n_ctx", 4096);
params.put("n_gpu_layers", 24);      // Adreno GPU layers
params.put("n_threads", 6);          // CPU threads
params.put("use_mmap", true);        // Memory mapping

LlamaCpp.getInstance().initContext(params, result -> {
    if (result.isSuccess()) {
        JSObject data = result.getData();
        boolean gpu = data.getBoolean("gpu");
        if (!gpu) {
            String reason = data.getString("reasonNoGPU");
            Log.w("LlamaCpp", "GPU not available: " + reason);
        }
    }
});
```

**Example: With GPU Acceleration (Kotlin)**

```kotlin
val params = JSObject().apply {
    put("model", "/data/local/tmp/model.gguf")
    put("n_ctx", 4096)
    put("n_gpu_layers", 24)  // Adreno GPU layers
    put("n_threads", 6)      // CPU threads
    put("use_mmap", true)    // Memory mapping
}

LlamaCpp.getInstance().initContext(params) { result ->
    if (result.isSuccess) {
        val gpu = result.data?.getBoolean("gpu") ?: false
        if (!gpu) {
            val reason = result.data?.getString("reasonNoGPU")
            Log.w("LlamaCpp", "GPU not available: $reason")
        }
    }
}
```

### 2. releaseAllContexts() - Release All Models

```java
LlamaCpp.getInstance().releaseAllContexts(result -> {
    if (result.isSuccess()) {
        Log.i("LlamaCpp", "All models released");
    }
});
```

```kotlin
LlamaCpp.getInstance().releaseAllContexts { result ->
    if (result.isSuccess) {
        Log.i("LlamaCpp", "All models released")
    }
}
```

### 3. toggleNativeLog() - Enable/Disable Logging

**Java:**
```java
JSObject params = new JSObject();
params.put("enabled", true);

LlamaCpp.getInstance().toggleNativeLog(params, result -> {
    Log.i("LlamaCpp", "Logging toggled");
});
```

**Kotlin:**
```kotlin
val params = JSObject().apply {
    put("enabled", true)
}

LlamaCpp.getInstance().toggleNativeLog(params) { result ->
    Log.i("LlamaCpp", "Logging toggled")
}
```

### 4. modelInfo() - Get Model Metadata

**Purpose:** Extract metadata from a GGUF model file

**Java:**
```java
JSObject params = new JSObject();
params.put("path", "/data/local/tmp/model.gguf");

JSArray skip = new JSArray();
skip.put("tokenizer.ggml.tokens");
params.put("skip", skip);

LlamaCpp.getInstance().modelInfo(params, result -> {
    if (result.isSuccess()) {
        JSObject info = result.getData();
        
        // Access model metadata
        String modelName = info.optString("name", "Unknown");
        int contextLength = info.optInt("context_length", 0);
        int vocabSize = info.optInt("vocab_size", 0);
        
        Log.i("LlamaCpp", "Model: " + modelName);
        Log.i("LlamaCpp", "Context: " + contextLength);
        Log.i("LlamaCpp", "Vocab: " + vocabSize);
    }
});
```

**Kotlin:**
```kotlin
val params = JSObject().apply {
    put("path", "/data/local/tmp/model.gguf")
    put("skip", JSArray().apply {
        put("tokenizer.ggml.tokens")
    })
}

LlamaCpp.getInstance().modelInfo(params) { result ->
    if (result.isSuccess) {
        val info = result.data
        val modelName = info?.optString("name", "Unknown")
        val contextLength = info?.optInt("context_length", 0)
        val vocabSize = info?.optInt("vocab_size", 0)
        
        Log.i("LlamaCpp", "Model: $modelName")
        Log.i("LlamaCpp", "Context: $contextLength")
        Log.i("LlamaCpp", "Vocab: $vocabSize")
    }
}
```



---

## Context Management

### completion() - Generate Text

**Purpose:** Generate text with comprehensive control

**Basic Example (Java):**

```java
JSObject params = new JSObject();
params.put("prompt", "The meaning of life is");
params.put("n_predict", 100);
params.put("temperature", 0.8);

LlamaCpp.getInstance().completion(params, result -> {
    if (result.isSuccess()) {
        String generated = result.getData().getString("text");
        int tokensGenerated = result.getData().getInt("tokens_predicted");
        
        Log.i("LlamaCpp", "Generated: " + generated);
        Log.i("LlamaCpp", "Tokens: " + tokensGenerated);
    }
});
```

**Basic Example (Kotlin):**

```kotlin
val params = JSObject().apply {
    put("prompt", "The meaning of life is")
    put("n_predict", 100)
    put("temperature", 0.8)
}

LlamaCpp.getInstance().completion(params) { result ->
    if (result.isSuccess) {
        val generated = result.data?.getString("text")
        val tokensGenerated = result.data?.getInt("tokens_predicted")
        
        Log.i("LlamaCpp", "Generated: $generated")
        Log.i("LlamaCpp", "Tokens: $tokensGenerated")
    }
}
```

**With Sampling Parameters (Java):**

```java
JSObject params = new JSObject();
params.put("prompt", "Complete this thought:");
params.put("n_predict", 150);
params.put("temperature", 0.7);
params.put("top_p", 0.9);
params.put("top_k", 40);
params.put("penalty_repeat", 1.2);
params.put("mirostat", 2);
params.put("mirostat_tau", 5.0);

LlamaCpp.getInstance().completion(params, result -> {
    if (result.isSuccess()) {
        JSObject data = result.getData();
        String text = data.getString("text");
        double speedTokSec = data.getDouble("predicted_per_second");
        
        Log.i("LlamaCpp", "Generated at " + speedTokSec + " tok/s");
    }
});
```

**With Stop Sequences (Kotlin):**

```kotlin
val params = JSObject().apply {
    put("prompt", "Q: What is AI?\nA:")
    put("n_predict", 100)
    put("stop", JSArray().apply {
        put("\n\nQ:")
        put("\n\nUser:")
        put("Assistant:")
    })
}

LlamaCpp.getInstance().completion(params) { result ->
    if (result.isSuccess) {
        val text = result.data?.getString("content")
        Log.i("LlamaCpp", "Response: $text")
    }
}
```

### chat() - Chat Conversation

**Java Example:**

```java
JSArray messages = new JSArray();

JSObject msg1 = new JSObject();
msg1.put("role", "user");
msg1.put("content", "What is machine learning?");
messages.put(msg1);

JSObject msg2 = new JSObject();
msg2.put("role", "assistant");
msg2.put("content", "Machine learning is...");
messages.put(msg2);

JSObject msg3 = new JSObject();
msg3.put("role", "user");
msg3.put("content", "Tell me more about neural networks.");
messages.put(msg3);

JSObject params = new JSObject();
params.put("messages", messages);
params.put("system", "You are a helpful AI assistant focused on explaining technical concepts.");
params.put("n_predict", 200);
params.put("temperature", 0.7);

LlamaCpp.getInstance().chat(params, result -> {
    if (result.isSuccess()) {
        String response = result.getData().getString("content");
        Log.i("LlamaCpp", "Assistant: " + response);
    }
});
```

**Kotlin Example:**

```kotlin
val messages = JSArray().apply {
    put(JSObject().apply {
        put("role", "user")
        put("content", "What is machine learning?")
    })
    put(JSObject().apply {
        put("role", "assistant")
        put("content", "Machine learning is...")
    })
    put(JSObject().apply {
        put("role", "user")
        put("content", "Tell me more about neural networks.")
    })
}

val params = JSObject().apply {
    put("messages", messages)
    put("system", "You are a helpful AI assistant focused on explaining technical concepts.")
    put("n_predict", 200)
    put("temperature", 0.7)
}

LlamaCpp.getInstance().chat(params) { result ->
    if (result.isSuccess) {
        val response = result.data?.getString("content")
        Log.i("LlamaCpp", "Assistant: $response")
    }
}
```

### chatWithSystem() - Simple Chat

**Java:**

```java
JSObject params = new JSObject();
params.put("system", "You are a helpful assistant.");
params.put("message", "What is the capital of France?");
params.put("n_predict", 100);
params.put("temperature", 0.7);

LlamaCpp.getInstance().chatWithSystem(params, result -> {
    if (result.isSuccess()) {
        String response = result.getData().getString("content");
        Log.i("LlamaCpp", "Response: " + response);
    }
});
```

**Kotlin:**

```kotlin
val params = JSObject().apply {
    put("system", "You are a helpful assistant.")
    put("message", "What is the capital of France?")
    put("n_predict", 100)
    put("temperature", 0.7)
}

LlamaCpp.getInstance().chatWithSystem(params) { result ->
    if (result.isSuccess) {
        val response = result.data?.getString("content")
        Log.i("LlamaCpp", "Response: $response")
    }
}
```

### generateText() - Simple Generation

**Java:**

```java
JSObject params = new JSObject();
params.put("prompt", "Once upon a time, there was");
params.put("n_predict", 200);
params.put("temperature", 0.8);
params.put("top_p", 0.9);

LlamaCpp.getInstance().generateText(params, result -> {
    if (result.isSuccess()) {
        String story = result.getData().getString("text");
        Log.i("LlamaCpp", "Story: " + story);
    }
});
```

**Kotlin:**

```kotlin
val params = JSObject().apply {
    put("prompt", "Once upon a time, there was")
    put("n_predict", 200)
    put("temperature", 0.8)
    put("top_p", 0.9)
}

LlamaCpp.getInstance().generateText(params) { result ->
    if (result.isSuccess) {
        val story = result.data?.getString("text")
        Log.i("LlamaCpp", "Story: $story")
    }
}
```

### getFormattedChat() - Format Messages

**Java:**

```java
JSArray messages = new JSArray();
JSObject sysMsg = new JSObject();
sysMsg.put("role", "system");
sysMsg.put("content", "You are a Python expert.");
messages.put(sysMsg);

JSObject userMsg = new JSObject();
userMsg.put("role", "user");
userMsg.put("content", "Write a function to sort a list.");
messages.put(userMsg);

JSObject params = new JSObject();
params.put("messages", messages);
params.put("template", "chatml");
params.put("jinja", true);

LlamaCpp.getInstance().getFormattedChat(params, result -> {
    if (result.isSuccess()) {
        String formattedPrompt = result.getData().getString("prompt");
        Log.i("LlamaCpp", "Formatted: " + formattedPrompt);
    }
});
```

**Kotlin:**

```kotlin
val messages = JSArray().apply {
    put(JSObject().apply {
        put("role", "system")
        put("content", "You are a Python expert.")
    })
    put(JSObject().apply {
        put("role", "user")
        put("content", "Write a function to sort a list.")
    })
}

val params = JSObject().apply {
    put("messages", messages)
    put("template", "chatml")
    put("jinja", true)
}

LlamaCpp.getInstance().getFormattedChat(params) { result ->
    if (result.isSuccess) {
        val formattedPrompt = result.data?.getString("prompt")
        Log.i("LlamaCpp", "Formatted: $formattedPrompt")
    }
}
```



---

## Embeddings & Reranking

### embedding() - Generate Embeddings

**Purpose:** Generate vector embeddings for semantic search

**Java:**

```java
JSObject params = new JSObject();
params.put("text", "This is a test sentence.");

LlamaCpp.getInstance().embedding(params, result -> {
    if (result.isSuccess()) {
        JSArray embedding = result.getData().getJSArray("embedding");
        int dimension = embedding.length();
        
        Log.i("LlamaCpp", "Embedding dimension: " + dimension);
        
        // Convert to float array
        float[] embeddingVector = new float[dimension];
        for (int i = 0; i < dimension; i++) {
            embeddingVector[i] = (float) embedding.getDouble(i);
        }
    }
});
```

**Kotlin:**

```kotlin
val params = JSObject().apply {
    put("text", "This is a test sentence.")
}

LlamaCpp.getInstance().embedding(params) { result ->
    if (result.isSuccess) {
        val embedding = result.data?.getJSArray("embedding")
        val dimension = embedding?.length()
        
        Log.i("LlamaCpp", "Embedding dimension: $dimension")
        
        // Convert to FloatArray
        val embeddingVector = FloatArray(dimension ?: 0) { i ->
            embedding?.getDouble(i)?.toFloat() ?: 0f
        }
    }
}
```

**Batch Embeddings (Java):**

```java
String[] texts = {
    "The quick brown fox",
    "A fast russet dog",
    "The lazy cat sleeps"
};

for (String text : texts) {
    JSObject params = new JSObject();
    params.put("text", text);
    
    LlamaCpp.getInstance().embedding(params, result -> {
        if (result.isSuccess()) {
            JSArray emb = result.getData().getJSArray("embedding");
            Log.i("LlamaCpp", "Embedding for '" + text + "': " + emb.length() + " dims");
        }
    });
}
```

**Batch Embeddings (Kotlin):**

```kotlin
val texts = listOf(
    "The quick brown fox",
    "A fast russet dog",
    "The lazy cat sleeps"
)

texts.forEach { text ->
    val params = JSObject().apply {
        put("text", text)
    }
    
    LlamaCpp.getInstance().embedding(params) { result ->
        if (result.isSuccess) {
            val emb = result.data?.getJSArray("embedding")
            Log.i("LlamaCpp", "Embedding for '$text': ${emb?.length()} dims")
        }
    }
}
```

### rerank() - Rerank Documents

**Purpose:** Rank documents by relevance to query

**Java:**

```java
String query = "How to learn machine learning";

JSArray documents = new JSArray();
documents.put("Linear algebra is fundamental to ML");
documents.put("Python is a programming language");
documents.put("Neural networks are ML models");
documents.put("iOS development guide");

JSObject params = new JSObject();
params.put("query", query);
params.put("documents", documents);

LlamaCpp.getInstance().rerank(params, result -> {
    if (result.isSuccess()) {
        JSArray ranked = result.getData().getJSArray("results");
        
        for (int i = 0; i < ranked.length(); i++) {
            JSObject rankItem = ranked.getJSObject(i);
            int index = rankItem.getInt("index");
            double score = rankItem.getDouble("score");
            
            Log.i("LlamaCpp", documents.getString(index) + ": " + 
                String.format("%.2f", score));
        }
    }
});
```

**Kotlin:**

```kotlin
val query = "How to learn machine learning"

val documents = JSArray().apply {
    put("Linear algebra is fundamental to ML")
    put("Python is a programming language")
    put("Neural networks are ML models")
    put("iOS development guide")
}

val params = JSObject().apply {
    put("query", query)
    put("documents", documents)
}

LlamaCpp.getInstance().rerank(params) { result ->
    if (result.isSuccess) {
        val ranked = result.data?.getJSArray("results")
        
        for (i in 0 until (ranked?.length() ?: 0)) {
            val rankItem = ranked?.getJSObject(i)
            val index = rankItem?.getInt("index") ?: 0
            val score = rankItem?.getDouble("score") ?: 0.0
            
            val docText = documents.getString(index)
            Log.i("LlamaCpp", "$docText: ${"%.2f".format(score)}")
        }
    }
}
```



---

## LoRA Adapters

### applyLoraAdapters() - Apply Adapters

**Purpose:** Apply LoRA adapters for model fine-tuning

**Single Adapter (Java):**

```java
JSArray loraList = new JSArray();
JSObject adapter = new JSObject();
adapter.put("path", "/data/local/tmp/adapter.gguf");
adapter.put("scaled", 1.0);
loraList.put(adapter);

JSObject params = new JSObject();
params.put("lora_list", loraList);

LlamaCpp.getInstance().applyLoraAdapters(params, result -> {
    if (result.isSuccess()) {
        Log.i("LlamaCpp", "LoRA adapter applied");
    }
});
```

**Single Adapter (Kotlin):**

```kotlin
val loraList = JSArray().apply {
    put(JSObject().apply {
        put("path", "/data/local/tmp/adapter.gguf")
        put("scaled", 1.0)
    })
}

val params = JSObject().apply {
    put("lora_list", loraList)
}

LlamaCpp.getInstance().applyLoraAdapters(params) { result ->
    if (result.isSuccess) {
        Log.i("LlamaCpp", "LoRA adapter applied")
    }
}
```

**Multiple Adapters with Scaling (Java):**

```java
JSArray loraList = new JSArray();

JSObject adapter1 = new JSObject();
adapter1.put("path", "/data/local/tmp/domain-adapter.gguf");
adapter1.put("scaled", 1.0);
loraList.put(adapter1);

JSObject adapter2 = new JSObject();
adapter2.put("path", "/data/local/tmp/style-adapter.gguf");
adapter2.put("scaled", 0.7);
loraList.put(adapter2);

JSObject adapter3 = new JSObject();
adapter3.put("path", "/data/local/tmp/tone-adapter.gguf");
adapter3.put("scaled", 0.5);
loraList.put(adapter3);

JSObject params = new JSObject();
params.put("lora_list", loraList);

LlamaCpp.getInstance().applyLoraAdapters(params, result -> {
    if (result.isSuccess()) {
        Log.i("LlamaCpp", "Multiple LoRA adapters applied");
    }
});
```

**Generate with Adapters (Kotlin):**

```kotlin
// Apply adapters first
val loraList = JSArray().apply {
    put(JSObject().apply {
        put("path", "/data/local/tmp/adapter.gguf")
        put("scaled", 1.0)
    })
}

val loraParams = JSObject().apply {
    put("lora_list", loraList)
}

LlamaCpp.getInstance().applyLoraAdapters(loraParams) { result ->
    if (result.isSuccess) {
        // Now generate text using adapted model
        val completionParams = JSObject().apply {
            put("prompt", "Generate a poem in the style of...")
            put("n_predict", 150)
            put("temperature", 0.8)
        }
        
        LlamaCpp.getInstance().completion(completionParams) { result2 ->
            if (result2.isSuccess) {
                val text = result2.data?.getString("text")
                Log.i("LlamaCpp", "Generated: $text")
            }
        }
    }
}
```

### getLoadedLoraAdapters() - List Adapters

**Java:**

```java
LlamaCpp.getInstance().getLoadedLoraAdapters(new JSObject(), result -> {
    if (result.isSuccess()) {
        JSArray adapters = result.getData().getJSArray("adapters");
        
        for (int i = 0; i < adapters.length(); i++) {
            JSObject adapter = adapters.getJSObject(i);
            String path = adapter.getString("path");
            double scale = adapter.getDouble("scaled");
            
            Log.i("LlamaCpp", path + " (scale: " + scale + ")");
        }
    }
});
```

**Kotlin:**

```kotlin
LlamaCpp.getInstance().getLoadedLoraAdapters(JSObject()) { result ->
    if (result.isSuccess) {
        val adapters = result.data?.getJSArray("adapters")
        
        for (i in 0 until (adapters?.length() ?: 0)) {
            val adapter = adapters?.getJSObject(i)
            val path = adapter?.getString("path")
            val scale = adapter?.getDouble("scaled")
            
            Log.i("LlamaCpp", "$path (scale: $scale)")
        }
    }
}
```

### removeLoraAdapters() - Remove Adapters

**Java:**

```java
LlamaCpp.getInstance().removeLoraAdapters(new JSObject(), result -> {
    if (result.isSuccess()) {
        Log.i("LlamaCpp", "All adapters removed");
    }
});
```

**Kotlin:**

```kotlin
LlamaCpp.getInstance().removeLoraAdapters(JSObject()) { result ->
    if (result.isSuccess) {
        Log.i("LlamaCpp", "All adapters removed")
    }
}
```



---

## Multimodal Processing

### initMultimodal() - Initialize Vision

**Purpose:** Initialize multimodal support for image processing

**Java:**

```java
JSObject params = new JSObject();
params.put("path", "/data/local/tmp/mmproj.gguf");
params.put("use_gpu", true);

LlamaCpp.getInstance().initMultimodal(params, result -> {
    if (result.isSuccess()) {
        boolean initialized = result.getData().getBoolean("initialized");
        Log.i("LlamaCpp", "Multimodal initialized: " + initialized);
    }
});
```

**Kotlin:**

```kotlin
val params = JSObject().apply {
    put("path", "/data/local/tmp/mmproj.gguf")
    put("use_gpu", true)
}

LlamaCpp.getInstance().initMultimodal(params) { result ->
    if (result.isSuccess) {
        val initialized = result.data?.getBoolean("initialized")
        Log.i("LlamaCpp", "Multimodal initialized: $initialized")
    }
}
```

### completion() with Images

**Java:**

```java
JSArray messageContent = new JSArray();

// Add text message
JSObject textPart = new JSObject();
textPart.put("type", "text");
textPart.put("text", "What do you see in this image?");
messageContent.put(textPart);

// Add image
JSObject imagePart = new JSObject();
imagePart.put("type", "image_url");
JSObject imageUrl = new JSObject();
imageUrl.put("url", "file:///data/local/tmp/image.jpg");
imagePart.put("image_url", imageUrl);
messageContent.put(imagePart);

// Build message
JSObject message = new JSObject();
message.put("role", "user");
message.put("content", messageContent);

JSArray messages = new JSArray();
messages.put(message);

JSObject params = new JSObject();
params.put("messages", messages);
params.put("n_predict", 200);

LlamaCpp.getInstance().completion(params, result -> {
    if (result.isSuccess()) {
        String description = result.getData().getString("content");
        Log.i("LlamaCpp", "Description: " + description);
    }
});
```

**Kotlin:**

```kotlin
val messageContent = JSArray().apply {
    put(JSObject().apply {
        put("type", "text")
        put("text", "What do you see in this image?")
    })
    put(JSObject().apply {
        put("type", "image_url")
        put("image_url", JSObject().apply {
            put("url", "file:///data/local/tmp/image.jpg")
        })
    })
}

val message = JSObject().apply {
    put("role", "user")
    put("content", messageContent)
}

val params = JSObject().apply {
    put("messages", JSArray().apply { put(message) })
    put("n_predict", 200)
}

LlamaCpp.getInstance().completion(params) { result ->
    if (result.isSuccess) {
        val description = result.data?.getString("content")
        Log.i("LlamaCpp", "Description: $description")
    }
}
```

### getMultimodalSupport() - Check Capabilities

**Java:**

```java
LlamaCpp.getInstance().getMultimodalSupport(new JSObject(), result -> {
    if (result.isSuccess()) {
        JSObject support = result.getData();
        boolean visionSupport = support.getBoolean("vision");
        boolean audioSupport = support.getBoolean("audio");
        
        Log.i("LlamaCpp", "Vision support: " + visionSupport);
        Log.i("LlamaCpp", "Audio support: " + audioSupport);
    }
});
```

**Kotlin:**

```kotlin
LlamaCpp.getInstance().getMultimodalSupport(JSObject()) { result ->
    if (result.isSuccess) {
        val visionSupport = result.data?.getBoolean("vision")
        val audioSupport = result.data?.getBoolean("audio")
        
        Log.i("LlamaCpp", "Vision support: $visionSupport")
        Log.i("LlamaCpp", "Audio support: $audioSupport")
    }
}
```

### isMultimodalEnabled() - Check Status

**Java:**

```java
LlamaCpp.getInstance().isMultimodalEnabled(new JSObject(), result -> {
    if (result.isSuccess()) {
        boolean enabled = result.getData().getBoolean("enabled");
        
        if (enabled) {
            Log.i("LlamaCpp", "Ready to process images");
        } else {
            Log.i("LlamaCpp", "Initialize multimodal first");
        }
    }
});
```

**Kotlin:**

```kotlin
LlamaCpp.getInstance().isMultimodalEnabled(JSObject()) { result ->
    if (result.isSuccess) {
        val enabled = result.data?.getBoolean("enabled")
        
        if (enabled == true) {
            Log.i("LlamaCpp", "Ready to process images")
        } else {
            Log.i("LlamaCpp", "Initialize multimodal first")
        }
    }
}
```

### releaseMultimodal() - Release Resources

**Java:**

```java
LlamaCpp.getInstance().releaseMultimodal(new JSObject(), result -> {
    if (result.isSuccess()) {
        Log.i("LlamaCpp", "Multimodal resources released");
    }
});
```

**Kotlin:**

```kotlin
LlamaCpp.getInstance().releaseMultimodal(JSObject()) { result ->
    if (result.isSuccess) {
        Log.i("LlamaCpp", "Multimodal resources released")
    }
}
```



---

## Text-to-Speech

### initVocoder() - Initialize TTS

**Java:**

```java
JSObject params = new JSObject();
params.put("path", "/data/local/tmp/vocoder.gguf");
params.put("n_batch", 512);

LlamaCpp.getInstance().initVocoder(params, result -> {
    if (result.isSuccess()) {
        boolean initialized = result.getData().getBoolean("initialized");
        Log.i("LlamaCpp", "Vocoder initialized: " + initialized);
    }
});
```

**Kotlin:**

```kotlin
val params = JSObject().apply {
    put("path", "/data/local/tmp/vocoder.gguf")
    put("n_batch", 512)
}

LlamaCpp.getInstance().initVocoder(params) { result ->
    if (result.isSuccess) {
        val initialized = result.data?.getBoolean("initialized")
        Log.i("LlamaCpp", "Vocoder initialized: $initialized")
    }
}
```

### getFormattedAudioCompletion() - Prepare Audio

**Java:**

```java
JSObject params = new JSObject();
params.put("speakerJsonStr", "");  // Empty string or speaker config JSON
params.put("textToSpeak", "Hello, this is a test of text-to-speech.");

LlamaCpp.getInstance().getFormattedAudioCompletion(params, result -> {
    if (result.isSuccess()) {
        JSObject audioParams = result.getData();
        String prompt = audioParams.getString("prompt");
        String grammar = audioParams.optString("grammar", null);
        
        Log.i("LlamaCpp", "Audio prompt prepared");
        Log.i("LlamaCpp", "Prompt length: " + prompt.length());
    }
});
```

**Kotlin:**

```kotlin
val params = JSObject().apply {
    put("speakerJsonStr", "")  // Empty string or speaker config JSON
    put("textToSpeak", "Hello, this is a test of text-to-speech.")
}

LlamaCpp.getInstance().getFormattedAudioCompletion(params) { result ->
    if (result.isSuccess) {
        val prompt = result.data?.getString("prompt")
        val grammar = result.data?.optString("grammar", null)
        
        Log.i("LlamaCpp", "Audio prompt prepared")
        Log.i("LlamaCpp", "Prompt length: ${prompt?.length}")
    }
}
```

### getAudioCompletionGuideTokens() - Get Guide Tokens

**Java:**

```java
JSObject params = new JSObject();
params.put("textToSpeak", "Hello, world!");

LlamaCpp.getInstance().getAudioCompletionGuideTokens(params, result -> {
    if (result.isSuccess()) {
        JSArray guideTokens = result.getData().getJSArray("guide_tokens");
        Log.i("LlamaCpp", "Guide tokens count: " + guideTokens.length());
        
        // Convert JSArray to int array
        int[] tokens = new int[guideTokens.length()];
        for (int i = 0; i < guideTokens.length(); i++) {
            tokens[i] = guideTokens.getInt(i);
        }
    }
});
```

**Kotlin:**

```kotlin
val params = JSObject().apply {
    put("textToSpeak", "Hello, world!")
}

LlamaCpp.getInstance().getAudioCompletionGuideTokens(params) { result ->
    if (result.isSuccess) {
        val guideTokens = result.data?.getJSArray("guide_tokens")
        Log.i("LlamaCpp", "Guide tokens count: ${guideTokens?.length()}")
        
        // Convert JSArray to IntArray
        val tokens = IntArray(guideTokens?.length() ?: 0) { i ->
            guideTokens?.getInt(i) ?: 0
        }
    }
}
```

### Generate Audio Complete Workflow

**Java:**

```java
// Step 1: Get formatted audio completion
JSObject audioParams = new JSObject();
audioParams.put("speakerJsonStr", "");
audioParams.put("textToSpeak", "Hello, this is text-to-speech.");

LlamaCpp.getInstance().getFormattedAudioCompletion(audioParams, result1 -> {
    if (result1.isSuccess()) {
        String audioPrompt = result1.getData().getString("prompt");
        String grammar = result1.getData().optString("grammar", null);
        
        // Step 2: Get guide tokens
        JSObject guideParams = new JSObject();
        guideParams.put("textToSpeak", "Hello, this is text-to-speech.");
        
        LlamaCpp.getInstance().getAudioCompletionGuideTokens(guideParams, result2 -> {
            if (result2.isSuccess()) {
                JSArray guideTokensArray = result2.getData().getJSArray("guide_tokens");
                
                // Convert to int array
                int[] guideTokens = new int[guideTokensArray.length()];
                for (int i = 0; i < guideTokensArray.length(); i++) {
                    guideTokens[i] = guideTokensArray.getInt(i);
                }
                
                // Step 3: Generate audio tokens
                JSObject completionParams = new JSObject();
                completionParams.put("prompt", audioPrompt);
                if (grammar != null) {
                    completionParams.put("grammar", grammar);
                }
                JSArray guideTokenArray = new JSArray();
                for (int token : guideTokens) {
                    guideTokenArray.put(token);
                }
                completionParams.put("guide_tokens", guideTokenArray);
                completionParams.put("n_predict", 1000);
                
                LlamaCpp.getInstance().completion(completionParams, result3 -> {
                    if (result3.isSuccess()) {
                        JSArray audioTokensArray = result3.getData()
                            .optJSArray("audio_tokens", new JSArray());
                        
                        Log.i("LlamaCpp", "Generated " + audioTokensArray.length() 
                            + " audio tokens");
                        
                        // Step 4: Decode audio tokens (optional)
                        JSObject decodeParams = new JSObject();
                        decodeParams.put("tokens", audioTokensArray);
                        
                        LlamaCpp.getInstance().decodeAudioTokens(decodeParams, result4 -> {
                            if (result4.isSuccess()) {
                                JSArray audioSamples = result4.getData()
                                    .getJSArray("audio_samples");
                                Log.i("LlamaCpp", "Audio samples: " + audioSamples.length());
                            }
                        });
                    }
                });
            }
        });
    }
});
```

**Kotlin:**

```kotlin
// Step 1: Get formatted audio completion
val audioParams = JSObject().apply {
    put("speakerJsonStr", "")
    put("textToSpeak", "Hello, this is text-to-speech.")
}

LlamaCpp.getInstance().getFormattedAudioCompletion(audioParams) { result1 ->
    if (result1.isSuccess) {
        val audioPrompt = result1.data?.getString("prompt")
        val grammar = result1.data?.optString("grammar", null)
        
        // Step 2: Get guide tokens
        val guideParams = JSObject().apply {
            put("textToSpeak", "Hello, this is text-to-speech.")
        }
        
        LlamaCpp.getInstance().getAudioCompletionGuideTokens(guideParams) { result2 ->
            if (result2.isSuccess) {
                val guideTokensArray = result2.data?.getJSArray("guide_tokens")
                
                // Step 3: Generate audio tokens
                val completionParams = JSObject().apply {
                    put("prompt", audioPrompt)
                    if (grammar != null) {
                        put("grammar", grammar)
                    }
                    put("guide_tokens", guideTokensArray)
                    put("n_predict", 1000)
                }
                
                LlamaCpp.getInstance().completion(completionParams) { result3 ->
                    if (result3.isSuccess) {
                        val audioTokensArray = result3.data?.optJSArray(
                            "audio_tokens", JSArray()
                        )
                        
                        Log.i("LlamaCpp", "Generated ${audioTokensArray?.length()} audio tokens")
                        
                        // Step 4: Decode audio tokens
                        val decodeParams = JSObject().apply {
                            put("tokens", audioTokensArray)
                        }
                        
                        LlamaCpp.getInstance().decodeAudioTokens(decodeParams) { result4 ->
                            if (result4.isSuccess) {
                                val audioSamples = result4.data?.getJSArray("audio_samples")
                                Log.i("LlamaCpp", "Audio samples: ${audioSamples?.length()}")
                            }
                        }
                    }
                }
            }
        }
    }
}
```

### decodeAudioTokens() - Decode to Audio

**Java:**

```java
JSArray tokens = new JSArray();
// Add audio tokens (e.g., from audio completion)
for (int token : audioTokensArray) {
    tokens.put(token);
}

JSObject params = new JSObject();
params.put("tokens", tokens);

LlamaCpp.getInstance().decodeAudioTokens(params, result -> {
    if (result.isSuccess()) {
        JSArray audioSamples = result.getData().getJSArray("audio_samples");
        Log.i("LlamaCpp", "Decoded audio samples: " + audioSamples.length());
        
        // Convert to PCM audio (short array)
        short[] pcmAudio = new short[audioSamples.length()];
        for (int i = 0; i < audioSamples.length(); i++) {
            pcmAudio[i] = (short) audioSamples.getInt(i);
        }
    }
});
```

**Kotlin:**

```kotlin
val tokens = JSArray().apply {
    audioTokensArray?.let {
        for (i in 0 until it.length()) {
            put(it.getInt(i))
        }
    }
}

val params = JSObject().apply {
    put("tokens", tokens)
}

LlamaCpp.getInstance().decodeAudioTokens(params) { result ->
    if (result.isSuccess) {
        val audioSamples = result.data?.getJSArray("audio_samples")
        Log.i("LlamaCpp", "Decoded audio samples: ${audioSamples?.length()}")
        
        // Convert to PCM audio
        val pcmAudio = ShortArray(audioSamples?.length() ?: 0) { i ->
            audioSamples?.getInt(i)?.toShort() ?: 0
        }
    }
}
```

### releaseVocoder() - Release TTS

**Java:**

```java
LlamaCpp.getInstance().releaseVocoder(new JSObject(), result -> {
    if (result.isSuccess()) {
        Log.i("LlamaCpp", "Vocoder released");
    }
});
```

**Kotlin:**

```kotlin
LlamaCpp.getInstance().releaseVocoder(JSObject()) { result ->
    if (result.isSuccess) {
        Log.i("LlamaCpp", "Vocoder released")
    }
}
```



---

## Session Management

### saveSession() - Save State

**Purpose:** Save inference session to disk

**Java:**

```java
JSObject params = new JSObject();
params.put("filepath", "/data/local/tmp/session.bin");
params.put("size", -1);  // -1 for all tokens

LlamaCpp.getInstance().saveSession(params, result -> {
    if (result.isSuccess()) {
        int tokensSaved = result.getData().getInt("tokens_saved");
        Log.i("LlamaCpp", "Session saved: " + tokensSaved + " tokens");
    }
});
```

**Kotlin:**

```kotlin
val params = JSObject().apply {
    put("filepath", "/data/local/tmp/session.bin")
    put("size", -1)  // -1 for all tokens
}

LlamaCpp.getInstance().saveSession(params) { result ->
    if (result.isSuccess) {
        val tokensSaved = result.data?.getInt("tokens_saved")
        Log.i("LlamaCpp", "Session saved: $tokensSaved tokens")
    }
}
```

### loadSession() - Restore State

**Java:**

```java
JSObject params = new JSObject();
params.put("filepath", "/data/local/tmp/session.bin");

LlamaCpp.getInstance().loadSession(params, result -> {
    if (result.isSuccess()) {
        int tokensLoaded = result.getData().getInt("tokens_loaded");
        Log.i("LlamaCpp", "Loaded " + tokensLoaded + " tokens");
        
        // Continue generation from where we left off
        JSObject completionParams = new JSObject();
        completionParams.put("prompt", "");  // Empty - continues from session
        completionParams.put("n_predict", 50);
        
        LlamaCpp.getInstance().completion(completionParams, result2 -> {
            if (result2.isSuccess()) {
                String text = result2.getData().getString("text");
                Log.i("LlamaCpp", "Continuation: " + text);
            }
        });
    }
});
```

**Kotlin:**

```kotlin
val params = JSObject().apply {
    put("filepath", "/data/local/tmp/session.bin")
}

LlamaCpp.getInstance().loadSession(params) { result ->
    if (result.isSuccess) {
        val tokensLoaded = result.data?.getInt("tokens_loaded")
        Log.i("LlamaCpp", "Loaded $tokensLoaded tokens")
        
        // Continue generation
        val completionParams = JSObject().apply {
            put("prompt", "")  // Empty - continues from session
            put("n_predict", 50)
        }
        
        LlamaCpp.getInstance().completion(completionParams) { result2 ->
            if (result2.isSuccess) {
                val text = result2.data?.getString("text")
                Log.i("LlamaCpp", "Continuation: $text")
            }
        }
    }
}
```

---

## Tokenization

### tokenize() - Tokenize Text

**Java:**

```java
JSObject params = new JSObject();
params.put("text", "Hello, world!");

LlamaCpp.getInstance().tokenize(params, result -> {
    if (result.isSuccess()) {
        JSArray tokens = result.getData().getJSArray("tokens");
        Log.i("LlamaCpp", "Token count: " + tokens.length());
        
        // Print tokens
        for (int i = 0; i < tokens.length(); i++) {
            Log.i("LlamaCpp", "Token " + i + ": " + tokens.getInt(i));
        }
    }
});
```

**Kotlin:**

```kotlin
val params = JSObject().apply {
    put("text", "Hello, world!")
}

LlamaCpp.getInstance().tokenize(params) { result ->
    if (result.isSuccess) {
        val tokens = result.data?.getJSArray("tokens")
        Log.i("LlamaCpp", "Token count: ${tokens?.length()}")
        
        // Print tokens
        for (i in 0 until (tokens?.length() ?: 0)) {
            Log.i("LlamaCpp", "Token $i: ${tokens?.getInt(i)}")
        }
    }
}
```

### detokenize() - Convert Tokens to Text

**Java:**

```java
JSArray tokens = new JSArray();
tokens.put(1);
tokens.put(500);
tokens.put(1000);

JSObject params = new JSObject();
params.put("tokens", tokens);

LlamaCpp.getInstance().detokenize(params, result -> {
    if (result.isSuccess()) {
        String text = result.getData().getString("text");
        Log.i("LlamaCpp", "Reconstructed: " + text);
    }
});
```

**Kotlin:**

```kotlin
val tokens = JSArray().apply {
    put(1)
    put(500)
    put(1000)
}

val params = JSObject().apply {
    put("tokens", tokens)
}

LlamaCpp.getInstance().detokenize(params) { result ->
    if (result.isSuccess) {
        val text = result.data?.getString("text")
        Log.i("LlamaCpp", "Reconstructed: $text")
    }
}
```



---

## Error Handling

### Try-Catch Pattern

**Java:**

```java
try {
    JSObject params = new JSObject();
    params.put("model", "/data/local/tmp/model.gguf");
    params.put("n_ctx", 2048);
    
    LlamaCpp.getInstance().initContext(params, result -> {
        if (!result.isSuccess()) {
            throw new Exception(result.getError().getMessage());
        }
        
        String modelDesc = result.getData().getString("desc");
        Log.i("LlamaCpp", "Model loaded: " + modelDesc);
    });
    
} catch (Exception e) {
    Log.e("LlamaCpp", "Error: " + e.getMessage());
}
```

**Kotlin:**

```kotlin
try {
    val params = JSObject().apply {
        put("model", "/data/local/tmp/model.gguf")
        put("n_ctx", 2048)
    }
    
    LlamaCpp.getInstance().initContext(params) { result ->
        if (!result.isSuccess) {
            throw Exception(result.error?.message)
        }
        
        val modelDesc = result.data?.getString("desc")
        Log.i("LlamaCpp", "Model loaded: $modelDesc")
    }
    
} catch (e: Exception) {
    Log.e("LlamaCpp", "Error: ${e.message}")
}
```

### Specific Error Handling (Java)

```java
LlamaCpp.getInstance().initContext(params, result -> {
    if (!result.isSuccess()) {
        String errorMsg = result.getError().getMessage();
        
        if (errorMsg.contains("not found")) {
            Log.e("LlamaCpp", "Model file not found");
        } else if (errorMsg.contains("memory") || errorMsg.contains("OutOfMemory")) {
            Log.e("LlamaCpp", "Out of memory");
        } else if (errorMsg.contains("permission")) {
            Log.e("LlamaCpp", "Permission denied");
        } else {
            Log.e("LlamaCpp", "Unknown error: " + errorMsg);
        }
    }
});
```

### Specific Error Handling (Kotlin)

```kotlin
LlamaCpp.getInstance().initContext(params) { result ->
    if (!result.isSuccess) {
        val errorMsg = result.error?.message ?: "Unknown error"
        
        when {
            errorMsg.contains("not found") -> Log.e("LlamaCpp", "Model file not found")
            errorMsg.contains("memory") || errorMsg.contains("OutOfMemory") -> 
                Log.e("LlamaCpp", "Out of memory")
            errorMsg.contains("permission") -> Log.e("LlamaCpp", "Permission denied")
            else -> Log.e("LlamaCpp", "Unknown error: $errorMsg")
        }
    }
}
```

---

## Android-Specific Features

### Multi-Architecture Support

The plugin supports multiple architectures. The native library is selected at runtime:

```java
// Java - Check architecture
String abi = android.os.Build.CPU_ABI;
Log.i("LlamaCpp", "Device ABI: " + abi);

// Supported: arm64-v8a, armeabi-v7a, x86, x86_64
```

```kotlin
// Kotlin
val abi = android.os.Build.CPU_ABI
Log.i("LlamaCpp", "Device ABI: $abi")
```

### GPU Acceleration (Qualcomm Adreno)

```java
JSObject params = new JSObject();
params.put("model", "/data/local/tmp/model.gguf");
params.put("n_gpu_layers", 20);  // Offload to Adreno GPU
params.put("n_threads", 4);       // CPU threads

LlamaCpp.getInstance().initContext(params, result -> {
    if (result.isSuccess()) {
        boolean gpuEnabled = result.getData().getBoolean("gpu");
        String noGpuReason = result.getData().getString("reasonNoGPU");
        
        if (gpuEnabled) {
            Log.i("LlamaCpp", "GPU acceleration enabled");
        } else {
            Log.i("LlamaCpp", "GPU not available: " + noGpuReason);
        }
    }
});
```

### Background Thread Execution

**Using Thread:**

```java
new Thread(() -> {
    // Long-running operation
    JSObject params = new JSObject();
    params.put("prompt", "Generate a story...");
    params.put("n_predict", 500);
    
    LlamaCpp.getInstance().completion(params, result -> {
        if (result.isSuccess()) {
            String text = result.getData().getString("text");
            
            // Switch to main thread for UI updates
            runOnUiThread(() -> {
                textView.setText(text);
            });
        }
    });
}).start();
```

**Using Coroutines (Kotlin):**

```kotlin
lifecycleScope.launch(Dispatchers.Default) {
    val params = JSObject().apply {
        put("prompt", "Generate a story...")
        put("n_predict", 500)
    }
    
    LlamaCpp.getInstance().completion(params) { result ->
        if (result.isSuccess) {
            val text = result.data?.getString("text")
            
            withContext(Dispatchers.Main) {
                textView.text = text
            }
        }
    }
}
```

### Model Download & Management

**Download Model:**

```java
JSObject params = new JSObject();
params.put("url", "https://example.com/model.gguf");
params.put("filename", "model.gguf");

LlamaCpp.getInstance().downloadModel(params, result -> {
    if (result.isSuccess()) {
        String localPath = result.getData().getString("path");
        Log.i("LlamaCpp", "Downloaded to: " + localPath);
    }
});
```

**Get Download Progress:**

```kotlin
val url = "https://example.com/model.gguf"

val progressChecker = object : Runnable {
    override fun run() {
        val params = JSObject().apply {
            put("url", url)
        }
        
        LlamaCpp.getInstance().getDownloadProgress(params) { result ->
            if (result.isSuccess) {
                val progress = result.data?.getInt("progress") ?: 0
                val completed = result.data?.getBoolean("completed") ?: false
                
                Log.i("LlamaCpp", "Progress: $progress%")
                
                if (!completed) {
                    // Check again after 1 second
                    Handler(Looper.getMainLooper()).postDelayed(this, 1000)
                }
            }
        }
    }
}

Handler(Looper.getMainLooper()).post(progressChecker)
```

**Cancel Download:**

```java
JSObject params = new JSObject();
params.put("url", "https://example.com/model.gguf");

LlamaCpp.getInstance().cancelDownload(params, result -> {
    if (result.isSuccess()) {
        boolean cancelled = result.getData().getBoolean("cancelled");
        Log.i("LlamaCpp", "Download cancelled: " + cancelled);
    }
});
```

### Storage Paths

Android provides different storage locations:

```java
// App-specific cache (temporary, may be cleared)
String cacheDir = getContext().getCacheDir().getAbsolutePath();
// e.g., /data/data/com.example.app/cache

// App-specific files directory
String filesDir = getContext().getFilesDir().getAbsolutePath();
// e.g., /data/data/com.example.app/files

// External storage (requires permissions)
File externalDir = getContext().getExternalFilesDir(null);
// e.g., /storage/emulated/0/Android/data/com.example.app/files
```

### Benchmarking

**Java:**

```java
JSObject params = new JSObject();
params.put("pp", 512);      // Process 512 prompt tokens
params.put("tg", 128);      // Generate 128 tokens
params.put("pl", 2048);     // Prompt length
params.put("nr", 3);        // Number of runs

LlamaCpp.getInstance().bench(params, result -> {
    if (result.isSuccess()) {
        JSObject bench = result.getData();
        double ppAvg = bench.getDouble("ppAvg");
        double tgAvg = bench.getDouble("tgAvg");
        
        Log.i("LlamaCpp", "Prompt processing: " + ppAvg + " tok/s");
        Log.i("LlamaCpp", "Token generation: " + tgAvg + " tok/s");
    }
});
```

**Kotlin:**

```kotlin
val params = JSObject().apply {
    put("pp", 512)      // Process 512 prompt tokens
    put("tg", 128)      // Generate 128 tokens
    put("pl", 2048)     // Prompt length
    put("nr", 3)        // Number of runs
}

LlamaCpp.getInstance().bench(params) { result ->
    if (result.isSuccess) {
        val ppAvg = result.data?.getDouble("ppAvg")
        val tgAvg = result.data?.getDouble("tgAvg")
        
        Log.i("LlamaCpp", "Prompt processing: $ppAvg tok/s")
        Log.i("LlamaCpp", "Token generation: $tgAvg tok/s")
    }
}
```

---

## Complete Example Application

**MainActivity.java:**

```java
import android.os.Bundle;
import android.util.Log;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Button;
import androidx.appcompat.app.AppCompatActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import ai.annadata.plugin.capacitor.LlamaCpp;

public class MainActivity extends AppCompatActivity {
    private static final String TAG = "LlamaCppDemo";
    
    private EditText inputText;
    private TextView outputText;
    private Button generateButton;
    private LlamaCpp llamaCpp;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        inputText = findViewById(R.id.input_text);
        outputText = findViewById(R.id.output_text);
        generateButton = findViewById(R.id.generate_button);
        
        llamaCpp = LlamaCpp.getInstance();
        
        generateButton.setOnClickListener(v -> generateText());
        
        // Initialize model on startup
        initializeModel();
    }
    
    private void initializeModel() {
        JSObject params = new JSObject();
        params.put("model", "/data/local/tmp/model.gguf");
        params.put("n_ctx", 1024);
        params.put("n_threads", 4);
        params.put("n_gpu_layers", 20);
        
        llamaCpp.initContext(params, result -> {
            if (result.isSuccess()) {
                Log.i(TAG, "Model loaded");
                runOnUiThread(() -> generateButton.setEnabled(true));
            } else {
                Log.e(TAG, "Failed to load model: " + result.getError().getMessage());
            }
        });
    }
    
    private void generateText() {
        String prompt = inputText.getText().toString();
        if (prompt.isEmpty()) {
            outputText.setText("Enter a prompt");
            return;
        }
        
        generateButton.setEnabled(false);
        outputText.setText("Generating...");
        
        JSObject params = new JSObject();
        params.put("prompt", prompt);
        params.put("n_predict", 200);
        params.put("temperature", 0.8);
        
        llamaCpp.completion(params, result -> {
            generateButton.setEnabled(true);
            
            if (result.isSuccess()) {
                String generated = result.getData().getString("text");
                runOnUiThread(() -> outputText.setText(generated));
            } else {
                Log.e(TAG, "Generation failed: " + result.getError().getMessage());
                runOnUiThread(() -> outputText.setText("Error: Generation failed"));
            }
        });
    }
}
```

**MainActivity.kt:**

```kotlin
import android.os.Bundle
import android.util.Log
import android.widget.EditText
import android.widget.TextView
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import com.getcapacitor.JSObject
import com.getcapacitor.JSArray
import ai.annadata.plugin.capacitor.LlamaCpp

class MainActivity : AppCompatActivity() {
    companion object {
        private const val TAG = "LlamaCppDemo"
    }
    
    private lateinit var inputText: EditText
    private lateinit var outputText: TextView
    private lateinit var generateButton: Button
    private val llamaCpp = LlamaCpp.getInstance()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        inputText = findViewById(R.id.input_text)
        outputText = findViewById(R.id.output_text)
        generateButton = findViewById(R.id.generate_button)
        
        generateButton.setOnClickListener { generateText() }
        
        initializeModel()
    }
    
    private fun initializeModel() {
        val params = JSObject().apply {
            put("model", "/data/local/tmp/model.gguf")
            put("n_ctx", 1024)
            put("n_threads", 4)
            put("n_gpu_layers", 20)
        }
        
        llamaCpp.initContext(params) { result ->
            if (result.isSuccess) {
                Log.i(TAG, "Model loaded")
                runOnUiThread { generateButton.isEnabled = true }
            } else {
                Log.e(TAG, "Failed to load model: ${result.error?.message}")
            }
        }
    }
    
    private fun generateText() {
        val prompt = inputText.text.toString()
        if (prompt.isEmpty()) {
            outputText.text = "Enter a prompt"
            return
        }
        
        generateButton.isEnabled = false
        outputText.text = "Generating..."
        
        val params = JSObject().apply {
            put("prompt", prompt)
            put("n_predict", 200)
            put("temperature", 0.8)
        }
        
        llamaCpp.completion(params) { result ->
            generateButton.isEnabled = true
            
            if (result.isSuccess) {
                val generated = result.data?.getString("text")
                runOnUiThread { outputText.text = generated }
            } else {
                Log.e(TAG, "Generation failed: ${result.error?.message}")
                runOnUiThread { outputText.text = "Error: Generation failed" }
            }
        }
    }
}
```

---

## Performance Tips

1. **Use Speculative Decoding** - 2-8x speedup with draft model
2. **Enable GPU** - Set `n_gpu_layers` appropriately for device
3. **Quantize Models** - Use Q4_0 or Q4_1 for smaller size
4. **Batch Processing** - Increase `n_batch` for throughput
5. **Thread Count** - Match device CPU count for optimal performance
6. **Background Threads** - Always run model operations off main thread

---

## Common Patterns

### Pattern 1: Loading with Progress

```java
JSObject params = new JSObject();
params.put("model", "/data/local/tmp/model.gguf");

LlamaCpp.getInstance().initContext(params, result -> {
    if (result.isSuccess()) {
        // Model loaded
    }
});
```

### Pattern 2: Error Recovery

```java
private void tryInitContext(int gpuLayers) {
    JSObject params = new JSObject();
    params.put("model", "/data/local/tmp/model.gguf");
    params.put("n_gpu_layers", gpuLayers);
    
    LlamaCpp.getInstance().initContext(params, result -> {
        if (!result.isSuccess() && gpuLayers > 0) {
            // Retry without GPU
            tryInitContext(0);
        }
    });
}
```

### Pattern 3: Streaming Response

```java
StringBuilder fullText = new StringBuilder();

JSObject params = new JSObject();
params.put("prompt", "Tell me a story:");
params.put("n_predict", 500);

LlamaCpp.getInstance().completion(params, result -> {
    if (result.isSuccess()) {
        String generated = result.getData().getString("text");
        fullText.append(generated);
        
        // Update UI with accumulated text
        runOnUiThread(() -> outputText.setText(fullText.toString()));
    }
});
```

---

## API Reference Table

| Method | Purpose | Platform |
|--------|---------|----------|
| `initContext()` | Load model | All |
| `completion()` | Generate text | All |
| `chat()` | Chat interface | All |
| `embedding()` | Generate embeddings | All |
| `rerank()` | Rank documents | All |
| `applyLoraAdapters()` | Apply LoRA | All |
| `initMultimodal()` | Vision support | Android 5.0+ |
| `initVocoder()` | TTS support | Android 5.0+ |
| `saveSession()` | Persist state | All |
| `loadSession()` | Restore state | All |
| `tokenize()` | Tokenization | All |
| `detokenize()` | Token to text | All |

---

## Troubleshooting

### Model fails to load

- Check file path exists and is readable
- Verify model format is GGUF
- Check available memory with `adb shell dumpsys meminfo`

### GPU not available

- Verify device has Qualcomm GPU (check Build.CPU_ABI)
- Check Adreno drivers are up to date
- Try reducing `n_gpu_layers`

### Out of memory errors

- Reduce `n_ctx` size
- Reduce `n_batch` size
- Quantize model (use Q2_K or Q3_K)
- Close other apps

### Slow performance

- Enable GPU acceleration if available
- Reduce context size
- Use speculative decoding
- Increase `n_threads` up to CPU count

---

## Conclusion

This API reference provides all methods and examples needed to integrate LlamaCpp inference into Android applications. For more details, refer to the complete Low-Level Design document and source code examples.
