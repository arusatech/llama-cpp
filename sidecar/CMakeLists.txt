# =============================================================================
# llama-cpp-sidecar — Native accelerated desktop sidecar binary
#
# Links a single upstream llama.cpp runtime (third_party/llama.cpp) so the
# executable and ggml backend plugins (Vulkan / OpenVINO / CUDA / …) share one
# ggml ABI. Project-owned adapters live under ../native/.
#
# Usage:
#   cmake -B build -DCMAKE_BUILD_TYPE=Release -DSIDECAR_VARIANT=<variant>
#   cmake --build build --config Release
#
# Variants (set via -DSIDECAR_VARIANT):
#   vulkan-openblas    — CPU + dynamic Vulkan   [default win/linux x64]
#   vulkan             — dynamic Vulkan only
#   openvino           — dynamic OpenVINO (Intel GPU/NPU)
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

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

set(LLAMA_CPP_PRO_ROOT "${CMAKE_CURRENT_LIST_DIR}/..")
set(NATIVE_DIR "${LLAMA_CPP_PRO_ROOT}/native")

set(LLAMA_CPP_UPSTREAM "" CACHE PATH "Path to upstream llama.cpp (default: third_party/llama.cpp)")
if(NOT LLAMA_CPP_UPSTREAM AND DEFINED ENV{LLAMA_CPP_UPSTREAM})
    set(LLAMA_CPP_UPSTREAM "$ENV{LLAMA_CPP_UPSTREAM}")
endif()
if(NOT LLAMA_CPP_UPSTREAM)
    set(_DEFAULT_UPSTREAM "${LLAMA_CPP_PRO_ROOT}/third_party/llama.cpp")
    if(EXISTS "${_DEFAULT_UPSTREAM}/CMakeLists.txt")
        set(LLAMA_CPP_UPSTREAM "${_DEFAULT_UPSTREAM}")
    endif()
endif()
if(NOT LLAMA_CPP_UPSTREAM OR NOT EXISTS "${LLAMA_CPP_UPSTREAM}/CMakeLists.txt")
    message(FATAL_ERROR
        "LLAMA_CPP_UPSTREAM not found. Expected ${LLAMA_CPP_PRO_ROOT}/third_party/llama.cpp "
        "(git submodule) or set -DLLAMA_CPP_UPSTREAM=/path/to/llama.cpp")
endif()
message(STATUS "Upstream llama.cpp: ${LLAMA_CPP_UPSTREAM}")

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
    "Build variant: vulkan-openblas, vulkan, openvino, cuda, rocm, metal, metal-coreml, cpu, openblas")

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
# Upstream llama.cpp — single shared ggml runtime + backend DL plugins
# ---------------------------------------------------------------------------

set(BUILD_SHARED_LIBS ON CACHE BOOL "" FORCE)
set(GGML_BACKEND_DL ON CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_CPU ON CACHE BOOL "" FORCE)

set(LLAMA_BUILD_COMMON ON CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_APP OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_MTMD ON CACHE BOOL "" FORCE)

# Backend plugins selected by variant
set(_GGML_VULKAN OFF)
set(_GGML_CUDA OFF)
set(_GGML_HIP OFF)
set(_GGML_OPENVINO OFF)
set(_GGML_METAL OFF)
set(_GGML_BLAS OFF)

if(SIDECAR_VARIANT MATCHES "vulkan")
    set(_GGML_VULKAN ON)
endif()
if(SIDECAR_VARIANT STREQUAL "cuda")
    set(_GGML_CUDA ON)
endif()
if(SIDECAR_VARIANT STREQUAL "rocm")
    set(_GGML_HIP ON)
endif()
if(SIDECAR_VARIANT MATCHES "openvino")
    set(_GGML_OPENVINO ON)
endif()
if(SIDECAR_VARIANT MATCHES "metal")
    set(_GGML_METAL ON)
endif()
if(SIDECAR_VARIANT MATCHES "openblas")
    set(_GGML_BLAS ON)
endif()

