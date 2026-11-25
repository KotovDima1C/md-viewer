# Builds MD Viewer, copies it to %LOCALAPPDATA%\Programs\md-viewer
# and registers it for .md files (current user only, no admin rights needed).
$ErrorActionPreference = 'Stop'

$dest = Join-Path $env:LOCALAPPDATA 'Programs\md-viewer'
$exe  = Join-Path $dest 'md-viewer.exe'

Get-Process md-viewer -ErrorAction SilentlyContinue | Stop-Process -Force
dotnet publish (Join-Path $PSScriptRoot 'src\MdViewer.csproj') -c Release -o $dest --nologo
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }

function Set-Key([string]$path, [string]$value) {
    if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
    if ($null -ne $value) { Set-Item -Path $path -Value $value }
}

$cls    = 'HKCU:\Software\Classes'
$progId = 'MdViewer.Markdown'
$exts   = '.md', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdwn'

Set-Key "$cls\$progId" 'Markdown'
Set-Key "$cls\$progId\DefaultIcon" "`"$exe`",0"
Set-Key "$cls\$progId\shell\open\command" "`"$exe`" `"%1`""

# Shows up in "Open with" and in Settings > Default apps
Set-Key "$cls\Applications\md-viewer.exe" $null
Set-ItemProperty "$cls\Applications\md-viewer.exe" -Name FriendlyAppName -Value 'MD Viewer'
Set-Key "$cls\Applications\md-viewer.exe\shell\open\command" "`"$exe`" `"%1`""
Set-Key "$cls\Applications\md-viewer.exe\SupportedTypes" $null

foreach ($ext in $exts) {
    Set-Key "$cls\$ext" $progId
    Set-Key "$cls\$ext\OpenWithProgids" $null
    Set-ItemProperty "$cls\$ext\OpenWithProgids" -Name $progId -Value ''
    Set-ItemProperty "$cls\Applications\md-viewer.exe\SupportedTypes" -Name $ext -Value ''
}

# Tell Explorer that associations changed
Add-Type -Namespace Win32 -Name Shell -MemberDefinition '[DllImport("shell32.dll")] public static extern void SHChangeNotify(int e, int f, IntPtr a, IntPtr b);'
[Win32.Shell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host "Installed: $exe"
Write-Host 'If .md still opens in another app: right-click a .md file > Open with > Choose another app > MD Viewer > Always.'
