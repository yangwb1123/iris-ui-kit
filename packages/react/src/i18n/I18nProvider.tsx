import * as React from 'react'
import { createI18n, localeDirection, type I18n, type I18nMessages } from '@iris-ui/core'
import { applyDirection } from '@iris-ui/theme'
import { I18nContext } from './context'

export interface IrisI18nProviderProps {
  /** BCP-47 locale. Changes are synced to the live instance. */
  locale?: string
  /** Message overrides. Changes are merged into the live instance. */
  messages?: I18nMessages
  /** Provide a pre-created instance instead of `locale` / `messages`. */
  i18n?: I18n
  /**
   * When set, the locale's writing direction ({@link localeDirection}) is
   * applied to `directionTarget` (`dir` + `data-iris-dir`) and `<html lang>` is
   * set whenever `locale` changes — so "set locale → flip direction + announce
   * language" needs no manual wiring. Off by default so it never fights an
   * explicit `<ThemeProvider dir>`. Reverts on unmount.
   */
  autoDirection?: boolean
  /** Element to receive dir/lang when `autoDirection` is set. Defaults to `document.documentElement`. */
  directionTarget?: HTMLElement | null
  children?: React.ReactNode
}

/**
 * Makes a locale + message dictionary available to descendant components via
 * `useI18n`. Either pass `locale` / `messages` (an instance is created and
 * kept in sync) or a pre-built `i18n` instance you control externally.
 */
export function IrisI18nProvider({
  locale,
  messages,
  i18n,
  autoDirection,
  directionTarget,
  children,
}: IrisI18nProviderProps) {
  const ref = React.useRef<I18n | null>(null)
  if (ref.current === null) {
    ref.current = i18n ?? createI18n({ locale, messages })
  }
  const instance = ref.current

  React.useEffect(() => {
    if (i18n || !locale) return
    instance.setLocale(locale)
  }, [locale, i18n, instance])

  React.useEffect(() => {
    if (i18n || !messages) return
    instance.setMessages(messages)
  }, [messages, i18n, instance])

  // Auto-apply writing direction + `lang` from the active locale (opt-in).
  React.useEffect(() => {
    if (!autoDirection || !locale || typeof document === 'undefined') return
    const el = directionTarget ?? document.documentElement
    const applied = applyDirection(localeDirection(locale), el)
    const prevLang = el.getAttribute('lang')
    el.setAttribute('lang', locale)
    return () => {
      applied.revert()
      if (prevLang === null) el.removeAttribute('lang')
      else el.setAttribute('lang', prevLang)
    }
  }, [autoDirection, locale, directionTarget])

  return <I18nContext.Provider value={instance}>{children}</I18nContext.Provider>
}
