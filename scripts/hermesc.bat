@echo off
set HERMESC_EXE=%~dp0..\node_modules\hermes-compiler\hermesc\win64-bin\hermesc.exe
if exist "%HERMESC_EXE%" (
    "%HERMESC_EXE%" %*
) else (
    node "%~dp0hermesc-fallback.js" %*
)
