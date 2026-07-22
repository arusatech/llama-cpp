# Optional ggml GPU backend plugin builds
#
# Requires LLAMA_CPP_UPSTREAM pointing at a full upstream llama.cpp checkout.
# Produces ggml-vulkan.dll / libggml-vulkan.so next to the sidecar (and under
# sidecar/bin/ggml-plugins/<platform>-<arch>/ after the win/linux stage scripts).
#
# Usage:
#   cmake -B sidecar/build -DLLAMA_CPP_UPSTREAM=/path/to/llama.cpp -DSIDECAR_VARIANT=vulkan-openblas
#   cmake --build sidecar/build --config Release

if(NOT LLAMA_CPP_UPSTREAM OR NOT EXISTS "${LLAMA_CPP_UPSTREAM}/ggml/CMakeLists.txt")
    message(STATUS "ggml-backends: LLAMA_CPP_UPSTREAM not set — skipping GPU plugin build")
    return()
endif()

message(STATUS "ggml-backends: building plugins from ${LLAMA_CPP_UPSTREAM}")

# Dynamic backend DLLs so the sidecar can lm_ggml_backend_load_all_from_path().
set(BUILD_SHARED_LIBS ON CACHE BOOL "" FORCE)
set(GGML_BACKEND_DL ON CACHE BOOL "" FORCE)
set(GGML_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(GGML_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)

set(_GGML_VULKAN OFF)
set(_GGML_CUDA OFF)
set(_GGML_HIP OFF)

if(SIDECAR_VARIANT MATCHES "vulkan")
    set(_GGML_VULKAN ON)
elseif(SIDECAR_VARIANT STREQUAL "cuda")
    set(_GGML_CUDA ON)
elseif(SIDECAR_VARIANT STREQUAL "rocm")
    set(_GGML_HIP ON)
endif()

set(GGML_VULKAN ${_GGML_VULKAN} CACHE BOOL "" FORCE)
set(GGML_CUDA ${_GGML_CUDA} CACHE BOOL "" FORCE)
set(GGML_HIP ${_GGML_HIP} CACHE BOOL "" FORCE)
set(GGML_CPU ON CACHE BOOL "" FORCE)

if(DEFINED ENV{VULKAN_SDK} AND NOT "$ENV{VULKAN_SDK}" STREQUAL "")
    list(APPEND CMAKE_PREFIX_PATH "$ENV{VULKAN_SDK}")
    message(STATUS "ggml-backends: VULKAN_SDK=$ENV{VULKAN_SDK}")
endif()

add_subdirectory("${LLAMA_CPP_UPSTREAM}/ggml" "${CMAKE_BINARY_DIR}/ggml-upstream")

# Collect plugin artifacts into a predictable folder for stage-desktop-resources.
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

if(_PLUGIN_TARGETS)
    add_custom_target(ggml-backends ALL
        DEPENDS ${_PLUGIN_TARGETS}
        COMMENT "ggml GPU backend plugins: ${_PLUGIN_TARGETS}"
    )
    foreach(_t ${_PLUGIN_TARGETS})
        if(TARGET ${_t})
            add_custom_command(TARGET ggml-backends POST_BUILD
                COMMAND ${CMAKE_COMMAND} -E make_directory "${_PLUGIN_OUT}"
                COMMAND ${CMAKE_COMMAND} -E copy_if_different
                    "$<TARGET_FILE:${_t}>" "${_PLUGIN_OUT}/"
                COMMENT "Copy ${_t} → ${_PLUGIN_OUT}"
                VERBATIM
            )
        endif()
    endforeach()
else()
    add_custom_target(ggml-backends ALL
        DEPENDS ggml
        COMMENT "ggml built (no GPU backend selected for SIDECAR_VARIANT=${SIDECAR_VARIANT})"
    )
endif()
