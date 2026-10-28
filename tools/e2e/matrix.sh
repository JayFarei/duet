#!/bin/sh
# Plays every journey of CATALOGUE.md in parallel on the "Duo e2e N" simulators, then joins the shard reports into one.
#   tools/e2e/matrix.sh [--only j01,j07] [--page /confirm]
# Builds once (duet-ui, fold.bin, the host and its runner), starts the site on :3140 once, then runs one run.sh per
# simulator, each with its own beacon and runner (BEACON_PORT 3151, 3152, ...) and every Nth journey (--shard i/N).
# Confirm pass: the journeys with a red step re-run alone on the first simulator (confirm/). A red that repeats alone
# is FAIL, one that passes alone is UNVERIFIED ("red under load, passed alone"). Four simulators is the calibrated N
# (#110): more and timing contention makes false flash and settle reds.
# Report: tools/e2e/reports/matrix-<ts>/index.html (each shard in shard-i/, its log in shard-i.log).
# Env: DUO_SIMS, the simulators (default the four "Duo e2e" clones of "Duo Lab"); E2E_SITE_PORT (default 3140).
# The simulators are shut down when the run ends.
# Exit: 0 pass, 1 fail, 2 blocked.
set -e
E2E="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$E2E/../.." && pwd)"
SIMS="${DUO_SIMS:-D00CA882-99D4-4B4A-A21E-AE7F96DAADF6 9FCE1601-1100-4AB4-85FF-8A39FD194FDA F8D31ECD-201C-46FD-A5B6-5EE3B89FF58A 97D6703E-6F5B-43BC-AE54-5006BCCE89D1}"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode-27.1.0.app/Contents/Developer}"
OUT="$E2E/reports/matrix-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$OUT"
SITE=""
export E2E_SITE_PORT="${E2E_SITE_PORT:-3140}"

blocked() { echo "BLOCKED: $1"; exit 2; }
cleanup() { [ -n "$SITE" ] && kill "$SITE" 2>/dev/null; for u in $SIMS; do xcrun simctl shutdown "$u" 2>/dev/null; done; true; }
trap cleanup EXIT INT TERM

N=$(echo $SIMS | wc -w | tr -d ' ')
FIRST=$(echo $SIMS | cut -d' ' -f1)
# Each shard's beacon binds 0.0.0.0:315i; anything on that port (a `tailscale serve` of an old report too) loses the
# whole shard and the confirm pass, so check them all before booting anything.
i=0; for u in $SIMS; do i=$((i+1)); node -e 'require("net").createServer().listen(+process.argv[1],"0.0.0.0",function(){this.close()}).on("error",()=>process.exit(1))' $((3150+i)) || blocked "beacon port $((3150+i)) is in use"; done
xcrun simctl boot "$FIRST" 2>/dev/null || true
xcrun simctl bootstatus "$FIRST" -b >/dev/null || blocked "simulator $FIRST did not boot"
(cd "$ROOT/packages/duet-ui" && pnpm -s build) || blocked "duet-ui build failed"
[ "$E2E/fold/fold.bin" -nt "$E2E/fold/fold.m" ] || "$E2E/fold/build.sh" || blocked "fold.bin build failed"
"$E2E/host/build.sh" "$FIRST" || blocked "host build failed"
if ! curl -s -o /dev/null -m 2 "http://localhost:$E2E_SITE_PORT/"; then
  (cd "$ROOT/apps/site" && exec npx next dev -p "$E2E_SITE_PORT" -H 0.0.0.0 >"$OUT/site.log" 2>&1) & SITE=$!
  i=0; until curl -s -o /dev/null -m 2 "http://localhost:$E2E_SITE_PORT/"; do i=$((i+1)); [ $i -gt 120 ] && blocked "site did not start, $OUT/site.log"; sleep 1; done
fi

# Phased start: boot one simulator, start its shard, and boot the next only once that shard plays its first step.
# Booting them all at once starves the host: the iOS watchdog kills apps that miss their launch allowance.
phased_in() { w=0; until grep -q '^\[' "$1" 2>/dev/null; do kill -0 "$2" 2>/dev/null || return 0; w=$((w+1)); [ $w -gt 180 ] && return 0; sleep 1; done; }
i=0; PIDS=""
for u in $SIMS; do
  i=$((i+1))
  xcrun simctl boot "$u" 2>/dev/null || true
  xcrun simctl bootstatus "$u" -b >/dev/null || { echo "simulator $u did not boot, shard $i not run"; continue; }
  BEACON_PORT=$((3150+i)) DUO_UDID="$u" E2E_SHARED=1 "$E2E/run.sh" --catalogue --shard "$i/$N" --out "$OUT/shard-$i" "$@" \
    >"$OUT/shard-$i.log" 2>&1 &
  PIDS="$PIDS $!"
  phased_in "$OUT/shard-$i.log" $!
done
echo "$N shards running, logs in $OUT/shard-*.log"
for p in $PIDS; do wait "$p" || true; done

REDS=$("$E2E/.venv/bin/python" -I -c '
import glob, json, sys
ids = {j["id"] for f in glob.glob(sys.argv[1] + "/shard-*/results.json") for j in json.load(open(f))["journeys"] if j["status"] == "FAIL"}
print(",".join(sorted(ids)))' "$OUT")
if [ -n "$REDS" ]; then
  for u in $SIMS; do [ "$u" = "$FIRST" ] || xcrun simctl shutdown "$u" 2>/dev/null || true; done
  echo "confirm pass, alone on $FIRST: $REDS"
  BEACON_PORT=3151 DUO_UDID="$FIRST" E2E_SHARED=1 "$E2E/run.sh" --catalogue "$@" --only "$REDS" --out "$OUT/confirm" \
    >"$OUT/confirm.log" 2>&1 || true
fi

set +e
"$E2E/.venv/bin/python" -I "$E2E/e2e.py" --merge "$OUT"
