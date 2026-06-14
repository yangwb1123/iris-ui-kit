#!/usr/bin/env bash
# Copy the four built CMS apps into frontend/dist/<fw>/ so go:embed can bundle
# them. Run after building the CMS (turbo run build --filter=cms*).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
declare -A SRC=(
  [react]="../cms-react/dist"
  [vue]="../cms/dist"
  [solid]="../cms-solid/dist"
  [svelte]="../cms-svelte/dist"
)
rm -rf "$here/frontend/dist"
mkdir -p "$here/frontend/dist"
for fw in react vue solid svelte; do
  src="$here/${SRC[$fw]}"
  if [ -f "$src/index.html" ]; then
    cp -r "$src" "$here/frontend/dist/$fw"
    echo "  embedded $fw  <- ${SRC[$fw]}"
  else
    echo "  SKIP $fw (no build at ${SRC[$fw]})"
  fi
done
