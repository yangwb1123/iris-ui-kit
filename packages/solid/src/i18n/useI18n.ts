import { createSignal, onCleanup, createMemo, type Accessor } from 'solid-js'
import { type I18n, type I18nState } from '@iris-ui/core'
import { useI18nContext } from './context'

export interface UseI18nReturn {
  locale: Accessor<string>
  t: I18n['t']
  formatDate: I18n['formatDate']
  formatNumber: I18n['formatNumber']
  formatRelativeTime: I18n['formatRelativeTime']
  setLocale: I18n['setLocale']
  setMessages: I18n['setMessages']
}

/**
 * Reactive access to the active locale + translation/formatting helpers.
 * Solid port of the Vue useI18n.
 */
export function useI18n(): UseI18nReturn {
  const i18n = useI18nContext()
  const [state, setState] = createSignal<I18nState>(i18n.getState())
  const unsubscribe = i18n.subscribe((next) => {
    setState(next as I18nState)
  })
  onCleanup(unsubscribe)

  const locale = createMemo(() => state().locale)

  return {
    locale,
    t: (key, params) => {
      void locale() // touch locale for reactivity
      return i18n.t(key, params)
    },
    formatDate: (value, options) => {
      void locale()
      return i18n.formatDate(value, options)
    },
    formatNumber: (value, options) => {
      void locale()
      return i18n.formatNumber(value, options)
    },
    formatRelativeTime: (value, unit, options) => {
      void locale()
      return i18n.formatRelativeTime(value, unit, options)
    },
    setLocale: i18n.setLocale,
    setMessages: i18n.setMessages,
  }
}
