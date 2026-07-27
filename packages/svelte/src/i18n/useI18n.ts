import { readable, derived, type Readable } from 'svelte/store'
import { createI18n, type I18n, type I18nState } from '@iris-ui-kit/core'
import { getI18nContext } from './context'

export interface UseI18nReturn {
  locale: Readable<string>
  t: I18n['t']
  formatDate: I18n['formatDate']
  formatNumber: I18n['formatNumber']
  formatRelativeTime: I18n['formatRelativeTime']
  setLocale: I18n['setLocale']
  setMessages: I18n['setMessages']
}

let fallbackI18n: I18n | null = null
function getFallback(): I18n {
  if (!fallbackI18n) fallbackI18n = createI18n()
  return fallbackI18n
}

/**
 * Svelte binding for i18n context. Returns Svelte stores.
 * Works with or without an IrisI18nProvider (falls back to English defaults).
 */
export function useI18n(): UseI18nReturn {
  const i18n = getI18nContext() ?? getFallback()
  const state = readable<I18nState>(i18n.getState(), (set) => i18n.subscribe(set))
  const locale = derived(state, ($s) => $s.locale)

  return {
    locale,
    t: (key, params) => i18n.t(key, params),
    formatDate: (value, options) => i18n.formatDate(value, options),
    formatNumber: (value, options) => i18n.formatNumber(value, options),
    formatRelativeTime: (value, unit, options) => i18n.formatRelativeTime(value, unit, options),
    setLocale: i18n.setLocale,
    setMessages: i18n.setMessages,
  }
}
