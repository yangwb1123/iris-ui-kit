import { defineComponent, provide, watch, type PropType } from 'vue'
import { createI18n, type I18n, type I18nMessages } from '@iris-ui/core'
import { I18nInjectionKey } from './context'

/**
 * Makes a locale + message dictionary available to descendant components via
 * `useI18n`. Pass `locale` / `messages` (an instance is created and kept in
 * sync) or a pre-built `i18n` instance you control externally. Renderless:
 * renders its default slot.
 */
export const IrisI18nProvider = defineComponent({
  name: 'IrisI18nProvider',
  props: {
    locale: { type: String, default: undefined },
    messages: { type: Object as PropType<I18nMessages>, default: undefined },
    i18n: { type: Object as PropType<I18n>, default: undefined },
  },
  setup(props, { slots }) {
    const instance = props.i18n ?? createI18n({ locale: props.locale, messages: props.messages })
    provide(I18nInjectionKey, instance)

    if (!props.i18n) {
      watch(
        () => props.locale,
        (locale) => {
          if (locale) instance.setLocale(locale)
        },
      )
      watch(
        () => props.messages,
        (messages) => {
          if (messages) instance.setMessages(messages)
        },
      )
    }

    return () => slots.default?.()
  },
})
