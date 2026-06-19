/**
 * Windows-11 desktop chrome constants. The React demo carries three skins here
 * (Win/mac/KDE); this Svelte shell ships the Windows 11 look only, so we keep a
 * single bar-inset helper that drives the window-manager work area.
 */

/** Taskbar height (px), matching `--os-bar-h` in style.css. */
export const BAR_HEIGHT = 48

/** Reserved px for top + bottom bars (drives the WM work area). */
export function barInsets(): { top: number; bottom: number } {
  return { top: 0, bottom: BAR_HEIGHT }
}
