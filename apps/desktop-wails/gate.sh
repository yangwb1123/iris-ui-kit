#!/usr/bin/env bash
# Toolchain-guarded turbo task for the Wails shell (arg: build|test). Skips
# cleanly when Go / WebKitGTK aren't present.
set -euo pipefail
mode="${1:-test}"
here="$(cd "$(dirname "$0")" && pwd)"
skip() { echo "[desktop-wails] SKIP $mode — $1"; exit 0; }
command -v go >/dev/null 2>&1 || skip "go not installed"
export PATH="$PATH:$(go env GOPATH 2>/dev/null)/bin"
command -v pkg-config >/dev/null 2>&1 || skip "pkg-config not installed"
{ pkg-config --exists webkit2gtk-4.1 2>/dev/null || pkg-config --exists webkit2gtk-4.0 2>/dev/null; } || skip "webkitgtk not found"
[ -f "$here/../cms-react/dist/index.html" ] || skip "CMS not built"
if [ "$mode" = "build" ] || [ ! -f "$here/frontend/dist/react/index.html" ]; then "$here/populate-dist.sh" >/dev/null; fi
cd "$here"
case "$mode" in
  build) go build -tags webkit2_41 ./... ;;
  test)  go test -tags webkit2_41 ./... ;;
  *) echo "unknown mode: $mode" >&2; exit 1 ;;
esac
echo "[desktop-wails] $mode OK"
