# LlamaCpp Capacitor Plugin - Complete API Documentation Index

**Documentation Version:** 1.0.0  
**Last Updated:** July 2, 2026  
**Coverage:** All 37+ Plugin Methods Across 3 Platforms

---

## Overview

This index provides comprehensive API documentation for the LlamaCpp Capacitor plugin across all three major platforms: iOS, Android, and PWA/Web. Each platform has complete examples with working code samples for every available method.

**Total Documentation:**
- iOS API: 1,268 lines (25 KB)
- Android API: 2,444 lines (62 KB) - Comprehensive Java/Kotlin examples
- PWA API: 1,540 lines (35 KB) - TypeScript/JavaScript with React/Vue
- **Combined: 5,252 lines (~122 KB)**

---

## Documentation Files

### 1. **iOS_API.md** - Swift/Objective-C Implementation
📱 **File:** `docs/IOS_API.md`

**Coverage:**
- Quick Start with Xcode setup
- Complete initialization examples
- All 37 plugin methods with Swift examples
- GPU acceleration (Metal)
- Thread safety patterns
- Complete ChatBot example application
- Performance optimization tips

**Best For:** iOS app developers using Swift or Objective-C

**Key Sections:**
- Installation & Setup
- Core API Methods (5 methods)
- Context Management (6 methods)
- Chat & Conversations (4 methods)
- Embeddings & Reranking (2 methods)
- LoRA Adapters (3 methods)
- Multimodal Processing (5 methods)
- Text-to-Speech (7 methods)
- Session Management (2 methods)
- Advanced Topics (JSON Schema, Benchmarking, Speculative Decoding)

---

### 2. **ANDROID_API.md** - Java/Kotlin Implementation
🤖 **File:** `docs/ANDROID_API.md`

**Coverage:**
- Gradle build configuration
- AndroidManifest permissions
- Both Java and Kotlin examples for every method
- Multi-architecture support (arm64-v8a, armeabi-v7a, x86, x86_64)
- Qualcomm Adreno GPU acceleration
- Android-specific thread patterns (Threading, Coroutines)
- Background task execution
- Storage path guidance
- Complete MainActivity examples (Java & Kotlin)

**Best For:** Android developers using Java or Kotlin

**Key Sections:**
- Installation & Setup (Gradle configuration)
- Core API Methods (5 methods)
- Context Management (6 methods)
- Chat & Conversations (4 methods)
- Embeddings & Reranking (2 methods)
- LoRA Adapters (3 methods)
- Multimodal Processing (5 methods)
- Text-to-Speech (7 methods)
- Session Management (2 methods)
- Tokenization (2 methods)
- Android-Specific Features (GPU, Workers, Downloads, Benchmarking)
- Complete Application Example (MainActivity)

---

### 3. **PWA_API.md** - TypeScript/JavaScript Implementation
🌐 **File:** `docs/PWA_API.md`

**Coverage:**
- HTML/Browser setup with CORP/COEP headers
- TypeScript and JavaScript examples
- React and Vue component examples
- Web Worker integration (Dedicated & Shared)
- Service Worker for offline support
- OPFS (Origin Private File System) for model caching
- Vite and Webpack configuration
- Cross-browser compatibility matrix
- Docker deployment guide

**Best For:** Web/PWA developers using React, Vue, or vanilla JavaScript

**Key Sections:**
- Installation & Setup (Browser configuration)
- Core Concepts (Web Provider, Model Scheduler, OPFS)
- Core API Methods (5 methods)
- Context Management (6 methods)
- Chat & Conversations (4 methods)
- Embeddings & Reranking (2 methods)
- LoRA Adapters (3 methods)
- Multimodal Processing (5 methods)
- Text-to-Speech (7 methods)
- Session Management (2 methods)
- Storage & OPFS (Model caching)
- Web Worker Integration
- Service Worker Integration
- Complete React & Vue Examples

---

## Quick Navigation

### By Task

