/**
 * OS "chrome" config — the seam that lets ONE window manager + ONE shell render
 * as Windows / macOS / KDE. Each entry is a set of CSS custom properties (the
 * "skin") plus STRUCTURAL flags the shell branches on: where the window controls
 * sit, whether there's a top menu bar, which bottom bar (taskbar / dock / panel)
 * and which launcher (start / spotlight / kickoff). Adding fidelity = extend
 * here + the per-OS component, never the window manager. Style via tokens.
 */

export type OsId = 'win11' | 'macos' | 'kde'

export interface OsChrome {
  id: OsId
  label: string
  /** Window control buttons: right (Windows/KDE) or left (macOS traffic lights). */
  controls: 'left' | 'right'
  controlStyle: 'win' | 'mac' | 'kde'
  /** Optional global top menu bar (macOS). */
  topBar: 'menubar' | 'none'
  /** Bottom bar kind. */
  bottomBar: 'taskbar' | 'dock' | 'panel'
  /** App launcher style. */
  launcher: 'start' | 'spotlight' | 'kickoff'
  /** Task-item alignment in the bottom bar. */
  taskAlign: 'center' | 'left'
  /** Show app labels next to task buttons (KDE panel style). */
  taskLabels: boolean
  /** CSS variables applied to the desktop root — the skin. */
  vars: Record<string, string>
}

const WIN11: OsChrome = {
  id: 'win11',
  label: 'Windows 11',
  controls: 'right',
  controlStyle: 'win',
  topBar: 'none',
  bottomBar: 'taskbar',
  launcher: 'start',
  taskAlign: 'center',
  taskLabels: false,
  vars: {
    '--os-accent': '#0a84ff',
    '--os-accent-strong': '#0067c0',
    '--os-wallpaper':
      'radial-gradient(140% 120% at 70% 10%, #4cc2ff 0%, #2b6cb0 42%, #11294f 100%)',
    '--os-window-bg': 'rgba(243, 243, 243, 0.92)',
    '--os-window-fg': '#1b1b1b',
    '--os-window-radius': '8px',
    '--os-window-border': '1px solid rgba(255, 255, 255, 0.5)',
    '--os-window-shadow': '0 16px 48px rgba(0, 0, 0, 0.36)',
    '--os-titlebar-bg': 'rgba(255, 255, 255, 0.6)',
    '--os-titlebar-h': '36px',
    '--os-topbar-h': '0px',
    '--os-bar-bg': 'rgba(243, 243, 243, 0.72)',
    '--os-bar-fg': '#1b1b1b',
    '--os-bar-h': '48px',
    '--os-bar-radius': '0px',
    '--os-blur': 'blur(28px) saturate(1.6)',
    '--os-font': "'Segoe UI Variable', 'Segoe UI', system-ui, -apple-system, sans-serif",
  },
}

const MACOS: OsChrome = {
  id: 'macos',
  label: 'macOS',
  controls: 'left',
  controlStyle: 'mac',
  topBar: 'menubar',
  bottomBar: 'dock',
  launcher: 'spotlight',
  taskAlign: 'center',
  taskLabels: false,
  vars: {
    '--os-accent': '#1e8fff',
    '--os-accent-strong': '#0a6cff',
    '--os-wallpaper': 'linear-gradient(160deg, #3a1c71 0%, #d76d77 50%, #ffaf7b 100%)',
    '--os-window-bg': 'rgba(246, 246, 248, 0.82)',
    '--os-window-fg': '#1d1d1f',
    '--os-window-radius': '12px',
    '--os-window-border': '1px solid rgba(0, 0, 0, 0.14)',
    '--os-window-shadow': '0 24px 64px rgba(0, 0, 0, 0.42)',
    '--os-titlebar-bg': 'rgba(255, 255, 255, 0.5)',
    '--os-titlebar-h': '40px',
    '--os-topbar-h': '26px',
    '--os-bar-bg': 'rgba(255, 255, 255, 0.4)',
    '--os-bar-fg': '#1d1d1f',
    '--os-bar-h': '66px',
    '--os-bar-radius': '20px',
    '--os-blur': 'blur(34px) saturate(1.9)',
    '--os-font': "'SF Pro Display', system-ui, -apple-system, sans-serif",
  },
}

const KDE: OsChrome = {
  id: 'kde',
  label: 'KDE Plasma',
  controls: 'right',
  controlStyle: 'kde',
  topBar: 'none',
  bottomBar: 'panel',
  launcher: 'kickoff',
  taskAlign: 'left',
  taskLabels: true,
  vars: {
    '--os-accent': '#3daee9',
    '--os-accent-strong': '#1d99f3',
    '--os-wallpaper': 'linear-gradient(135deg, #1a2b3c 0%, #27496d 60%, #3daee9 100%)',
    '--os-window-bg': 'rgba(252, 252, 252, 0.97)',
    '--os-window-fg': '#232629',
    '--os-window-radius': '4px',
    '--os-window-border': '1px solid rgba(61, 174, 233, 0.45)',
    '--os-window-shadow': '0 12px 36px rgba(0, 0, 0, 0.45)',
    '--os-titlebar-bg': 'rgba(238, 240, 241, 0.94)',
    '--os-titlebar-h': '32px',
    '--os-topbar-h': '0px',
    '--os-bar-bg': 'rgba(35, 38, 41, 0.88)',
    '--os-bar-fg': '#eff0f1',
    '--os-bar-h': '42px',
    '--os-bar-radius': '0px',
    '--os-blur': 'blur(12px)',
    '--os-font': "'Noto Sans', 'Oxygen', system-ui, sans-serif",
  },
}

export const CHROMES: Record<OsId, OsChrome> = { win11: WIN11, macos: MACOS, kde: KDE }
export const OS_ORDER: OsId[] = ['win11', 'macos', 'kde']

/** Reserved px for top + bottom bars (drives the WM work area). */
export function barInsets(chrome: OsChrome): { top: number; bottom: number } {
  const px = (v: string | undefined, d: number) => (v ? parseInt(v, 10) || d : d)
  const top = chrome.topBar === 'menubar' ? px(chrome.vars['--os-topbar-h'], 26) : 0
  const barH = px(chrome.vars['--os-bar-h'], 48)
  const bottom = chrome.bottomBar === 'dock' ? barH + 18 : barH
  return { top, bottom }
}
