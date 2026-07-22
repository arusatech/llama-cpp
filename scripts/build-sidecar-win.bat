@echo off
REM Build llama-cpp sidecar for Windows x64 + optional ggml-vulkan.dll plugins.
REM Default variant: vulkan-openblas
REM
REM Env (PowerShell):
REM   $env:VULKAN_SDK = "C:\VulkanSDK\1.4.350.0"
REM   $env:OPENBLAS_ROOT = "C:\OpenBLAS"
REM   $env:LLAMA_CPP_UPSTREAM = "C:\Users\arusa\Project\llama.cpp"
REM
REM Usage:
REM   scripts\build-sidecar-win.bat
REM   scripts\build-sidecar-win.bat vulkan-openblas
REM   scripts\build-sidecar-win.bat cpu

setlocal EnableExtensions
set ROOT=%~dp0..
set VARIANT=%1
if "%VARIANT%"=="" set VARIANT=vulkan-openblas

if "%VULKAN_SDK%"=="" if exist "C:\VulkanSDK\1.4.350.0" set "VULKAN_SDK=C:\VulkanSDK\1.4.350.0"
if "%OPENBLAS_ROOT%"=="" if exist "C:\OpenBLAS" set "OPENBLAS_ROOT=C:\OpenBLAS"
if "%LLAMA_CPP_UPSTREAM%"=="" if exist "C:\Users\arusa\Project\llama.cpp\ggml\CMakeLists.txt" set "LLAMA_CPP_UPSTREAM=C:\Users\arusa\Project\llama.cpp"

echo [sidecar-win] VARIANT=%VARIANT%
echo [sidecar-win] VULKAN_SDK=%VULKAN_SDK%
echo [sidecar-win] OPENBLAS_ROOT=%OPENBLAS_ROOT%
echo [sidecar-win] LLAMA_CPP_UPSTREAM=%LLAMA_CPP_UPSTREAM%

if "%VARIANT%"=="vulkan-openblas" if "%VULKAN_SDK%"=="" (
  echo WARNING: VULKAN_SDK is not set. Vulkan headers/libs may not be found.
)
if "%VARIANT%"=="vulkan-openblas" if "%OPENBLAS_ROOT%"=="" (
  echo WARNING: OPENBLAS_ROOT is not set. OpenBLAS may not be found.
)
if not "%VARIANT%"=="cpu" if "%LLAMA_CPP_UPSTREAM%"=="" (
  echo WARNING: LLAMA_CPP_UPSTREAM unset — ggml-vulkan.dll will NOT be built.
)

set "CMAKE_PREFIX_PATH=%OPENBLAS_ROOT%;%VULKAN_SDK%;%CMAKE_PREFIX_PATH%"
if not "%OPENBLAS_ROOT%"=="" set "PATH=%OPENBLAS_ROOT%\bin;%PATH%"
if not "%VULKAN_SDK%"=="" set "PATH=%VULKAN_SDK%\Bin;%PATH%"

set "CMAKE_EXTRA="
if not "%OPENBLAS_ROOT%"=="" set "CMAKE_EXTRA=%CMAKE_EXTRA% -DOPENBLAS_ROOT=%OPENBLAS_ROOT%"
if not "%VULKAN_SDK%"=="" set "CMAKE_EXTRA=%CMAKE_EXTRA% -DVULKAN_SDK=%VULKAN_SDK%"
if not "%LLAMA_CPP_UPSTREAM%"=="" set "CMAKE_EXTRA=%CMAKE_EXTRA% -DLLAMA_CPP_UPSTREAM=%LLAMA_CPP_UPSTREAM%"

if not exist "%ROOT%\sidecar\build" mkdir "%ROOT%\sidecar\build"

cmake -B "%ROOT%\sidecar\build" -S "%ROOT%\sidecar" ^
  -DCMAKE_BUILD_TYPE=Release ^
  -DCMAKE_PREFIX_PATH="%CMAKE_PREFIX_PATH%" ^
  -DSIDECAR_VARIANT=%VARIANT% ^
  %CMAKE_EXTRA%
if errorlevel 1 exit /b 1

cmake --build "%ROOT%\sidecar\build" --config Release -j
if errorlevel 1 exit /b 1

if not exist "%ROOT%\sidecar\bin" mkdir "%ROOT%\sidecar\bin"
if not exist "%ROOT%\sidecar\bin\ggml-plugins\win32-x64" mkdir "%ROOT%\sidecar\bin\ggml-plugins\win32-x64"

REM Sidecar exe (MSVC multi-config → build\bin\Release)
if exist "%ROOT%\sidecar\build\bin\Release\*.exe" (
  copy /Y "%ROOT%\sidecar\build\bin\Release\*.exe" "%ROOT%\sidecar\bin\"
) else if exist "%ROOT%\sidecar\build\bin\*.exe" (
  copy /Y "%ROOT%\sidecar\build\bin\*.exe" "%ROOT%\sidecar\bin\"
) else (
  echo ERROR: no sidecar .exe found under sidecar\build\bin
  exit /b 1
)

REM Runtime DLLs next to exe
if exist "%ROOT%\sidecar\build\bin\Release\*.dll" copy /Y "%ROOT%\sidecar\build\bin\Release\*.dll" "%ROOT%\sidecar\bin\" >nul
if exist "%ROOT%\sidecar\build\bin\*.dll" copy /Y "%ROOT%\sidecar\build\bin\*.dll" "%ROOT%\sidecar\bin\" >nul
if not "%OPENBLAS_ROOT%"=="" if exist "%OPENBLAS_ROOT%\bin\libopenblas.dll" (
  copy /Y "%OPENBLAS_ROOT%\bin\libopenblas.dll" "%ROOT%\sidecar\bin\" >nul
)

REM ggml GPU plugins → ggml-plugins\win32-x64 (electron + sidecar-manager layout)
set "PLUGIN_DST=%ROOT%\sidecar\bin\ggml-plugins\win32-x64"
if exist "%ROOT%\sidecar\build\ggml-plugins\*.dll" (
  copy /Y "%ROOT%\sidecar\build\ggml-plugins\*.dll" "%PLUGIN_DST%\"
)
REM Fallback: search common MSVC output dirs for ggml-vulkan*.dll
for /r "%ROOT%\sidecar\build\ggml-upstream" %%F in (ggml-vulkan*.dll) do (
  copy /Y "%%F" "%PLUGIN_DST%\" >nul
)
for /r "%ROOT%\sidecar\build\bin" %%F in (ggml-vulkan*.dll) do (
  copy /Y "%%F" "%PLUGIN_DST%\" >nul
)

echo Sidecar built: %ROOT%\sidecar\bin
dir "%ROOT%\sidecar\bin"
echo.
echo Plugins:
dir "%PLUGIN_DST%" 2>nul
endlocal
