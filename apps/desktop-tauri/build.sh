#!/usr/bin/env bash
# Build the Tauri desktop shell: build the 4 CMS apps, embed them, compile.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
export PKG_CONFIG_PATH="${HOME}/.local/iris-native-libs/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/share/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
( cd "$here/../.." && pnpm turbo run build --filter=cms --filter=cms-react --filter=cms-solid --filter=cms-svelte )
"$here/populate-dist.sh"
cd "$here/src-tauri"
cargo build --release "$@"
echo "Built: $here/src-tauri/target/release/iris-desktop-tauri"
