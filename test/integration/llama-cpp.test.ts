import { LlamaCpp } from '@capacitor-community/llama-cpp';
import { initLlama, LlamaContext } from '../../src/index';

// Test configuration
const TEST_CONFIG = {
  // Small test model (7B or smaller for faster testing)
  modelPath: '/path/to/test-model.gguf',
  // Alternative models for different test scenarios
  models: {
    small: '/path/to/llama-2-7b-chat.gguf',
    medium: '/path/to/llama-2-13b-chat.gguf',
    multimodal: '/path/to/llava-1.5-7b.gguf',
    tts: '/path/to/llama-2-7b-chat.gguf',
    vocoder: '/path/to/vocoder-model.gguf'
  },
  // Test parameters
  params: {
    n_ctx: 2048,
    n_batch: 512,
    n_threads: 4,
    n_gpu_layers: 0,
    use_mmap: true,
    use_mlock: false
  },
  // Test timeouts
  timeouts: {
    modelLoad: 30000, // 30 seconds for model loading
    completion: 15000, // 15 seconds for completion
    embedding: 10000,  // 10 seconds for embeddings
    tts: 20000        // 20 seconds for TTS
  }
};

describe('LlamaCpp Integration Tests', () => {
  let context: LlamaContext;
  let contextId: number;

  beforeAll(async () => {
    // Enable native logging for debugging
    await LlamaCpp.toggleNativeLog({ enabled: true });
    
    // Set context limit for testing
    await LlamaCpp.setContextLimit({ limit: 5 });
  });

  afterAll(async () => {
    // Clean up all contexts
    await LlamaCpp.releaseAllContexts();
    
    // Disable native logging
    await LlamaCpp.toggleNativeLog({ enabled: false });
  });

  describe('Model Initialization', () => {
    test('should initialize model successfully', async () => {
      const startTime = Date.now();
      
      try {
        context = await initLlama({
          model: TEST_CONFIG.modelPath,
          ...TEST_CONFIG.params
        });
        
        contextId = context.contextId;
        
        const loadTime = Date.now() - startTime;
        console.log(`Model loaded in ${loadTime}ms`);
        
        expect(context).toBeDefined();
        expect(context.contextId).toBeGreaterThan(0);
        expect(context.model).toBeDefined();
        expect(context.model.desc).toContain('llama');
        
      } catch (error) {
        console.error('Model initialization failed:', error);
        throw error;
      }
    }, TEST_CONFIG.timeouts.modelLoad);

    test('should handle invalid model path', async () => {
      await expect(initLlama({
        model: '/invalid/path/model.gguf',
        ...TEST_CONFIG.params
      })).rejects.toThrow();
    });

    test('should validate model parameters', async () => {
      const context = await initLlama({
        model: TEST_CONFIG.modelPath,
        n_ctx: 1024,
        n_batch: 256,
        n_threads: 2,
        n_gpu_layers: 0
      });
      
      expect(context.model.n_ctx).toBe(1024);
      expect(context.model.n_batch).toBe(256);
      expect(context.model.n_threads).toBe(2);
      
      await context.release();
    });
  });

  describe('Text Completion', () => {
    test('should generate basic text completion', async () => {
      const prompt = "Hello, how are you today?";
      
      const result = await context.completion({
        prompt,
        n_predict: 50,
        temperature: 0.8,
        top_p: 0.9,
        top_k: 40,
        repeat_penalty: 1.1
      });
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.tokens_predicted).toBeGreaterThan(0);
      expect(result.tokens_evaluated).toBeGreaterThan(0);
      expect(result.timings).toBeDefined();
      
      console.log('Completion result:', result.text);
    }, TEST_CONFIG.timeouts.completion);

    test('should handle streaming completion', async () => {
      const prompt = "Write a short story about a robot:";
      const tokens: string[] = [];
      
      const result = await context.completion({
        prompt,
        n_predict: 100,
        temperature: 0.7,
        stream: true,
        onToken: (token) => {
          tokens.push(token);
          console.log('Token:', token);
        }
      });
      
      expect(result).toBeDefined();
      expect(tokens.length).toBeGreaterThan(0);
      expect(result.text).toBe(tokens.join(''));
    }, TEST_CONFIG.timeouts.completion);

    test('should handle stop completion', async () => {
      const prompt = "Count from 1 to 100:";
      
      // Start completion
      const completionPromise = context.completion({
        prompt,
        n_predict: 200,
        temperature: 0.1
      });
      
      // Stop after a short delay
      setTimeout(async () => {
        await context.stopCompletion();
      }, 1000);
      
      const result = await completionPromise;
      expect(result).toBeDefined();
      expect(result.interrupted).toBe(true);
    }, TEST_CONFIG.timeouts.completion);
  });

  describe('Chat Conversations', () => {
    test('should handle chat-style conversations', async () => {
      const messages = [
        { role: "system", content: "You are a helpful AI assistant." },
        { role: "user", content: "What is the capital of France?" },
        { role: "assistant", content: "The capital of France is Paris." },
        { role: "user", content: "What is the population of Paris?" }
      ];
      
      const result = await context.completion({
        messages,
        n_predict: 100,
        temperature: 0.7,
        chat_format: 0 // Use default chat format
      });
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.chat_format).toBe(0);
      
      console.log('Chat response:', result.text);
    }, TEST_CONFIG.timeouts.completion);

    test('should format chat with custom template', async () => {
      const messages = [
        { role: "user", content: "Hello, how are you?" }
      ];
      
      const chatTemplate = "{{#each messages}}{{#if (eq role 'user')}}User: {{content}}{{else}}Assistant: {{content}}{{/if}}\n{{/each}}Assistant:";
      
      const formattedChat = await context.getFormattedChat({
        messages: JSON.stringify(messages),
        chat_template: chatTemplate
      });
      
      expect(formattedChat).toBeDefined();
      expect(formattedChat.prompt).toContain('User: Hello, how are you?');
      expect(formattedChat.prompt).toContain('Assistant:');
    });
  });

  describe('Tokenization', () => {
    test('should tokenize text correctly', async () => {
      const text = "Hello world, this is a test sentence.";
      
      const result = await context.tokenize({
        text,
        media_paths: []
      });
      
      expect(result).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.tokens.length).toBeGreaterThan(0);
      expect(result.has_media).toBe(false);
      expect(result.chunk_pos).toBeDefined();
      
      console.log('Tokenization result:', result.tokens.length, 'tokens');
    });

    test('should detokenize tokens correctly', async () => {
      const text = "Hello world";
      const tokenizeResult = await context.tokenize({ text, media_paths: [] });
      
      const detokenized = await context.detokenize({
        tokens: tokenizeResult.tokens
      });
      
      expect(detokenized).toBeDefined();
      expect(detokenized.text).toBe(text);
    });
  });

  describe('Embeddings', () => {
    test('should generate embeddings', async () => {
      const text = "This is a test sentence for embedding generation.";
      
      const result = await context.embedding({
        content: text,
        model: TEST_CONFIG.modelPath
      });
      
      expect(result).toBeDefined();
      expect(result.embedding).toBeDefined();
      expect(result.embedding.length).toBeGreaterThan(0);
      expect(typeof result.embedding[0]).toBe('number');
      
      console.log('Embedding dimension:', result.embedding.length);
    }, TEST_CONFIG.timeouts.embedding);
  });

  describe('Session Management', () => {
    test('should save and load session', async () => {
      const sessionPath = '/tmp/test-session.json';
      
      // Generate some content first
      const completion = await context.completion({
        prompt: "Hello world",
        n_predict: 20
      });
      
      // Save session
      const saveResult = await context.saveSession({
        filepath: sessionPath,
        size: 1000
      });
      
      expect(saveResult).toBeDefined();
      expect(saveResult.tokens_saved).toBeGreaterThan(0);
      
      // Load session
      const loadResult = await context.loadSession({
        filepath: sessionPath
      });
      
      expect(loadResult).toBeDefined();
      expect(loadResult.tokens_loaded).toBeGreaterThan(0);
      expect(loadResult.prompt).toBeDefined();
    });
  });

  describe('Benchmarking', () => {
    test('should run performance benchmark', async () => {
      const result = await context.bench({
        n_threads: [1, 2, 4],
        n_prompt: 100,
        n_gen: 50,
        model: TEST_CONFIG.modelPath
      });
      
      expect(result).toBeDefined();
      expect(result.timings).toBeDefined();
      expect(result.timings.length).toBeGreaterThan(0);
      
      console.log('Benchmark results:', result.timings);
    });
  });

  describe('LoRA Adapters', () => {
    test('should apply and remove LoRA adapters', async () => {
      const loraPath = '/path/to/test-lora.gguf';
      
      // Apply LoRA adapter
      const applyResult = await context.applyLoraAdapters({
        adapters: [{
          path: loraPath,
          scale: 1.0
        }]
      });
      
      expect(applyResult).toBeDefined();
      expect(applyResult.success).toBe(true);
      
      // Get loaded adapters
      const loadedAdapters = await context.getLoadedLoraAdapters();
      expect(loadedAdapters).toBeDefined();
      expect(loadedAdapters.length).toBeGreaterThan(0);
      
      // Remove adapters
      const removeResult = await context.removeLoraAdapters();
      expect(removeResult).toBeDefined();
      expect(removeResult.success).toBe(true);
    });
  });

  describe('Multimodal Support', () => {
    test('should initialize multimodal support', async () => {
      const mmprojPath = '/path/to/mmproj.bin';
      
      const result = await context.initMultimodal({
        mmproj_path: mmprojPath,
        use_gpu: false
      });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      
      // Check multimodal support
      const support = await context.getMultimodalSupport();
      expect(support).toBeDefined();
      expect(support.vision).toBeDefined();
      expect(support.audio).toBeDefined();
    });

    test('should process images with multimodal model', async () => {
      const imagePath = '/path/to/test-image.jpg';
      
      const result = await context.completion({
        prompt: "Describe this image:",
        media_paths: [imagePath],
        n_predict: 100
      });
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
      
      console.log('Image description:', result.text);
    }, TEST_CONFIG.timeouts.completion);
  });

  describe('Text-to-Speech', () => {
    test('should initialize vocoder', async () => {
      const vocoderPath = TEST_CONFIG.models.vocoder;
      
      const result = await context.initVocoder({
        vocoder_model_path: vocoderPath,
        batch_size: 1
      });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    test('should generate audio completion', async () => {
      const result = await context.getAudioCompletion({
        prompt: "Hello world, this is a test.",
        vocoder_model: TEST_CONFIG.models.vocoder
      });
      
      expect(result).toBeDefined();
      expect(result.audio_data).toBeDefined();
      expect(result.audio_data.length).toBeGreaterThan(0);
      expect(result.sample_rate).toBeDefined();
      
      console.log('Audio generated:', result.audio_data.length, 'samples');
    }, TEST_CONFIG.timeouts.tts);

    test('should decode audio tokens', async () => {
      const tokens = [1, 2, 3, 4, 5]; // Sample tokens
      
      const result = await context.decodeAudioTokens({
        tokens,
        vocoder_model: TEST_CONFIG.models.vocoder
      });
      
      expect(result).toBeDefined();
      expect(result.audio_data).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid context ID', async () => {
      const invalidContext = new LlamaContext(999999);
      
      await expect(invalidContext.completion({
        prompt: "test",
        n_predict: 10
      })).rejects.toThrow();
    });

    test('should handle model loading errors', async () => {
      await expect(initLlama({
        model: '/nonexistent/model.gguf',
        n_ctx: 1024
      })).rejects.toThrow();
    });

    test('should handle completion errors gracefully', async () => {
      await expect(context.completion({
        prompt: "",
        n_predict: -1 // Invalid parameter
      })).rejects.toThrow();
    });
  });

  describe('Performance Tests', () => {
    test('should handle concurrent completions', async () => {
      const prompts = [
        "Hello world",
        "How are you?",
        "What is AI?",
        "Tell me a joke"
      ];
      
      const promises = prompts.map(prompt => 
        context.completion({
          prompt,
          n_predict: 20,
          temperature: 0.7
        })
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(prompts.length);
      results.forEach(result => {
        expect(result.text).toBeDefined();
        expect(result.text.length).toBeGreaterThan(0);
      });
    }, TEST_CONFIG.timeouts.completion * 2);

    test('should handle large context windows', async () => {
      const largePrompt = "Hello world. ".repeat(1000); // Large prompt
      
      const result = await context.completion({
        prompt: largePrompt,
        n_predict: 50
      });
      
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.context_full).toBeDefined();
    }, TEST_CONFIG.timeouts.completion);
  });

  describe('Memory Management', () => {
    test('should release context properly', async () => {
      const testContext = await initLlama({
        model: TEST_CONFIG.modelPath,
        ...TEST_CONFIG.params
      });
      
      const releaseResult = await testContext.release();
      expect(releaseResult).toBeDefined();
      expect(releaseResult.success).toBe(true);
    });

    test('should handle multiple context creation and release', async () => {
      const contexts = [];
      
      // Create multiple contexts
      for (let i = 0; i < 3; i++) {
        const ctx = await initLlama({
          model: TEST_CONFIG.modelPath,
          n_ctx: 1024,
          n_threads: 2
        });
        contexts.push(ctx);
      }
      
      // Release all contexts
      for (const ctx of contexts) {
        await ctx.release();
      }
      
      // Verify all contexts are released
      const releaseAllResult = await LlamaCpp.releaseAllContexts();
      expect(releaseAllResult).toBeDefined();
    });
  });
});
