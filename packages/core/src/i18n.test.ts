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

    describe('ICU plural', () => {
      const msg = { items: '{count, plural, =0 {No items} one {# item} other {# items}}' }

      it('selects exact (=N), one, and other categories (en)', () => {
        const i18n = createI18n({ locale: 'en-US', messages: msg })
        expect(i18n.t('items', { count: 0 })).toBe('No items')
        expect(i18n.t('items', { count: 1 })).toBe('1 item')
        expect(i18n.t('items', { count: 5 })).toBe('5 items')
      })

      it('uses the locale plural rules (Polish has a distinct "few")', () => {
        const pl = {
          files: '{n, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}',
        }
        const i18n = createI18n({ locale: 'pl-PL', messages: pl })
        expect(i18n.t('files', { n: 1 })).toBe('1 plik')
        expect(i18n.t('files', { n: 3 })).toBe('3 pliki') // few
        expect(i18n.t('files', { n: 5 })).toBe('5 plików') // many
      })

      it('mixes plural with plain placeholders', () => {
        const i18n = createI18n({
          locale: 'en-US',
          messages: { cart: '{name}: {count, plural, one {# thing} other {# things}}' },
        })
        expect(i18n.t('cart', { name: 'Ann', count: 2 })).toBe('Ann: 2 things')
      })

      it('leaves a plural block intact when its count is missing', () => {
        const i18n = createI18n({ messages: msg })
        expect(i18n.t('items')).toBe(msg.items) // no params → template returned
      })
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

    it('caches formatters: repeated same-key calls construct Intl once', () => {
      const spy = vi.spyOn(Intl, 'NumberFormat')
      const i18n = createI18n({ locale: 'en-US' })
      const opts = { style: 'currency', currency: 'USD' } as const
      const before = spy.mock.calls.length
      i18n.formatNumber(1, opts)
      i18n.formatNumber(2, opts)
      i18n.formatNumber(3, opts)
      expect(spy.mock.calls.length - before).toBe(1) // one construction, three formats
      // a different locale or option set is a distinct cache key
      i18n.setLocale('de-DE')
      i18n.formatNumber(4, opts)
      expect(spy.mock.calls.length - before).toBe(2)
      spy.mockRestore()
    })
  })

  describe('invalid-locale robustness', () => {
    it('formatDate falls back instead of throwing on a malformed locale', () => {
      const i18n = createI18n({ locale: 'bad locale!' })
      expect(() => i18n.formatDate(new Date(Date.UTC(2026, 4, 29)))).not.toThrow()
    })

    it('formatNumber falls back on a malformed locale', () => {
      const i18n = createI18n({ locale: 'en_US_bad' })
      expect(() => i18n.formatNumber(1234.5)).not.toThrow()
    })

    it('formatRelativeTime falls back on a malformed locale', () => {
      const i18n = createI18n({ locale: '@@@' })
      expect(() => i18n.formatRelativeTime(-1, 'day')).not.toThrow()
    })

    it('plural interpolation falls back on a malformed locale', () => {
      const i18n = createI18n({
        locale: 'not a locale',
        messages: { items: '{count, plural, one {# item} other {# items}}' },
      })
      expect(() => i18n.t('items', { count: 2 })).not.toThrow()
      expect(i18n.t('items', { count: 2 })).toBe('2 items')
    })

    it('setLocale to a malformed tag keeps the stored value but formats safely', () => {
      const i18n = createI18n({ locale: 'en-US' })
      i18n.setLocale('bad locale!')
      expect(i18n.getState().locale).toBe('bad locale!')
      expect(() => i18n.formatNumber(1)).not.toThrow()
    })

    it('unknown but well-formed tags still pass through', () => {
      const i18n = createI18n({ locale: 'zz' })
      expect(() => i18n.formatNumber(1)).not.toThrow()
    })
  })
})
