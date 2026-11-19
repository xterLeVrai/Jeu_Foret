# ==============================================================================
# Upload direct vers GitHub via l'API REST (Sans avoir besoin d'installer Git)
# ==============================================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$repoOwner = "xterLeVrai"
$repoName = "Jeu_Foret"
$branch = "main"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   🦊 EXPORT VERS GITHUB : $repoOwner/$repoName           " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$token = Read-Host "Entrez votre GitHub Personal Access Token (PAT)"
if (-not $token) {
    Write-Host "❌ Token requis. Rendez-vous sur https://github.com/settings/tokens pour en créer un." -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "token $token"
    "Accept"        = "application/vnd.github.v3+json"
    "User-Agent"    = "PowerShell-ForestGameUploader"
}

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Liste des fichiers à téléverser
$files = Get-ChildItem -Path $baseDir -Recurse -File | Where-Object {
    $_.FullName -notmatch '\\\.git' -and
    $_.FullName -notmatch '\.zip$' -and
    $_.FullName -notmatch '\\OLD' -and
    $_.Name -ne '.github_repo_url' -and
    $_.Name -ne 'upload_to_github_api.ps1'
}

Write-Host "🚀 Téléversement de $($files.Count) fichiers en cours vers GitHub..." -ForegroundColor Cyan

foreach ($file in $files) {
    # Chemin relatif
    $relativePath = $file.FullName.Substring($baseDir.Length).TrimStart('\', '/').Replace('\', '/')
    
    # Lire le contenu en base64
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $base64Content = [Convert]::ToBase64String($bytes)
    
    $url = "https://api.github.com/repos/$repoOwner/$repoName/contents/$relativePath"
    
    # Vérifier si le fichier existe déjà pour récupérer son SHA
    $sha = $null
    try {
        $existing = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -ErrorAction SilentlyContinue
        if ($existing -and $existing.sha) {
            $sha = $existing.sha
        }
    } catch {
        # Fichier nouveau
    }
    
    $body = @{
        message = "Ajout de $relativePath"
        content = $base64Content
        branch  = $branch
    }
    if ($sha) {
        $body["sha"] = $sha
    }
    
    $jsonBody = $body | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Put -Body $jsonBody
        Write-Host "  ✅ $relativePath envoyé" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Erreur pour $relativePath : $_" -ForegroundColor Red
    }
}

Write-Host "`n🎉 Terminé ! Votre jeu est en ligne sur : https://github.com/$repoOwner/$repoName" -ForegroundColor Yellow
Write-Host "Pour jouer en ligne, activez GitHub Pages dans Settings > Pages du dépôt !" -ForegroundColor Cyan
