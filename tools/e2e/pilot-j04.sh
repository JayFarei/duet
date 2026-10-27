#!/bin/sh
# One j04 run on a caller-owned Duo simulator, with the same toolchain and ports on either host.
set -eu
E2E="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$E2E/../.." && pwd)"
: "${DUO_UDID:=${WORKER_SIMULATOR_UDID:-}}"
[ -n "$DUO_UDID" ] || { echo 'DUO_UDID is required' >&2; exit 2; }
export DUO_UDID
export COREPACK_HOME="${COREPACK_HOME:-${WORKER_DERIVED_DATA:-$ROOT/.pilot-cache}/corepack}"
export E2E_SITE_PORT="${E2E_SITE_PORT:-3190}"
export BEACON_PORT="${BEACON_PORT:-3191}"
mkdir -p "$COREPACK_HOME"
(cd "$ROOT" && corepack pnpm@10.32.0 install --frozen-lockfile)
OUT="${J04_OUT:-${WORKER_RESULTS:-$E2E/reports}/pilot-j04-$(date +%Y%m%d-%H%M%S)}"
"$E2E/run.sh" --catalogue --only j04 --out "$OUT"
