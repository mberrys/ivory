param(
    [Parameter(Mandatory=$true)][string]$Destination,
    [string]$RHome = 'C:/Program Files/R/R-4.6.1'
)
$ErrorActionPreference = 'Stop'
$runtimeRoot = [IO.Path]::GetFullPath($Destination)
$runtimeLock = Get-Content (Join-Path $PSScriptRoot 'fixtures/runtime-lock.json') -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Force $runtimeRoot | Out-Null
$runtimeVersion = & (Join-Path $RHome 'bin/Rscript.exe') --vanilla -e 'cat(as.character(getRversion()))'
if ($LASTEXITCODE -ne 0 -or $runtimeVersion -ne $runtimeLock.r.version) { throw 'Supply an R home matching the pinned version.' }
$env:UV_PYTHON_INSTALL_DIR = Join-Path $runtimeRoot 'python'
$env:UV_CACHE_DIR = Join-Path $runtimeRoot 'uv-cache'
uv python install $runtimeLock.python.version --no-bin
if ($LASTEXITCODE -ne 0) { throw 'Pinned Python provisioning failed' }
$archive = Join-Path $runtimeRoot 'quarto.zip'
if (-not (Test-Path -LiteralPath $archive)) { Invoke-WebRequest $runtimeLock.quarto.windowsUrl -OutFile $archive }
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $runtimeLock.quarto.sha256) { throw 'Quarto checksum mismatch' }
$quartoRoot = Join-Path $runtimeRoot 'quarto'
if (-not (Test-Path -LiteralPath (Join-Path $quartoRoot 'bin/quarto.js'))) { Expand-Archive -LiteralPath $archive -DestinationPath $quartoRoot }
$rDestination = Join-Path $runtimeRoot 'r'
if (-not (Test-Path -LiteralPath $rDestination)) {
    New-Item -ItemType Directory $rDestination | Out-Null
    Get-ChildItem -LiteralPath $RHome | Copy-Item -Destination $rDestination -Recurse
}
$pythonExecutable = Get-ChildItem -LiteralPath (Join-Path $runtimeRoot 'python') -Recurse -Filter python.exe |
    Where-Object { $_.FullName -match 'cpython-' } | Select-Object -First 1
if (-not $pythonExecutable) { throw 'Pinned Python executable missing' }
@{ python = $pythonExecutable.FullName; r = (Join-Path $rDestination 'bin/Rscript.exe'); quarto = $quartoRoot } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeRoot 'runtime.json') -Encoding utf8
Write-Output "Prepared pinned runtimes: $runtimeRoot"
