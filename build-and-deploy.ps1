# ============================================================
# DriveFlow — One Click Build & Deploy
# Run: .\build-and-deploy.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$FRONTEND = "$PSScriptRoot\frontend"
$BACKEND  = "$PSScriptRoot\backend"
$APK_SRC  = "$FRONTEND\android\app\build\outputs\apk\debug\app-debug.apk"
$APK_DEST = "$FRONTEND\android\app\build\outputs\apk\debug\DriveFlow.apk"

function Log($msg) { Write-Host "`n$msg" -ForegroundColor Cyan }
function OK($msg)  { Write-Host "  $msg" -ForegroundColor Green }
function Fail($msg){ Write-Host "  ERROR: $msg" -ForegroundColor Red; exit 1 }

# ── Step 1: Next.js Build ─────────────────────────────────
Log "Step 1/5 — Building Next.js..."
Set-Location $FRONTEND
npm run build
if ($LASTEXITCODE -ne 0) { Fail "Next.js build failed" }
OK "Next.js build complete"

# ── Step 2: Capacitor Sync ────────────────────────────────
Log "Step 2/5 — Syncing Capacitor..."
npx cap sync android
if ($LASTEXITCODE -ne 0) { Fail "Capacitor sync failed" }
OK "Capacitor sync complete"

# ── Step 3: Build APK ─────────────────────────────────────
Log "Step 3/5 — Building APK..."
Set-Location "$FRONTEND\android"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew assembleDebug
if ($LASTEXITCODE -ne 0) { Fail "APK build failed" }
OK "APK build complete"

# ── Step 4: Rename APK ────────────────────────────────────
Log "Step 4/5 — Renaming APK to DriveFlow.apk..."
Copy-Item $APK_SRC $APK_DEST -Force
OK "Renamed: DriveFlow.apk"

# ── Step 5: Upload to Google Drive ────────────────────────
Log "Step 5/5 — Uploading to Google Drive..."
Set-Location $BACKEND
npx ts-node --project tsconfig.json src/scratch/replace_apk.ts
if ($LASTEXITCODE -ne 0) { Fail "Google Drive upload failed" }
OK "Google Drive updated!"

# ── Done ──────────────────────────────────────────────────
Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  ALL DONE! DriveFlow.apk is live on Drive" -ForegroundColor Green
Write-Host "  Website download link is updated too!" -ForegroundColor Green
Write-Host "============================================`n" -ForegroundColor Green
