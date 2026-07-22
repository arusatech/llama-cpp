# llama-cpp-pro

[![Actions Status](https://github.com/arusatech/llama-cpp-pro/workflows/CI/badge.svg)](https://github.com/arusatech/llama-cpp-pro/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/llama-cpp-pro.svg)](https://www.npmjs.com/package/llama-cpp-pro/)
[![Support: ANNADATA.AI](https://img.shields.io/badge/AI-ANNADATA.AI-orange.svg)](https://annadata.ai/)
[![Principal Engineer / Architect: Mr. Yakub Mohammad](https://img.shields.io/badge/Principal%20Architect-Mr.%20Yakub%20Mohammad-blue.svg)](https://annadata.ai/)

A native Capacitor plugin that embeds [llama.cpp](https://github.com/ggerganov/llama.cpp) directly into mobile apps, enabling offline AI inference with comprehensive support for text generation, multimodal processing, TTS, LoRA adapters, and more.

[Annadata.ai](https://annadata.ai): Inference of [LLaMA](https://arxiv.org/abs/2302.13971) model in pure C/C++ used in [Annadata.ai](https://annadata.ai)

## 🚀 Features

- **Offline AI Inference**: Run large language models completely offline on mobile devices
- **Text Generation**: Complete text completion with streaming support
- **Chat Conversations**: Multi-turn conversations with context management
- **Multimodal Support**: Process images and audio alongside text
- **Text-to-Speech (TTS)**: Generate speech from text using vocoder models
- **LoRA Adapters**: Fine-tune models with LoRA adapters
- **Embeddings**: Generate vector embeddings for semantic search
- **Reranking**: Rank documents by relevance to queries
- **Session Management**: Save and load conversation states
- **Benchmarking**: Performance testing and optimization tools
- **Structured Output**: Generate JSON with schema validation
- **Cross-Platform**: iOS, Android, **Web/PWA**, and **Desktop** (Windows, macOS, Linux) with native optimizations



## 📱 Platform Support


| Feature            | iOS   | Android    | Web (PWA) | Desktop                |
| ------------------ | ----- | ---------- | --------- | ---------------------- |
| Text Generation    | ✅     | ✅          | ✅         | ✅                      |
| Chat Conversations | ✅     | ✅          | ✅         | ✅                      |
| Streaming          | ✅     | ✅          | ✅         | ✅¹                     |
| Multimodal         | ✅     | ✅          | ✅²        | ✅                      |
| TTS                | ✅     | ✅          | ✅²        | ✅                      |
| LoRA Adapters      | ✅     | ✅          | ✅²        | ✅                      |
| Embeddings         | ✅     | ✅          | ✅         | ✅                      |
| Reranking          | ✅     | ✅          | ✅³        | ✅                      |
| Session Management | ✅     | ✅          | ✅⁴        | ✅                      |
| Benchmarking       | ✅     | ✅          | ✅         | ✅                      |
| GPU Acceleration   | Metal | CPU/Adreno | —         | Vulkan/CUDA/ROCm/Metal |


¹ **Desktop:** SSE streaming from the native sidecar (`/v1/chat/completions`, `/v1/completions` with `stream: true`).  
² **Web:** auxiliary GGUF files must be staged in WASM VFS.  
³ **Web:** requires rank-pooling embedding model.  
⁴ **Web:** sessions persist in worker MEMFS for tab lifetime.

---

## Builds

```bash
# iOS + Android + PWA (npm release / Capacitor)
./build-variants.sh --variant minimal

# iOS only / Android only
./build-variants.sh --variant ios-only
./build-variants.sh --variant android-only

# Desktop / Electron (macOS universal sidecar: arm64 + x64)
./build-variants.sh --variant desktop
./build-variants.sh --variant minimal --with-desktop --desktop-arch=universal
```

See [BUILD_GUIDE.md](BUILD_GUIDE.md) and [README_BUILD_SYSTEM.md](README_BUILD_SYSTEM.md) for full build, API, and troubleshooting details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [llama.cpp](https://github.com/ggerganov/llama.cpp) - The core inference engine
- [Capacitor](https://capacitorjs.com/) - The cross-platform runtime
- [Annadata.ai](https://annadata.ai) - Complete system developed and powered by [npm](https://www.npmjs.com/package/llama-cpp-pro/)



## 📞 Support

- 📧 Email: [support@arusatech.com](mailto:support@arusatech.com) ; [yakub@annadata.ai](mailto:yakub@annadata.ai)
- 🐛 Issues: [GitHub Issues](https://github.com/arusatech/llama-cpp-pro/issues)
- 📖 Documentation: [GitHub Wiki](https://github.com/arusatech/llama-cpp-pro/wiki)

