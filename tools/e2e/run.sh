#!/bin/sh
# Runs the Duo e2e matrix on the "Duo Lab" simulator. Usage:
#   tools/e2e/run.sh [--only tab,preview-sheet,...] [--page /confirm] [--md out.md] [--video]
#   tools/e2e/run.sh --catalogue [--only j01,j07]      (the journeys of CATALOGUE.md, every step filmed)
# Env: DUO_UDID (simulator), BEACON_PORT (default 3141; matrix.sh gives each simulator its own beacon and runner),
# E2E_SHARED=1 (matrix.sh built everything and started the site: skip the builds, only check the site is up).
# Builds duet-ui's dist (the site consumes it) and fold.bin (the rotator and hinge), starts what is not already
# running (site from this worktree on :3140, beacon on :3141, host build + UI-test runner), checks the page renders,
# runs e2e.py, stops what it started. Report: tools/e2e/reports/<ts>/index.html. Exit: 0 pass, 1 fail, 2 blocked
# (including a setup that did not come up: a broken build never passes as "blocked, exit 0").
set -e
E2E="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$E2E/../.." && pwd)"
UDID="${DUO_UDID:-6E0F2BC5-873E-4B6C-BB6C-779BDF7173A4}"   # "Duo Lab"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode-27.1.0.app/Contents/Developer}"
PORT="${BEACON_PORT:-3141}"
export E2E_SITE_PORT="${E2E_SITE_PORT:-3140}"
SITE="http://localhost:$E2E_SITE_PORT"
TMP="$E2E/reports/.run-$PORT"; mkdir -p "$TMP"
STARTED=""

up() { curl -s -o /dev/null -m 2 "$1"; }
alive() { curl -s -m 2 "localhost:$PORT/runner" | grep -q true; }
cleanup() {
  # The runner is stopped through the beacon, so before the beacon is killed (else it outlives the run, stale).
  case " $STARTED " in *" runner "*) curl -s -m 5 -XPOST "localhost:$PORT/cmd?timeout=3000" -d '{"op":"stop"}' >/dev/null || true ;; esac
  for p in $STARTED; do [ "$p" = runner ] || kill "$p" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

blocked() { echo "BLOCKED: $1"; exit 2; }
xcrun simctl bootstatus "$UDID" -b >/dev/null || blocked "simulator $UDID did not boot"
if [ -z "$E2E_SHARED" ]; then
  (cd "$ROOT/packages/duet-ui" && pnpm -s build) || blocked "duet-ui build failed"
  [ "$E2E/fold/fold.bin" -nt "$E2E/fold/fold.m" ] || "$E2E/fold/build.sh" || blocked "fold.bin build failed"
fi

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

if ! up "$SITE/"; then
  [ -n "$E2E_SHARED" ] && blocked "site not up on :$E2E_SITE_PORT"
  (cd "$ROOT/apps/site" && exec npx next dev -p "$E2E_SITE_PORT" -H 0.0.0.0 >"$TMP/site.log" 2>&1) & STARTED="$STARTED $!"
  i=0; until up "$SITE/"; do i=$((i+1)); [ $i -gt 120 ] && blocked "site did not start, $TMP/site.log"; sleep 1; done
fi
if ! up "http://localhost:$PORT/step"; then
  node "$E2E/beacon.mjs" "$PORT" "$TMP" >"$TMP/beacon.log" 2>&1 & STARTED="$STARTED $!"
  sleep 1
fi
if ! alive; then
  [ -n "$E2E_SHARED" ] || "$E2E/host/build.sh" "$UDID"
  xcrun simctl install "$UDID" "$E2E/host/build/Build/Products/Debug-iphonesimulator/DuoE2EHost.app"
  # The runner reports to this run's beacon: a copy of the xctestrun beside it (its paths are relative to its folder).
  P="$E2E/host/build/Build/Products"
  cp "$(ls "$P"/DuoE2ERunner_*.xctestrun | head -1)" "$P/run-$PORT.xctestrun"
  plutil -replace DuoE2ERunner.EnvironmentVariables.E2E_BEACON -string "http://localhost:$PORT" "$P/run-$PORT.xctestrun"
  (cd "$E2E/host" && exec xcodebuild test-without-building -xctestrun "$P/run-$PORT.xctestrun" \
    -destination "id=$UDID" -only-testing:DuoE2ERunner/Runner/testServe >"$TMP/runner.log" 2>&1) & STARTED="$STARTED runner"
  i=0; until alive; do i=$((i+1)); [ $i -gt 180 ] && blocked "runner did not start, $TMP/runner.log"; sleep 1; done
fi
[ -n "$LA_NEW" ] && xcrun simctl install "$UDID" "$E2E/host/build/Build/Products/Debug-iphonesimulator/DuoE2EHost.app"

# A compile error in the site or the dist answers 500 (or a page without the reporter): stop here, not mid-matrix.
code=$(curl -s -o "$TMP/page.html" -w '%{http_code}' -m 60 "$SITE/?e2e=1")
[ "$code" = 200 ] || blocked "site answered $code for /?e2e=1 ($TMP/page.html, $TMP/site.log)"

PY="$E2E/.venv/bin/python"
[ -x "$PY" ] || { python3 -m venv "$E2E/.venv" && "$E2E/.venv/bin/pip" -q install pillow; }
set +e
"$PY" -I "$E2E/e2e.py" --udid "$UDID" --beacon "http://localhost:$PORT" "$@"
exit $?
