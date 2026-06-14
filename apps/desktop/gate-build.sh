#!/usr/bin/env bash
# Toolchain-guarded packaging check for the Electron shell. Skips unless
# electron-builder + its electron cache are primed (never triggers a download).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
skip() { echo "[iris-desktop] SKIP build — $1"; exit 0; }
[ -x "$here/node_modules/.bin/electron-builder" ] || skip "electron-builder not installed"
{ [ -d "$HOME/.cache/electron-builder" ] || [ -d "$HOME/.cache/electron" ]; } || skip "electron cache not primed (would download)"
[ -f "$here/../cms-react/dist/index.html" ] || skip "CMS not built"
cd "$here"
./node_modules/.bin/electron-builder --dir >/dev/null 2>&1
echo "[iris-desktop] build OK (release/linux-unpacked)"
