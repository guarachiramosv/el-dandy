$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$androidDir = Join-Path $projectRoot "android"
$repoRoot = Split-Path -Parent $projectRoot

$jdkCandidates = @(
  $env:JAVA_HOME,
  "C:\Program Files\Android\openjdk\jdk-21.0.8",
  "C:\Program Files\Android\Android Studio\jbr",
  "C:\Program Files\Android\Android Studio1\jbr"
) | Where-Object { $_ -and (Test-Path (Join-Path $_ "bin\java.exe")) }

if (-not $jdkCandidates -or $jdkCandidates.Count -eq 0) {
  throw "No se encontro Java/JDK. Instala JDK 17+ o Android Studio, o configura JAVA_HOME."
}

$env:JAVA_HOME = $jdkCandidates[0]
$env:ANDROID_HOME = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:NODE_ENV = "production"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

$envFile = Join-Path $projectRoot ".env"
if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $projectRoot ".env.example") $envFile
  Write-Warning "Se creo mobile\.env desde .env.example. Edita EXPO_PUBLIC_API_URL con la URL publica del backend antes del APK final."
}

$envLines = Get-Content $envFile
foreach ($line in $envLines) {
  if ($line -match '^\s*EXPO_PUBLIC_API_URL\s*=\s*"?([^"#]+)"?\s*$') {
    $env:EXPO_PUBLIC_API_URL = $matches[1].Trim()
  }
}

if (-not $env:EXPO_PUBLIC_API_URL -or $env:EXPO_PUBLIC_API_URL -match '192\.168\.|localhost|tu-backend') {
  throw "Configura mobile\.env con EXPO_PUBLIC_API_URL=https://sistema-el-dandy.onrender.com/api antes de generar el APK."
}

if (-not (Test-Path $androidDir)) {
  Push-Location $projectRoot
  try {
    & "npx.cmd" expo prebuild --platform android
    if ($LASTEXITCODE -ne 0) {
      throw "Expo prebuild fallo con codigo $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }
}

$appBuildGradle = Join-Path $androidDir "app\build.gradle"
if (-not (Test-Path $appBuildGradle)) {
  throw "No se encontro $appBuildGradle."
}

$keystoreFile = Join-Path $androidDir "app\el-dandy-release.keystore"
$keystorePropertiesFilePath = Join-Path $androidDir "keystore.properties"
if (-not (Test-Path $keystoreFile) -or -not (Test-Path $keystorePropertiesFilePath)) {
  $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $bytes = New-Object byte[] 28
  $rng.GetBytes($bytes)
  $storePassword = -join ($bytes | ForEach-Object { $chars[($_ % $chars.Length)] })
  $keytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"

  if (-not (Test-Path $keystoreFile)) {
    & $keytool -genkeypair -v -storetype PKCS12 -keystore $keystoreFile -alias el-dandy -keyalg RSA -keysize 2048 -validity 10000 -storepass $storePassword -keypass $storePassword -dname "CN=El Dandy, OU=Mobile, O=El Dandy, L=Santa Cruz, ST=Santa Cruz, C=BO"
    if ($LASTEXITCODE -ne 0) {
      throw "No se pudo crear la keystore release."
    }
  }

  @"
storeFile=app/el-dandy-release.keystore
storePassword=$storePassword
keyAlias=el-dandy
keyPassword=$storePassword
"@ | Set-Content -Encoding ASCII $keystorePropertiesFilePath
}

$gradleText = Get-Content $appBuildGradle -Raw
if ($gradleText -notmatch "keystorePropertiesFile") {
  $gradleText = $gradleText.Replace(
    'def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()',
    @'
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('keystore.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()
'@
  )
  $gradleText = $gradleText.Replace(
    @'
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
'@,
    @'
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile rootProject.file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
'@
  )
  $gradleText = $gradleText.Replace(
    'signingConfig signingConfigs.debug',
    'signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug'
  )
  Set-Content -Encoding UTF8 $appBuildGradle $gradleText
}

$gradleText = Get-Content $appBuildGradle -Raw
if ($gradleText -notmatch "react_native_dev_server_ip") {
  $gradleText = $gradleText.Replace(
    @'
            def enablePngCrunchInRelease = findProperty('android.enablePngCrunchInReleaseBuilds') ?: 'true'
            crunchPngs enablePngCrunchInRelease.toBoolean()
'@,
    @'
            def enablePngCrunchInRelease = findProperty('android.enablePngCrunchInReleaseBuilds') ?: 'true'
            crunchPngs enablePngCrunchInRelease.toBoolean()
            resValue "string", "react_native_dev_server_ip", ""
'@
  )
  Set-Content -Encoding UTF8 $appBuildGradle $gradleText
}

$androidFullPath = [System.IO.Path]::GetFullPath($androidDir).TrimEnd('\') + '\'
$releaseArtifacts = @(
  (Join-Path $androidDir "app\build\generated\assets\createBundleReleaseJsAndAssets"),
  (Join-Path $androidDir "app\build\generated\sourcemaps\react\release"),
  (Join-Path $androidDir "app\build\intermediates\assets\release\mergeReleaseAssets\index.android.bundle"),
  (Join-Path $androidDir "app\build\intermediates\sourcemaps\react\release"),
  (Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"),
  (Join-Path $androidDir "app\build\outputs\apk\release\output-metadata.json")
)

foreach ($artifact in $releaseArtifacts) {
  if (Test-Path $artifact) {
    $artifactFullPath = [System.IO.Path]::GetFullPath($artifact)
    if (-not $artifactFullPath.StartsWith($androidFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Ruta de build invalida para limpiar: $artifactFullPath"
    }
    Remove-Item -LiteralPath $artifactFullPath -Recurse -Force
  }
}

Push-Location $androidDir
try {
  & ".\gradlew.bat" assembleRelease
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle fallo con codigo $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}

$sourceApk = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $sourceApk)) {
  throw "No se encontro el APK generado en $sourceApk."
}

$releaseDir = Join-Path $projectRoot "release-apk"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
$targetApk = Join-Path $releaseDir "el-dandy.apk"
Copy-Item $sourceApk $targetApk -Force

Write-Host "APK generado: $targetApk"
Write-Host "Backend usado por el APK: $env:EXPO_PUBLIC_API_URL"
