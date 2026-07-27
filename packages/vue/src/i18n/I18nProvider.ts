import { defineComponent, onScopeDispose, provide, watch, type PropType } from 'vue'
import { createI18n, localeDirection, type I18n, type I18nMessages } from '@iris-ui-kit/core'
import { applyDirection } from '@iris-ui-kit/theme'
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
    /**
     * When set, the locale's writing direction ({@link localeDirection}) is
     * applied to `directionTarget` (`dir` + `data-iris-dir`) and `<html lang>`
     * is set whenever `locale` changes — so "set locale → flip direction +
     * announce language" needs no manual wiring. Off by default so it never
     * fights an explicit `<ThemeProvider dir>`. Reverts on unmount.
     */
    autoDirection: { type: Boolean, default: false },
    /** Element to receive dir/lang when `autoDirection` is set. Defaults to `document.documentElement`. */
    directionTarget: { type: Object as PropType<HTMLElement | null>, default: undefined },
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

    // Auto-apply writing direction + `lang` from the active locale (opt-in).
    let revertDirection: (() => void) | null = null
    watch(
      () => [props.autoDirection, props.locale, props.directionTarget] as const,
      ([autoDirection, locale]) => {
        revertDirection?.()
        revertDirection = null
        if (!autoDirection || !locale || typeof document === 'undefined') return
        const el = props.directionTarget ?? document.documentElement
        const applied = applyDirection(localeDirection(locale), el)
        const prevLang = el.getAttribute('lang')
        el.setAttribute('lang', locale)
        revertDirection = () => {
          applied.revert()
          if (prevLang === null) el.removeAttribute('lang')
          else el.setAttribute('lang', prevLang)
        }
      },
      { immediate: true },
    )
    onScopeDispose(() => {
      revertDirection?.()
      revertDirection = null
    })

    return () => slots.default?.()
  },
})
