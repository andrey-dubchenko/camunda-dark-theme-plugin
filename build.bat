@echo off
echo === Dark Theme Plugin - Build ===

echo Installing dependencies...
call npm install
if errorlevel 1 goto error

echo Building bundle...
call npm run build
if errorlevel 1 goto error

echo Creating camunda-dark-theme-plugin\...
set DIST_DIR=camunda-dark-theme-plugin

if exist "%DIST_DIR%" rmdir /s /q "%DIST_DIR%"
mkdir "%DIST_DIR%"
mkdir "%DIST_DIR%\dist"

copy index.js          "%DIST_DIR%\index.js"
copy style.css         "%DIST_DIR%\style.css"
copy package.json      "%DIST_DIR%\package.json"
copy dist\client.js    "%DIST_DIR%\dist\client.js"

echo.
echo Done! Plugin folder ready: %DIST_DIR%\
echo.
echo === Install ===
echo Copy '%DIST_DIR%' to:
echo   %%APPDATA%%\camunda-modeler\resources\plugins\
echo.
echo Then restart Camunda Modeler.
goto end

:error
echo Build failed!
pause
exit /b 1

:end
pause
