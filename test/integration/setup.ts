import { LlamaCpp } from '@capacitor-community/llama-cpp';
import * as fs from 'fs';
import * as path from 'path';

// Global test configuration
declare global {
  namespace NodeJS {
    interface Global {
      TEST_CONFIG: {
        models: {
          small: string;
          multimodal: string;
        };
        output: {
          logs: string;
          results: string;
          sessions: string;
          audio: string;
        };
        timeouts: {
          modelLoad: number;
          completion: number;
          embedding: number;
          tts: number;
        };
      };
    }
  }
}

// Test configuration
global.TEST_CONFIG = {
  models: {
    small: process.env.TEST_MODEL_SMALL || 'test/models/llama-2-7b-chat.Q4_K_M.gguf',
    multimodal: process.env.TEST_MODEL_MULTIMODAL || 'test/models/llava-1.5-7b-Q4_K_M.gguf'
  },
  output: {
    logs: 'test/output/logs',
    results: 'test/output/results',
    sessions: 'test/output/sessions',
    audio: 'test/output/audio'
  },
  timeouts: {
    modelLoad: parseInt(process.env.TEST_TIMEOUT_MODEL_LOAD || '30000'),
    completion: parseInt(process.env.TEST_TIMEOUT_COMPLETION || '15000'),
    embedding: parseInt(process.env.TEST_TIMEOUT_EMBEDDING || '10000'),
    tts: parseInt(process.env.TEST_TIMEOUT_TTS || '20000')
  }
};

// Setup function - runs before all tests
beforeAll(async () => {
  console.log('=== Setting up LlamaCpp Integration Tests ===');
  
  // Create output directories
  Object.values(global.TEST_CONFIG.output).forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Enable native logging for debugging
  try {
    await LlamaCpp.toggleNativeLog({ enabled: true });
    console.log('Native logging enabled');
  } catch (error) {
    console.warn('Failed to enable native logging:', error);
  }
  
  // Set context limit for testing
  try {
    await LlamaCpp.setContextLimit({ limit: 5 });
    console.log('Context limit set to 5');
  } catch (error) {
    console.warn('Failed to set context limit:', error);
  }
  
  // Check if test models exist
  const modelPaths = Object.values(global.TEST_CONFIG.models);
  for (const modelPath of modelPaths) {
    if (fs.existsSync(modelPath)) {
      console.log(`✓ Test model found: ${modelPath}`);
    } else {
      console.warn(`⚠ Test model not found: ${modelPath}`);
      console.warn(`  Please download the model and place it at: ${modelPath}`);
    }
  }
  
  console.log('Test setup completed');
}, 30000);

// Teardown function - runs after all tests
afterAll(async () => {
  console.log('=== Cleaning up LlamaCpp Integration Tests ===');
  
  try {
    // Release all contexts
    await LlamaCpp.releaseAllContexts();
    console.log('All contexts released');
  } catch (error) {
    console.warn('Failed to release contexts:', error);
  }
  
  try {
    // Disable native logging
    await LlamaCpp.toggleNativeLog({ enabled: false });
    console.log('Native logging disabled');
  } catch (error) {
    console.warn('Failed to disable native logging:', error);
  }
  
  console.log('Test cleanup completed');
}, 10000);

// Global test utilities
export const testUtils = {
  // Wait for a specified time
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Generate random test data
  generateRandomText: (length: number = 100) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
  
  // Create test image file
  createTestImage: (filePath: string, width: number = 100, height: number = 100) => {
    // Create a simple test image (placeholder)
    const testImageData = Buffer.alloc(width * height * 3);
    for (let i = 0; i < testImageData.length; i += 3) {
      testImageData[i] = 255;     // Red
      testImageData[i + 1] = 0;   // Green
      testImageData[i + 2] = 0;   // Blue
    }
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, testImageData);
    return filePath;
  },
  
  // Create test audio file
  createTestAudio: (filePath: string, duration: number = 1) => {
    // Create a simple test audio file (placeholder)
    const sampleRate = 44100;
    const samples = duration * sampleRate;
    const audioData = Buffer.alloc(samples * 2); // 16-bit audio
    
    for (let i = 0; i < samples; i++) {
      const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 32767; // 440Hz sine wave
      audioData.writeInt16LE(sample, i * 2);
    }
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, audioData);
    return filePath;
  },
  
  // Clean up test files
  cleanupTestFiles: (filePaths: string[]) => {
    filePaths.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  },
  
  // Validate model file
  validateModelFile: (modelPath: string): boolean => {
    if (!fs.existsSync(modelPath)) {
      return false;
    }
    
    const stats = fs.statSync(modelPath);
    const fileSize = stats.size;
    
    // Check if file is reasonably sized (at least 1MB for a GGUF model)
    if (fileSize < 1024 * 1024) {
      return false;
    }
    
    // Check file extension
    if (!modelPath.endsWith('.gguf')) {
      return false;
    }
    
    return true;
  },
  
  // Log test results
  logTestResult: (testName: string, success: boolean, details?: any) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      test: testName,
      success,
      timestamp,
      details
    };
    
    const logPath = path.join(global.TEST_CONFIG.output.logs, 'test-results.json');
    let logs = [];
    
    if (fs.existsSync(logPath)) {
      try {
        logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      } catch (error) {
        logs = [];
      }
    }
    
    logs.push(logEntry);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    
    console.log(`[${timestamp}] ${testName}: ${success ? 'PASS' : 'FAIL'}`);
  },
  
  // Performance measurement
  measurePerformance: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const startTime = process.hrtime.bigint();
    const result = await fn();
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    console.log(`Performance [${name}]: ${duration.toFixed(2)}ms`);
    
    // Log performance data
    const perfLogPath = path.join(global.TEST_CONFIG.output.logs, 'performance.json');
    let perfLogs = [];
    
    if (fs.existsSync(perfLogPath)) {
      try {
        perfLogs = JSON.parse(fs.readFileSync(perfLogPath, 'utf8'));
      } catch (error) {
        perfLogs = [];
      }
    }
    
    perfLogs.push({
      name,
      duration,
      timestamp: new Date().toISOString()
    });
    
    fs.writeFileSync(perfLogPath, JSON.stringify(perfLogs, null, 2));
    
    return result;
  }
};

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Export test utilities for use in tests
export default testUtils;
