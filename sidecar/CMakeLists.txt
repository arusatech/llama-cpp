# =============================================================================
# llama-cpp-sidecar — Native accelerated desktop sidecar binary
#
# Builds a standalone executable with the embedded cap-native-server HTTP API.
# GPU backends (Vulkan, CUDA, ROCm/HIP) are loaded dynamically at runtime from
# libggml-*.so / ggml-*.dll placed next to the binary (see cmake/ggml-backends.cmake).
#
# Usage:
#   cmake -B build -DCMAKE_BUILD_TYPE=Release -DSIDECAR_VARIANT=<variant>
#   cmake --build build --config Release
#
# Variants (set via -DSIDECAR_VARIANT):
#   vulkan-openblas    — CPU + dynamic Vulkan   [default win/linux x64]
#   vulkan             — dynamic Vulkan only
#   openblas           — CPU-optimized (OpenBLAS when available)
#   cuda               — dynamic CUDA (NVIDIA)
#   rocm               — dynamic ROCm/HIP (AMD)
#   metal              — Apple Metal GPU (macOS)
#   metal-coreml       — Metal + CoreML ANE (macOS arm64)
#   cpu                — CPU-only universal fallback
# =============================================================================

cmake_minimum_required(VERSION 3.16)
project(llama-cpp-sidecar VERSION 0.2.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(${CMAKE_CURRENT_LIST_DIR}/../cmake/desktop-sources.cmake)

# ---------------------------------------------------------------------------
# Platform / architecture detection
# ---------------------------------------------------------------------------

if(CMAKE_SYSTEM_NAME STREQUAL "Windows")
    set(SIDECAR_PLATFORM "win32")
elseif(CMAKE_SYSTEM_NAME STREQUAL "Darwin")
    set(SIDECAR_PLATFORM "darwin")
elseif(CMAKE_SYSTEM_NAME STREQUAL "Linux")
    set(SIDECAR_PLATFORM "linux")
else()
    set(SIDECAR_PLATFORM "${CMAKE_SYSTEM_NAME}")
endif()

set(_SIDECAR_DETECTED_PROC "${CMAKE_SYSTEM_PROCESSOR}")
if(CMAKE_OSX_ARCHITECTURES AND NOT CMAKE_OSX_ARCHITECTURES STREQUAL "")
    set(_SIDECAR_DETECTED_PROC "${CMAKE_OSX_ARCHITECTURES}")
endif()

if(_SIDECAR_DETECTED_PROC MATCHES "^(aarch64|arm64|ARM64)$")
    set(SIDECAR_ARCH "arm64")
elseif(_SIDECAR_DETECTED_PROC MATCHES "^(x86_64|AMD64|amd64)$")
    set(SIDECAR_ARCH "x64")
else()
    set(SIDECAR_ARCH "${_SIDECAR_DETECTED_PROC}")
endif()

# ---------------------------------------------------------------------------
# Variant selection
# ---------------------------------------------------------------------------

set(SIDECAR_VARIANT "" CACHE STRING
    "Build variant: vulkan-openblas, cuda, rocm, metal, metal-coreml, cpu, openblas, vulkan")

if(NOT SIDECAR_VARIANT)
    if(SIDECAR_PLATFORM STREQUAL "darwin" AND SIDECAR_ARCH STREQUAL "arm64")
        set(SIDECAR_VARIANT "metal-coreml")
    elseif(SIDECAR_PLATFORM STREQUAL "darwin")
        set(SIDECAR_VARIANT "metal")
    else()
        set(SIDECAR_VARIANT "vulkan-openblas")
    endif()
endif()

set(SIDECAR_NEEDS_SUFFIX ON)
if(SIDECAR_VARIANT STREQUAL "vulkan-openblas" AND NOT SIDECAR_PLATFORM STREQUAL "darwin")
    set(SIDECAR_NEEDS_SUFFIX OFF)
elseif(SIDECAR_VARIANT STREQUAL "cpu" AND NOT SIDECAR_PLATFORM STREQUAL "darwin")
    # CPU is a valid default desktop binary for npm packaging (win32-x64.exe / linux-x64).
    set(SIDECAR_NEEDS_SUFFIX OFF)
elseif(SIDECAR_VARIANT STREQUAL "metal-coreml" AND SIDECAR_PLATFORM STREQUAL "darwin" AND SIDECAR_ARCH STREQUAL "arm64")
    set(SIDECAR_NEEDS_SUFFIX OFF)
elseif(SIDECAR_VARIANT STREQUAL "metal" AND SIDECAR_PLATFORM STREQUAL "darwin")
    set(SIDECAR_NEEDS_SUFFIX OFF)
endif()

if(SIDECAR_NEEDS_SUFFIX)
    set(SIDECAR_BINARY_NAME "${SIDECAR_PLATFORM}-${SIDECAR_ARCH}-${SIDECAR_VARIANT}")
else()
    set(SIDECAR_BINARY_NAME "${SIDECAR_PLATFORM}-${SIDECAR_ARCH}")
endif()

message(STATUS "Sidecar target: ${SIDECAR_BINARY_NAME}")
message(STATUS "Platform: ${SIDECAR_PLATFORM}  Arch: ${SIDECAR_ARCH}  Variant: ${SIDECAR_VARIANT}")

# ---------------------------------------------------------------------------
# Compile definitions per variant
# ---------------------------------------------------------------------------

set(SIDECAR_COMPILE_DEFS
    -DNDEBUG
    -DLM_GGML_USE_CPU
)

set(SIDECAR_SOURCES ${ANNADATA_DESKTOP_CORE_SOURCES})

if(SIDECAR_VARIANT MATCHES "metal")
    list(APPEND SIDECAR_SOURCES ${ANNADATA_CPP_DIR}/ggml-metal.m)
    list(APPEND SIDECAR_COMPILE_DEFS
        -DLM_GGML_USE_METAL
        -DLM_GGML_METAL_EMBED_LIBRARY
        -DLM_GGML_METAL_USE_BF16
    )
    if(APPLE)
        list(APPEND SIDECAR_COMPILE_DEFS -DLM_GGML_USE_ACCELERATE)
    endif()
endif()

# Vulkan/CUDA/ROCm are loaded dynamically via lm_ggml_backend_load_all_from_path().
# Variant names select which plugin DLLs to bundle (see scripts/build-ggml-backends.sh).

# ---------------------------------------------------------------------------
# Metal shader embedding (macOS)
# ---------------------------------------------------------------------------

if(SIDECAR_VARIANT MATCHES "metal" AND APPLE)
    enable_language(ASM)
    include(${CMAKE_CURRENT_LIST_DIR}/../cmake/desktop-metal-embed.cmake)
    list(APPEND SIDECAR_SOURCES ${METALLIB_EMBED_ASM})
endif()

# ---------------------------------------------------------------------------
# Executable target
# ---------------------------------------------------------------------------

add_executable(${SIDECAR_BINARY_NAME}
    ${CMAKE_CURRENT_SOURCE_DIR}/cap-sidecar-main.cpp
    ${SIDECAR_SOURCES}
)

target_include_directories(${SIDECAR_BINARY_NAME} PRIVATE
    ${ANNADATA_CPP_DIR}
    ${ANNADATA_CPP_DIR}/ggml-cpu
    ${ANNADATA_CPP_DIR}/tools/mtmd
    ${ANNADATA_CPP_DIR}/vendor/cpp-httplib
)

target_compile_options(${SIDECAR_BINARY_NAME} PRIVATE ${SIDECAR_COMPILE_DEFS})

find_package(Threads REQUIRED)
target_link_libraries(${SIDECAR_BINARY_NAME} PRIVATE Threads::Threads)

# Optional OpenBLAS (CPU BLAS) for openblas / vulkan-openblas variants.
set(OPENBLAS_ROOT "" CACHE PATH "OpenBLAS install prefix (include/, lib/)")
if(NOT OPENBLAS_ROOT AND DEFINED ENV{OPENBLAS_ROOT})
    set(OPENBLAS_ROOT "$ENV{OPENBLAS_ROOT}")
endif()
if(SIDECAR_VARIANT MATCHES "openblas")
    if(OPENBLAS_ROOT AND EXISTS "${OPENBLAS_ROOT}")
        message(STATUS "OpenBLAS: using ${OPENBLAS_ROOT}")
        target_include_directories(${SIDECAR_BINARY_NAME} PRIVATE
            "${OPENBLAS_ROOT}/include"
        )
        find_library(OPENBLAS_LIB
            NAMES openblas libopenblas openblas_shared
            PATHS
                "${OPENBLAS_ROOT}/lib"
                "${OPENBLAS_ROOT}/lib/x64"
            NO_DEFAULT_PATH
        )
        if(NOT OPENBLAS_LIB)
            find_library(OPENBLAS_LIB NAMES openblas libopenblas)
        endif()
        if(OPENBLAS_LIB)
            target_link_libraries(${SIDECAR_BINARY_NAME} PRIVATE "${OPENBLAS_LIB}")
            target_compile_definitions(${SIDECAR_BINARY_NAME} PRIVATE LLAMA_CPP_PRO_USE_OPENBLAS=1)
            message(STATUS "OpenBLAS library: ${OPENBLAS_LIB}")
        else()
            message(WARNING "OPENBLAS_ROOT set but openblas library not found — building without OpenBLAS link")
        endif()
    else()
        message(WARNING "SIDECAR_VARIANT=${SIDECAR_VARIANT} but OPENBLAS_ROOT is unset — CPU BLAS not linked")
    endif()
endif()

# Surface Vulkan SDK for optional ggml plugin builds / tooling.
if(DEFINED ENV{VULKAN_SDK} AND NOT VULKAN_SDK)
    set(VULKAN_SDK "$ENV{VULKAN_SDK}" CACHE PATH "Vulkan SDK root")
endif()
if(VULKAN_SDK)
    message(STATUS "Vulkan SDK: ${VULKAN_SDK}")
endif()

if(APPLE)
    find_library(ACCELERATE_FRAMEWORK Accelerate)
    find_library(METAL_FRAMEWORK Metal)
    find_library(FOUNDATION_FRAMEWORK Foundation)
    find_library(METALKIT_FRAMEWORK MetalKit)
    target_link_libraries(${SIDECAR_BINARY_NAME} PRIVATE
        ${ACCELERATE_FRAMEWORK}
        ${METAL_FRAMEWORK}
        ${FOUNDATION_FRAMEWORK}
        ${METALKIT_FRAMEWORK}
    )
    # Honor target arch (allows arm64→x86_64 cross-builds via CMAKE_OSX_ARCHITECTURES)
    if(SIDECAR_ARCH STREQUAL "arm64")
        set_target_properties(${SIDECAR_BINARY_NAME} PROPERTIES OSX_ARCHITECTURES "arm64")
    elseif(SIDECAR_ARCH STREQUAL "x64")
        set_target_properties(${SIDECAR_BINARY_NAME} PROPERTIES OSX_ARCHITECTURES "x86_64")
    endif()
endif()

if(WIN32)
    target_link_libraries(${SIDECAR_BINARY_NAME} PRIVATE ws2_32)
    if(MSVC)
        target_compile_definitions(${SIDECAR_BINARY_NAME} PRIVATE _USE_MATH_DEFINES)
        set_property(TARGET ${SIDECAR_BINARY_NAME} PROPERTY
            MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
    endif()
endif()

if(UNIX AND NOT APPLE)
    target_link_options(${SIDECAR_BINARY_NAME} PRIVATE -static-libgcc -static-libstdc++)
    # ggml-cpu.c uses SCHED_BATCH / pthread_setaffinity_np (GNU extensions)
    target_compile_definitions(${SIDECAR_BINARY_NAME} PRIVATE _GNU_SOURCE)
endif()

set_target_properties(${SIDECAR_BINARY_NAME} PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
    OUTPUT_NAME "${SIDECAR_BINARY_NAME}"
)

# Optional: build ggml backend plugins from upstream llama.cpp
set(LLAMA_CPP_UPSTREAM "" CACHE PATH "Path to upstream llama.cpp for ggml GPU backend plugins")
if(NOT LLAMA_CPP_UPSTREAM AND DEFINED ENV{LLAMA_CPP_UPSTREAM})
    set(LLAMA_CPP_UPSTREAM "$ENV{LLAMA_CPP_UPSTREAM}")
endif()
if(LLAMA_CPP_UPSTREAM AND EXISTS "${LLAMA_CPP_UPSTREAM}/ggml/CMakeLists.txt")
    include(${CMAKE_CURRENT_LIST_DIR}/../cmake/ggml-backends.cmake)
elseif(LLAMA_CPP_UPSTREAM)
    message(WARNING "LLAMA_CPP_UPSTREAM=${LLAMA_CPP_UPSTREAM} but ggml/CMakeLists.txt missing — skipping GPU plugins")
endif()

install(TARGETS ${SIDECAR_BINARY_NAME} RUNTIME DESTINATION "sidecar")
