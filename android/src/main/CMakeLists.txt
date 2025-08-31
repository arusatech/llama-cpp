cmake_minimum_required(VERSION 3.10)

project(llama-cpp)

set(CMAKE_CXX_STANDARD 17)
set(LLAMACPP_LIB_DIR ${CMAKE_SOURCE_DIR}/../../../cpp)

include_directories(
    ${LLAMACPP_LIB_DIR}
    ${LLAMACPP_LIB_DIR}/ggml-cpu
    ${LLAMACPP_LIB_DIR}/tools/mtmd
)

set(
    SOURCE_FILES
    ${LLAMACPP_LIB_DIR}/ggml.c
    ${LLAMACPP_LIB_DIR}/ggml-alloc.c
    ${LLAMACPP_LIB_DIR}/ggml-backend.cpp
    ${LLAMACPP_LIB_DIR}/ggml-backend-reg.cpp
    ${LLAMACPP_LIB_DIR}/ggml-cpu/amx/amx.cpp
    ${LLAMACPP_LIB_DIR}/ggml-cpu/amx/mmq.cpp
    ${LLAMACPP_LIB_DIR}/ggml-cpu/ggml-cpu.c
    ${LLAMACPP_LIB_DIR}/ggml-cpu/ggml-cpu.cpp
    ${LLAMACPP_LIB_DIR}/ggml-cpu/quants.c
    ${LLAMACPP_LIB_DIR}/ggml-cpu/traits.cpp
    ${LLAMACPP_LIB_DIR}/ggml-cpu/repack.cpp
    ${LLAMACPP_LIB_DIR}/ggml-cpu/unary-ops.cpp
    ${LLAMACPP_LIB_DIR}/ggml-cpu/binary-ops.cpp
    ${LLAMACPP_LIB_DIR}/ggml-cpu/vec.cpp
    ${LLAMACPP_LIB_DIR}/ggml-cpu/ops.cpp
    ${LLAMACPP_LIB_DIR}/ggml-opt.cpp
    ${LLAMACPP_LIB_DIR}/ggml-threading.cpp
    ${LLAMACPP_LIB_DIR}/ggml-quants.c
    ${LLAMACPP_LIB_DIR}/gguf.cpp
    ${LLAMACPP_LIB_DIR}/log.cpp
    ${LLAMACPP_LIB_DIR}/llama-impl.cpp
    ${LLAMACPP_LIB_DIR}/chat-parser.cpp
    ${LLAMACPP_LIB_DIR}/json-partial.cpp
    ${LLAMACPP_LIB_DIR}/regex-partial.cpp
    # Multimodal support
    ${LLAMACPP_LIB_DIR}/tools/mtmd/mtmd.cpp
    ${LLAMACPP_LIB_DIR}/tools/mtmd/mtmd-audio.cpp
    ${LLAMACPP_LIB_DIR}/tools/mtmd/clip.cpp
    ${LLAMACPP_LIB_DIR}/tools/mtmd/mtmd-helper.cpp
    ${LLAMACPP_LIB_DIR}/llama-grammar.cpp
    ${LLAMACPP_LIB_DIR}/llama-sampling.cpp
    ${LLAMACPP_LIB_DIR}/llama-vocab.cpp
    ${LLAMACPP_LIB_DIR}/llama-adapter.cpp
    ${LLAMACPP_LIB_DIR}/llama-chat.cpp
    ${LLAMACPP_LIB_DIR}/llama-context.cpp
    ${LLAMACPP_LIB_DIR}/llama-arch.cpp
    ${LLAMACPP_LIB_DIR}/llama-batch.cpp
    ${LLAMACPP_LIB_DIR}/llama-cparams.cpp
    ${LLAMACPP_LIB_DIR}/llama-hparams.cpp
    ${LLAMACPP_LIB_DIR}/llama.cpp
    ${LLAMACPP_LIB_DIR}/llama-model.cpp
    ${LLAMACPP_LIB_DIR}/llama-model-loader.cpp
    ${LLAMACPP_LIB_DIR}/llama-model-saver.cpp
    ${LLAMACPP_LIB_DIR}/llama-kv-cache.cpp
    ${LLAMACPP_LIB_DIR}/llama-kv-cache-iswa.cpp
    ${LLAMACPP_LIB_DIR}/llama-memory-hybrid.cpp
    ${LLAMACPP_LIB_DIR}/llama-memory-recurrent.cpp
    ${LLAMACPP_LIB_DIR}/llama-mmap.cpp
    ${LLAMACPP_LIB_DIR}/llama-vocab.cpp
    ${LLAMACPP_LIB_DIR}/llama-memory.cpp
    ${LLAMACPP_LIB_DIR}/llama-io.cpp
    ${LLAMACPP_LIB_DIR}/llama-graph.cpp
    ${LLAMACPP_LIB_DIR}/sampling.cpp
    ${LLAMACPP_LIB_DIR}/unicode-data.cpp
    ${LLAMACPP_LIB_DIR}/unicode.cpp
    ${LLAMACPP_LIB_DIR}/common.cpp
    ${LLAMACPP_LIB_DIR}/chat.cpp
    ${LLAMACPP_LIB_DIR}/json-schema-to-grammar.cpp
    ${LLAMACPP_LIB_DIR}/nlohmann/json.hpp
    ${LLAMACPP_LIB_DIR}/nlohmann/json_fwd.hpp
    ${LLAMACPP_LIB_DIR}/minja/minja.hpp
    ${LLAMACPP_LIB_DIR}/minja/chat-template.hpp
    ${LLAMACPP_LIB_DIR}/anyascii.c
    ${LLAMACPP_LIB_DIR}/rn-llama.cpp
    ${LLAMACPP_LIB_DIR}/rn-completion.cpp
    ${LLAMACPP_LIB_DIR}/rn-tts.cpp
    ${CMAKE_SOURCE_DIR}/jni-utils.h
    ${CMAKE_SOURCE_DIR}/jni.cpp
)

