@echo off
echo Starting DSE Stock Scraper API (Professional Edition)...
echo.
echo Server will be available at: http://localhost:3000
echo.
echo Endpoints:
echo   Health Check: http://localhost:3000/health
echo   API Docs:     http://localhost:3000/api
echo   Stocks API:   http://localhost:3000/api/stocks
echo.
echo Press Ctrl+C to stop the server
echo.

node server.js

pause