set(GGML_VULKAN ${_GGML_VULKAN} CACHE BOOL "" FORCE)
set(GGML_CUDA ${_GGML_CUDA} CACHE BOOL "" FORCE)
set(GGML_HIP ${_GGML_HIP} CACHE BOOL "" FORCE)
set(GGML_OPENVINO ${_GGML_OPENVINO} CACHE BOOL "" FORCE)
set(GGML_METAL ${_GGML_METAL} CACHE BOOL "" FORCE)
set(GGML_BLAS ${_GGML_BLAS} CACHE BOOL "" FORCE)
if(_GGML_BLAS)
    set(GGML_BLAS_VENDOR "OpenBLAS" CACHE STRING "" FORCE)
endif()

if(DEFINED ENV{VULKAN_SDK} AND NOT "$ENV{VULKAN_SDK}" STREQUAL "")
    list(APPEND CMAKE_PREFIX_PATH "$ENV{VULKAN_SDK}")
endif()
if(DEFINED ENV{OPENBLAS_ROOT} AND NOT "$ENV{OPENBLAS_ROOT}" STREQUAL "")
    list(APPEND CMAKE_PREFIX_PATH "$ENV{OPENBLAS_ROOT}")
endif()
if(DEFINED ENV{OpenVINO_DIR} AND NOT "$ENV{OpenVINO_DIR}" STREQUAL "")
    list(APPEND CMAKE_PREFIX_PATH "$ENV{OpenVINO_DIR}")
endif()

add_subdirectory("${LLAMA_CPP_UPSTREAM}" "${CMAKE_BINARY_DIR}/llama-upstream")

# Collect GPU/accelerator plugins into a predictable folder for staging
set(_PLUGIN_OUT "${CMAKE_BINARY_DIR}/ggml-plugins")
file(MAKE_DIRECTORY "${_PLUGIN_OUT}")
set(_PLUGIN_TARGETS "")
if(_GGML_VULKAN)
    list(APPEND _PLUGIN_TARGETS ggml-vulkan)
endif()
if(_GGML_CUDA)
    list(APPEND _PLUGIN_TARGETS ggml-cuda)
endif()
if(_GGML_HIP)
    list(APPEND _PLUGIN_TARGETS ggml-hip)
endif()
if(_GGML_OPENVINO)
    list(APPEND _PLUGIN_TARGETS ggml-openvino)
endif()

if(_PLUGIN_TARGETS)
    add_custom_target(ggml-backends ALL DEPENDS ${_PLUGIN_TARGETS}
        COMMENT "ggml backend plugins: ${_PLUGIN_TARGETS}")
    foreach(_t ${_PLUGIN_TARGETS})
        if(TARGET ${_t})
            add_custom_command(TARGET ggml-backends POST_BUILD
                COMMAND ${CMAKE_COMMAND} -E make_directory "${_PLUGIN_OUT}"
                COMMAND ${CMAKE_COMMAND} -E copy_if_different
                    "$<TARGET_FILE:${_t}>" "${_PLUGIN_OUT}/"
                COMMENT "Copy ${_t} → ${_PLUGIN_OUT}"
                VERBATIM)
        endif()
    endforeach()
endif()

# ---------------------------------------------------------------------------
# Project-owned native adapters + sidecar entry
# ---------------------------------------------------------------------------

set(NATIVE_SOURCES
    ${NATIVE_DIR}/anyascii.c
    ${NATIVE_DIR}/cap-llama.cpp
    ${NATIVE_DIR}/cap-completion.cpp
    ${NATIVE_DIR}/cap-tts.cpp
    ${NATIVE_DIR}/cap-embedding.cpp
    ${NATIVE_DIR}/cap-ios-bridge.cpp
    ${NATIVE_DIR}/cap-native-server.cpp
)

add_executable(${SIDECAR_BINARY_NAME}
    ${CMAKE_CURRENT_SOURCE_DIR}/cap-sidecar-main.cpp
    ${NATIVE_SOURCES}
)

# ABI guard: catch struct layout drift between exe and plugins at compile time
target_sources(${SIDECAR_BINARY_NAME} PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/abi-guard.cpp
)

