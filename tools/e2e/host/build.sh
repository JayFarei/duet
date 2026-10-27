#!/bin/sh
# Builds the e2e host app and its UI-test runner with the iOS 27 SDK (Xcode 27.1): an older SDK runs the host
# letterboxed at 375x667, not Duo-native, so its preview would not match a real Duo app's.
# Output: tools/e2e/host/build (derived data). Usage: build.sh <simulator udid>
set -e
cd "$(dirname "$0")"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode-27.1.0.app/Contents/Developer}"
xcodegen generate -q
xcodebuild -project DuoE2EHost.xcodeproj -scheme DuoE2ERunner -destination "id=$1" -derivedDataPath build -quiet build-for-testing