find_library(LOG_LIB log)

function(build_library target_name arch cpu_flags)
    set(SOURCE_FILES_ARCH "")
    # For now, use generic implementation for all architectures
    # This ensures we have all required functions

    add_library(
        ${target_name}
        SHARED
        ${SOURCE_FILES}
        ${SOURCE_FILES_ARCH}
    )

    target_compile_options(${target_name} PRIVATE ${cpu_flags})
    target_link_libraries(${target_name} ${LOG_LIB})

    set_target_properties(${target_name} PROPERTIES
        LIBRARY_OUTPUT_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}
    )
endfunction()

# Build for different architectures - use generic name for Java compatibility
if (ANDROID_ABI STREQUAL "arm64-v8a")
    build_library(llama-cpp "arm" "-march=armv8-a")
elseif (ANDROID_ABI STREQUAL "armeabi-v7a")
    build_library(llama-cpp "arm" "-march=armv7-a -mfpu=neon")
elseif (ANDROID_ABI STREQUAL "x86")
    build_library(llama-cpp "x86" "-march=i686 -mtune=intel -mssse3 -mfpmath=sse -m32")
elseif (ANDROID_ABI STREQUAL "x86_64")
    build_library(llama-cpp "x86" "-march=x86-64 -msse4.2 -mpopcnt -m64 -mtune=intel")
endif()

# Set compile definitions for the target that was actually built
if (ANDROID_ABI STREQUAL "arm64-v8a")
    target_compile_definitions(llama-cpp PRIVATE
        -DNDEBUG
        -DO3
        -DLM_GGML_USE_CPU
        -DLM_GGML_CPU_GENERIC
    )
elseif (ANDROID_ABI STREQUAL "armeabi-v7a")
    target_compile_definitions(llama-cpp PRIVATE
        -DNDEBUG
        -DO3
        -DLM_GGML_USE_CPU
        -DLM_GGML_CPU_GENERIC
    )
elseif (ANDROID_ABI STREQUAL "x86")
    target_compile_definitions(llama-cpp PRIVATE
        -DNDEBUG
        -DO3
        -DLM_GGML_USE_CPU
        -DLM_GGML_CPU_GENERIC
    )
elseif (ANDROID_ABI STREQUAL "x86_64")
    target_compile_definitions(llama-cpp PRIVATE
        -DNDEBUG
        -DO3
        -DLM_GGML_USE_CPU
        -DLM_GGML_CPU_GENERIC
    )
endif()
