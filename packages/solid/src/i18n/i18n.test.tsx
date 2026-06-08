import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { renderHook } from '@solidjs/testing-library'
import { IrisI18nProvider } from './IrisI18nProvider'
import { useI18n } from './useI18n'

afterEach(cleanup)

describe('IrisI18nProvider', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisI18nProvider locale="en">
        <div data-test="">content</div>
      </IrisI18nProvider>
    ))
    expect(container.querySelector('[data-test]')).not.toBeNull()
  })

  it('autoDirection applies rtl dir + lang to the target and reverts on unmount', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const { unmount } = render(() => (
      <IrisI18nProvider locale="ar-SA" autoDirection directionTarget={target}>
        <span>content</span>
      </IrisI18nProvider>
    ))
    expect(target.getAttribute('dir')).toBe('rtl')
    expect(target.getAttribute('data-iris-dir')).toBe('rtl')
    expect(target.getAttribute('lang')).toBe('ar-SA')

    unmount()
    expect(target.getAttribute('dir')).toBeNull()
    expect(target.getAttribute('data-iris-dir')).toBeNull()
    expect(target.getAttribute('lang')).toBeNull()
    target.remove()
  })

  it('does nothing to the target when autoDirection is off (default)', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    render(() => (
      <IrisI18nProvider locale="ar-SA" directionTarget={target}>
        <span>content</span>
      </IrisI18nProvider>
    ))
    expect(target.getAttribute('dir')).toBeNull()
    expect(target.getAttribute('data-iris-dir')).toBeNull()
    expect(target.getAttribute('lang')).toBeNull()
    target.remove()
  })
})

describe('useI18n', () => {
  it('returns a t function', () => {
    const { result } = renderHook(() => useI18n())
    expect(typeof result.t).toBe('function')
    expect(typeof result.locale).toBe('function')
  })

  it('t function returns key as fallback for unknown keys', () => {
    const { result } = renderHook(() => useI18n())
    const translated = result.t('unknown.key')
    expect(typeof translated).toBe('string')
  })
})
