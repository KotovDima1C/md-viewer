@echo off
rem Installs MD Viewer for the current user and links .md files to it
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
pause
