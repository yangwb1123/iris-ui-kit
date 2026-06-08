<script lang="ts">
  import type { Snippet } from 'svelte'
  import { createI18n, type I18n, type I18nMessages } from '@iris-ui/core'
  import { setI18nContext } from './context'

  interface Props {
    locale?: string
    messages?: I18nMessages
    i18n?: I18n
    children?: Snippet
  }

  let { locale, messages, i18n: i18nProp, children }: Props = $props()

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
</script>

{@render children?.()}
