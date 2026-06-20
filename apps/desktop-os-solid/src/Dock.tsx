import { For, Show, createMemo, createSignal, type JSX } from 'solid-js'
import { getManifest } from './catalog'
import { useApps, useLaunchApp } from './profile'
import { useWm, useWmState } from './wm'

/** Apps pinned to the dock by default (in order), if present in the catalog. */
const PINNED = ['about', 'appstore', 'files', 'showcase', 'settings']

const BASE = 46 // resting icon box
const MAX_BOOST = 26 // extra px added to the icon under the cursor
const RADIUS = 110 // how far (px) the magnification reaches along the dock
const GAP = 6
const PAD = 10

/**
 * macOS dock: centered translucent pill of pinned + running apps, with running
 * dots, hover magnification (cosine falloff) and a launcher (Launchpad) trigger.
 * Mirrors the React shell's Dock, here in Solid signals. The bottom bar when the
 * skin's `chrome.bottomBar === 'dock'`.
 */
export function Dock(props: { onToggleLauncher: () => void }): JSX.Element {
  const wm = useWm()
  const state = useWmState()
  const apps = useApps()
  const launch = useLaunchApp()

  // Only windows on the ACTIVE virtual desktop count as "running" here.
  const wsWindows = createMemo(() =>
    state().windows.filter((w) => w.workspace === state().currentWorkspace),
  )
  const running = createMemo(() => new Set(wsWindows().map((w) => w.appId)))
  // Pinned apps that are actually available + any running app not already pinned.
  const items = createMemo<string[]>(() => {
    const available = new Set(apps().map((a) => a.id))
    const ids = [
      ...PINNED.filter((id) => available.has(id)),
      ...wsWindows()
        .map((w) => w.appId)
        .filter((id) => !PINNED.includes(id)),
    ]
    const seen = new Set<string>()
    return ids.filter((id) => (seen.has(id) ? false : (seen.add(id), true)))
  })

  // Pointer X relative to the dock pill; null when the cursor isn't over it.
  const [pointerX, setPointerX] = createSignal<number | null>(null)
  // Icons that should bounce (keyed by appId) right after launch.
  const [bouncing, setBouncing] = createSignal<Set<string>>(new Set())

  const bounce = (appId: string): void => {
    setBouncing((prev) => new Set(prev).add(appId))
    window.setTimeout(() => {
      setBouncing((prev) => {
        const next = new Set(prev)
        next.delete(appId)
        return next
      })
    }, 560)
  }

  const activate = (appId: string): void => {
    const win = state().windows.find((w) => w.appId === appId)
    if (win) {
      if (win.focused && win.state !== 'minimized') wm.minimize(win.id)
      else wm.focus(win.id)
    } else {
      const app = getManifest(appId)
      if (!app) return
      launch(appId)
      // Only window-creating apps bounce; `link` apps open in a new tab.
      if (app.kind !== 'link') bounce(appId)
    }
  }

  /** Resting center (px) of each item along the dock — for symmetric magnification. */
  const centers = createMemo<number[]>(() => {
    let cursor = 0
    return items().map(() => {
      const c = PAD + cursor + BASE / 2
      cursor += BASE + GAP
      return c
    })
  })

  /** Magnification scale (1 → 1+boost) for an icon centered at `center` px. */
  const scaleFor = (center: number): number => {
    const px = pointerX()
    if (px == null) return 1
    const dist = Math.abs(px - center)
    if (dist >= RADIUS) return 1
    // Cosine falloff: smooth, peaks at the cursor, settles to 1 at the radius.
    const t = (Math.cos((dist / RADIUS) * Math.PI) + 1) / 2
    return 1 + (MAX_BOOST / BASE) * t
  }

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '10px',
        display: 'flex',
        'justify-content': 'center',
        'pointer-events': 'none',
      }}
    >
      <div
        class="dock"
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          setPointerX(e.clientX - rect.left)
        }}
        onPointerLeave={() => setPointerX(null)}
        style={{
          'pointer-events': 'auto',
          display: 'flex',
          'align-items': 'flex-end',
          gap: `${GAP}px`,
          padding: `8px ${PAD}px`,
          background: 'var(--os-bar-bg)',
          'backdrop-filter': 'var(--os-blur)',
          '-webkit-backdrop-filter': 'var(--os-blur)',
          'border-radius': 'var(--os-bar-radius)',
          border: '1px solid rgba(255,255,255,0.35)',
          'box-shadow': '0 12px 40px rgba(0,0,0,0.35)',
        }}
      >
        <For each={items()}>
          {(id, i) => {
            const app = getManifest(id)
            if (!app) return null
            const scale = (): number => scaleFor(centers()[i()] ?? 0)
            const isBouncing = (): boolean => bouncing().has(id)
            return (
              <button
                type="button"
                title={app.name}
                class="dock-item"
                onClick={() => activate(id)}
                style={{
                  position: 'relative',
                  width: `${BASE}px`,
                  height: `${BASE}px`,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  'font-size': '30px',
                  'line-height': 1,
                  padding: 0,
                  display: 'flex',
                  'align-items': 'flex-end',
                  'justify-content': 'center',
                  transition: 'transform 140ms cubic-bezier(0.25, 1, 0.5, 1)',
                  'transform-origin': 'bottom center',
                  transform: isBouncing()
                    ? 'translateY(-22px) scale(1.08)'
                    : `scale(${scale().toFixed(3)})`,
                  'will-change': 'transform',
                }}
              >
                <span style={{ display: 'block' }}>{app.icon}</span>
                <Show when={running().has(id)}>
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '-4px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '4px',
                      height: '4px',
                      'border-radius': '50%',
                      background: 'var(--os-window-fg)',
                      opacity: 0.7,
                    }}
                  />
                </Show>
              </button>
            )
          }}
        </For>
        <span
          style={{
            width: '1px',
            'align-self': 'stretch',
            margin: '4px 4px',
            background: 'rgba(0,0,0,0.18)',
          }}
        />
        <button
          type="button"
          title="Launchpad"
          aria-label="Launchpad"
          class="dock-item"
          onClick={props.onToggleLauncher}
          style={{
            width: `${BASE}px`,
            height: `${BASE}px`,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            'font-size': '28px',
            padding: 0,
            transition: 'transform 140ms cubic-bezier(0.25, 1, 0.5, 1)',
            'transform-origin': 'bottom center',
          }}
          onPointerEnter={(e) => (e.currentTarget.style.transform = 'scale(1.35)')}
          onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          🚀
        </button>
      </div>
    </div>
  )
}
