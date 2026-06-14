#!/usr/bin/env bash
# Package the Wails desktop shell into Linux release artifacts: a .deb (declares
# the WebKitGTK/GTK runtime as a dependency — not bundled) and a portable
# .tar.gz. Output: release/. (AppImage for a GTK app additionally needs
# appimagetool + linuxdeploy-plugin-gtk to bundle WebKitGTK — out of scope here;
# the .deb is the recommended Linux distributable.)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
ver="0.1.0"
arch="amd64"

# 1) build the release binary (builds the 4 CMS, embeds them, compiles).
"$here/build.sh"
bin="$here/build/bin/desktop-wails"
[ -f "$bin" ] || { echo "[dist] build produced no binary at $bin" >&2; exit 1; }

out="$here/release"
rm -rf "$out"
mkdir -p "$out"

# 2) .deb (system WebKitGTK as a dependency, not bundled).
root="$out/deb/iris-desktop-wails_${ver}_${arch}"
mkdir -p "$root/DEBIAN" "$root/usr/bin" "$root/usr/share/applications" \
  "$root/usr/share/icons/hicolor/256x256/apps"
install -m755 "$bin" "$root/usr/bin/iris-desktop-wails"
cp "$here/build/appicon.png" "$root/usr/share/icons/hicolor/256x256/apps/iris-desktop-wails.png"
cat >"$root/usr/share/applications/iris-desktop-wails.desktop" <<'DESK'
[Desktop Entry]
Name=Iris CMS (Wails)
Exec=iris-desktop-wails
Icon=iris-desktop-wails
Type=Application
Categories=Development;
DESK
cat >"$root/DEBIAN/control" <<CTRL
Package: iris-desktop-wails
Version: ${ver}
Section: devel
Priority: optional
Architecture: ${arch}
Maintainer: Iris UI <noreply@anthropic.com>
Depends: libgtk-3-0, libwebkit2gtk-4.1-0 | libwebkit2gtk-4.0-37
Description: Iris CMS - Wails desktop shell
 Hosts the Iris UI CMS (React/Vue/Solid/Svelte) in one native Wails window
 with a live framework switcher and native save/clipboard bridges.
CTRL
dpkg-deb --build --root-owner-group "$root" "$out/iris-desktop-wails_${ver}_${arch}.deb" >/dev/null

# 3) portable tar.gz (just the self-describing binary).
tar czf "$out/iris-desktop-wails_${ver}_linux_${arch}.tar.gz" -C "$here/build/bin" desktop-wails

echo "[dist] artifacts:"
ls -lah "$out"/*.deb "$out"/*.tar.gz
