@echo off
rem Removes MD Viewer and its .md file association
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
pause
