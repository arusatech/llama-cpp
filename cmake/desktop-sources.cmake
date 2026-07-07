# Shared llama.cpp / cap-* source list for desktop sidecar builds.
# Included by sidecar/CMakeLists.txt.

set(ANNADATA_CPP_DIR "${CMAKE_CURRENT_LIST_DIR}/../cpp")

set(ANNADATA_DESKTOP_CORE_SOURCES
    ${ANNADATA_CPP_DIR}/ggml.c
    ${ANNADATA_CPP_DIR}/ggml-alloc.c
    ${ANNADATA_CPP_DIR}/ggml-backend.cpp
    ${ANNADATA_CPP_DIR}/ggml-backend-reg.cpp
    ${ANNADATA_CPP_DIR}/ggml-cpu/amx/amx.cpp
    ${ANNADATA_CPP_DIR}/ggml-cpu/amx/mmq.cpp
    ${ANNADATA_CPP_DIR}/ggml-cpu/ggml-cpu.c
    ${ANNADATA_CPP_DIR}/ggml-cpu/ggml-cpu.cpp
    ${ANNADATA_CPP_DIR}/ggml-cpu/quants.c
    ${ANNADATA_CPP_DIR}/ggml-cpu/traits.cpp
    ${ANNADATA_CPP_DIR}/ggml-cpu/repack.cpp
    ${ANNADATA_CPP_DIR}/ggml-cpu/unary-ops.cpp
    ${ANNADATA_CPP_DIR}/ggml-cpu/binary-ops.cpp
    ${ANNADATA_CPP_DIR}/ggml-cpu/vec.cpp
    ${ANNADATA_CPP_DIR}/ggml-cpu/ops.cpp
    ${ANNADATA_CPP_DIR}/ggml-opt.cpp
    ${ANNADATA_CPP_DIR}/ggml-threading.cpp
    ${ANNADATA_CPP_DIR}/ggml-quants.c
    ${ANNADATA_CPP_DIR}/gguf.cpp
    ${ANNADATA_CPP_DIR}/log.cpp
    ${ANNADATA_CPP_DIR}/llama-impl.cpp
    ${ANNADATA_CPP_DIR}/chat-parser.cpp
    ${ANNADATA_CPP_DIR}/json-partial.cpp
    ${ANNADATA_CPP_DIR}/regex-partial.cpp
    ${ANNADATA_CPP_DIR}/tools/mtmd/mtmd.cpp
    ${ANNADATA_CPP_DIR}/tools/mtmd/mtmd-audio.cpp
    ${ANNADATA_CPP_DIR}/tools/mtmd/clip.cpp
    ${ANNADATA_CPP_DIR}/tools/mtmd/mtmd-helper.cpp
    ${ANNADATA_CPP_DIR}/llama-grammar.cpp
    ${ANNADATA_CPP_DIR}/llama-sampling.cpp
    ${ANNADATA_CPP_DIR}/llama-vocab.cpp
    ${ANNADATA_CPP_DIR}/llama-adapter.cpp
    ${ANNADATA_CPP_DIR}/llama-chat.cpp
    ${ANNADATA_CPP_DIR}/llama-context.cpp
    ${ANNADATA_CPP_DIR}/llama-arch.cpp
    ${ANNADATA_CPP_DIR}/llama-batch.cpp
    ${ANNADATA_CPP_DIR}/llama-cparams.cpp
    ${ANNADATA_CPP_DIR}/llama-hparams.cpp
    ${ANNADATA_CPP_DIR}/llama.cpp
    ${ANNADATA_CPP_DIR}/llama-model.cpp
    ${ANNADATA_CPP_DIR}/llama-model-loader.cpp
    ${ANNADATA_CPP_DIR}/llama-model-saver.cpp
    ${ANNADATA_CPP_DIR}/llama-kv-cache.cpp
    ${ANNADATA_CPP_DIR}/llama-kv-cache-iswa.cpp
    ${ANNADATA_CPP_DIR}/llama-memory-hybrid.cpp
    ${ANNADATA_CPP_DIR}/llama-memory-recurrent.cpp
    ${ANNADATA_CPP_DIR}/llama-mmap.cpp
    ${ANNADATA_CPP_DIR}/llama-memory.cpp
    ${ANNADATA_CPP_DIR}/llama-io.cpp
    ${ANNADATA_CPP_DIR}/llama-graph.cpp
    ${ANNADATA_CPP_DIR}/sampling.cpp
    ${ANNADATA_CPP_DIR}/unicode-data.cpp
    ${ANNADATA_CPP_DIR}/unicode.cpp
    ${ANNADATA_CPP_DIR}/common.cpp
    ${ANNADATA_CPP_DIR}/chat.cpp
    ${ANNADATA_CPP_DIR}/json-schema-to-grammar.cpp
    ${ANNADATA_CPP_DIR}/anyascii.c
    ${ANNADATA_CPP_DIR}/cap-llama.cpp
    ${ANNADATA_CPP_DIR}/cap-completion.cpp
    ${ANNADATA_CPP_DIR}/cap-tts.cpp
    ${ANNADATA_CPP_DIR}/cap-embedding.cpp
    ${ANNADATA_CPP_DIR}/cap-ios-bridge.cpp
    ${ANNADATA_CPP_DIR}/cap-native-server.cpp
    ${ANNADATA_CPP_DIR}/vendor/cpp-httplib/httplib.cpp
)

# Architecture-specific CPU kernels
set(_DESKTOP_IS_ARM64 OFF)
if(APPLE)
    if(CMAKE_OSX_ARCHITECTURES MATCHES "arm64")
        set(_DESKTOP_IS_ARM64 ON)
    elseif(NOT CMAKE_OSX_ARCHITECTURES OR CMAKE_OSX_ARCHITECTURES STREQUAL "")
        execute_process(COMMAND uname -m OUTPUT_VARIABLE _UNAME_M OUTPUT_STRIP_TRAILING_WHITESPACE)
        if(_UNAME_M STREQUAL "arm64")
            set(_DESKTOP_IS_ARM64 ON)
        endif()
    endif()
elseif(CMAKE_SYSTEM_PROCESSOR MATCHES "aarch64|arm64|ARM64")
    set(_DESKTOP_IS_ARM64 ON)
endif()

if(_DESKTOP_IS_ARM64)
    list(APPEND ANNADATA_DESKTOP_CORE_SOURCES
        ${ANNADATA_CPP_DIR}/ggml-cpu/arch/arm/quants.c
        ${ANNADATA_CPP_DIR}/ggml-cpu/arch/arm/repack.cpp
        ${ANNADATA_CPP_DIR}/ggml-cpu/arch/arm/cpu-feats.cpp
    )
else()
    list(APPEND ANNADATA_DESKTOP_CORE_SOURCES
        ${ANNADATA_CPP_DIR}/ggml-cpu/arch/x86/quants.c
        ${ANNADATA_CPP_DIR}/ggml-cpu/arch/x86/repack.cpp
        ${ANNADATA_CPP_DIR}/ggml-cpu/arch/x86/cpu-feats.cpp
    )
endif()
