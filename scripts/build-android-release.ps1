param(
  [string]$StoreFile = $env:UNIEQUB_RELEASE_STORE_FILE,
  [string]$StorePassword = $env:UNIEQUB_RELEASE_STORE_PASSWORD,
  [string]$KeyAlias = $env:UNIEQUB_RELEASE_KEY_ALIAS,
  [string]$KeyPassword = $env:UNIEQUB_RELEASE_KEY_PASSWORD
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $repoRoot "mobile\android"

$javaHome = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $javaHome) {
  $env:JAVA_HOME = $javaHome
  $env:Path = "$env:JAVA_HOME\bin;$env:Path"
}

if ($StoreFile -and $StorePassword -and $KeyAlias -and $KeyPassword) {
  $env:UNIEQUB_RELEASE_STORE_FILE = $StoreFile
  $env:UNIEQUB_RELEASE_STORE_PASSWORD = $StorePassword
  $env:UNIEQUB_RELEASE_KEY_ALIAS = $KeyAlias
  $env:UNIEQUB_RELEASE_KEY_PASSWORD = $KeyPassword
  Write-Host "Building release APK with configured release signing key."
} else {
  Write-Warning "Release signing env vars are incomplete. Gradle will fall back to the checked-in debug keystore."
}

Push-Location $androidDir
try {
  .\gradlew.bat assembleRelease
} finally {
  Pop-Location
}

$apk = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apk)) {
  throw "Release APK was not produced at $apk"
}

Get-Item $apk | Select-Object FullName, Length, LastWriteTime
