@echo off
echo Starting FamilyHub...
echo.
echo Open on this PC:      http://localhost:5000
echo Open on your network: http://10.10.60.91:5000
echo.
echo Press Ctrl+C to stop.
echo.
cd /d "%~dp0backend"
python app.py
