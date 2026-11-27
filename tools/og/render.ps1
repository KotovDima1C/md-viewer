# Рисует баннер превью ссылки docs/og.png (1200x630) из tools/og/og.html через Edge без окна.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$out  = Join-Path $here '..\..\docs\og.png' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $out) { $out = [IO.Path]::GetFullPath((Join-Path $here '..\..\docs\og.png')) }
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$src  = 'file:///' + ((Join-Path $here 'og.html') -replace '\\', '/')
$tmp  = Join-Path $env:TEMP 'md-viewer-og-profile'
& $edge --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
  --user-data-dir="$tmp" --window-size=1200,630 --virtual-time-budget=8000 `
  --screenshot="$out" $src | Out-Null
Start-Sleep -Milliseconds 500
Get-Item $out | Select-Object FullName, Length
