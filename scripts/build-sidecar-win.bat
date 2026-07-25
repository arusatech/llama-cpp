@echo off
REM Build llama-cpp sidecar for Windows x64 + optional ggml-vulkan.dll plugins.
REM Default variant: vulkan-openblas
REM
REM Env (PowerShell):
REM   $env:VULKAN_SDK = "C:\VulkanSDK\1.4.350.0"
REM   $env:OPENBLAS_ROOT = "C:\OpenBLAS"
REM   $env:LLAMA_CPP_UPSTREAM = "<override; default: third_party\llama.cpp>"
REM
REM Usage:
REM   scripts\build-sidecar-win.bat
REM   scripts\build-sidecar-win.bat vulkan-openblas
REM   scripts\build-sidecar-win.bat vulkan
REM   scripts\build-sidecar-win.bat cpu
REM   scripts\build-sidecar-win.bat openvino   (requires OpenVINO Toolkit + OpenCL)

setlocal EnableExtensions
set ROOT=%~dp0..
set VARIANT=%1
if "%VARIANT%"=="" set VARIANT=vulkan-openblas

if "%VULKAN_SDK%"=="" if exist "C:\VulkanSDK\1.4.350.0" set "VULKAN_SDK=C:\VulkanSDK\1.4.350.0"
if "%OPENBLAS_ROOT%"=="" if exist "C:\OpenBLAS" set "OPENBLAS_ROOT=C:\OpenBLAS"
if "%LLAMA_CPP_UPSTREAM%"=="" if exist "%ROOT%\third_party\llama.cpp\ggml\CMakeLists.txt" set "LLAMA_CPP_UPSTREAM=%ROOT%\third_party\llama.cpp"
if "%LLAMA_CPP_UPSTREAM%"=="" if exist "%ROOT%\..\llama.cpp\ggml\CMakeLists.txt" set "LLAMA_CPP_UPSTREAM=%ROOT%\..\llama.cpp"

