@echo off
title AeroPulse India - Aviation Intelligence Platform
echo =====================================================================
echo         AeroPulse India
echo  Real-Time Airfare Price Index & Flight Search Intelligence
echo =====================================================================
echo.
echo Launching local server at http://localhost:8080/index.html ...
echo.

start "" "http://localhost:8080/index.html"
python -m http.server 8080
pause
