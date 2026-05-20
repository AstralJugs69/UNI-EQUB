param(
    [switch]$Clean,
    [switch]$Dev,
    [switch]$NoInstall,
    [switch]$SkipBuild,
    [switch]$Check
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$message) {
    Write-Host "`n==> $message" -ForegroundColor Cyan
}

function Test-PortListening([int]$Port) {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $listener
}

function Wait-ForPort([int]$Port, [string]$Name) {
    $retries = 45
    while ($retries -gt 0) {
        if (Test-PortListening -Port $Port) {
            return
        }
        Start-Sleep -Seconds 1
        $retries--
    }
    throw "$Name did not start on port $Port in time."
}

function Get-AdbPath {
    foreach ($candidate in @(
        'adb',
        (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'),
        (Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe'),
        (Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe')
    )) {
        if (-not $candidate) {
            continue
        }
        $resolved = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($resolved) {
            return $resolved.Source
        }
        if (Test-Path $candidate) {
            return $candidate
        }
    }
    return $null
}

function Invoke-Npm {
    param(
        [string]$DesktopDir,
        [string[]]$Arguments
    )

    Push-Location $DesktopDir
    try {
        & npm @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "npm $($Arguments -join ' ') failed."
        }
    }
    finally {
        Pop-Location
    }
}

function Start-ViteDevServer {
    param([string]$DesktopDir)

    if (Test-PortListening -Port 5173) {
        Write-Step 'Desktop Vite server is already running on port 5173'
        return
    }

    $logDir = Join-Path (Split-Path -Parent $DesktopDir) '.temp'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $logPath = Join-Path $logDir 'desktop-controller-vite.log'
    $command = "Set-Location '$DesktopDir'; npm run dev *> '$logPath'"

    Write-Step 'Starting desktop Vite server'
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $command | Out-Null
    Wait-ForPort -Port 5173 -Name 'Desktop Vite server'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$desktopDir = Join-Path $repoRoot 'desktop'
$packageJson = Join-Path $desktopDir 'package.json'
$nodeModules = Join-Path $desktopDir 'node_modules'
$distIndex = Join-Path $desktopDir 'dist\index.html'
$adbPath = Get-AdbPath

if (-not (Test-Path $packageJson)) {
    throw "Desktop package not found at $packageJson"
}

Write-Step "Desktop controller: $desktopDir"
if ($adbPath) {
    Write-Step "ADB: $adbPath"
    $adbParent = Split-Path -Parent $adbPath
    if ($adbParent -and ($env:Path -notlike "*$adbParent*")) {
        $env:Path = "$adbParent;$env:Path"
    }
} else {
    Write-Step 'ADB was not found on PATH. The controller can still open, but device discovery will fail until adb is available.'
}

if ($Check) {
    Write-Step 'Check complete'
    exit 0
}

if ($Clean) {
    Write-Step 'Removing generated desktop dist'
    Remove-Item -LiteralPath (Join-Path $desktopDir 'dist') -Recurse -Force -ErrorAction SilentlyContinue
}

if (-not $NoInstall -and -not (Test-Path $nodeModules)) {
    Write-Step 'Installing desktop dependencies'
    Invoke-Npm -DesktopDir $desktopDir -Arguments @('install')
} elseif ($NoInstall) {
    Write-Step 'Skipping dependency install'
} else {
    Write-Step 'Desktop dependencies already installed'
}

if ($Dev) {
    Start-ViteDevServer -DesktopDir $desktopDir
    Write-Step 'Launching desktop controller against Vite'
    Push-Location $desktopDir
    try {
        $env:VITE_DEV_SERVER_URL = 'http://127.0.0.1:5173'
        & npm run electron
        if ($LASTEXITCODE -ne 0) {
            throw 'Electron launch failed.'
        }
    }
    finally {
        Remove-Item Env:\VITE_DEV_SERVER_URL -ErrorAction SilentlyContinue
        Pop-Location
    }
    exit 0
}

if (-not $SkipBuild -or -not (Test-Path $distIndex)) {
    Write-Step 'Building desktop controller'
    Invoke-Npm -DesktopDir $desktopDir -Arguments @('run', 'build')
} else {
    Write-Step 'Using existing desktop build'
}

Write-Step 'Launching desktop controller'
Invoke-Npm -DesktopDir $desktopDir -Arguments @('run', 'electron')