REM Auto-detect OpenVINO (classic Program Files or winget MSIX 2026.x)
if "%OpenVINO_DIR%"=="" if exist "C:\Program Files\Intel\openvino_2026\runtime\cmake\OpenVINOConfig.cmake" set "OpenVINO_DIR=C:\Program Files\Intel\openvino_2026\runtime\cmake"
if "%OpenVINO_DIR%"=="" if exist "C:\Program Files\Intel\openvino_2025\runtime\cmake\OpenVINOConfig.cmake" set "OpenVINO_DIR=C:\Program Files\Intel\openvino_2025\runtime\cmake"
if "%OpenVINO_DIR%"=="" if "%INTEL_OPENVINO_DIR%"=="" (
  for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "Get-AppxPackage *OpenVINO* | Select-Object -ExpandProperty InstallLocation -First 1"`) do (
    if exist "%%P\runtime\cmake\OpenVINOConfig.cmake" (
      set "INTEL_OPENVINO_DIR=%%P"
      set "OpenVINO_DIR=%%P\runtime\cmake"
    )
  )
)
if "%OpenVINO_DIR%"=="" if not "%INTEL_OPENVINO_DIR%"=="" if exist "%INTEL_OPENVINO_DIR%\runtime\cmake\OpenVINOConfig.cmake" set "OpenVINO_DIR=%INTEL_OPENVINO_DIR%\runtime\cmake"

echo [sidecar-win] VARIANT=%VARIANT%
echo [sidecar-win] VULKAN_SDK=%VULKAN_SDK%
echo [sidecar-win] OPENBLAS_ROOT=%OPENBLAS_ROOT%
echo [sidecar-win] LLAMA_CPP_UPSTREAM=%LLAMA_CPP_UPSTREAM%
echo [sidecar-win] OpenVINO_DIR=%OpenVINO_DIR%

if "%VARIANT%"=="vulkan-openblas" if "%VULKAN_SDK%"=="" (
  echo WARNING: VULKAN_SDK is not set. Vulkan headers/libs may not be found.
)
if "%VARIANT%"=="vulkan-openblas" if "%OPENBLAS_ROOT%"=="" (
  echo WARNING: OPENBLAS_ROOT is not set. OpenBLAS may not be found.
)
if /I "%VARIANT%"=="openvino" if "%OpenVINO_DIR%"=="" (
  echo ERROR: OpenVINO_DIR not set. Install Intel OpenVINO Toolkit ^(winget: Intel.OpenVINOToolkit.2026.2.0^) or set OpenVINO_DIR.
  exit /b 1
)
if not "%VARIANT%"=="cpu" if "%LLAMA_CPP_UPSTREAM%"=="" (
  echo WARNING: LLAMA_CPP_UPSTREAM unset — GPU plugins will NOT be built.
)

set "CMAKE_PREFIX_PATH=%OPENBLAS_ROOT%;%VULKAN_SDK%;%OpenVINO_DIR%;%CMAKE_PREFIX_PATH%"
if not "%OPENBLAS_ROOT%"=="" set "PATH=%OPENBLAS_ROOT%\bin;%PATH%"
if not "%VULKAN_SDK%"=="" set "PATH=%VULKAN_SDK%\Bin;%PATH%"
if not "%INTEL_OPENVINO_DIR%"=="" set "PATH=%INTEL_OPENVINO_DIR%\runtime\bin\intel64\Release;%PATH%"

set "CMAKE_EXTRA="
if not "%OPENBLAS_ROOT%"=="" set "CMAKE_EXTRA=%CMAKE_EXTRA% -DOPENBLAS_ROOT=%OPENBLAS_ROOT%"
if not "%VULKAN_SDK%"=="" set "CMAKE_EXTRA=%CMAKE_EXTRA% -DVULKAN_SDK=%VULKAN_SDK%"
if not "%LLAMA_CPP_UPSTREAM%"=="" set "CMAKE_EXTRA=%CMAKE_EXTRA% -DLLAMA_CPP_UPSTREAM=%LLAMA_CPP_UPSTREAM%"
if not "%OpenVINO_DIR%"=="" set "CMAKE_EXTRA=%CMAKE_EXTRA% -DOpenVINO_DIR=%OpenVINO_DIR%"

REM OpenCL headers+lib for ggml-openvino (Khronos clones under third_party/)
if "%OpenCL_INCLUDE_DIR%"=="" if exist "%ROOT%\third_party\OpenCL-Headers\CL\cl.h" set "OpenCL_INCLUDE_DIR=%ROOT%\third_party\OpenCL-Headers"
if "%OpenCL_LIBRARY%"=="" if exist "%ROOT%\third_party\OpenCL-ICD-Loader\build\Release\OpenCL.lib" set "OpenCL_LIBRARY=%ROOT%\third_party\OpenCL-ICD-Loader\build\Release\OpenCL.lib"
if not "%OpenCL_INCLUDE_DIR%"=="" set "CMAKE_EXTRA=%CMAKE_EXTRA% -DOpenCL_INCLUDE_DIR=%OpenCL_INCLUDE_DIR%"
if not "%OpenCL_LIBRARY%"=="" set "CMAKE_EXTRA=%CMAKE_EXTRA% -DOpenCL_LIBRARY=%OpenCL_LIBRARY%"
if /I "%VARIANT%"=="openvino" (
  echo [sidecar-win] OpenCL_INCLUDE_DIR=%OpenCL_INCLUDE_DIR%
  echo [sidecar-win] OpenCL_LIBRARY=%OpenCL_LIBRARY%
)

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

REM Runtime DLLs next to exe (CPU + shared ggml/llama only — NOT GPU plugins)
if exist "%ROOT%\sidecar\build\bin\Release\*.dll" (
  for %%F in ("%ROOT%\sidecar\build\bin\Release\*.dll") do (
    echo %%~nxF | findstr /I /R "vulkan cuda hip openvino rocm" >nul
    if errorlevel 1 copy /Y "%%F" "%ROOT%\sidecar\bin\" >nul
  )
)
if exist "%ROOT%\sidecar\build\bin\*.dll" (
  for %%F in ("%ROOT%\sidecar\build\bin\*.dll") do (
    echo %%~nxF | findstr /I /R "vulkan cuda hip openvino rocm" >nul
    if errorlevel 1 copy /Y "%%F" "%ROOT%\sidecar\bin\" >nul
  )
)
if not "%OPENBLAS_ROOT%"=="" if exist "%OPENBLAS_ROOT%\bin\libopenblas.dll" (
  copy /Y "%OPENBLAS_ROOT%\bin\libopenblas.dll" "%ROOT%\sidecar\bin\" >nul
)

REM ggml GPU plugins → ggml-plugins\win32-x64 ONLY (never next to exe — duplicate load = heap corruption)
set "PLUGIN_DST=%ROOT%\sidecar\bin\ggml-plugins\win32-x64"
if exist "%ROOT%\sidecar\build\ggml-plugins\*.dll" (
  copy /Y "%ROOT%\sidecar\build\ggml-plugins\*.dll" "%PLUGIN_DST%\"
)
for /r "%ROOT%\sidecar\build\bin" %%F in (ggml-vulkan*.dll ggml-cuda*.dll ggml-hip*.dll ggml-openvino*.dll) do (
  copy /Y "%%F" "%PLUGIN_DST%\" >nul
)

REM Optional: stage OpenVINO redistributables when toolkit is installed
if /I "%VARIANT%"=="openvino" (
  node "%ROOT%\scripts\stage-openvino-runtime.cjs" "%ROOT%\sidecar\bin\openvino-runtime"
)

echo Sidecar built: %ROOT%\sidecar\bin
dir "%ROOT%\sidecar\bin"
echo.
echo Plugins:
dir "%PLUGIN_DST%" 2>nul
endlocal
