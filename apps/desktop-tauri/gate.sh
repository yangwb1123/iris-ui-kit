#!/usr/bin/env bash
# Toolchain-guarded turbo task for the Tauri shell (arg: build|test). Local
# monorepo runs may skip missing native prerequisites; the dedicated CI job sets
# IRIS_REQUIRE_NATIVE_BUILD=1 so a missing prerequisite is gate-failing.
set -euo pipefail
mode="${1:-test}"
here="$(cd "$(dirname "$0")" && pwd)"
required="${IRIS_REQUIRE_NATIVE_BUILD:-0}"
skip() {
  if [ "$required" = "1" ]; then
    echo "[desktop-tauri] ERROR $mode — $1" >&2
    exit 1
  fi
  echo "[desktop-tauri] SKIP $mode — $1"
  exit 0
}
command -v cargo >/dev/null 2>&1 || skip "cargo not installed"
command -v pkg-config >/dev/null 2>&1 || skip "pkg-config not installed"
export PKG_CONFIG_PATH="${HOME}/.local/iris-native-libs/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/share/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
pkg-config --exists webkit2gtk-4.1 2>/dev/null || skip "webkit2gtk-4.1 not found"
pkg-config --exists librsvg-2.0 2>/dev/null || skip "librsvg-2.0 not found"
[ -f "$here/../cms-react/dist/index.html" ] || skip "CMS not built"
if [ "$mode" = "build" ] || [ ! -f "$here/dist/react/index.html" ]; then "$here/populate-dist.sh" >/dev/null; fi
cd "$here/src-tauri"
case "$mode" in
  build) cargo build --release -q --ignore-rust-version ;;
  test)  cargo test --release -q --ignore-rust-version ;;
  *) echo "unknown mode: $mode" >&2; exit 1 ;;
esac
echo "[desktop-tauri] $mode OK"
