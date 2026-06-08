import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisI18nProvider from './IrisI18nProvider.svelte'

describe('i18n module', () => {
  it('exports IrisI18nProvider and useI18n', async () => {
    const mod = await import('./index')
    expect(typeof mod.IrisI18nProvider).toBe('function')
    expect(typeof mod.useI18n).toBe('function')
  })

  it('autoDirection applies locale direction + lang to a target, and reverts on unmount', () => {
    const target = document.createElement('div')
    const { rerender, unmount } = render(IrisI18nProvider, {
      props: { locale: 'en-US', autoDirection: true, directionTarget: target },
    })
    expect(target.getAttribute('dir')).toBe('ltr')
    expect(target.getAttribute('lang')).toBe('en-US')

    rerender({ locale: 'ar-SA', autoDirection: true, directionTarget: target })
    expect(target.getAttribute('dir')).toBe('rtl')
    expect(target.getAttribute('data-iris-dir')).toBe('rtl')
    expect(target.getAttribute('lang')).toBe('ar-SA')

    unmount()
    expect(target.getAttribute('dir')).toBeNull()
    expect(target.getAttribute('lang')).toBeNull()
  })

  it('does not touch direction when autoDirection is off', () => {
    const target = document.createElement('div')
    render(IrisI18nProvider, { props: { locale: 'ar-SA', directionTarget: target } })
    expect(target.getAttribute('dir')).toBeNull()
  })
})
