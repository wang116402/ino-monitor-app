@echo off
chcp 65001 >nul
echo ================================================
echo       物联网监控系统 - APK构建脚本
echo ================================================
echo.

set "ANDROID_HOME=%cd%\android-sdk"
set "JAVA_HOME=%cd%\jdk-17"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\cmdline-tools\latest\bin;%ANDROID_HOME%\platform-tools;%PATH%"

REM 检查Java是否已安装
java -version 2>nul
if %errorlevel% neq 0 (
    echo [1/3] 正在下载Java JDK 17...
    mkdir jdk-17
    powershell -Command "Invoke-WebRequest -Uri 'https://download.oracle.com/java/17/latest/jdk-17_windows-x64_bin.zip' -OutFile 'jdk.zip'"
    powershell -Command "Expand-Archive -Path 'jdk.zip' -DestinationPath 'jdk-17' -Force"
    for /d %%i in (jdk-17\jdk-*) do move "%%i" jdk-17\temp && move jdk-17\temp\* jdk-17\ && rmdir jdk-17\temp
    del jdk.zip
    echo Java JDK安装完成
)

REM 检查Android SDK是否已安装
if not exist "android-sdk\cmdline-tools\latest\bin\sdkmanager.bat" (
    echo [2/3] 正在下载Android SDK...
    mkdir android-sdk\cmdline-tools
    powershell -Command "Invoke-WebRequest -Uri 'https://dl.google.com/android/repository/commandlinetools-win-10406996_latest.zip' -OutFile 'sdk.zip'"
    powershell -Command "Expand-Archive -Path 'sdk.zip' -DestinationPath 'android-sdk\cmdline-tools' -Force"
    rename "android-sdk\cmdline-tools\cmdline-tools" "latest"
    del sdk.zip
    
    echo 正在安装Android SDK组件...
    call sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" --sdk_root=%ANDROID_HOME%
    echo Android SDK安装完成
)

REM 构建APK
echo [3/3] 正在构建APK...
cd android
call gradlew assembleDebug

if %errorlevel% equ 0 (
    echo.
    echo ================================================
    echo           APK构建成功！
    echo ================================================
    echo APK位置: android\app\build\outputs\apk\debug\app-debug.apk
    echo.
    echo 请将APK文件发送到手机安装
    pause
) else (
    echo.
    echo ================================================
    echo           APK构建失败！
    echo ================================================
    echo 请检查错误信息并重新运行脚本
    pause
)