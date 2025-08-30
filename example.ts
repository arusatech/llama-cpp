import { 
  initLlama, 
  LlamaContext, 
  releaseAllLlama, 
  toggleNativeLog,
  addNativeLogListener,
  BuildInfo 
} from './src';

// Example usage of the llama-cpp CapacitorJS plugin

async function main() {
  try {
    // Enable native logging for debugging
    await toggleNativeLog(true);
    
    // Add a log listener to see native logs
    const logListener = addNativeLogListener((level, text) => {
      console.log(`[${level}] ${text}`);
    });

    console.log('LlamaCpp Build Info:', BuildInfo);

    // Initialize a llama.cpp model
    console.log('Initializing model...');
    const context = await initLlama({
      model: '/path/to/your/model.gguf', // Replace with your model path
      n_ctx: 2048,                      // Context size
      n_threads: 4,                     // Number of threads
      n_gpu_layers: 0,                  // GPU layers (iOS only)
      use_mlock: false,                 // Don't lock memory
      use_mmap: true,                   // Use memory mapping
      embedding: false,                 // Not in embedding mode
    });

    console.log('Model loaded successfully!');
    console.log('Model description:', context.model.desc);
    console.log('Model size:', context.model.size);
    console.log('GPU available:', context.gpu);
    if (!context.gpu) {
      console.log('GPU not available:', context.reasonNoGPU);
    }

    // Example 1: Simple text completion
    console.log('\n=== Example 1: Simple Text Completion ===');
    const result1 = await context.completion({
      prompt: "Hello, how are you today?",
      n_predict: 50,
      temperature: 0.8,
      top_p: 0.9,
      top_k: 40,
    });

    console.log('Generated text:', result1.text);
    console.log('Tokens predicted:', result1.tokens_predicted);
    console.log('Timings:', result1.timings);

    // Example 2: Chat-style completion
    console.log('\n=== Example 2: Chat-Style Completion ===');
    const result2 = await context.completion({
      messages: [
        { role: "system", content: "You are a helpful AI assistant." },
        { role: "user", content: "What is the capital of France?" },
        { role: "assistant", content: "The capital of France is Paris." },
        { role: "user", content: "Tell me more about it." }
      ],
      n_predict: 100,
      temperature: 0.7,
    });

    console.log('Chat response:', result2.content);

    // Example 3: Streaming completion
    console.log('\n=== Example 3: Streaming Completion ===');
    let fullText = '';
    const result3 = await context.completion({
      prompt: "Write a short story about a robot learning to paint:",
      n_predict: 150,
      temperature: 0.8,
    }, (tokenData) => {
      // Called for each token as it's generated
      fullText += tokenData.token;
      process.stdout.write(tokenData.token); // Print tokens as they arrive
    });

    console.log('\nFinal result:', result3.text);

    // Example 4: Tokenization
    console.log('\n=== Example 4: Tokenization ===');
    const tokenizeResult = await context.tokenize("Hello, world!");
    console.log('Tokens:', tokenizeResult.tokens);
    console.log('Has images:', tokenizeResult.has_images);

    // Example 5: Embeddings
    console.log('\n=== Example 5: Embeddings ===');
    const embeddingResult = await context.embedding("Hello, world!", {
      embd_normalize: 1.0
    });
    console.log('Embedding vector length:', embeddingResult.embedding.length);
    console.log('First 5 values:', embeddingResult.embedding.slice(0, 5));

    // Example 6: Reranking
    console.log('\n=== Example 6: Reranking ===');
    const documents = [
      "Document about cats and their behavior",
      "Document about dogs and training methods", 
      "Document about birds and migration patterns",
      "Document about fish and ocean life"
    ];

    const rerankResults = await context.rerank(
      "Tell me about pets",
      documents,
      { normalize: 1.0 }
    );

    console.log('Reranked results:');
    rerankResults.forEach((result, index) => {
      console.log(`${index + 1}. Score: ${result.score.toFixed(3)}, Document: ${result.document}`);
    });

    // Example 7: Multimodal support (if available)
    console.log('\n=== Example 7: Multimodal Support ===');
    try {
      await context.initMultimodal({
        path: '/path/to/mmproj.gguf', // Replace with your multimodal projector
        use_gpu: true,
      });

      const multimodalSupport = await context.getMultimodalSupport();
      console.log('Multimodal support:', multimodalSupport);

      if (multimodalSupport.vision) {
        console.log('Vision support is available!');
        
        // Example with image
        const imageResult = await context.completion({
          messages: [
            { 
              role: "user", 
              content: [
                { type: "text", text: "What do you see in this image?" },
                { type: "image_url", image_url: { url: "file:///path/to/image.jpg" } }
              ]
            }
          ],
          n_predict: 100,
        });

        console.log('Image analysis:', imageResult.content);
      }

      await context.releaseMultimodal();
    } catch (error) {
      console.log('Multimodal not available:', error.message);
    }

    // Example 8: TTS support (if available)
    console.log('\n=== Example 8: TTS Support ===');
    try {
      await context.initVocoder({
        path: '/path/to/vocoder.gguf', // Replace with your vocoder model
        n_batch: 512,
      });

      const isVocoderEnabled = await context.isVocoderEnabled();
      console.log('TTS enabled:', isVocoderEnabled);

      if (isVocoderEnabled) {
        // Generate audio completion
        const audioCompletion = await context.getFormattedAudioCompletion(
          null, // Speaker configuration (null for default)
          "Hello, this is a test of text-to-speech functionality."
        );

        // Get guide tokens
        const guideTokens = await context.getAudioCompletionGuideTokens(
          "Hello, this is a test of text-to-speech functionality."
        );

        // Generate audio tokens
        const audioResult = await context.completion({
          prompt: audioCompletion.prompt,
          grammar: audioCompletion.grammar,
          guide_tokens: guideTokens,
          n_predict: 1000,
        });

        // Decode audio tokens to audio data
        const audioData = await context.decodeAudioTokens(audioResult.audio_tokens);
        console.log('Audio data length:', audioData.length);
      }

      await context.releaseVocoder();
    } catch (error) {
      console.log('TTS not available:', error.message);
    }

    // Example 9: LoRA adapters
    console.log('\n=== Example 9: LoRA Adapters ===');
    try {
      await context.applyLoraAdapters([
        { path: '/path/to/adapter1.gguf', scaled: 1.0 },
        { path: '/path/to/adapter2.gguf', scaled: 0.5 }
      ]);

      const adapters = await context.getLoadedLoraAdapters();
      console.log('Loaded LoRA adapters:', adapters);

      // Test completion with adapters
      const adapterResult = await context.completion({
        prompt: "Test prompt with LoRA adapters:",
        n_predict: 50,
      });

      console.log('Result with adapters:', adapterResult.text);

      await context.removeLoraAdapters();
    } catch (error) {
      console.log('LoRA adapters not available:', error.message);
    }

    // Example 10: Session management
    console.log('\n=== Example 10: Session Management ===');
    try {
      // Save current session
      const tokensSaved = await context.saveSession('/path/to/session.gguf', { 
        tokenSize: 1000 
      });
      console.log('Session saved, tokens:', tokensSaved);

      // Load session
      const session = await context.loadSession('/path/to/session.gguf');
      console.log('Session loaded, tokens:', session.tokens_loaded);
      console.log('Previous prompt:', session.prompt);
    } catch (error) {
      console.log('Session management not available:', error.message);
    }

    // Example 11: Benchmarking
    console.log('\n=== Example 11: Benchmarking ===');
    try {
      const benchResult = await context.bench(128, 128, 128, 10);
      console.log('Benchmark result:', benchResult);
    } catch (error) {
      console.log('Benchmarking not available:', error.message);
    }

    // Example 12: Structured output with JSON schema
    console.log('\n=== Example 12: Structured Output ===');
    const structuredResult = await context.completion({
      prompt: "Generate a JSON object with a person's name, age, and favorite color:",
      n_predict: 100,
      response_format: {
        type: 'json_schema',
        json_schema: {
          strict: true,
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
              favorite_color: { type: 'string' }
            },
            required: ['name', 'age', 'favorite_color']
          }
        }
      }
    });

    console.log('Structured output:', structuredResult.content);

    // Clean up
    console.log('\n=== Cleanup ===');
    await context.release();
    logListener.remove();
    await releaseAllLlama();
    
    console.log('All resources released successfully!');

  } catch (error) {
    console.error('Error:', error);
    
    // Clean up on error
    try {
      await releaseAllLlama();
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  }
}

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
