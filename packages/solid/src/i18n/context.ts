import { createContext, useContext } from 'solid-js'
import type { I18n } from '@iris-ui-kit/core'
import { createI18n } from '@iris-ui-kit/core'

export const I18nContext = createContext<I18n | null>(null)

let fallbackI18n: I18n | null = null
function getFallback(): I18n {
  if (fallbackI18n === null) fallbackI18n = createI18n()
  return fallbackI18n
}

export function useI18nContext(): I18n {
  return useContext(I18nContext) ?? getFallback()
}
