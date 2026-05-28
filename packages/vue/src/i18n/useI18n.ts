import { computed, inject, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue'
import { createI18n, type I18n, type I18nState } from '@iris-ui/core'
import { I18nInjectionKey } from './context'

export interface UseI18nReturn {
  locale: ComputedRef<string>
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
 * Works with or without an `<IrisI18nProvider>` (falls back to English
 * defaults). `t` / formatters read the live locale at call time, and `locale`
 * is a reactive ref so templates re-render on change.
 */
export function useI18n(): UseI18nReturn {
  const i18n = inject(I18nInjectionKey, null) ?? getFallback()
  const state = ref(i18n.getState()) as Ref<I18nState>
  const unsubscribe = i18n.subscribe((next) => {
    state.value = next
  })
  onBeforeUnmount(unsubscribe)

  return {
    locale: computed(() => state.value.locale),
    t: (key, params) => {
      void state.value.locale
      return i18n.t(key, params)
    },
    formatDate: (value, options) => {
      void state.value.locale
      return i18n.formatDate(value, options)
    },
    formatNumber: (value, options) => {
      void state.value.locale
      return i18n.formatNumber(value, options)
    },
    formatRelativeTime: (value, unit, options) => {
      void state.value.locale
      return i18n.formatRelativeTime(value, unit, options)
    },
    setLocale: i18n.setLocale,
    setMessages: i18n.setMessages,
  }
}
