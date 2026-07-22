@echo off
REM Build Linux sidecar + ggml-vulkan inside Docker and stage into this repo.
REM Prerequisites: Docker Desktop running; optional sibling ..\llama.cpp for Vulkan plugins.
REM
REM Usage (from llama-cpp-pro root):
REM   scripts\build-sidecar-linux-docker.bat

setlocal EnableExtensions
set ROOT=%~dp0..
cd /d "%ROOT%"

where docker >nul 2>&1
if errorlevel 1 (
  echo ERROR: docker not found on PATH.
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo ERROR: Docker daemon is not running. Start Docker Desktop and retry.
  exit /b 1
)

set "UPSTREAM=%LLAMA_CPP_UPSTREAM%"
if "%UPSTREAM%"=="" if exist "%ROOT%\..\llama.cpp\ggml\CMakeLists.txt" set "UPSTREAM=%ROOT%\..\llama.cpp"
if "%UPSTREAM%"=="" if exist "C:\Users\arusa\Project\llama.cpp\ggml\CMakeLists.txt" set "UPSTREAM=C:\Users\arusa\Project\llama.cpp"

echo [docker-linux] ROOT=%CD%
echo [docker-linux] LLAMA_CPP_UPSTREAM=%UPSTREAM%

docker build -f docker\Dockerfile.sidecar-linux -t llama-cpp-pro-sidecar-linux .
if errorlevel 1 exit /b 1

if not "%UPSTREAM%"=="" (
  docker run --rm -v "%CD%:/src" -v "%UPSTREAM%:/llama.cpp:ro" llama-cpp-pro-sidecar-linux
) else (
  echo WARNING: no llama.cpp upstream — Linux sidecar without ggml-vulkan plugin
  docker run --rm -v "%CD%:/src" llama-cpp-pro-sidecar-linux
)
if errorlevel 1 exit /b 1

echo [docker-linux] staged into extraResources\sidecar\
dir /b extraResources\sidecar
if exist extraResources\sidecar\linux-x64 echo FOUND linux-x64
if exist extraResources\sidecar\ggml-plugins\linux-x64 dir /b extraResources\sidecar\ggml-plugins\linux-x64
endlocal