#### **Initialize a Model**
- iOS: [initLlama()](#ios-initiallama) - See IOS_API.md
- Android: [initContext()](#android-initcontext) - See ANDROID_API.md
- Web: [initLlama()](#web-initiallama) - See PWA_API.md

#### **Generate Text**
- iOS: [completion()](#ios-completion) - See IOS_API.md
- Android: [completion()](#android-completion) - See ANDROID_API.md
- Web: [completion()](#web-completion) - See PWA_API.md

#### **Chat/Conversation**
- iOS: [chat()](#ios-chat) - See IOS_API.md
- Android: [chat()](#android-chat) - See ANDROID_API.md
- Web: [chat()](#web-chat) - See PWA_API.md

#### **Embeddings**
- iOS: [embedding()](#ios-embedding) - See IOS_API.md
- Android: [embedding()](#android-embedding) - See ANDROID_API.md
- Web: [embedding()](#web-embedding) - See PWA_API.md

#### **Vision/Multimodal**
- iOS: [initMultimodal()](#ios-multimodal) - See IOS_API.md
- Android: [initMultimodal()](#android-multimodal) - See ANDROID_API.md
- Web: [initMultimodal()](#web-multimodal) - See PWA_API.md

#### **Text-to-Speech**
- iOS: [initVocoder()](#ios-vocoder) - See IOS_API.md
- Android: [initVocoder()](#android-vocoder) - See ANDROID_API.md
- Web: [initVocoder()](#web-vocoder) - See PWA_API.md

### By Platform

#### **iOS Developers**
Start here: `docs/IOS_API.md`
- Quick Start section for setup
- Core API Methods for basic usage
- GPU Acceleration section for performance
- Advanced Topics for optimization

#### **Android Developers**
Start here: `docs/ANDROID_API.md`
- Installation & Setup section (includes Gradle config)
- Android-Specific Features for GPU and threading
- Complete MainActivity examples
- Troubleshooting section

#### **Web/PWA Developers**
Start here: `docs/PWA_API.md`
- Installation & Setup section (browser config)
- Core Concepts for WASM/Worker architecture
- Web Worker Integration for background processing
- Complete React/Vue examples

---

## API Methods Reference

### Complete Method List (37 Methods)

| Category | Method | iOS | Android | Web | Notes |
|----------|--------|-----|---------|-----|-------|
| **Core** | initLlama() | ✅ | ✅ | ✅ | Initialize model |
| | releaseAllLlama() | ✅ | ✅ | ✅ | Release all contexts |
| | modelInfo() | ✅ | ✅ | ✅ | Get model metadata |
| | toggleNativeLog() | ✅ | ✅ | ✅ | Enable/disable logging |
| | addNativeLogListener() | ✅ | ✅ | ✅ | Listen to logs |
| **Generation** | completion() | ✅ | ✅ | ✅ | Generate text |
| | chat() | ✅ | ✅ | ✅ | Chat interface |
| | chatWithSystem() | ✅ | ✅ | ✅ | Simple system chat |
| | generateText() | ✅ | ✅ | ✅ | Simple generation |
| | getFormattedChat() | ✅ | ✅ | ✅ | Format messages |
| **Embeddings** | embedding() | ✅ | ✅ | ✅ | Generate embeddings |
| | rerank() | ✅ | ✅ | ✅ | Rank documents |
| **LoRA** | applyLoraAdapters() | ✅ | ✅ | ✅ | Apply adapters |
| | removeLoraAdapters() | ✅ | ✅ | ✅ | Remove adapters |
| | getLoadedLoraAdapters() | ✅ | ✅ | ✅ | List adapters |
| **Multimodal** | initMultimodal() | ✅ | ✅ | ✅ | Initialize vision |
| | isMultimodalEnabled() | ✅ | ✅ | ✅ | Check status |
| | getMultimodalSupport() | ✅ | ✅ | ✅ | Check capabilities |
| | releaseMultimodal() | ✅ | ✅ | ✅ | Release vision |
| **TTS** | initVocoder() | ✅ | ✅ | ✅ | Initialize TTS |
| | getFormattedAudioCompletion() | ✅ | ✅ | ✅ | Prepare audio |
| | getAudioCompletionGuideTokens() | ✅ | ✅ | ✅ | Get guide tokens |
| | decodeAudioTokens() | ✅ | ✅ | ✅ | Decode audio |
| | releaseVocoder() | ✅ | ✅ | ✅ | Release TTS |
| **Sessions** | saveSession() | ✅ | ✅ | ✅ | Save state |
| | loadSession() | ✅ | ✅ | ✅ | Restore state |
| **Tokenization** | tokenize() | ✅ | ✅ | ✅ | Tokenize text |
| | detokenize() | ✅ | ✅ | ✅ | Tokens to text |
| **Benchmark** | bench() | ✅ | ✅ | ✅ | Benchmark performance |
| **Utilities** | convertJsonSchemaToGrammar() | ✅ | ✅ | ✅ | JSON schema to GBNF |
| | setContextLimit() | ✅ | ✅ | ✅ | Set context limit |
| | downloadModel() | - | ✅ | ✅ | Download model |
| | getDownloadProgress() | - | ✅ | ✅ | Check download |
| | cancelDownload() | - | ✅ | ✅ | Cancel download |
| | getAvailableModels() | - | ✅ | ✅ | List available |
| | startNativeLlamaServer() | - | - | ✅ | Start HTTP server |
| | stopNativeLlamaServer() | - | - | ✅ | Stop HTTP server |

---

## Code Example Counts

### iOS API Examples
- Core Methods: 8 examples
- Context Management: 10 examples
- Embeddings/Reranking: 4 examples
- LoRA Adapters: 6 examples
- Multimodal: 6 examples
- Text-to-Speech: 8 examples
- Session Management: 2 examples
- Error Handling: 5 examples
- Advanced Topics: 8 examples
- Complete App: 1 full application
- **Total: 58 working examples**

### Android API Examples
- Core Methods: 12 examples (Java & Kotlin)
- Context Management: 12 examples (Java & Kotlin)
- Embeddings/Reranking: 4 examples (Java & Kotlin)
- LoRA Adapters: 8 examples (Java & Kotlin)
- Multimodal: 8 examples (Java & Kotlin)
- Text-to-Speech: 12 examples (Java & Kotlin)
- Session Management: 4 examples (Java & Kotlin)
- Tokenization: 4 examples (Java & Kotlin)
- Error Handling: 4 examples (Java & Kotlin)
- Android-Specific: 8 examples (Java & Kotlin)
- Complete App: 2 full applications (Java & Kotlin)
- **Total: 76 working examples (38 Java + 38 Kotlin)**

### Web/PWA API Examples
- Core Methods: 10 examples (TS & JS)
- Context Management: 12 examples (TS & JS)
- Embeddings/Reranking: 6 examples (TS & JS)
- LoRA Adapters: 6 examples (TS & JS)
- Multimodal: 4 examples (TS & JS)
- Text-to-Speech: 6 examples (TS & JS)
- Session Management: 4 examples (TS & JS)
- Storage/OPFS: 4 examples
- Web Workers: 4 examples
- Service Workers: 1 example
- Complete Apps: 2 (React + Vue)
- **Total: 59 working examples**

---

## How to Use This Documentation

### 1. **For API Method Lookup**
Find the method in the table above, then go to the corresponding platform file for complete examples.

### 2. **For Platform-Specific Setup**
- iOS → Go to **IOS_API.md** → Installation & Setup
- Android → Go to **ANDROID_API.md** → Installation & Setup
- Web → Go to **PWA_API.md** → Installation & Setup

### 3. **For Complete Example**
- iOS → See "Complete Example Application" section in IOS_API.md
- Android → See "Complete Example Application" section in ANDROID_API.md
- Web → See "Complete Example Application" section in PWA_API.md

### 4. **For Specific Features**
- Multimodal (Vision) → Search each file for "Multimodal Processing" section
- Text-to-Speech → Search each file for "Text-to-Speech" section
- LoRA Adapters → Search each file for "LoRA Adapters" section
- Embeddings → Search each file for "Embeddings & Reranking" section

### 5. **For Performance Optimization**
- iOS → "Performance Tips" section in IOS_API.md
- Android → "Performance Tips" section in ANDROID_API.md
- Web → "Performance Tips" section in PWA_API.md

### 6. **For Error Handling**
- Each platform has dedicated "Error Handling" section with specific error patterns

---

## Code Examples by Language

### Swift/Objective-C (iOS)
- Location: IOS_API.md
- Count: 58 examples
- Focus: Metal GPU, Core Foundation integration

### Java (Android)
- Location: ANDROID_API.md
- Count: 38 examples
- Focus: JNI, Adreno GPU, Threading

### Kotlin (Android)
- Location: ANDROID_API.md
- Count: 38 examples
- Focus: Coroutines, Modern Kotlin patterns

### TypeScript (Web)
- Location: PWA_API.md
- Count: 30+ examples
- Focus: Type safety, React/Vue integration

### JavaScript (Web)
- Location: PWA_API.md
- Count: 29+ examples
- Focus: Browser APIs, WASM, Web Workers

---

## Documentation Structure Consistency

Each platform API document follows this consistent structure:

1. **Quick Start** - Minimal working example
2. **Installation & Setup** - Platform-specific setup
3. **Core API Methods** - Basic methods with examples
4. **Context Management** - Text generation methods
5. **Chat & Conversations** - Dialogue methods
6. **Embeddings & Reranking** - Vector operations
7. **LoRA Adapters** - Fine-tuning methods
8. **Multimodal Processing** - Vision methods
9. **Text-to-Speech** - Audio generation
10. **Session Management** - State persistence
11. **Error Handling** - Exception patterns
12. **Advanced Topics/Platform Features** - Optimization and platform-specific features
13. **Complete Example Application** - Full working app
14. **Common Patterns** - Reusable code patterns
15. **Performance Tips** - Optimization guide
16. **API Reference Table** - Quick lookup

---

## Related Documentation

For architectural details, see:
- **IOS_LLD.md** - iOS architectural deep-dive
- **ANDROID_LLD.md** - Android architectural deep-dive
- **PWA_LLD.md** - Web architectural deep-dive
- **LLD_SUMMARY.md** - Cross-platform comparison

---

## Version Information

- **Plugin Version:** 1.0.0
- **Documentation Date:** July 2, 2026
- **Last Updated:** July 2, 2026
- **API Methods Covered:** 37+
- **Platform Support:** iOS 13.0+, Android 5.0+, Modern Browsers
- **Languages Covered:** Swift, Objective-C, Java, Kotlin, TypeScript, JavaScript

---

## Getting Help

### If you need...

**...to understand a specific API method:**
1. Find the method in the table above
2. Go to the corresponding platform API file
3. Search for the method name (usually a section header)
4. Review the examples provided

**...platform-specific guidance:**
1. Go to the appropriate platform API file (IOS_API.md, ANDROID_API.md, or PWA_API.md)
2. Read the "Android-Specific Features" or equivalent section

**...a complete working example:**
1. Go to the "Complete Example Application" section in your platform API file
2. Copy the entire class/component
3. Adjust model paths and API endpoints for your use case

**...performance optimization:**
1. Review the "Performance Tips" section in your platform API file
2. Check the "Advanced Topics" section for optimization techniques
3. Use the benchmarking examples to measure improvements

---

## Conclusion

This comprehensive API documentation provides everything needed to integrate LlamaCpp inference into applications across iOS, Android, and Web platforms. Every method is documented with working examples, error handling patterns, and platform-specific optimization guidance.

**Total Coverage:** 5,252 lines of documentation with 193+ working code examples across all three platforms.
