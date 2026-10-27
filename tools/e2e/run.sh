#!/bin/sh
# Runs the Duo e2e matrix on the "Duo Lab" simulator. Usage:
#   tools/e2e/run.sh [--only tab,preview-sheet,...] [--page /confirm] [--md out.md] [--video]
# Builds duet-ui's dist (the site consumes it) and fold.bin (the rotator and hinge), starts what is not already
# running (site from this worktree on :3140, beacon on :3141, host build + UI-test runner), checks the page renders,
# runs e2e.py, stops what it started. Report: tools/e2e/reports/<ts>/index.html. Exit: 0 pass, 1 fail, 2 blocked
# (including a setup that did not come up: a broken build never passes as "blocked, exit 0").
set -e
E2E="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$E2E/../.." && pwd)"
UDID="${DUO_UDID:-6E0F2BC5-873E-4B6C-BB6C-779BDF7173A4}"   # "Duo Lab"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode-27.1.0.app/Contents/Developer}"
TMP="$E2E/reports/.run"; mkdir -p "$TMP"
STARTED=""

up() { curl -s -o /dev/null -m 2 "$1"; }
alive() { curl -s -m 2 localhost:3141/runner | grep -q true; }
cleanup() {
  # The runner is stopped through the beacon, so before the beacon is killed (else it outlives the run, stale).
  case " $STARTED " in *" runner "*) curl -s -m 5 -XPOST localhost:3141/cmd?timeout=3000 -d '{"op":"stop"}' >/dev/null || true ;; esac
  for p in $STARTED; do [ "$p" = runner ] || kill "$p" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

blocked() { echo "BLOCKED: $1"; exit 2; }
xcrun simctl bootstatus "$UDID" -b >/dev/null || blocked "simulator $UDID did not boot"
(cd "$ROOT/packages/duet-ui" && pnpm -s build) || blocked "duet-ui build failed"
[ "$E2E/fold/fold.bin" -nt "$E2E/fold/fold.m" ] || "$E2E/fold/build.sh" || blocked "fold.bin build failed"

# Live Activities (scenarios live-*): the simulator runtime ships chronod and liveactivitiesd but leaves them unloaded,
# so an activity starts without error and never shows. Load them once per boot, then restart SpringBoard so the island
# picks them up, and reinstall the host below so its widget extension registers.
LA_NEW=""
if ! xcrun simctl spawn "$UDID" launchctl print user/501/com.apple.liveactivitiesd >/dev/null 2>&1; then
  RT=$(xcrun simctl list -j | /usr/bin/python3 -I -c 'import json,sys; j=json.load(sys.stdin); u=sys.argv[1]
r=next(k for k,v in j["devices"].items() if any(d["udid"]==u for d in v)); print(next(x["runtimeRoot"] for x in j["runtimes"] if x["identifier"]==r))' "$UDID")
  for d in chronod liveactivitiesd; do
    xcrun simctl spawn "$UDID" launchctl enable "user/501/com.apple.$d"
    xcrun simctl spawn "$UDID" launchctl bootstrap user/501 "$RT/System/Library/LaunchDaemons/com.apple.$d.plist" || true
  done
  xcrun simctl spawn "$UDID" launchctl kickstart -k user/501/com.apple.SpringBoard
  sleep 8
  LA_NEW=1
fi

if ! up http://localhost:3140/; then
  (cd "$ROOT/apps/site" && exec npx next dev -p 3140 -H 0.0.0.0 >"$TMP/site.log" 2>&1) & STARTED="$STARTED $!"
  i=0; until up http://localhost:3140/; do i=$((i+1)); [ $i -gt 120 ] && blocked "site did not start, $TMP/site.log"; sleep 1; done
fi
if ! up http://localhost:3141/step; then
  node "$E2E/beacon.mjs" 3141 "$TMP" >"$TMP/beacon.log" 2>&1 & STARTED="$STARTED $!"
  sleep 1
fi
if ! alive; then
  "$E2E/host/build.sh" "$UDID"
  xcrun simctl install "$UDID" "$E2E/host/build/Build/Products/Debug-iphonesimulator/DuoE2EHost.app"
  (cd "$E2E/host" && exec xcodebuild test-without-building -xctestrun "$(ls build/Build/Products/*.xctestrun | head -1)" \
    -destination "id=$UDID" -only-testing:DuoE2ERunner/Runner/testServe >"$TMP/runner.log" 2>&1) & STARTED="$STARTED runner"
  i=0; until alive; do i=$((i+1)); [ $i -gt 180 ] && blocked "runner did not start, $TMP/runner.log"; sleep 1; done
fi
[ -n "$LA_NEW" ] && xcrun simctl install "$UDID" "$E2E/host/build/Build/Products/Debug-iphonesimulator/DuoE2EHost.app"

# A compile error in the site or the dist answers 500 (or a page without the reporter): stop here, not mid-matrix.
code=$(curl -s -o "$TMP/page.html" -w '%{http_code}' -m 60 "http://localhost:3140/?e2e=1")
[ "$code" = 200 ] || blocked "site answered $code for /?e2e=1 ($TMP/page.html, $TMP/site.log)"

PY="$E2E/.venv/bin/python"
[ -x "$PY" ] || { python3 -m venv "$E2E/.venv" && "$E2E/.venv/bin/pip" -q install pillow; }
set +e
"$PY" -I "$E2E/e2e.py" --udid "$UDID" "$@"
exit $?
