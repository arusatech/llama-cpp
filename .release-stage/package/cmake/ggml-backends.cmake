# Optional ggml GPU backend plugin builds
#
# Requires LLAMA_CPP_UPSTREAM pointing at a full upstream llama.cpp checkout.
# Produces libggml-vulkan.so, libggml-cuda.so, libggml-hip.so next to the sidecar.
#
# Usage:
#   cmake -B sidecar/build -DLLAMA_CPP_UPSTREAM=/path/to/llama.cpp -DSIDECAR_VARIANT=vulkan-openblas
#   cmake --build sidecar/build --target ggml-backends

if(NOT LLAMA_CPP_UPSTREAM OR NOT EXISTS "${LLAMA_CPP_UPSTREAM}/ggml/CMakeLists.txt")
    message(STATUS "ggml-backends: LLAMA_CPP_UPSTREAM not set — skipping GPU plugin build")
    return()
endif()

message(STATUS "ggml-backends: building plugins from ${LLAMA_CPP_UPSTREAM}")

set(GGML_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(GGML_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS ON CACHE BOOL "" FORCE)

set(_GGML_VULKAN OFF)
set(_GGML_CUDA OFF)
set(_GGML_HIP OFF)

if(SIDECAR_VARIANT MATCHES "vulkan")
    set(_GGML_VULKAN ON)
elseif(SIDECAR_VARIANT STREQUAL "cuda")
    set(_GGML_CUDA ON)
elseif(SIDECAR_VARIANT STREQUAL "rocm")
    set(_GGML_HIP ON)
elseif(SIDECAR_VARIANT STREQUAL "vulkan-openblas")
    set(_GGML_VULKAN ON)
endif()

set(GGML_VULKAN ${_GGML_VULKAN} CACHE BOOL "" FORCE)
set(GGML_CUDA ${_GGML_CUDA} CACHE BOOL "" FORCE)
set(GGML_HIP ${_GGML_HIP} CACHE BOOL "" FORCE)

add_subdirectory("${LLAMA_CPP_UPSTREAM}/ggml" "${CMAKE_BINARY_DIR}/ggml-upstream")

add_custom_target(ggml-backends ALL
    DEPENDS ggml
    COMMENT "ggml GPU backend plugins built into ${CMAKE_BINARY_DIR}/bin"
)
