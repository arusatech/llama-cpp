# PWA API Reference Guide
## LlamaCpp Capacitor Plugin - Complete Web/PWA Implementation API

**Version:** 1.0.0  
**Platform:** Modern Browsers (Chrome 90+, Firefox 88+, Safari 15+, Edge 90+)  
**Author:** Annadata AI  
**Date:** July 2, 2026

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation & Setup](#installation--setup)
3. [Core Concepts](#core-concepts)
4. [Core API Methods](#core-api-methods)
5. [Context Management](#context-management)
6. [Text Generation](#text-generation)
7. [Chat & Conversations](#chat--conversations)
8. [Embeddings & Reranking](#embeddings--reranking)
9. [LoRA Adapters](#lora-adapters)
10. [Multimodal Processing](#multimodal-processing)
11. [Text-to-Speech](#text-to-speech)
12. [Session Management](#session-management)
13. [Storage & OPFS](#storage--opfs)
14. [Web Worker Integration](#web-worker-integration)
15. [Error Handling](#error-handling)
16. [Performance Tips](#performance-tips)

---

## Quick Start

### Installation

```bash
# Install via npm
npm install llama-cpp-pro

# For web-only development
npm install

# Build with Vite/webpack
npm run build

# Serve locally
npm run dev
```

### HTML Setup

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LlamaCpp Web Demo</title>
    
    <!-- Enable shared array buffer for Web Workers -->
    <meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin">
    <meta http-equiv="Cross-Origin-Embedder-Policy" content="require-corp">
    
    <style>
        #output { 
            width: 100%; 
            height: 300px; 
            border: 1px solid #ccc; 
            padding: 10px;
            font-family: monospace;
            white-space: pre-wrap;
            overflow-y: auto;
        }
    </style>
</head>
<body>
    <h1>LlamaCpp Web Demo</h1>
    <input type="text" id="prompt" placeholder="Enter your prompt">
    <button id="generate">Generate</button>
    <div id="output"></div>
    
    <script type="module" src="main.js"></script>
</body>
</html>
```

### Minimal Working Example (TypeScript)

```typescript
import { initLlama, LlamaContext } from 'llama-cpp-pro';

async function main() {
    try {
        // Initialize model
        const context = await initLlama({
            model: 'https://example.com/model.gguf',
            n_ctx: 2048,
            n_threads: 4,
        });
        
        // Generate text
        const result = await context.completion({
            prompt: 'Hello, how are you?',
            n_predict: 50,
            temperature: 0.8,
        });
        
        console.log('Generated:', result.text);
        
        // Release
        await context.release();
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
```

### Minimal Working Example (JavaScript)

```javascript
import { initLlama } from 'llama-cpp-pro';

async function main() {
    // Initialize model
    const context = await initLlama({
        model: 'https://example.com/model.gguf',
        n_ctx: 2048,
        n_threads: 4,
    });
    
    // Generate text
    const result = await context.completion({
        prompt: 'Hello, how are you?',
        n_predict: 50,
        temperature: 0.8,
    });
    
    console.log('Generated:', result.text);
    
    // Release
    await context.release();
}

main();
```

### React Integration

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { initLlama, LlamaContext } from 'llama-cpp-pro';

export function LlamaComponent() {
    const [context, setContext] = useState<LlamaContext | null>(null);
    const [output, setOutput] = useState('');
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
        const init = async () => {
            try {
                const ctx = await initLlama({
                    model: 'https://example.com/model.gguf',
                    n_ctx: 2048,
                });
                setContext(ctx);
            } catch (error) {
                console.error('Failed to initialize:', error);
            }
        };
        
        init();
    }, []);
    
    const handleGenerate = async (prompt: string) => {
        if (!context) return;
        
        setLoading(true);
        try {
            const result = await context.completion({
                prompt,
                n_predict: 200,
                temperature: 0.8,
            });
            setOutput(result.text);
        } catch (error) {
            console.error('Generation error:', error);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div>
            <input type="text" placeholder="Enter prompt" 
                onKeyPress={e => {
                    if (e.key === 'Enter') {
                        handleGenerate(e.currentTarget.value);
                    }
                }} />
            <div>{loading ? 'Generating...' : output}</div>
        </div>
    );
}
```



---

## Installation & Setup

### NPM Installation

```bash
npm install llama-cpp-pro @capacitor/core @capacitor/webview
```

### Import Statements (TypeScript)

```typescript
import {
    initLlama,
    LlamaContext,
    releaseAllLlama,
    toggleNativeLog,
    addNativeLogListener,
    modelInfo,
    convertJsonSchemaToGrammar,
} from 'llama-cpp-pro';

import type {
    ContextParams,
    CompletionParams,
    NativeCompletionResult,
    EmbeddingParams,
    RerankParams,
} from 'llama-cpp-pro';
```

### Browser Requirements

```html
<!-- Required for Web Workers and SharedArrayBuffer -->
<meta http-equiv="Cross-Origin-Opener-Policy" content="same-origin">
<meta http-equiv="Cross-Origin-Embedder-Policy" content="require-corp">

<!-- Service Worker for offline support -->
<script>
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }
</script>
```

### Vite Configuration

```javascript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Resource-Policy': 'cross-origin',
        },
    },
});
```

### Webpack Configuration

```javascript
// webpack.config.js
module.exports = {
    devServer: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Resource-Policy': 'cross-origin',
        },
    },
};
```

---

## Core Concepts

### Web Provider Architecture

The LlamaCpp web implementation uses a provider pattern:

```typescript
import { WebProvider } from 'llama-cpp-pro/isomorphic/provider.web';

// Automatic provider selection
const provider = new WebProvider();

// Providers handle:
// - WASM initialization
// - Web Worker lifecycle
// - Model caching
// - OPFS storage
```

### Model Scheduler

The scheduler manages concurrent model slots:

```typescript
// MaxConcurrentModels controls how many models can run simultaneously
// Default: 2 (for browser memory constraints)

// Models share a WASM runtime, queued if scheduler is full
```

### OPFS Storage

Models are stored in the Origin Private File System for persistence:

```typescript
// Automatic: Models cache to OPFS on first load
// Models are retrieved from OPFS on subsequent loads
// No download needed if model already cached

// Manual: Use ensureModelInOpfs() for explicit control
```

---

## Core API Methods

### 1. initLlama() - Initialize Model

**TypeScript:**
```typescript
async function initLlama(
    params: ContextParams,
    onProgress?: (progress: number) => void
): Promise<LlamaContext>
```

**Purpose:** Initialize and load a language model (downloaded and cached)

**Basic Example:**

```typescript
const context = await initLlama({
    model: 'https://example.com/model.gguf',
    n_ctx: 2048,
    n_threads: 4,
});

console.log(`Model loaded: ${context.model.desc}`);
console.log(`GPU available: ${context.gpu}`);
```

**With Progress Tracking:**

```typescript
const context = await initLlama(
    {
        model: 'https://example.com/model-7b.gguf',
        n_ctx: 2048,
    },
    (progress) => {
        console.log(`Loading: ${progress}%`);
        updateProgressBar(progress);
    }
);

console.log('Model loaded!');
```

**With Speculative Decoding:**

```typescript
const context = await initLlama({
    model: 'https://example.com/model.gguf',
    n_ctx: 1024,
    draft_model: 'https://example.com/draft-model.gguf',
    speculative_samples: 3,
    mobile_speculative: true,
});

console.log('Speculative decoding enabled: 2-8x speedup');
```

**With LoRA Adapters:**

```typescript
const context = await initLlama({
    model: 'https://example.com/base-model.gguf',
    n_ctx: 2048,
    lora_list: [
        { path: 'https://example.com/adapter1.gguf', scaled: 1.0 },
        { path: 'https://example.com/adapter2.gguf', scaled: 0.7 }
    ],
});
```

### 2. releaseAllLlama() - Release All Models

```typescript
await releaseAllLlama();
console.log('All models released and memory freed');
```

### 3. modelInfo() - Get Model Metadata

```typescript
const info = await modelInfo({
    path: 'https://example.com/model.gguf',
    skip: ['tokenizer.ggml.tokens']  // Skip large arrays
});

console.log(`Model: ${info.general?.name}`);
console.log(`Context: ${info.parameters?.context_length}`);
console.log(`Parameters: ${info.parameters?.block_count} blocks`);
```

### 4. toggleNativeLog() - Enable/Disable Logging

```typescript
await toggleNativeLog(true);
console.log('Logging enabled');

await toggleNativeLog(false);
console.log('Logging disabled');
```

### 5. addNativeLogListener() - Listen to Logs

```typescript
const listener = addNativeLogListener((level, text) => {
    console.log(`[${level}] ${text}`);
});

// Later, remove listener
listener.remove();
```



---

## Context Management

### completion() - Generate Text

**Basic Example:**

```typescript
const result = await context.completion({
    prompt: 'The meaning of life is',
    n_predict: 100,
    temperature: 0.8,
});

console.log('Generated:', result.text);
console.log('Speed:', result.timings.predicted_per_second, 'tok/s');
```

**With Streaming Callback:**

```typescript
let fullText = '';

const result = await context.completion(
    {
        prompt: 'Write a poem about AI:',
        n_predict: 200,
        temperature: 0.9,
    },
    (tokenData) => {
        // Called for each generated token
        fullText += tokenData.token;
        console.log('Token:', tokenData.token);
        updateUI(fullText);  // Real-time update
    }
);

console.log('Complete:', result.text);
```

**With Sampling Parameters:**

```typescript
const result = await context.completion({
    prompt: 'Complete this thought:',
    n_predict: 150,
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    penalty_repeat: 1.2,
    mirostat: 2,
    mirostat_tau: 5.0,
});
```

**With Stop Sequences:**

```typescript
const result = await context.completion({
    prompt: 'Q: What is AI?\nA:',
    n_predict: 100,
    stop: ['\n\nQ:', '\n\nUser:', 'Assistant:'],
});
```

**With Grammar/Structured Output:**

```typescript
const result = await context.completion({
    prompt: 'Generate a JSON person object:',
    n_predict: 200,
    response_format: {
        type: 'json_schema',
        json_schema: {
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                    city: { type: 'string' },
                },
                required: ['name', 'age', 'city']
            }
        }
    }
});

const person = JSON.parse(result.content);
console.log('Generated:', person);
```

### chat() - Chat Conversation

```typescript
const result = await context.chat(
    [
        { role: 'user', content: 'What is machine learning?' },
        { role: 'assistant', content: 'Machine learning is...' },
        { role: 'user', content: 'Tell me more about neural networks.' },
    ],
    'You are a helpful AI assistant focused on explaining technical concepts.',
    {
        n_predict: 200,
        temperature: 0.7,
    }
);

console.log('Assistant:', result.content);
```

### chatWithSystem() - Simple Chat

```typescript
const result = await context.chatWithSystem(
    'You are a helpful assistant.',
    'What is the capital of France?',
    { n_predict: 100, temperature: 0.7 }
);

console.log('Response:', result.content);
```

### generateText() - Simple Generation

```typescript
const result = await context.generateText(
    'Once upon a time, there was',
    {
        n_predict: 200,
        temperature: 0.8,
        top_p: 0.9,
    }
);

console.log('Story:', result.text);
```

### getFormattedChat() - Format Messages

```typescript
const formatted = await context.getFormattedChat(
    [
        { role: 'system', content: 'You are a Python expert.' },
        { role: 'user', content: 'Write a function to sort a list.' },
    ],
    'chatml',  // or 'llama-chat', 'mistral', 'gemma'
    {
        jinja: true,
        enable_thinking: true,
    }
);

console.log('Formatted prompt:', formatted.prompt);
if (formatted.grammar) {
    console.log('Grammar rules:', formatted.grammar);
}
```

---

## Embeddings & Reranking

### embedding() - Generate Embeddings

**Single Text:**

```typescript
const embedding = await context.embedding(
    'This is a test sentence.'
);

console.log('Embedding vector:', embedding.embedding);
console.log('Embedding size:', embedding.embedding.length);
```

**Batch Embeddings:**

```typescript
const texts = [
    'The quick brown fox',
    'A fast russet dog',
    'The lazy cat sleeps'
];

const embeddings = await Promise.all(
    texts.map(text => context.embedding(text))
);

embeddings.forEach((emb, i) => {
    console.log(`Text ${i}: ${emb.embedding.length} dimensions`);
});
```

**Semantic Search:**

```typescript
// Create embeddings for documents
const documents = [
    'Machine learning algorithms',
    'Python programming language',
    'Web development with React'
];

const docEmbeddings = await Promise.all(
    documents.map(doc => context.embedding(doc))
);

// Search query
const query = 'How to learn machine learning';
const queryEmbedding = await context.embedding(query);

// Simple cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (normA * normB);
}

// Find most similar documents
const scores = docEmbeddings.map((emb, i) => ({
    index: i,
    doc: documents[i],
    score: cosineSimilarity(queryEmbedding.embedding, emb.embedding)
}));

scores.sort((a, b) => b.score - a.score);
console.log('Most relevant documents:', scores);
```

### rerank() - Rerank Documents

```typescript
const query = 'How to learn machine learning';
const documents = [
    'Linear algebra is fundamental to ML',
    'Python is a programming language',
    'Neural networks are ML models',
    'iOS development guide',
];

const ranked = await context.rerank(query, documents);

ranked.forEach(({ index, score }) => {
    console.log(`${documents[index]}: ${score.toFixed(2)}`);
});

// Output (sorted by relevance):
// Neural networks are ML models: 0.95
// Linear algebra is fundamental to ML: 0.87
// Python is a programming language: 0.45
// iOS development guide: 0.12
```



---

## LoRA Adapters

### applyLoraAdapters() - Apply Adapters

**Single Adapter:**

```typescript
await context.applyLoraAdapters([
    { path: 'https://example.com/adapter.gguf', scaled: 1.0 }
]);

console.log('LoRA adapter applied');
```

**Multiple Adapters with Scaling:**

```typescript
await context.applyLoraAdapters([
    { path: 'https://example.com/domain-adapter.gguf', scaled: 1.0 },
    { path: 'https://example.com/style-adapter.gguf', scaled: 0.7 },
    { path: 'https://example.com/tone-adapter.gguf', scaled: 0.5 }
]);

console.log('Multiple LoRA adapters applied');
```

**Generate with Adapters:**

```typescript
// Apply adapters
await context.applyLoraAdapters([
    { path: 'https://example.com/adapter.gguf', scaled: 1.0 }
]);

// Generate text (uses adapted model)
const result = await context.completion({
    prompt: 'Generate a poem in the style of...',
    n_predict: 150,
    temperature: 0.8,
});

console.log(result.text);
```

### getLoadedLoraAdapters() - List Adapters

```typescript
const adapters = await context.getLoadedLoraAdapters();

adapters.forEach(adapter => {
    console.log(`${adapter.path} (scale: ${adapter.scaled})`);
});
```

### removeLoraAdapters() - Remove Adapters

```typescript
const loaded = await context.getLoadedLoraAdapters();
console.log(`Loaded ${loaded.length} adapters`);

await context.removeLoraAdapters();
console.log('All adapters removed');

const remaining = await context.getLoadedLoraAdapters();
console.log(`Remaining: ${remaining.length}`);
```

---

## Multimodal Processing

### initMultimodal() - Initialize Vision

```typescript
const initialized = await context.initMultimodal({
    path: 'https://example.com/mmproj.gguf',
    use_gpu: true,
});

console.log('Multimodal initialized:', initialized);
```

### completion() with Images

```typescript
const result = await context.completion({
    messages: [
        {
            role: 'user',
            content: [
                { type: 'text', text: 'What do you see in this image?' },
                {
                    type: 'image_url',
                    image_url: { url: 'file:///path/to/image.jpg' }  // Local or data URL
                }
            ]
        }
    ],
    n_predict: 200,
});

console.log('Description:', result.content);
```

**With Blob/ArrayBuffer Images:**

```typescript
// Convert image to data URL
const imageFile = document.getElementById('imageInput').files[0];
const reader = new FileReader();

reader.onload = async (e) => {
    const dataUrl = e.target?.result;
    
    const result = await context.completion({
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'Describe this image:' },
                    { type: 'image_url', image_url: { url: dataUrl } }
                ]
            }
        ],
        n_predict: 200,
    });
    
    console.log('Result:', result.content);
};

reader.readAsDataURL(imageFile);
```

### getMultimodalSupport() - Check Capabilities

```typescript
const support = await context.getMultimodalSupport();

console.log('Vision support:', support.vision);
console.log('Audio support:', support.audio);
```

### isMultimodalEnabled() - Check Status

```typescript
const enabled = await context.isMultimodalEnabled();

if (enabled) {
    console.log('Ready to process images');
} else {
    console.log('Initialize multimodal first');
}
```

### releaseMultimodal() - Release Resources

```typescript
await context.releaseMultimodal();
console.log('Multimodal resources released');
```

---

## Text-to-Speech

### initVocoder() - Initialize TTS

```typescript
const initialized = await context.initVocoder({
    path: 'https://example.com/vocoder.gguf',
    n_batch: 512,
});

console.log('Vocoder initialized:', initialized);
```

### Generate Audio Workflow

```typescript
// Step 1: Get formatted audio completion
const audioParams = await context.getFormattedAudioCompletion(
    null,
    'Hello, this is text-to-speech.'
);

// Step 2: Get guide tokens
const guideTokens = await context.getAudioCompletionGuideTokens(
    'Hello, this is text-to-speech.'
);

// Step 3: Generate audio tokens
const result = await context.completion({
    prompt: audioParams.prompt,
    grammar: audioParams.grammar,
    guide_tokens: guideTokens,
    n_predict: 1000,
});

const audioTokens = result.audio_tokens || [];
console.log('Generated audio tokens:', audioTokens.length);

// Step 4: Decode audio tokens
const audioSamples = await context.decodeAudioTokens(audioTokens);
console.log('Audio samples:', audioSamples.length);

// Step 5: Play audio
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const audioBuffer = audioContext.createAudioBuffer(1, audioSamples.length, 16000);
const channelData = audioBuffer.getChannelData(0);
for (let i = 0; i < audioSamples.length; i++) {
    channelData[i] = audioSamples[i] / 32768;  // Normalize
}

const audioSource = audioContext.createBufferSource();
audioSource.buffer = audioBuffer;
audioSource.connect(audioContext.destination);
audioSource.start();
```

### getFormattedAudioCompletion() - Prepare Audio

```typescript
const audioParams = await context.getFormattedAudioCompletion(
    null,
    'Hello, this is a test of text-to-speech.'
);

console.log('Audio prompt:', audioParams.prompt);
console.log('Grammar:', audioParams.grammar);
```

### getAudioCompletionGuideTokens() - Get Guide Tokens

```typescript
const guideTokens = await context.getAudioCompletionGuideTokens(
    'Hello, world!'
);

console.log('Guide tokens:', guideTokens);
console.log('Token count:', guideTokens.length);
```

### decodeAudioTokens() - Decode to Audio

```typescript
const audioSamples = await context.decodeAudioTokens(audioTokens);
console.log('Audio samples:', audioSamples.length);
```

### releaseVocoder() - Release TTS

```typescript
await context.releaseVocoder();
console.log('Vocoder released');
```

---

## Session Management

### saveSession() - Save State

```typescript
// Generate some text first
await context.completion({
    prompt: 'The future of AI is',
    n_predict: 100,
});

// Save session
const tokensSaved = await context.saveSession(
    '/session.bin',
    { tokenSize: -1 }  // -1 for all tokens
);

console.log(`Session saved: ${tokensSaved} tokens`);
```

### loadSession() - Restore State

```typescript
const result = await context.loadSession('/session.bin');
console.log(`Loaded ${result.tokens_loaded} tokens`);

// Continue generation from where we left off
const completion = await context.completion({
    prompt: '',  // Empty - continues from session
    n_predict: 50,
});

console.log(completion.text);
```

### Tokenization

```typescript
// Tokenize text
const tokenized = await context.tokenize('Hello, world!');
console.log('Tokens:', tokenized.tokens);
console.log('Token count:', tokenized.tokens.length);

// Detokenize
const text = await context.detokenize(tokenized.tokens);
console.log('Reconstructed:', text);
```



---

## Storage & OPFS

### Origin Private File System (OPFS)

Models are automatically cached in OPFS for persistence:

```typescript
import { ensureModelInOpfs, listManifestEntries } from 'llama-cpp-pro';

// List cached models
const entries = await listManifestEntries();
entries.forEach(entry => {
    console.log(`${entry.modelId}: ${entry.sizeBytes} bytes`);
});

// Ensure model is in OPFS (download if needed)
const opfsPath = await ensureModelInOpfs({
    modelId: 'llama-7b',
    url: 'https://example.com/model.gguf',
    sizeBytes: 3500000000,  // ~3.5GB
});

console.log('Model cached at:', opfsPath);
```

### Cache Management

```typescript
// Check cache size
async function getCacheInfo() {
    const entries = await listManifestEntries();
    const totalSize = entries.reduce((sum, e) => sum + e.sizeBytes, 0);
    console.log(`Total cached: ${totalSize} bytes`);
    console.log(`Models: ${entries.length}`);
}

// Clear specific model (not implemented - browser security)
// OPFS is persistent until user clears site data
```

---

## Web Worker Integration

### Dedicated Worker

The plugin uses Web Workers for inference:

```typescript
// main.js
const worker = new Worker('inference-worker.js');

worker.onmessage = (e) => {
    const { result } = e.data;
    console.log('Generated:', result.text);
};

worker.postMessage({
    type: 'COMPLETE',
    prompt: 'Hello',
    n_predict: 50,
});
```

```typescript
// inference-worker.js
import { initLlama } from 'llama-cpp-pro';

let context;

onmessage = async (e) => {
    const { type, ...data } = e.data;
    
    if (type === 'INIT') {
        context = await initLlama(data.params);
        postMessage({ type: 'INIT_DONE' });
    } else if (type === 'COMPLETE') {
        const result = await context.completion(data);
        postMessage({ type: 'COMPLETE', result });
    }
};
```

### Shared Worker

For multi-tab model sharing:

```typescript
// main.js
const worker = new SharedWorker('shared-inference-worker.js');

worker.port.onmessage = (e) => {
    console.log('Response from worker:', e.data);
};

worker.port.start();
worker.port.postMessage({ type: 'COMPLETE', prompt: 'Hello' });
```

```typescript
// shared-inference-worker.js
import { initLlama } from 'llama-cpp-pro';

let context;

onconnect = (e) => {
    const port = e.ports[0];
    
    port.onmessage = async (event) => {
        const { type, ...data } = event.data;
        
        if (type === 'INIT') {
            context = await initLlama(data.params);
            port.postMessage({ type: 'INIT_DONE' });
        } else if (type === 'COMPLETE') {
            const result = await context.completion(data);
            port.postMessage({ result });
        }
    };
    
    port.start();
};
```

---

## Service Worker Integration

### Offline Support

```javascript
// sw.js
const CACHE_NAME = 'llama-cache-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/main.js',
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (e) => {
    // Cache models from indexedDB or OPFS
    if (e.request.url.includes('.gguf')) {
        e.respondWith(
            caches.match(e.request).then((response) => {
                return response || fetch(e.request);
            })
        );
    } else {
        e.respondWith(
            caches.match(e.request).then((response) => {
                return response || fetch(e.request);
            })
        );
    }
});
```

---

## Error Handling

### Try-Catch Pattern

```typescript
try {
    const context = await initLlama({
        model: 'https://example.com/model.gguf',
        n_ctx: 2048,
    });
    
    const result = await context.completion({
        prompt: 'Hello',
        n_predict: 100,
    });
    
    console.log(result.text);
    
} catch (error) {
    console.error('Error:', error.message);
}
```

### Specific Error Handling

```typescript
try {
    const context = await initLlama({
        model: 'https://example.com/model.gguf',
    });
} catch (error) {
    if (error.message.includes('404') || error.message.includes('not found')) {
        console.error('Model file not found');
    } else if (error.message.includes('memory')) {
        console.error('Out of memory');
    } else if (error.message.includes('network')) {
        console.error('Network error - try again');
    } else {
        console.error('Unknown error:', error);
    }
}
```

### Handling Browser Limitations

```typescript
// Check browser support
const checkBrowserSupport = () => {
    const support = {
        wasm: typeof WebAssembly !== 'undefined',
        workers: typeof Worker !== 'undefined',
        sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
        opfs: 'showDirectoryPicker' in window,
    };
    
    if (!support.wasm) {
        console.error('WebAssembly not supported');
    }
    if (!support.workers) {
        console.error('Web Workers not supported');
    }
    if (!support.sharedArrayBuffer) {
        console.warn('SharedArrayBuffer not available - performance may be reduced');
    }
    
    return support;
};

checkBrowserSupport();
```

---

## Performance Tips

1. **Use Speculative Decoding** - 2-8x speedup with draft model
2. **Cache Models in OPFS** - Avoid re-downloads
3. **Use Web Workers** - Keep main thread responsive
4. **Reduce Context Size** - Smaller `n_ctx` = faster inference
5. **Quantize Models** - Q4_0 or Q4_1 for smaller size
6. **Batch Requests** - Queue completions efficiently
7. **Monitor Memory** - Check browser memory warnings

### Memory Monitoring

```typescript
if (performance.memory) {
    console.log(`Used: ${performance.memory.usedJSHeapSize / 1048576} MB`);
    console.log(`Limit: ${performance.memory.jsHeapSizeLimit / 1048576} MB`);
}

// Cleanup when done
await context.release();
await releaseAllLlama();
```

---

## Complete Example Application

### React Component with Full Features

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { initLlama, LlamaContext, releaseAllLlama } from 'llama-cpp-pro';

export function ChatBot() {
    const [context, setContext] = useState<LlamaContext | null>(null);
    const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [input, setInput] = useState('');
    const [progress, setProgress] = useState(0);
    
    // Initialize model
    useEffect(() => {
        const init = async () => {
            try {
                const ctx = await initLlama(
                    {
                        model: 'https://example.com/model.gguf',
                        n_ctx: 2048,
                        n_threads: 4,
                        speculative_samples: 3,
                    },
                    (p) => setProgress(p)
                );
                setContext(ctx);
            } catch (error) {
                console.error('Failed to initialize:', error);
            }
        };
        
        init();
        
        return () => {
            releaseAllLlama();
        };
    }, []);
    
    const handleSendMessage = async () => {
        if (!context || !input.trim()) return;
        
        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);
        
        try {
            const result = await context.chat(
                [...messages, userMessage],
                'You are a helpful AI assistant.',
                {
                    n_predict: 200,
                    temperature: 0.7,
                }
            );
            
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: result.content
            }]);
        } catch (error) {
            console.error('Generation error:', error);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="chatbot">
            <div className="header">
                {progress < 100 && <div>Loading: {progress}%</div>}
                {progress === 100 && <div>Ready</div>}
            </div>
            
            <div className="messages">
                {messages.map((msg, i) => (
                    <div key={i} className={`message ${msg.role}`}>
                        {msg.content}
                    </div>
                ))}
            </div>
            
            <div className="input-area">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            handleSendMessage();
                        }
                    }}
                    placeholder="Type your message..."
                    disabled={!context || loading}
                />
                <button
                    onClick={handleSendMessage}
                    disabled={!context || loading || !input.trim()}
                >
                    {loading ? 'Generating...' : 'Send'}
                </button>
            </div>
        </div>
    );
}
```

### Vue Component

```typescript
<template>
    <div class="chatbot">
        <div class="header">
            <span v-if="progress < 100">Loading: {{ progress }}%</span>
            <span v-else>Ready</span>
        </div>
        
        <div class="messages">
            <div
                v-for="(msg, i) in messages"
                :key="i"
                :class="['message', msg.role]"
            >
                {{ msg.content }}
            </div>
        </div>
        
        <div class="input-area">
            <input
                v-model="input"
                @keypress.enter="sendMessage"
                placeholder="Type your message..."
                :disabled="!context || loading"
            />
            <button
                @click="sendMessage"
                :disabled="!context || loading || !input.trim()"
            >
                {{ loading ? 'Generating...' : 'Send' }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { initLlama, LlamaContext, releaseAllLlama } from 'llama-cpp-pro';

const context = ref<LlamaContext | null>(null);
const messages = ref<Array<{ role: string; content: string }>>([]);
const loading = ref(false);
const input = ref('');
const progress = ref(0);

onMounted(async () => {
    try {
        context.value = await initLlama(
            {
                model: 'https://example.com/model.gguf',
                n_ctx: 2048,
                n_threads: 4,
            },
            (p) => { progress.value = p; }
        );
    } catch (error) {
        console.error('Failed to initialize:', error);
    }
});

onUnmounted(async () => {
    await releaseAllLlama();
});

async function sendMessage() {
    if (!context.value || !input.value.trim()) return;
    
    const userMessage = { role: 'user', content: input.value };
    messages.value.push(userMessage);
    input.value = '';
    loading.value = true;
    
    try {
        const result = await context.value.chat(
            messages.value,
            'You are a helpful AI assistant.',
            { n_predict: 200, temperature: 0.7 }
        );
        
        messages.value.push({
            role: 'assistant',
            content: result.content
        });
    } catch (error) {
        console.error('Generation error:', error);
    } finally {
        loading.value = false;
    }
}
</script>
```

---

## Cross-Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebAssembly | ✅ 90+ | ✅ 88+ | ✅ 15+ | ✅ 90+ |
| Web Workers | ✅ All | ✅ All | ✅ All | ✅ All |
| SharedArrayBuffer | ✅ 91+ | ✅ 88+ | ✅ 16.4+ | ✅ 91+ |
| OPFS | ✅ 118+ | ✅ Partial | ✅ 16.1+ | ✅ 118+ |
| Service Workers | ✅ 45+ | ✅ 44+ | ✅ 11.1+ | ✅ 17+ |

---

## Deployment

### Static Site Hosting

```bash
# Build for production
npm run build

# Deploy to Netlify
netlify deploy --prod --dir dist

# Deploy to Vercel
vercel deploy --prod
```

### Docker Deployment

```dockerfile
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18
WORKDIR /app
COPY --from=builder /app/dist ./dist
RUN npm install -g serve
CMD ["serve", "-s", "dist", "-l", "3000"]
```

---

## Conclusion

This API reference provides all methods and examples needed to integrate LlamaCpp inference into web/PWA applications. The web implementation leverages WASM, Web Workers, and OPFS for efficient, offline-capable inference directly in the browser.
