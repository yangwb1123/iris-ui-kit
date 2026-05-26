import { describe, expect, it, vi } from 'vitest'
import { lightTheme, darkTheme } from '@iris-ui/tokens'
import { createThemeStore } from './createThemeStore'

describe('createThemeStore', () => {
  const make = () =>
    createThemeStore({
      themes: { light: lightTheme, dark: darkTheme },
      default: 'light',
    })

  it('initial state matches the default theme', () => {
    const ts = make()
    expect(ts.store.getState()).toEqual(lightTheme)
  })

  it('setTheme by name switches the active theme', () => {
    const ts = make()
    ts.setTheme('dark')
    expect(ts.store.getState()).toEqual(darkTheme)
  })

  it('setTheme by object switches the active theme', () => {
    const ts = make()
    ts.setTheme(darkTheme)
    expect(ts.store.getState()).toEqual(darkTheme)
  })

  it('subscribes notify on setTheme', () => {
    const ts = make()
    const listener = vi.fn()
    ts.store.subscribe(listener)
    ts.setTheme('dark')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(darkTheme)
  })

  it('throws on unknown default', () => {
    expect(() => createThemeStore({ themes: { light: lightTheme }, default: 'missing' })).toThrow()
  })

  it('throws on unknown theme name', () => {
    const ts = make()
    expect(() => ts.setTheme('missing')).toThrow()
  })

  it('does not call applyTheme (store is pure)', () => {
    // The store has no DOM dependency; the test environment may have a
    // documentElement but the store must not touch it.
    const before = document.documentElement.style.cssText
    const ts = make()
    ts.setTheme('dark')
    const after = document.documentElement.style.cssText
    expect(after).toBe(before)
  })
})
