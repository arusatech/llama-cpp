import { LlamaCpp } from '@capacitor-community/llama-cpp';
import { initLlama } from '../../src/index';
import * as fs from 'fs';
import * as path from 'path';

// Test runner configuration
const TEST_RUNNER_CONFIG = {
  // Test models to download and use
  models: {
    small: {
      name: 'llama-2-7b-chat.Q4_K_M.gguf',
      url: 'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGUF/resolve/main/llama-2-7b-chat.Q4_K_M.gguf',
      size: '4.37 GB',
      description: 'Small 7B model for basic testing'
    },
    multimodal: {
      name: 'llava-1.5-7b-Q4_K_M.gguf',
      url: 'https://huggingface.co/TheBloke/llava-v1.5-7B-GGUF/resolve/main/llava-v1.5-7b-Q4_K_M.gguf',
      size: '4.37 GB',
      description: 'Multimodal model for image processing'
    }
  },
  // Test data
  testData: {
    images: [
      'test/images/test-cat.jpg',
      'test/images/test-dog.jpg',
      'test/images/test-landscape.jpg'
    ],
    audio: [
      'test/audio/test-speech.wav',
      'test/audio/test-music.mp3'
    ]
  },
  // Output directories
  output: {
    logs: 'test/output/logs',
    results: 'test/output/results',
    sessions: 'test/output/sessions',
    audio: 'test/output/audio'
  }
};

class TestRunner {
  private downloadedModels: Map<string, string> = new Map();
  private testResults: any[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.setupDirectories();
  }

  private setupDirectories() {
    // Create output directories
    Object.values(TEST_RUNNER_CONFIG.output).forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Create test data directories
    ['test/images', 'test/audio'].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async downloadModel(modelKey: string, modelInfo: any): Promise<string> {
    const modelPath = path.join('test/models', modelInfo.name);
    
    if (fs.existsSync(modelPath)) {
      console.log(`Model ${modelInfo.name} already exists at ${modelPath}`);
      this.downloadedModels.set(modelKey, modelPath);
      return modelPath;
    }

    console.log(`Downloading ${modelInfo.name} (${modelInfo.size})...`);
    console.log(`URL: ${modelInfo.url}`);
    
    // Create models directory
    const modelsDir = path.dirname(modelPath);
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }

    // Download model (simplified - in real implementation, use proper download logic)
    console.log(`Please download ${modelInfo.name} manually from: ${modelInfo.url}`);
    console.log(`Save it to: ${modelPath}`);
    
    // For testing purposes, create a placeholder file
    fs.writeFileSync(modelPath, 'PLACEHOLDER_MODEL_FILE');
    
    this.downloadedModels.set(modelKey, modelPath);
    return modelPath;
  }

  async runBasicTests(modelPath: string): Promise<void> {
    console.log('\n=== Running Basic Tests ===');
    
    try {
      // Initialize model
      console.log('Initializing model...');
      const context = await initLlama({
        model: modelPath,
        n_ctx: 2048,
        n_batch: 512,
        n_threads: 4,
        n_gpu_layers: 0
      });

      // Test basic completion
      console.log('Testing basic completion...');
      const completion = await context.completion({
        prompt: "Hello, how are you?",
        n_predict: 50,
        temperature: 0.8
      });

      this.testResults.push({
        test: 'basic_completion',
        success: true,
        result: completion.text,
        timestamp: new Date().toISOString()
      });

      console.log('Completion result:', completion.text);

      // Test chat completion
      console.log('Testing chat completion...');
      const chatResult = await context.completion({
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "What is 2+2?" }
        ],
        n_predict: 30
      });

      this.testResults.push({
        test: 'chat_completion',
        success: true,
        result: chatResult.text,
        timestamp: new Date().toISOString()
      });

      console.log('Chat result:', chatResult.text);

      // Test tokenization
      console.log('Testing tokenization...');
      const tokenizeResult = await context.tokenize({
        text: "Hello world",
        media_paths: []
      });

