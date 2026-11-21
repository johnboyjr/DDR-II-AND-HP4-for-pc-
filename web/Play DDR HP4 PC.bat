@echo off
cd /d "%~dp0"
title DDR HP4 PC (close this window to quit)
python server.py --hp4
if errorlevel 9009 py server.py --hp4
if errorlevel 1 pause
