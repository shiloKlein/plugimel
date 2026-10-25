@echo off
rem Builds an installable test APK (debug-signed): platoon-helper.apk
setlocal
set "ROOT=%~dp0"
set "JAVA_HOME=C:\dev\tools\jdk-21.0.12.1+1"
set "ANDROID_HOME=C:\dev\tools\android-sdk"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%ROOT%"
call npx cap sync android
if errorlevel 1 goto :failed
cd /d "%ROOT%android"
call "%ROOT%android\gradlew.bat" assembleDebug --no-daemon
if errorlevel 1 goto :failed
copy /y "%ROOT%android\app\build\outputs\apk\debug\app-debug.apk" "%ROOT%platoon-helper.apk" >nul
echo.
echo Done: %ROOT%platoon-helper.apk
exit /b 0
:failed
echo BUILD FAILED - see the messages above.
exit /b 1