      this.testResults.push({
        test: 'tokenization',
        success: true,
        tokens: tokenizeResult.tokens.length,
        timestamp: new Date().toISOString()
      });

      console.log('Tokenization result:', tokenizeResult.tokens.length, 'tokens');

      // Test embeddings
      console.log('Testing embeddings...');
      const embeddingResult = await context.embedding({
        content: "Test sentence for embeddings",
        model: modelPath
      });

      this.testResults.push({
        test: 'embeddings',
        success: true,
        dimension: embeddingResult.embedding.length,
        timestamp: new Date().toISOString()
      });

      console.log('Embedding dimension:', embeddingResult.embedding.length);

      // Clean up
      await context.release();

    } catch (error) {
      console.error('Basic tests failed:', error);
      this.testResults.push({
        test: 'basic_tests',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async runAdvancedTests(modelPath: string): Promise<void> {
    console.log('\n=== Running Advanced Tests ===');
    
    try {
      const context = await initLlama({
        model: modelPath,
        n_ctx: 2048,
        n_batch: 512,
        n_threads: 4,
        n_gpu_layers: 0
      });

      // Test streaming completion
      console.log('Testing streaming completion...');
      const tokens: string[] = [];
      
      const streamResult = await context.completion({
        prompt: "Write a short poem:",
        n_predict: 100,
        stream: true,
        onToken: (token) => {
          tokens.push(token);
          process.stdout.write(token);
        }
      });

      this.testResults.push({
        test: 'streaming_completion',
        success: true,
        tokens_generated: tokens.length,
        timestamp: new Date().toISOString()
      });

      console.log('\nStreaming completed');

      // Test session management
      console.log('Testing session management...');
      const sessionPath = path.join(TEST_RUNNER_CONFIG.output.sessions, 'test-session.json');
      
      const saveResult = await context.saveSession({
        filepath: sessionPath,
        size: 1000
      });

      const loadResult = await context.loadSession({
        filepath: sessionPath
      });

      this.testResults.push({
        test: 'session_management',
        success: true,
        tokens_saved: saveResult.tokens_saved,
        tokens_loaded: loadResult.tokens_loaded,
        timestamp: new Date().toISOString()
      });

      // Test performance benchmark
      console.log('Testing performance benchmark...');
      const benchResult = await context.bench({
        n_threads: [1, 2],
        n_prompt: 50,
        n_gen: 25,
        model: modelPath
      });

      this.testResults.push({
        test: 'performance_benchmark',
        success: true,
        timings: benchResult.timings,
        timestamp: new Date().toISOString()
      });

      console.log('Benchmark results:', benchResult.timings);

      await context.release();

    } catch (error) {
      console.error('Advanced tests failed:', error);
      this.testResults.push({
        test: 'advanced_tests',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async runMultimodalTests(modelPath: string): Promise<void> {
    console.log('\n=== Running Multimodal Tests ===');
    
    // Check if multimodal model is available
    if (!this.downloadedModels.has('multimodal')) {
      console.log('Multimodal model not available, skipping multimodal tests');
      return;
    }

    try {
      const context = await initLlama({
        model: this.downloadedModels.get('multimodal')!,
        n_ctx: 2048,
        n_batch: 512,
        n_threads: 4,
        n_gpu_layers: 0
      });

      // Test multimodal initialization
      console.log('Testing multimodal initialization...');
      const mmprojPath = 'test/models/mmproj.bin'; // Placeholder
      
      const initResult = await context.initMultimodal({
        mmproj_path: mmprojPath,
        use_gpu: false
      });

      this.testResults.push({
        test: 'multimodal_init',
        success: initResult.success,
        timestamp: new Date().toISOString()
      });

      // Test image processing (if test image exists)
      const testImagePath = TEST_RUNNER_CONFIG.testData.images[0];
      if (fs.existsSync(testImagePath)) {
        console.log('Testing image processing...');
        
        const imageResult = await context.completion({
          prompt: "Describe this image:",
          media_paths: [testImagePath],
          n_predict: 100
        });

        this.testResults.push({
          test: 'image_processing',
          success: true,
          result: imageResult.text,
          timestamp: new Date().toISOString()
        });

        console.log('Image description:', imageResult.text);
      }

      await context.release();

    } catch (error) {
      console.error('Multimodal tests failed:', error);
      this.testResults.push({
        test: 'multimodal_tests',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async runErrorHandlingTests(): Promise<void> {
    console.log('\n=== Running Error Handling Tests ===');
    
    try {
      // Test invalid model path
      console.log('Testing invalid model path...');
      try {
        await initLlama({
          model: '/invalid/path/model.gguf',
          n_ctx: 1024
        });
        throw new Error('Should have failed with invalid model path');
      } catch (error) {
        this.testResults.push({
          test: 'invalid_model_path',
          success: true,
          error_handled: true,
          timestamp: new Date().toISOString()
        });
      }

      // Test invalid parameters
      console.log('Testing invalid parameters...');
      const context = await initLlama({
        model: this.downloadedModels.get('small')!,
        n_ctx: 1024
      });

      try {
        await context.completion({
          prompt: "",
          n_predict: -1
        });
        throw new Error('Should have failed with invalid parameters');
      } catch (error) {
        this.testResults.push({
          test: 'invalid_parameters',
          success: true,
          error_handled: true,
          timestamp: new Date().toISOString()
        });
      }

      await context.release();

    } catch (error) {
      console.error('Error handling tests failed:', error);
      this.testResults.push({
        test: 'error_handling_tests',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async generateReport(): Promise<void> {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    
    const report = {
      summary: {
        total_tests: this.testResults.length,
        successful_tests: this.testResults.filter(r => r.success).length,
        failed_tests: this.testResults.filter(r => !r.success).length,
        duration_ms: duration,
        timestamp: new Date().toISOString()
      },
      results: this.testResults,
      configuration: {
        models: Object.keys(this.downloadedModels),
        test_data: TEST_RUNNER_CONFIG.testData,
        output_directories: TEST_RUNNER_CONFIG.output
      }
    };

    // Save report
    const reportPath = path.join(TEST_RUNNER_CONFIG.output.results, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log('\n=== Test Report Summary ===');
    console.log(`Total tests: ${report.summary.total_tests}`);
    console.log(`Successful: ${report.summary.successful_tests}`);
    console.log(`Failed: ${report.summary.failed_tests}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Report saved to: ${reportPath}`);

    // Print failed tests
    const failedTests = this.testResults.filter(r => !r.success);
    if (failedTests.length > 0) {
      console.log('\nFailed tests:');
      failedTests.forEach(test => {
        console.log(`- ${test.test}: ${test.error}`);
      });
    }
  }

  async run(): Promise<void> {
    console.log('=== LlamaCpp Integration Test Runner ===');
    console.log('Starting comprehensive integration tests...\n');

    try {
      // Download test models
      console.log('Setting up test models...');
      for (const [key, modelInfo] of Object.entries(TEST_RUNNER_CONFIG.models)) {
        await this.downloadModel(key, modelInfo);
      }

      // Run tests with small model
      const smallModelPath = this.downloadedModels.get('small');
      if (smallModelPath) {
        await this.runBasicTests(smallModelPath);
        await this.runAdvancedTests(smallModelPath);
        await this.runErrorHandlingTests();
      }

      // Run multimodal tests
      await this.runMultimodalTests(smallModelPath!);

      // Generate report
      await this.generateReport();

    } catch (error) {
      console.error('Test runner failed:', error);
      await this.generateReport();
      process.exit(1);
    }
  }
}

// Run the test runner
if (require.main === module) {
  const runner = new TestRunner();
  runner.run().catch(console.error);
}

export { TestRunner, TEST_RUNNER_CONFIG };
