@echo off
REM Build llama-cpp sidecar for Windows x64 (Vulkan + OpenBLAS default)
setlocal
set ROOT=%~dp0..
set VARIANT=%1
if "%VARIANT%"=="" set VARIANT=vulkan-openblas

if not exist "%ROOT%\sidecar\build" mkdir "%ROOT%\sidecar\build"

cmake -B "%ROOT%\sidecar\build" -S "%ROOT%\sidecar" ^
  -DCMAKE_BUILD_TYPE=Release ^
  -DSIDECAR_VARIANT=%VARIANT%

cmake --build "%ROOT%\sidecar\build" --config Release -j

if not exist "%ROOT%\sidecar\bin" mkdir "%ROOT%\sidecar\bin"
copy /Y "%ROOT%\sidecar\build\bin\*" "%ROOT%\sidecar\bin\"

echo Sidecar built: %ROOT%\sidecar\bin
