#!/usr/bin/env bash
# Local-only experiment (see apps/site/app/duo3d): runs doan-labs/duo (MIT) with Apple's iPhone Duo model.
# Apple's model is not redistributable: it is downloaded into DUO_DIR, outside this repo, and never committed or deployed.
# Usage: tools/duo3d/setup.sh   then   pnpm --filter @duet/site exec next dev -p 3167   and open http://localhost:3167/duo3d
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dir="${DUO_DIR:-$HOME/.cache/duet-duo3d/duo}"
rev=ef924f2fafa2571ec918f0a6e434c854aa7fa692
port="${PORT:-3166}"

if [ ! -d "$dir/.git" ]; then
  git clone https://github.com/doan-labs/duo.git "$dir"
fi
cd "$dir"
if ! git apply --reverse --check "$here/duo.patch" 2>/dev/null; then
  git checkout -q "$rev"
  git apply "$here/duo.patch"
fi
bun install

if [ ! -f public/model/iPhone_Duo_Render.usdc ]; then
  [ -d .venv ] || python3 -m venv .venv
  .venv/bin/pip install -q usd-core
  .venv/bin/python scripts/prepare-model.py
fi

PORT="$port" BUN_JSC_useFTLJIT=false exec bun ./serve.ts
