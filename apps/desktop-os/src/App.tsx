import * as React from 'react'
import { createWindowManager } from '@iris-ui/core/window'
import { CHROMES, barInsets, type OsId } from './os'
import { WmProvider, OsProvider } from './shell'
import { Desktop } from './components/Desktop'

export function App() {
  const wm = React.useRef(createWindowManager()).current
  const [os, setOs] = React.useState<OsId>('win11')
  const chrome = CHROMES[os]
  const rootRef = React.useRef<HTMLDivElement>(null)

  // Reserve the bottom bar and feed the remaining rectangle to the WM as its
  // work area (drives maximize + snap). Re-measured on resize and skin change.
  React.useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const { top, bottom } = barInsets(chrome)
    const apply = () => {
      const r = el.getBoundingClientRect()
      wm.setWorkArea({
        x: 0,
        y: top,
        width: r.width,
        height: Math.max(240, r.height - top - bottom),
      })
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [wm, chrome])

  return (
    <WmProvider value={wm}>
      <OsProvider value={{ chrome, setOs }}>
        <div
          ref={rootRef}
          style={
            {
              position: 'fixed',
              inset: 0,
              overflow: 'hidden',
              fontFamily: 'var(--os-font)',
              background: 'var(--os-wallpaper)',
              ...chrome.vars,
            } as React.CSSProperties
          }
        >
          <Desktop />
        </div>
      </OsProvider>
    </WmProvider>
  )
}
