<script lang="ts">
  import type { Snippet } from 'svelte'
  import { createI18n, localeDirection, type I18n, type I18nMessages } from '@iris-ui/core'
  import { applyDirection } from '@iris-ui/theme'
  import { setI18nContext } from './context'

  interface Props {
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
    children?: Snippet
  }

  let { locale, messages, i18n: i18nProp, autoDirection, directionTarget, children }: Props =
    $props()

  // svelte-ignore state_referenced_locally — instance is created once; props sync via $effect
  const instance = i18nProp ?? createI18n({ locale, messages })

  // svelte-ignore state_referenced_locally
  setI18nContext(instance)

  $effect(() => {
    if (!i18nProp && locale) instance.setLocale(locale)
  })

  $effect(() => {
    if (!i18nProp && messages) instance.setMessages(messages)
  })

  // Auto-apply writing direction + `lang` from the active locale (opt-in). The
  // returned teardown runs both when the effect re-keys and on destroy.
  $effect(() => {
    if (!autoDirection || !locale || typeof document === 'undefined') return
    const el = directionTarget ?? document.documentElement
    const applied = applyDirection(localeDirection(locale), el)
    const prevLang = el.getAttribute('lang')
    el.setAttribute('lang', locale)
    return () => {
      applied.revert()
      if (prevLang === null) el.removeAttribute('lang')
      else el.setAttribute('lang', prevLang)
    }
  })
</script>

{@render children?.()}
