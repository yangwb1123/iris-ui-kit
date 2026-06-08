import { createEffect, onCleanup, type JSX } from 'solid-js'
import { createI18n, localeDirection, type I18n, type I18nMessages } from '@iris-ui/core'
import { applyDirection } from '@iris-ui/theme'
import { I18nContext } from './context'

export interface IrisI18nProviderProps {
  locale?: string
  messages?: I18nMessages
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
  children?: JSX.Element
}

/**
 * Makes a locale + message dictionary available to descendant components via
 * `useI18n`. Solid port of the Vue IrisI18nProvider.
 */
export function IrisI18nProvider(props: IrisI18nProviderProps): JSX.Element {
  const instance = props.i18n ?? createI18n({ locale: props.locale, messages: props.messages })

  if (!props.i18n) {
    createEffect(() => {
      if (props.locale) instance.setLocale(props.locale)
    })
    createEffect(() => {
      if (props.messages) instance.setMessages(props.messages)
    })
  }

  // Auto-apply writing direction + `lang` from the active locale (opt-in).
  // Solid re-runs the effect (cleanup-first) on change and on unmount.
  createEffect(() => {
    const locale = props.locale
    if (!props.autoDirection || !locale || typeof document === 'undefined') return
    const el = props.directionTarget ?? document.documentElement
    const applied = applyDirection(localeDirection(locale), el)
    const prevLang = el.getAttribute('lang')
    el.setAttribute('lang', locale)
    onCleanup(() => {
      applied.revert()
      if (prevLang === null) el.removeAttribute('lang')
      else el.setAttribute('lang', prevLang)
    })
  })

  return <I18nContext.Provider value={instance}>{props.children}</I18nContext.Provider>
}
