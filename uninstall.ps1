# Removes MD Viewer and its file associations (current user).
$ErrorActionPreference = 'SilentlyContinue'

Get-Process md-viewer | Stop-Process -Force
$cls = 'HKCU:\Software\Classes'
Remove-Item "$cls\MdViewer.Markdown" -Recurse -Force
Remove-Item "$cls\Applications\md-viewer.exe" -Recurse -Force
foreach ($ext in '.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdwn') {
    if ((Get-Item "$cls\$ext").GetValue('') -eq 'MdViewer.Markdown') { Set-Item "$cls\$ext" -Value '' }
    Remove-ItemProperty "$cls\$ext\OpenWithProgids" -Name 'MdViewer.Markdown'
}
Remove-Item (Join-Path $env:LOCALAPPDATA 'Programs\md-viewer') -Recurse -Force
Remove-Item (Join-Path $env:LOCALAPPDATA 'md-viewer') -Recurse -Force
Write-Host 'MD Viewer removed.'
