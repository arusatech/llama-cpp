# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

.0.2## [0.0.2] - 2025-08-30

### Added
- Comprehensive API documentation (API_DOCUMENTATION.md)
- Quick reference guide (QUICK_REFERENCE.md)
- Complete TypeScript declarations (types/llama-cpp-capacitor.d.ts)
- Fixed build warnings and improved TypeScript configuration
- Enhanced IDE support with IntelliSense

### Documentation
- Complete API reference with examples
- Platform support matrix
- Performance tips and troubleshooting guide
- TypeScript type safety improvements

## [0.0.1] - 2025-08-29

### Added
- Initial release of CapacitorJS plugin for llama.cpp
- Complete native iOS implementation with Swift and C++ integration
- Complete native Android implementation with Java and JNI
- Web fallback implementation for unsupported features
- Comprehensive TypeScript definitions and interfaces
- Support for text completion (basic and streaming)
- Chat conversation functionality with message formatting
- Tokenization and detokenization
- Embeddings generation
- Session management (save/load conversation states)
- Multimodal support for image processing
- Text-to-Speech (TTS) with vocoder models
- LoRA adapters support (apply, remove, list)
- Performance benchmarking capabilities
- Structured output with JSON Schema support
- Error handling and result types
- Integration testing framework with Jest and custom test runner
- Build automation scripts for native compilation
- Comprehensive documentation (README, TESTING, CONTRIBUTING)

### Technical Features
- Native C++ integration using dlopen/dlsym on iOS
- JNI bridge implementation for Android
- CMake build system for cross-platform compilation
- Event-driven architecture with Capacitor listeners
- Memory management and context handling
- Cross-platform compatibility (iOS, Android, Web)

### Documentation
- Complete API reference
- Installation and setup instructions
- Usage examples and code samples
- Integration testing guide
- Platform-specific build instructions
- Troubleshooting guide

## [Unreleased]

### Planned
- Support for larger models (13B, 70B)
- Enhanced multimodal capabilities
- Real-time audio processing
- Advanced LoRA fine-tuning
- Model quantization optimization
- Performance monitoring and analytics
- Cloud model integration
- Advanced caching mechanisms
