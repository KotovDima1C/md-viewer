# Builds the release zip: dist\md-viewer-<version>-win-x64.zip
# Self-contained (.NET runtime inside), so users need nothing but Windows 10/11 with WebView2.
$ErrorActionPreference = 'Stop'

$proj    = Join-Path $PSScriptRoot 'src\MdViewer.csproj'
$version = ([xml](Get-Content $proj -Raw)).Project.PropertyGroup.Version | Where-Object { $_ } | Select-Object -First 1
$name    = "md-viewer-$version-win-x64"
$dist    = Join-Path $PSScriptRoot 'dist'
$stage   = Join-Path $dist $name
$zip     = Join-Path $dist "$name.zip"

if (Test-Path $stage) { [IO.Directory]::Delete($stage, $true) }
if (Test-Path $zip)   { [IO.File]::Delete($zip) }

dotnet publish $proj -c Release -r win-x64 --self-contained true -o (Join-Path $stage 'app') --nologo
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }

foreach ($f in 'setup.ps1', 'setup.cmd', 'uninstall.ps1', 'uninstall.cmd', 'THIRD-PARTY-NOTICES.txt') {
    Copy-Item (Join-Path $PSScriptRoot $f) $stage
}
Copy-Item (Join-Path $PSScriptRoot 'docs\release-readme.txt') (Join-Path $stage 'README.txt')
Copy-Item (Join-Path $PSScriptRoot 'LICENSE') (Join-Path $stage 'LICENSE.txt')

Compress-Archive -Path $stage -DestinationPath $zip -CompressionLevel Optimal
$size = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "Release: $zip ($size MB)"

# Copy with a version-less name: attach it to every release too, so that
# https://github.com/KotovDima1C/md-viewer/releases/latest/download/md-viewer-win-x64.zip
# (the download button on the landing page) always points to the newest build.
$latest = Join-Path $dist 'md-viewer-win-x64.zip'
Copy-Item $zip $latest -Force
Write-Host "Also attach: $latest"
Write-Host "  gh release create v$version `"$zip`" `"$latest`" --repo KotovDima1C/md-viewer ..."
