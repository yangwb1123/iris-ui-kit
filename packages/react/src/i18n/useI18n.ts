import * as React from 'react'
import { createI18n, type I18n } from '@iris-ui-kit/core'
import { useStore } from '../useStore'
import { I18nContext } from './context'

export interface UseI18nReturn {
  locale: string
  t: I18n['t']
  formatDate: I18n['formatDate']
  formatNumber: I18n['formatNumber']
  formatRelativeTime: I18n['formatRelativeTime']
  setLocale: I18n['setLocale']
  setMessages: I18n['setMessages']
}

// Shared fallback so components can call `useI18n()` without an enclosing
// provider — they get English defaults rather than throwing.
let fallbackI18n: I18n | null = null
function getFallback(): I18n {
  if (fallbackI18n === null) fallbackI18n = createI18n()
  return fallbackI18n
}

/**
 * Reactive access to the active locale + translation/formatting helpers.
 * Re-renders the host when the locale or messages change. Works with or
 * without an `<IrisI18nProvider>` (falls back to English defaults).
 */
export function useI18n(): UseI18nReturn {
  const ctx = React.useContext(I18nContext)
  const i18n = ctx ?? getFallback()
  const state = useStore(i18n.store)

  return {
    locale: state.locale,
    t: i18n.t,
    formatDate: i18n.formatDate,
    formatNumber: i18n.formatNumber,
    formatRelativeTime: i18n.formatRelativeTime,
    setLocale: i18n.setLocale,
    setMessages: i18n.setMessages,
  }
}
