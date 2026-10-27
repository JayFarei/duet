#!/bin/zsh
# Builds fold.bin (an iOS simulator command line tool) next to this script.
set -e
cd "${0:A:h}"
export DEVELOPER_DIR=${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}
SDK=$(xcrun --sdk iphonesimulator --show-sdk-path)
xcrun --sdk iphonesimulator clang -fobjc-arc -arch arm64 -mios-simulator-version-min=17.0 -isysroot $SDK -framework Foundation -Wl,-sectcreate,__TEXT,__entitlements,fold.entitlements fold.m -o fold.bin
codesign -f -s - fold.bin 2>/dev/null
