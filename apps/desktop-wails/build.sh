#!/usr/bin/env bash
# Build the Wails desktop shell: build the 4 CMS apps, embed them, compile with
# the webkit2gtk-4.1 build tag. Output: build/bin/desktop-wails.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
export PATH="$PATH:$(go env GOPATH)/bin"
# librsvg dev headers live in a user prefix if the system lacks libwebkit*-dev;
# harmless if already on the default path.
export PKG_CONFIG_PATH="${HOME}/.local/iris-native-libs/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/lib/x86_64-linux-gnu/pkgconfig:/usr/share/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
( cd "$here/../.." && pnpm turbo run build --filter=cms --filter=cms-react --filter=cms-solid --filter=cms-svelte )
"$here/populate-dist.sh"
cd "$here"
wails build -tags webkit2_41 -s "$@"
echo "Built: $here/build/bin/desktop-wails"
