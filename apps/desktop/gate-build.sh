#!/usr/bin/env bash
# Toolchain-guarded packaging check for the Electron shell. Local monorepo runs
# may skip an unavailable native toolchain; CI sets IRIS_REQUIRE_NATIVE_BUILD=1,
# which converts every skip condition into a hard failure and permits the
# builder to prime its Electron cache.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
required="${IRIS_REQUIRE_NATIVE_BUILD:-0}"
skip() {
  if [ "$required" = "1" ]; then
    echo "[iris-desktop] ERROR build — $1" >&2
    exit 1
  fi
  echo "[iris-desktop] SKIP build — $1"
  exit 0
}
[ -x "$here/node_modules/.bin/electron-builder" ] || skip "electron-builder not installed"
if [ "$required" != "1" ]; then
  { [ -d "$HOME/.cache/electron-builder" ] || [ -d "$HOME/.cache/electron" ]; } ||
    skip "electron cache not primed (would download)"
fi
[ -f "$here/../cms-react/dist/index.html" ] || skip "CMS not built"
cd "$here"
./node_modules/.bin/electron-builder --dir
echo "[iris-desktop] build OK (release/linux-unpacked)"