target_include_directories(${SIDECAR_BINARY_NAME} PRIVATE
    ${NATIVE_DIR}
    ${LLAMA_CPP_UPSTREAM}/include
    ${LLAMA_CPP_UPSTREAM}/ggml/include
    ${LLAMA_CPP_UPSTREAM}/common
    ${LLAMA_CPP_UPSTREAM}/vendor
    ${LLAMA_CPP_UPSTREAM}/vendor/cpp-httplib
    ${LLAMA_CPP_UPSTREAM}/tools/mtmd
)

target_compile_definitions(${SIDECAR_BINARY_NAME} PRIVATE
    NDEBUG
)

find_package(Threads REQUIRED)
target_link_libraries(${SIDECAR_BINARY_NAME} PRIVATE
    Threads::Threads
    llama
    ggml
    llama-common
    mtmd
)

# Prefer the upstream-vendored cpp-httplib target (headers must match the .lib).
# Do NOT also put native/vendor/cpp-httplib on the include path — that caused
# STATUS_HEAP_CORRUPTION from mismatched httplib ABI.
if(TARGET cpp-httplib)
    target_link_libraries(${SIDECAR_BINARY_NAME} PRIVATE cpp-httplib)
else()
    target_include_directories(${SIDECAR_BINARY_NAME} PRIVATE
        ${NATIVE_DIR}/vendor/cpp-httplib
    )
    target_sources(${SIDECAR_BINARY_NAME} PRIVATE
        ${NATIVE_DIR}/vendor/cpp-httplib/httplib.cpp
    )
endif()

if(WIN32)
    target_link_libraries(${SIDECAR_BINARY_NAME} PRIVATE ws2_32)
    if(MSVC)
        target_compile_definitions(${SIDECAR_BINARY_NAME} PRIVATE _USE_MATH_DEFINES)
        # Match upstream llama.cpp / cpp-httplib (MD). Do NOT force MT — that
        # produces LNK2038 RuntimeLibrary mismatches against shared ggml/llama.
    endif()
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
    if(SIDECAR_ARCH STREQUAL "arm64")
        set_target_properties(${SIDECAR_BINARY_NAME} PROPERTIES OSX_ARCHITECTURES "arm64")
    elseif(SIDECAR_ARCH STREQUAL "x64")
        set_target_properties(${SIDECAR_BINARY_NAME} PROPERTIES OSX_ARCHITECTURES "x86_64")
    endif()
endif()

if(UNIX AND NOT APPLE)
    target_link_options(${SIDECAR_BINARY_NAME} PRIVATE -static-libgcc -static-libstdc++)
    target_compile_definitions(${SIDECAR_BINARY_NAME} PRIVATE _GNU_SOURCE)
endif()

set_target_properties(${SIDECAR_BINARY_NAME} PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
    OUTPUT_NAME "${SIDECAR_BINARY_NAME}"
)

# Copy shared ggml/llama runtime next to the exe after build
add_custom_command(TARGET ${SIDECAR_BINARY_NAME} POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory "${CMAKE_BINARY_DIR}/bin"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "$<TARGET_FILE:ggml>" "$<TARGET_FILE_DIR:${SIDECAR_BINARY_NAME}>/"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "$<TARGET_FILE:llama>" "$<TARGET_FILE_DIR:${SIDECAR_BINARY_NAME}>/"
    COMMENT "Stage ggml/llama shared libs next to sidecar"
    VERBATIM
)
if(TARGET ggml-base)
    add_custom_command(TARGET ${SIDECAR_BINARY_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "$<TARGET_FILE:ggml-base>" "$<TARGET_FILE_DIR:${SIDECAR_BINARY_NAME}>/"
        VERBATIM)
endif()
if(TARGET ggml-cpu)
    add_custom_command(TARGET ${SIDECAR_BINARY_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            "$<TARGET_FILE:ggml-cpu>" "$<TARGET_FILE_DIR:${SIDECAR_BINARY_NAME}>/"
        VERBATIM)
endif()

install(TARGETS ${SIDECAR_BINARY_NAME} RUNTIME DESTINATION "sidecar")
