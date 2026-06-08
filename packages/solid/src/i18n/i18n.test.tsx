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
