@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Publicar ECE QP Clinic
echo.
echo   ============================================
echo    PUBLICAR CAMBIOS DEL EXPEDIENTE - QP CLINIC
echo   ============================================
echo.

REM --- Verificador: nueve comprobaciones sobre el archivo completo ---
where python >nul 2>nul
if %errorlevel%==0 (set PY=python) else (set PY=py)
echo   Revisando index.html ...
echo.
%PY% verificar.py index.html
if errorlevel 1 (
  echo.
  echo   ^>^> El verificador encontro fallas. NO se publico nada.
  echo      Corrige lo senalado arriba y vuelve a intentar.
  echo.
  pause
  exit /b 1
)

echo.
set "MSG="
set /p MSG=  Describe el cambio en pocas palabras:
if "%MSG%"=="" set "MSG=Actualizacion del expediente clinico"

if exist ".git\index.lock" del /f /q ".git\index.lock"

echo.
echo   Publicando ...
git add -A
git commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo   ^>^> No habia nada nuevo que publicar, o el commit fallo.
  echo.
  pause
  exit /b 1
)
git push
if errorlevel 1 (
  echo.
  echo   ^>^> Fallo el envio a GitHub. Revisa tu conexion o tus credenciales.
  echo.
  pause
  exit /b 1
)

echo.
echo   ============================================
echo    LISTO. Vercel publica en uno o dos minutos.
echo    Recuerda recargar con Ctrl+F5.
echo   ============================================
echo.
pause
