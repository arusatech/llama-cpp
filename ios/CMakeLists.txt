cmake_minimum_required(VERSION 3.16)
project(llama-cpp VERSION 1.0.0 LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# iOS specific settings
set(CMAKE_OSX_DEPLOYMENT_TARGET 13.0)
set(CMAKE_XCODE_ATTRIBUTE_ENABLE_BITCODE NO)

# Dependencies and compile options
add_definitions(
    -DNDEBUG
    -DO3
    -DLM_GGML_USE_CPU
    -DLM_GGML_USE_ACCELERATE
    -DLM_GGML_USE_METAL
    -DLM_GGML_METAL_USE_BF16
)

if (CMAKE_OSX_ARCHITECTURES STREQUAL "arm64;x86_64")
    add_definitions(-DLM_GGML_CPU_GENERIC)
endif ()

set(SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../cpp)

if (CMAKE_OSX_ARCHITECTURES STREQUAL "arm64")
    set(SOURCE_FILES_ARCH
        ${SOURCE_DIR}/ggml-cpu/arch/arm/quants.c
        ${SOURCE_DIR}/ggml-cpu/arch/arm/repack.cpp
    )
endif ()

# Define public headers
set(PUBLIC_HEADERS
    ${SOURCE_DIR}/rn-llama.h
    ${SOURCE_DIR}/rn-completion.h
    ${SOURCE_DIR}/rn-tts.h
    ${SOURCE_DIR}/llama.h
    ${SOURCE_DIR}/ggml.h
)

# Create library target
add_library(llama-cpp SHARED
    ${SOURCE_DIR}/ggml.c
    ${SOURCE_DIR}/ggml-alloc.c
    ${SOURCE_DIR}/ggml-backend.cpp
    ${SOURCE_DIR}/ggml-backend-reg.cpp
    ${SOURCE_DIR}/ggml-cpu/amx/amx.cpp
    ${SOURCE_DIR}/ggml-cpu/amx/mmq.cpp
    ${SOURCE_DIR}/ggml-cpu/ggml-cpu.c
    ${SOURCE_DIR}/ggml-cpu/ggml-cpu.cpp
    ${SOURCE_DIR}/ggml-cpu/quants.c
    ${SOURCE_DIR}/ggml-cpu/traits.cpp
    ${SOURCE_DIR}/ggml-cpu/repack.cpp
    ${SOURCE_DIR}/ggml-cpu/unary-ops.cpp
    ${SOURCE_DIR}/ggml-cpu/binary-ops.cpp
    ${SOURCE_DIR}/ggml-cpu/vec.cpp
    ${SOURCE_DIR}/ggml-cpu/ops.cpp
    ${SOURCE_DIR}/ggml-metal.m
    ${SOURCE_DIR}/ggml-opt.cpp
    ${SOURCE_DIR}/ggml-threading.cpp
    ${SOURCE_DIR}/ggml-quants.c
    ${SOURCE_DIR}/gguf.cpp
    ${SOURCE_DIR}/log.cpp
    ${SOURCE_DIR}/llama-impl.cpp
    ${SOURCE_DIR}/llama-grammar.cpp
    ${SOURCE_DIR}/llama-sampling.cpp
    ${SOURCE_DIR}/llama-vocab.cpp
    ${SOURCE_DIR}/llama-adapter.cpp
    ${SOURCE_DIR}/llama-chat.cpp
    ${SOURCE_DIR}/llama-context.cpp
    ${SOURCE_DIR}/llama-arch.cpp
    ${SOURCE_DIR}/llama-batch.cpp
    ${SOURCE_DIR}/llama-cparams.cpp
    ${SOURCE_DIR}/llama-hparams.cpp
    ${SOURCE_DIR}/llama.cpp
    ${SOURCE_DIR}/llama-model.cpp
    ${SOURCE_DIR}/llama-model-loader.cpp
    ${SOURCE_DIR}/llama-model-saver.cpp
    ${SOURCE_DIR}/llama-mmap.cpp
    ${SOURCE_DIR}/llama-kv-cache.cpp
    ${SOURCE_DIR}/llama-kv-cache-iswa.cpp
    ${SOURCE_DIR}/llama-memory-hybrid.cpp
    ${SOURCE_DIR}/llama-memory-recurrent.cpp
    ${SOURCE_DIR}/llama-memory.cpp
    ${SOURCE_DIR}/llama-io.cpp
    ${SOURCE_DIR}/llama-graph.cpp
    ${SOURCE_DIR}/sampling.cpp
    ${SOURCE_DIR}/unicode-data.cpp
    ${SOURCE_DIR}/unicode.cpp
    ${SOURCE_DIR}/common.cpp
    ${SOURCE_DIR}/chat.cpp
    ${SOURCE_DIR}/json-schema-to-grammar.cpp
    ${SOURCE_DIR}/minja/minja.hpp
    ${SOURCE_DIR}/minja/chat-template.hpp
    ${SOURCE_DIR}/nlohmann/json.hpp
    ${SOURCE_DIR}/nlohmann/json_fwd.hpp
    ${SOURCE_DIR}/rn-llama.cpp
    ${SOURCE_DIR}/rn-completion.cpp
    ${SOURCE_DIR}/rn-tts.cpp
    ${SOURCE_FILES_ARCH}
)

# Set include directories
target_include_directories(llama-cpp PUBLIC
    ${SOURCE_DIR}
    ${SOURCE_DIR}/ggml-cpu
    ${SOURCE_DIR}/tools/mtmd
)

# Set compiler flags
target_compile_options(llama-cpp PRIVATE
    -fno-objc-arc
    -DLM_GGML_USE_CPU
    -DLM_GGML_USE_ACCELERATE
    -DLM_GGML_USE_METAL
    -DLM_GGML_METAL_USE_BF16
    -Wno-shorten-64-to-32
)

# Set linker flags
target_link_libraries(llama-cpp
    -framework Accelerate
    -framework Foundation
    -framework Metal
    -framework MetalKit
)

# Set properties
set_target_properties(llama-cpp PROPERTIES
    FRAMEWORK TRUE
    MACOSX_BUNDLE TRUE
    MACOSX_BUNDLE_INFO_PLIST ${CMAKE_CURRENT_SOURCE_DIR}/Info.plist
    XCODE_ATTRIBUTE_PRODUCT_BUNDLE_IDENTIFIER "com.arusatech.llama-cpp"
    XCODE_ATTRIBUTE_PRODUCT_NAME "LlamaCpp"
    XCODE_ATTRIBUTE_SKIP_INSTALL NO
    XCODE_ATTRIBUTE_INSTALL_PATH "@rpath"
)

# Install rules
install(TARGETS llama-cpp
    FRAMEWORK DESTINATION ${CMAKE_INSTALL_PREFIX}
    LIBRARY DESTINATION ${CMAKE_INSTALL_PREFIX}/lib
    ARCHIVE DESTINATION ${CMAKE_INSTALL_PREFIX}/lib
)
