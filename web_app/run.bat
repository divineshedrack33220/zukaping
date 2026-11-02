@echo off
title Zukaping Web App

setlocal EnableExtensions
set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

rem ---- local service locations (this machine, no admin required) ----
set "DEVTOOLS=C:\Users\hp\devtools"
set "MONGOD=%DEVTOOLS%\mongosrc\mongodb-win32-x86_64-windows-7.0.14\bin\mongod.exe"
set "MONGO_DATA=%DEVTOOLS%\mongodb-data"
set "BACKEND_DIR=%APP_DIR%..\backend"
set "GO_BUILD=%DEVTOOLS%\gosrc\go\bin\go.exe"

echo ==========================================
echo  Zukaping Web Application
echo ==========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
  ) else (
    echo ERROR: Node.js was not found.
    echo Install Node.js from https://nodejs.org/ and run this file again.
    echo.
    pause
    exit /b 1
  )
)

for /f "delims=" %%v in ('node --version') do set "NODE_VERSION=%%v"
echo Node.js: %NODE_VERSION%
echo Folder : %CD%
echo.

echo [1/3] MongoDB
netstat -an | findstr /C:":27017 " | findstr /C:"LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo       already listening on 127.0.0.1:27017
  goto api_start
)
if not exist "%MONGOD%" goto mongo_missing
echo       starting mongod...
start "Zukaping MongoDB" /min "%MONGOD%" --dbpath "%MONGO_DATA%" --bind_ip 127.0.0.1 --port 27017 --logpath "%MONGO_DATA%\mongod.log" --logappend
call :waitfor 27017 60
if errorlevel 1 goto mongo_failed
echo       mongod is up

:api_start
echo [2/3] API backend
netstat -an | findstr /C:":8080 " | findstr /C:"LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo       already listening on 127.0.0.1:8080
  goto web_start
)
if not exist "%BACKEND_DIR%" goto api_missing
if not exist "%BACKEND_DIR%\.env" goto api_noenv
if not exist "%BACKEND_DIR%\server.exe" goto api_build
pushd "%BACKEND_DIR%"
start "Zukaping API" /min "%CD%\server.exe"
popd
call :waitfor 8080 60
if errorlevel 1 goto api_slow
echo       API is up on http://localhost:8080/api
goto web_start

:api_build
if not exist "%GO_BUILD%" goto api_nobuild
echo       compiling server.exe, first run can take a minute...
pushd "%BACKEND_DIR%"
"%GO_BUILD%" build -o server.exe .
set "BUILD_RC=%errorlevel%"
popd
if not "%BUILD_RC%"=="0" goto api_buildfailed
pushd "%BACKEND_DIR%"
start "Zukaping API" /min "%CD%\server.exe"
popd
call :waitfor 8080 60
if errorlevel 1 goto api_slow
echo       API is up on http://localhost:8080/api
goto web_start

:web_start
echo [3/3] Web app
if not exist "node_modules" (
  echo       installing dependencies...
  call npm install
  if errorlevel 1 goto npm_failed
)

echo.
echo Ready: http://localhost:3000
echo The MongoDB and API windows are minimised - close them to stop those services.
echo Press CTRL+C here to stop the web app.
echo.
call npm run dev

pause
exit /b 0

:waitfor
rem %~1 = TCP port, %~2 = seconds to wait (default 30)
set "WAIT_LIMIT=%~2"
if "%WAIT_LIMIT%"=="" set "WAIT_LIMIT=30"
set "WAIT_TRIES=0"
:waitfor_loop
netstat -an | findstr /C:":%~1 " | findstr /C:"LISTENING" >nul 2>&1
if not errorlevel 1 exit /b 0
set /a WAIT_TRIES=WAIT_TRIES+1
if %WAIT_TRIES% geq %WAIT_LIMIT% exit /b 1
ping -n 2 127.0.0.1 >nul
goto waitfor_loop

:mongo_missing
echo ERROR: mongod.exe is missing.
echo        Expected: %MONGOD%
echo.
pause
exit /b 1

:mongo_failed
echo ERROR: MongoDB did not come up within 60 seconds.
echo        Read %MONGO_DATA%\mongod.log - after an unclean
echo        shutdown MongoDB wants mongod.lock deleted.
echo.
pause
exit /b 1

:api_missing
echo WARNING: %BACKEND_DIR% does not exist - starting without the API.
goto web_start

:api_noenv
echo WARNING: backend\.env is missing, so the API will refuse to start.
echo          Copy backend\.env.example to backend\.env, then run this again.
goto web_start

:api_nobuild
echo WARNING: backend\server.exe is missing and Go was not found.
echo          Build it once with: go build -o server.exe .
goto web_start

:api_buildfailed
echo WARNING: go build failed - starting without the API.
goto web_start

:api_slow
echo WARNING: the API did not come up within 60 seconds.
echo          Open the minimised Zukaping API window to read the error.
goto web_start

:npm_failed
echo.
echo ERROR: npm install failed.
pause
exit /b 1