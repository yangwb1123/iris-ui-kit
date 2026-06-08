import { createEffect, type JSX } from 'solid-js'
import { createI18n, type I18n, type I18nMessages } from '@iris-ui/core'
import { I18nContext } from './context'

export interface IrisI18nProviderProps {
  locale?: string
  messages?: I18nMessages
  i18n?: I18n
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

  return <I18nContext.Provider value={instance}>{props.children}</I18nContext.Provider>
}
