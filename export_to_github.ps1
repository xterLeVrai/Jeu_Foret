# ==============================================================================
# Script d'export automatique vers GitHub pour "Forest Game"
# ==============================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "       🦊 EXPORT AUTOMATIQUE VERS GITHUB - FOREST GAME     " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 1. Vérifier la présence de Git
$gitCmd = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCmd) {
    # Tenter les chemins standards sous Windows
    $gitPaths = @(
        "C:\Program Files\Git\cmd\git.exe",
        "C:\Program Files (x86)\Git\cmd\git.exe",
        "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
    )
    foreach ($p in $gitPaths) {
        if (Test-Path $p) {
            $gitCmd = $p
            break
        }
    }
} else {
    $gitCmd = "git"
}

# Fonction d'export via ZIP de secours si Git n'est pas installé
function Export-AsZip {
    param([string]$targetDir)
    $zipPath = Join-Path $targetDir "forest_game_export.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Write-Host "`n📦 Création d'une archive ZIP prête pour GitHub..." -ForegroundColor Cyan
    
    $filesToZip = Get-ChildItem -Path $targetDir -Recurse | Where-Object {
        $_.FullName -notmatch '\\\.git' -and 
        $_.FullName -notmatch 'forest_game_export\.zip' -and
        $_.FullName -notmatch '\\OLD'
    }
    Compress-Archive -Path $filesToZip.FullName -DestinationPath $zipPath -Force
    Write-Host "✅ Archive créée avec succès : $zipPath" -ForegroundColor Green
    Write-Host "👉 Vous pouvez glisser-déposer ce contenu directement sur github.com dans votre nouveau dépôt !" -ForegroundColor Yellow
}

if (-not $gitCmd) {
    Write-Host "⚠️  Git n'a pas été détecté sur votre système Windows." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pour exporter via la ligne de commande Git :"
    Write-Host "1. Téléchargez et installez Git pour Windows depuis : https://git-scm.com/download/win" -ForegroundColor White
    Write-Host "2. Relancez ce script une fois l'installation terminée." -ForegroundColor White
    Write-Host ""
    $createZip = Read-Host "Souhaitez-vous générer un fichier ZIP prêt à être déposé sur GitHub dès maintenant ? (O/N)"
    if ($createZip -match '^[oOyY]') {
        Export-AsZip -targetDir $scriptDir
    }
    Write-Host "`nAppuyez sur une touche pour quitter..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 0
}

Write-Host "✅ Git détecté : $gitCmd" -ForegroundColor Green

# 2. Initialisation du dépôt Git local si nécessaire
if (-not (Test-Path (Join-Path $scriptDir ".git"))) {
    Write-Host "📁 Initialisation du dépôt Git local..." -ForegroundColor Cyan
    & $gitCmd init
}

# 3. Vérifier ou demander l'URL du dépôt GitHub distant
$configFile = Join-Path $scriptDir ".github_repo_url"
$remoteUrl = ""

if (Test-Path $configFile) {
    $remoteUrl = (Get-Content $configFile -Raw).Trim()
}

if (-not $remoteUrl) {
    # Tenter de lire le remote origin existant
    $existingRemote = (& $gitCmd remote get-url origin 2>$null)
    if ($existingRemote) {
        $remoteUrl = $existingRemote.Trim()
    }
}

if (-not $remoteUrl) {
    Write-Host ""
    Write-Host "Entrez l'URL de votre dépôt GitHub distant" -ForegroundColor Cyan
    Write-Host "(ex: https://github.com/xterLeVrai/Jeu_Foret.git) :" -ForegroundColor DarkGray
    $remoteUrl = Read-Host "URL GitHub"
    $remoteUrl = $remoteUrl.Trim()

    if ($remoteUrl) {
        Set-Content -Path $configFile -Value $remoteUrl -Force
    }
}

if (-not $remoteUrl) {
    Write-Host "❌ Aucune URL renseignée. Export annulé." -ForegroundColor Red
    exit 1
}

# 4. Configurer le remote 'origin'
$hasOrigin = & $gitCmd remote | Where-Object { $_ -eq "origin" }
if ($hasOrigin) {
    & $gitCmd remote set-url origin $remoteUrl
} else {
    & $gitCmd remote add origin $remoteUrl
}

Write-Host "🔗 Remote configuré sur : $remoteUrl" -ForegroundColor Green

# 5. Préparer les commits et pousser
Write-Host "`n📦 Ajout des fichiers..." -ForegroundColor Cyan
& $gitCmd add .

$status = & $gitCmd status --porcelain
if ($status) {
    $commitMsg = "Mise à jour Forest Game : améliorations visuelles, son poule, ZQSD et pause"
    Write-Host "💾 Enregistrement du commit..." -ForegroundColor Cyan
    & $gitCmd commit -m "$commitMsg"
} else {
    Write-Host "ℹ️ Les fichiers sont déjà à jour dans Git." -ForegroundColor Yellow
}

# Renommer la branche en 'main'
& $gitCmd branch -M main 2>$null

# 6. Push vers GitHub
Write-Host "`n🚀 Envoi (push) vers GitHub..." -ForegroundColor Cyan
& $gitCmd push -u origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n🎉 SUCCÈS ! Votre projet Forest Game est en ligne sur GitHub :" -ForegroundColor Green
    Write-Host "   $remoteUrl" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Astuce : Vous pouvez activer GitHub Pages dans Settings > Pages pour y jouer en ligne !" -ForegroundColor Cyan
} else {
    Write-Host "`n⚠️ Note sur le push :" -ForegroundColor Yellow
    Write-Host "Si GitHub vous demande de vous identifier dans une fenêtre, validez votre connexion pour terminer l'envoi." -ForegroundColor White
}

Write-Host "`nTerminé !"
