import { afterEach, describe, expect, it } from 'vitest'
import { injectGlobalStyles } from './globalStyles'
import { __GLOBAL_STYLE_ID, __resetGlobalStyles } from './globalStyles'

afterEach(() => {
  __resetGlobalStyles()
})

function styleEl(): HTMLStyleElement | null {
  return document.getElementById(__GLOBAL_STYLE_ID) as HTMLStyleElement | null
}

describe('injectGlobalStyles', () => {
  it('injects a single <style> into <head>', () => {
    injectGlobalStyles()
    const el = styleEl()
    expect(el).not.toBeNull()
    expect(el?.parentElement).toBe(document.head)
  })

  it('is idempotent (no duplicate stylesheets)', () => {
    injectGlobalStyles()
    injectGlobalStyles()
    injectGlobalStyles()
    expect(document.querySelectorAll(`#${__GLOBAL_STYLE_ID}`).length).toBe(1)
  })

  it('carries the reduced-motion rule scoped to the themed subtree', () => {
    // jsdom does not evaluate media queries, so assert the wiring (rule text):
    // a prefers-reduced-motion block, scoped to [data-iris-theme], that forces
    // transition/animation durations down via !important (beats inline styles).
    injectGlobalStyles()
    const css = styleEl()?.textContent ?? ''
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('[data-iris-theme]')
    expect(css).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
    expect(css).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
  })

  it('re-injects after a reset', () => {
    injectGlobalStyles()
    __resetGlobalStyles()
    expect(styleEl()).toBeNull()
    injectGlobalStyles()
    expect(styleEl()).not.toBeNull()
  })
})
