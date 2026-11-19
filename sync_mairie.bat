@echo off
chcp 65001 >nul
echo ==========================================================
echo    🦊 SYNCHRONISATION FORGE MAIRIE - FOREST GAME
echo ==========================================================
echo.
"%LOCALAPPDATA%\Programs\Git\cmd\git.exe" push -uf mairie main
if %ERRORLEVEL% equ 0 (
    echo.
    echo 🎉 Succès ! Dépôt Mairie mis à jour.
) else (
    echo.
    echo ⚠️ Si vos identifiants sont demandés, entrez vos accès Mairie.
)
echo.
pause
