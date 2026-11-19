# ==============================================================================
# Script d'export automatique vers GitHub pour "Forest Game"
# ==============================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  🦊 SYNCHRO GITHUB & MAIRIE - FOREST GAME                 " -ForegroundColor Yellow
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

# 3. URLs des dépôts cibles
$githubUrl = "https://github.com/xterLeVrai/Jeu_Foret.git"
$mairieUrl = "https://git.mairie.remiremont.fr/mickael.gerard/Jeu_Foret.git"

# 4. Configuration des remotes distants
Write-Host "🔗 Configuration des dépôts distants..." -ForegroundColor Cyan

# Remote origin (GitHub)
$hasOrigin = & $gitCmd remote | Where-Object { $_ -eq "origin" }
if (-not $hasOrigin) {
    & $gitCmd remote add origin $githubUrl
} else {
    & $gitCmd remote set-url origin $githubUrl
}

# Remote mairie (Forge interne)
$hasMairie = & $gitCmd remote | Where-Object { $_ -eq "mairie" }
if (-not $hasMairie) {
    & $gitCmd remote add mairie $mairieUrl
} else {
    & $gitCmd remote set-url mairie $mairieUrl
}

# Configuration multi-push sur origin pour pousser vers les deux en même temps
& $gitCmd remote set-url --add --push origin $githubUrl
& $gitCmd remote set-url --add --push origin $mairieUrl

Write-Host "  ✅ GitHub : $githubUrl" -ForegroundColor Green
Write-Host "  ✅ Mairie : $mairieUrl" -ForegroundColor Green

# 5. Préparer les commits
Write-Host "`n📦 Ajout des fichiers..." -ForegroundColor Cyan
& $gitCmd add .

$status = & $gitCmd status --porcelain
if ($status) {
    $commitMsg = "Mise à jour Forest Game : synchronisation GitHub et Forge Mairie"
    Write-Host "💾 Enregistrement du commit..." -ForegroundColor Cyan
    & $gitCmd commit -m "$commitMsg"
} else {
    Write-Host "ℹ️ Aucun nouveau changement local à committer." -ForegroundColor Yellow
}

# Renommer la branche en 'main'
& $gitCmd branch -M main 2>$null

# 6. Push vers GitHub et Mairie
Write-Host "`n🚀 Envoi (push) vers GitHub..." -ForegroundColor Cyan
& $gitCmd push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "  🎉 GitHub synchronisé !" -ForegroundColor Green
} else {
    Write-Host "  ⚠️ Vérifiez la connexion à GitHub si nécessaire." -ForegroundColor Yellow
}

Write-Host "`n🚀 Envoi (push) vers Forge Mairie..." -ForegroundColor Cyan
& $gitCmd push -uf mairie main
if ($LASTEXITCODE -eq 0) {
    Write-Host "  🎉 Forge Mairie synchronisée !" -ForegroundColor Green
} else {
    Write-Host "  ℹ️ Si une fenêtre s'ouvre pour vos identifiants Mairie, entrez votre login/mot de passe ou token pour valider l'envoi." -ForegroundColor Yellow
}

Write-Host "`nTerminé !"
