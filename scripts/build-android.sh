#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_SDK_ROOT:-/usr/lib/android-sdk}"
BUILD_TOOLS="${ANDROID_BUILD_TOOLS:-$SDK/build-tools/29.0.3}"
ANDROID_JAR="${ANDROID_JAR:-$SDK/platforms/android-28/android.jar}"
R8_JAR="${R8_JAR:-/tmp/farhangpt-android/r8.jar}"
BUILD="${ANDROID_BUILD_DIR:-/tmp/farhangpt-android/build}"
KEYSTORE="${ANDROID_KEYSTORE:-/tmp/farhangpt-android/development.keystore}"
mkdir -p "$BUILD/classes" "$BUILD/dex" "$BUILD/gen" "$ROOT/public/downloads"
[[ -f "$ANDROID_JAR" ]] || { echo 'Set ANDROID_JAR to an Android platform android.jar (API 28+).'; exit 1; }
[[ -f "$R8_JAR" ]] || { echo 'Set R8_JAR to the official Android R8 compiler JAR.'; exit 1; }
"$BUILD_TOOLS/aapt" package -f -m -J "$BUILD/gen" -M "$ROOT/android/AndroidManifest.xml" -S "$ROOT/android/res" -I "$ANDROID_JAR" -F "$BUILD/unsigned.apk"
javac -encoding UTF-8 -source 8 -target 8 -classpath "$ANDROID_JAR" -d "$BUILD/classes" $(find "$ROOT/android/src" "$BUILD/gen" -name '*.java')
java -cp "$R8_JAR" com.android.tools.r8.D8 --lib "$ANDROID_JAR" --min-api 23 --output "$BUILD/dex" $(find "$BUILD/classes" -name '*.class')
(cd "$BUILD/dex" && "$BUILD_TOOLS/aapt" add "$BUILD/unsigned.apk" classes.dex)
"$BUILD_TOOLS/zipalign" -f 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"
if [[ ! -f "$KEYSTORE" ]]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storepass android -keypass android -alias farhangpt-development -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=FarhanGPT Development, O=FarhanGPT, C=PK' -noprompt
fi
"$BUILD_TOOLS/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android --ks-key-alias farhangpt-development --out "$ROOT/public/downloads/farhangpt.apk" "$BUILD/aligned.apk"
"$BUILD_TOOLS/apksigner" verify --verbose "$ROOT/public/downloads/farhangpt.apk"
echo 'Built public/downloads/farhangpt.apk. This is development-signed; use your own release signing identity for production distribution.'
