import { onCleanup, onMount, type JSX } from 'solid-js'
import { createWindowManager } from '@iris-ui/core/window'
import { WmProvider } from './wm'
import { Desktop } from './Desktop'

/** Taskbar height (var(--os-bar-h)); reserved so maximize/snap avoid it. */
const BAR_H = 48

export function App(): JSX.Element {
  // ONE framework-agnostic window manager for the whole shell — the same engine
  // the React desktop demo drives, proven here on Solid.
  const wm = createWindowManager()

  let rootRef: HTMLDivElement | undefined

  // Reserve the bottom taskbar and feed the remaining rectangle to the WM as its
  // work area (drives maximize + snap). Re-measured on resize.
  onMount(() => {
    const el = rootRef
    if (!el) return
    const apply = (): void => {
      const r = el.getBoundingClientRect()
      wm.setWorkArea({
        x: 0,
        y: 0,
        width: r.width,
        height: Math.max(240, r.height - BAR_H),
      })
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    onCleanup(() => ro.disconnect())
  })

  return (
    <WmProvider wm={wm}>
      <div
        ref={rootRef}
        class="os-root"
        style={{
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
          'font-family': 'var(--os-font)',
          background: 'var(--os-wallpaper)',
        }}
      >
        <Desktop />
      </div>
    </WmProvider>
  )
}
