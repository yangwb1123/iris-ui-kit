import * as React from 'react'
import { createI18n, type I18n, type I18nMessages } from '@iris-ui/core'
import { I18nContext } from './context'

export interface IrisI18nProviderProps {
  /** BCP-47 locale. Changes are synced to the live instance. */
  locale?: string
  /** Message overrides. Changes are merged into the live instance. */
  messages?: I18nMessages
  /** Provide a pre-created instance instead of `locale` / `messages`. */
  i18n?: I18n
  children?: React.ReactNode
}

/**
 * Makes a locale + message dictionary available to descendant components via
 * `useI18n`. Either pass `locale` / `messages` (an instance is created and
 * kept in sync) or a pre-built `i18n` instance you control externally.
 */
export function IrisI18nProvider({ locale, messages, i18n, children }: IrisI18nProviderProps) {
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

  return <I18nContext.Provider value={instance}>{children}</I18nContext.Provider>
}
