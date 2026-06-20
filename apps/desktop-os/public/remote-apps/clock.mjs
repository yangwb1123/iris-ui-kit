// A self-contained remote app: vanilla DOM, zero imports. The desktop fetches
// and evaluates this module AT RUNTIME (see src/remoteApp.ts) and calls mount().
// This is a micro-frontend loaded over the network, not bundled with the shell.

/**
 * Render a live ticking clock into `el`.
 * @param {HTMLElement} el host-provided container
 * @returns {() => void} teardown — the host calls this on unmount
 */
export function mount(el) {
  el.innerHTML = ''

  const wrap = document.createElement('div')
  wrap.style.cssText =
    'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'gap:10px;height:100%;font-family:system-ui,sans-serif;text-align:center;'

  const badge = document.createElement('div')
  badge.textContent = '🛰️ Remote app'
  badge.style.cssText = 'font-size:13px;opacity:0.6;letter-spacing:0.5px;'

  const time = document.createElement('div')
  time.style.cssText = 'font-size:46px;font-weight:700;font-variant-numeric:tabular-nums;'

  const date = document.createElement('div')
  date.style.cssText = 'font-size:14px;opacity:0.75;'

  const origin = document.createElement('div')
  origin.style.cssText =
    'font-size:11px;opacity:0.5;max-width:90%;word-break:break-all;margin-top:6px;'
  origin.textContent = 'loaded at runtime from ' + import.meta.url

  wrap.append(badge, time, date, origin)
  el.append(wrap)

  const tick = () => {
    const now = new Date()
    time.textContent = now.toLocaleTimeString()
    date.textContent = now.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }
  tick()
  const id = setInterval(tick, 1000)

  return () => clearInterval(id)
}
