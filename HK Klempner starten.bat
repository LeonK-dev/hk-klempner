@echo off
rem Startet HK Klempner auf diesem Rechner und macht den Browser auf.
rem Braucht Python. Das Fenster offen lassen, solange das Tool benutzt wird.
title HK Klempner
pushd "%~dp0"
python werkzeug\server.py 8765 --oeffnen
if errorlevel 1 (
  echo.
  echo Start fehlgeschlagen. Ist Python installiert?
)
popd
pause
