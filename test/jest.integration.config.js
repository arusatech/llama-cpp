module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/integration'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/web.ts'
  ],
  coverageDirectory: 'test/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Test setup and teardown
  setupFilesAfterEnv: ['<rootDir>/integration/setup.ts'],
  
  // Test timeouts
  testTimeout: 60000, // 60 seconds for integration tests
  
  // Verbose output for debugging
  verbose: true,
  
  // Test reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test/output',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ],
  
  // Global test configuration
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },
  
  // Module name mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Test environment variables
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // Collect coverage from specific files
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Test retries for flaky tests
  retryTimes: 1,
  
  // Parallel test execution
  maxWorkers: 1, // Run tests sequentially for integration tests
  
  // Test file patterns
  testFileExtensions: ['ts', 'js'],
  
  // Transform files
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'js', 'json'],
  
  // Test results processor
  testResultsProcessor: 'jest-junit',
  
  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};
