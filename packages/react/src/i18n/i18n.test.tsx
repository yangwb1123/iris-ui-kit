import { afterEach, describe, expect, it } from 'vitest'
import * as React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IrisI18nProvider } from './I18nProvider'
import { useI18n } from './useI18n'

afterEach(cleanup)

function Probe() {
  const { locale, t, formatNumber, setLocale } = useI18n()
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="next">{t('pagination.next')}</span>
      <span data-testid="page">{t('pagination.page', { page: 2 })}</span>
      <span data-testid="num">{formatNumber(1234.5)}</span>
      <button type="button" onClick={() => setLocale('de-DE')}>
        de
      </button>
    </div>
  )
}

describe('@iris-ui/react i18n', () => {
  it('falls back to English defaults without a provider', () => {
    render(<Probe />)
    expect(screen.getByTestId('locale').textContent).toBe('en-US')
    expect(screen.getByTestId('next').textContent).toBe('Next page')
    expect(screen.getByTestId('page').textContent).toBe('Page 2')
  })

  it('uses provider locale + message overrides', () => {
    render(
      <IrisI18nProvider locale="de-DE" messages={{ 'pagination.next': 'Weiter' }}>
        <Probe />
      </IrisI18nProvider>,
    )
    expect(screen.getByTestId('locale').textContent).toBe('de-DE')
    expect(screen.getByTestId('next').textContent).toBe('Weiter')
    expect(screen.getByTestId('num').textContent).toBe('1.234,5')
  })

  it('re-renders consumers when the locale changes', () => {
    render(
      <IrisI18nProvider locale="en-US">
        <Probe />
      </IrisI18nProvider>,
    )
    expect(screen.getByTestId('num').textContent).toBe('1,234.5')
    act(() => {
      fireEvent.click(screen.getByText('de'))
    })
    expect(screen.getByTestId('locale').textContent).toBe('de-DE')
    expect(screen.getByTestId('num').textContent).toBe('1.234,5')
  })

  it('syncs a changed locale prop into the live instance', () => {
    const { rerender } = render(
      <IrisI18nProvider locale="en-US">
        <Probe />
      </IrisI18nProvider>,
    )
    expect(screen.getByTestId('num').textContent).toBe('1,234.5')
    rerender(
      <IrisI18nProvider locale="de-DE">
        <Probe />
      </IrisI18nProvider>,
    )
    expect(screen.getByTestId('locale').textContent).toBe('de-DE')
  })

  it('autoDirection applies locale direction + lang to a target, and reverts on unmount', () => {
    const target = document.createElement('div')
    const { rerender, unmount } = render(
      <IrisI18nProvider locale="en-US" autoDirection directionTarget={target}>
        <Probe />
      </IrisI18nProvider>,
    )
    expect(target.getAttribute('dir')).toBe('ltr')
    expect(target.getAttribute('lang')).toBe('en-US')
    rerender(
      <IrisI18nProvider locale="ar-SA" autoDirection directionTarget={target}>
        <Probe />
      </IrisI18nProvider>,
    )
    expect(target.getAttribute('dir')).toBe('rtl')
    expect(target.getAttribute('data-iris-dir')).toBe('rtl')
    expect(target.getAttribute('lang')).toBe('ar-SA')
    unmount()
    expect(target.getAttribute('dir')).toBeNull()
    expect(target.getAttribute('lang')).toBeNull()
  })

  it('does not touch direction when autoDirection is off', () => {
    const target = document.createElement('div')
    render(
      <IrisI18nProvider locale="ar-SA" directionTarget={target}>
        <Probe />
      </IrisI18nProvider>,
    )
    expect(target.getAttribute('dir')).toBeNull()
  })
})
