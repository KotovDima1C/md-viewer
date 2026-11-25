# Builds MD Viewer from source and installs it (see setup.ps1).
# Needs .NET SDK 9; the installed app needs .NET Desktop Runtime 9 (comes with the SDK).
$ErrorActionPreference = 'Stop'

$out = Join-Path $PSScriptRoot 'src\bin\publish'
dotnet publish (Join-Path $PSScriptRoot 'src\MdViewer.csproj') -c Release -o $out --nologo
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }

& (Join-Path $PSScriptRoot 'setup.ps1') -From $out
