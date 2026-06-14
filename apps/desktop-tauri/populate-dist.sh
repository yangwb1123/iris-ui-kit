#!/usr/bin/env bash
# Copy the four built CMS apps into dist/<fw>/ so rust-embed can bundle them.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
declare -A SRC=( [react]="../cms-react/dist" [vue]="../cms/dist" [solid]="../cms-solid/dist" [svelte]="../cms-svelte/dist" )
rm -rf "$here/dist"; mkdir -p "$here/dist"; touch "$here/dist/.gitkeep"
for fw in react vue solid svelte; do
  src="$here/${SRC[$fw]}"
  if [ -f "$src/index.html" ]; then cp -r "$src" "$here/dist/$fw"; echo "  embedded $fw"; else echo "  SKIP $fw"; fi
done
