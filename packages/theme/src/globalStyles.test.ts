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

  it('stylesheet contains reduced-motion and color-scheme handling', () => {
    injectGlobalStyles()
    const el = document.getElementById(__GLOBAL_STYLE_ID)
    expect(el?.textContent).toContain('prefers-reduced-motion')
  })
})
