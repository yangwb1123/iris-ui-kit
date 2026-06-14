#!/usr/bin/env bash
# Package the Tauri desktop shell into Linux release artifacts via Tauri's own
# bundler: a .deb and an .AppImage. Output: src-tauri/target/release/bundle/.
# (Pass --bundles deb to skip AppImage, or build on macOS/Windows for dmg/nsis.)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
export PATH="$PATH:$HOME/.cargo/bin"
export PKG_CONFIG_PATH="${HOME}/.local/iris-native-libs/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/share/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"

( cd "$here/../.." && pnpm turbo run build --filter=cms --filter=cms-react --filter=cms-solid --filter=cms-svelte )
"$here/populate-dist.sh"

cd "$here/src-tauri"
cargo tauri build "$@"

echo "[dist] artifacts:"
ls -lah target/release/bundle/deb/*.deb 2>/dev/null || true
ls -lah target/release/bundle/appimage/*.AppImage 2>/dev/null || true
