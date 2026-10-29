#!/usr/bin/env bash
# Builds doan-labs/duo (MIT) with duo.patch and the iPhone Duo model into apps/site/public/duo3d/app, the static
# 3D device /duo3d and the home stage frame. The output is committed: rerun after changing duo.patch or the rev.
# Only what the screens mode draws is copied: the shell, its CSS, the model and the home screen icons it bakes; not
# duo's apps, symbols or catalog.
# Usage: tools/duo3d/build.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$here/../../apps/site/public/duo3d/app"
dir="${DUO_DIR:-$HOME/.cache/duet-duo3d/duo}"
rev=ef924f2fafa2571ec918f0a6e434c854aa7fa692

if [ ! -d "$dir/.git" ]; then
  git clone https://github.com/doan-labs/duo.git "$dir"
fi
cd "$dir"
git checkout -q -f "$rev"
git apply "$here/duo.patch"
bun install

if [ ! -f public/model/iPhone_Duo_Render.usdc ]; then
  [ -d .venv ] || python3 -m venv .venv
  .venv/bin/pip install -q usd-core
  .venv/bin/python scripts/prepare-model.py
fi

rm -rf dist
BUN_JSC_useFTLJIT=false bun ./build.ts
rm -rf "$out" && mkdir -p "$out/model"
cp LICENSE dist/index.html dist/stylex.css dist/chunk-*.js dist/chunk-*.css dist/icon-*.svg "$out/"
cp -R public/model/iPhone_Duo_Render.usdc public/model/textures "$out/model/"
mkdir -p "$out/icons" && cp public/icons/*.webp "$out/icons/"
echo "built $out"
