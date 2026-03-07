param(
    [switch]$Clean,
    [switch]$ResetCache
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$message) {
    Write-Host "`n==> $message" -ForegroundColor Cyan
}

function Get-SdkPath {
    param([string]$AndroidDir)

    $localProps = Join-Path $AndroidDir 'local.properties'
    if (Test-Path $localProps) {
        $sdkLine = Get-Content $localProps | Where-Object { $_ -match '^sdk\.dir=' } | Select-Object -First 1
        if ($sdkLine) {
            $value = $sdkLine -replace '^sdk\.dir=', ''
            $value = $value -replace '\\:', ':'
            $value = $value -replace '\\', '\'
            if (Test-Path $value) {
                return $value
            }
        }
    }

    foreach ($candidate in @(
        $env:ANDROID_SDK_ROOT,
        $env:ANDROID_HOME,
        'C:\Users\milli\AppData\Local\Android\Sdk'
    )) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    throw 'Android SDK path could not be resolved. Check local.properties or ANDROID_HOME.'
}

function Get-JavaHome {
    foreach ($candidate in @(
        $env:JAVA_HOME,
        'C:\Program Files\Java\jdk-17',
        'C:\Program Files\Android\Android Studio\jbr',
        'C:\Program Files\Java\jdk-24'
    )) {
        if ($candidate -and (Test-Path (Join-Path $candidate 'bin\java.exe'))) {
            return $candidate
        }
    }

    throw 'No valid JDK was found. Install JDK 17 or use Android Studio bundled JBR.'
}

function Test-MetroRunning {
    $listener = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
    return $null -ne $listener
}

function Start-MetroWindow {
    param([string]$MobileDir, [switch]$ResetCache)

    $command = if ($ResetCache) {
        "Set-Location '$MobileDir'; npx react-native start --reset-cache"
    } else {
        "Set-Location '$MobileDir'; npm run start"
    }

    Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', $command | Out-Null
}

function Wait-ForMetro {
    $retries = 60
    while ($retries -gt 0) {
        if (Test-MetroRunning) {
            return
        }
        Start-Sleep -Seconds 2
        $retries--
    }
    throw 'Metro did not start on port 8081 in time.'
}

function Get-Devices([string]$AdbPath) {
    & $AdbPath start-server | Out-Null
    $lines = & $AdbPath devices
    return $lines | Where-Object { $_ -match "`tdevice$" } | ForEach-Object { ($_ -split "`t")[0] }
}

function Ensure-DeviceOrEmulator([string]$AdbPath, [string]$EmulatorPath) {
    $devices = Get-Devices $AdbPath
    if ($devices.Count -gt 0) {
        return $devices
    }

    if (-not (Test-Path $EmulatorPath)) {
        throw 'No connected device and emulator executable not found.'
    }

    $avds = & $EmulatorPath -list-avds
    if (-not $avds) {
        throw 'No connected device and no Android Virtual Device configured.'
    }

    $avd = ($avds | Select-Object -First 1).Trim()
    Write-Step "Starting emulator $avd"
    Start-Process $EmulatorPath -ArgumentList '-avd', $avd | Out-Null

    $retries = 90
    while ($retries -gt 0) {
        $devices = Get-Devices $AdbPath
        if ($devices.Count -gt 0) {
            return $devices
        }
        Start-Sleep -Seconds 2
        $retries--
    }

    throw 'Emulator did not become available in time.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$mobileDir = Join-Path $repoRoot 'mobile'
$androidDir = Join-Path $mobileDir 'android'
$sdkPath = Get-SdkPath $androidDir
$javaHome = Get-JavaHome
$adbPath = Join-Path $sdkPath 'platform-tools\adb.exe'
$emulatorPath = Join-Path $sdkPath 'emulator\emulator.exe'
$gradleWrapper = Join-Path $androidDir 'gradlew.bat'

if (-not (Test-Path $adbPath)) {
    throw "adb.exe not found at $adbPath"
}
if (-not (Test-Path $gradleWrapper)) {
    throw "gradlew.bat not found at $gradleWrapper"
}

$env:ANDROID_HOME = $sdkPath
$env:ANDROID_SDK_ROOT = $sdkPath
$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$sdkPath\platform-tools;$sdkPath\emulator;$env:Path"

Write-Step "Android SDK: $sdkPath"
Write-Step "Java Home: $javaHome"

if (-not (Test-MetroRunning)) {
    Write-Step 'Starting Metro in a new PowerShell window'
    Start-MetroWindow -MobileDir $mobileDir -ResetCache:$ResetCache
} else {
    Write-Step 'Metro is already running'
}

Wait-ForMetro
Write-Step 'Metro is listening on port 8081'

$devices = Ensure-DeviceOrEmulator $adbPath $emulatorPath
Write-Step ("Connected targets: " + ($devices -join ', '))

foreach ($device in $devices) {
    & $adbPath -s $device reverse tcp:8081 tcp:8081 | Out-Null
}
Write-Step 'adb reverse configured for port 8081'

Push-Location $androidDir
try {
    if ($Clean) {
        Write-Step 'Running Gradle clean'
        & $gradleWrapper clean
        if ($LASTEXITCODE -ne 0) { throw 'Gradle clean failed.' }
    }

    Write-Step 'Installing debug build'
    & $gradleWrapper installDebug
    if ($LASTEXITCODE -ne 0) { throw 'Gradle installDebug failed.' }
}
finally {
    Pop-Location
}

foreach ($device in $devices) {
    & $adbPath -s $device shell am start -n com.uniequb/com.uniequb.MainActivity -a android.intent.action.MAIN -c android.intent.category.LAUNCHER | Out-Null
}

Write-Step 'UniEqub debug app launched successfully'
