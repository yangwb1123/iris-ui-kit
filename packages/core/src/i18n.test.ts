import { describe, expect, it, vi } from 'vitest'
import { createI18n, defaultMessages } from './i18n'

describe('createI18n', () => {
  it('defaults to en-US with no overrides', () => {
    const i18n = createI18n()
    expect(i18n.getState().locale).toBe('en-US')
    expect(i18n.getState().messages).toEqual({})
  })

  it('honors configured locale and messages', () => {
    const i18n = createI18n({ locale: 'de-DE', messages: { greet: 'Hallo' } })
    expect(i18n.getState().locale).toBe('de-DE')
    expect(i18n.t('greet')).toBe('Hallo')
  })

  describe('t()', () => {
    it('resolves overrides → defaults → the key itself', () => {
      const i18n = createI18n({ messages: { 'pagination.next': 'Onward' } })
      expect(i18n.t('pagination.next')).toBe('Onward') // override
      expect(i18n.t('pagination.previous')).toBe(defaultMessages['pagination.previous']) // default
      expect(i18n.t('totally.missing')).toBe('totally.missing') // key fallback
    })

    it('interpolates {placeholders}', () => {
      const i18n = createI18n()
      expect(i18n.t('pagination.page', { page: 3 })).toBe('Page 3')
    })

    it('leaves unmatched placeholders intact', () => {
      const i18n = createI18n({ messages: { hi: 'Hi {name}, {missing}' } })
      expect(i18n.t('hi', { name: 'Ann' })).toBe('Hi Ann, {missing}')
    })
  })

  describe('mutations', () => {
    it('setLocale updates state and notifies subscribers', () => {
      const i18n = createI18n()
      const listener = vi.fn()
      i18n.subscribe(listener)
      i18n.setLocale('fr-FR')
      expect(i18n.getState().locale).toBe('fr-FR')
      expect(listener).toHaveBeenCalled()
    })

    it('setMessages merges over existing overrides', () => {
      const i18n = createI18n({ messages: { a: '1' } })
      i18n.setMessages({ b: '2' })
      expect(i18n.t('a')).toBe('1')
      expect(i18n.t('b')).toBe('2')
    })
  })

  describe('Intl formatters follow the active locale', () => {
    it('formatNumber respects locale grouping', () => {
      const i18n = createI18n({ locale: 'en-US' })
      expect(i18n.formatNumber(1234.5)).toBe('1,234.5')
      i18n.setLocale('de-DE')
      expect(i18n.formatNumber(1234.5)).toBe('1.234,5')
    })

    it('formatNumber supports currency options', () => {
      const i18n = createI18n({ locale: 'en-US' })
      expect(i18n.formatNumber(1234.5, { style: 'currency', currency: 'USD' })).toBe('$1,234.50')
    })

    it('formatDate uses the locale (UTC-pinned for determinism)', () => {
      const i18n = createI18n({ locale: 'en-US' })
      const date = new Date('2026-05-29T12:00:00Z')
      expect(
        i18n.formatDate(date, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }),
      ).toBe('May 29, 2026')
    })

    it('formatRelativeTime uses the locale', () => {
      const i18n = createI18n({ locale: 'en-US' })
      expect(i18n.formatRelativeTime(-1, 'day')).toBe('1 day ago')
    })
  })
})
