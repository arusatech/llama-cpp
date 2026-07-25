# =============================================================================
# Android JNI plugin — arm64-v8a (default Gradle path)
#
# Links upstream llama.cpp (third_party/llama.cpp) + project adapters (native/).
# Legacy flat cpp/ is not used.
# =============================================================================

cmake_minimum_required(VERSION 3.22)
project(llama-cpp LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(LLAMA_CPP_PRO_ROOT "${CMAKE_SOURCE_DIR}/../../..")
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
        "(git submodule) or set -DLLAMA_CPP_UPSTREAM=/path/to/llama.cpp. "
        "See docs/NATIVE_UPSTREAM.md — legacy cpp/ is no longer used for Android builds.")
endif()
if(NOT EXISTS "${NATIVE_DIR}/cap-llama.cpp")
    message(FATAL_ERROR "native/ adapters not found at ${NATIVE_DIR}")
endif()
message(STATUS "Upstream llama.cpp: ${LLAMA_CPP_UPSTREAM}")
message(STATUS "Native adapters: ${NATIVE_DIR}")

# Single JNI shared lib: statically link ggml/llama into the plugin .so
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
set(GGML_CPU ON CACHE BOOL "" FORCE)
set(GGML_BACKEND_DL OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON ON CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_APP OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_MTMD ON CACHE BOOL "" FORCE)
set(LLAMA_OPENSSL OFF CACHE BOOL "" FORCE)

add_subdirectory("${LLAMA_CPP_UPSTREAM}" "${CMAKE_BINARY_DIR}/llama-upstream")

set(PLUGIN_SOURCES
    ${CMAKE_SOURCE_DIR}/jni.cpp
    ${CMAKE_SOURCE_DIR}/jni-utils.h
    ${NATIVE_DIR}/anyascii.c
    ${NATIVE_DIR}/cap-llama.cpp
    ${NATIVE_DIR}/cap-completion.cpp
    ${NATIVE_DIR}/cap-tts.cpp
    ${NATIVE_DIR}/cap-embedding.cpp
    ${NATIVE_DIR}/cap-ios-bridge.cpp
    ${NATIVE_DIR}/cap-native-server.cpp
)

# Optional JNI split translation units (present in tree)
foreach(_jni_extra jni-chat-session.cpp jni-lora.cpp jni-multimodal.cpp jni-tts.cpp)
    if(EXISTS "${CMAKE_SOURCE_DIR}/${_jni_extra}")
        list(APPEND PLUGIN_SOURCES "${CMAKE_SOURCE_DIR}/${_jni_extra}")
    endif()
endforeach()

add_library(llama-cpp-arm64 SHARED ${PLUGIN_SOURCES})

target_include_directories(llama-cpp-arm64 PRIVATE
    ${CMAKE_SOURCE_DIR}
    ${NATIVE_DIR}
    ${NATIVE_DIR}/vendor/cpp-httplib
    ${LLAMA_CPP_UPSTREAM}/include
    ${LLAMA_CPP_UPSTREAM}/ggml/include
    ${LLAMA_CPP_UPSTREAM}/common
    ${LLAMA_CPP_UPSTREAM}/vendor
    ${LLAMA_CPP_UPSTREAM}/tools/mtmd
)

target_compile_options(llama-cpp-arm64 PRIVATE
    -march=armv8-a
    -mtune=cortex-a76
    -O3
    -fno-finite-math-only
    -funroll-loops
)

target_compile_definitions(llama-cpp-arm64 PRIVATE NDEBUG)

find_library(LOG_LIB log)
find_library(ANDROID_LIB android)
find_package(Threads REQUIRED)

target_link_libraries(llama-cpp-arm64 PRIVATE
    ${LOG_LIB}
    ${ANDROID_LIB}
    Threads::Threads
    llama
    ggml
    llama-common
    mtmd
)

if(TARGET cpp-httplib)
    target_link_libraries(llama-cpp-arm64 PRIVATE cpp-httplib)
else()
    target_sources(llama-cpp-arm64 PRIVATE ${NATIVE_DIR}/vendor/cpp-httplib/httplib.cpp)
endif()

set_target_properties(llama-cpp-arm64 PROPERTIES
    OUTPUT_NAME "llama-cpp-arm64"
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/jniLibs/arm64-v8a"
)

message(STATUS "Building llama-cpp Android ARM64 against upstream + native/")
message(STATUS "Output: ${CMAKE_CURRENT_SOURCE_DIR}/jniLibs/arm64-v8a")
