<script lang="ts">
  import type { I18nMessages, NavNode } from '@iris-ui-kit/core'
  import { IrisI18nProvider } from '../i18n'
  import IrisNavMenu from './NavMenu.svelte'

  let {
    locale = 'en-US',
    messages,
    items = [],
    collapsed = true,
  }: {
    locale?: string
    messages?: I18nMessages
    items?: NavNode[]
    collapsed?: boolean
  } = $props()
</script>

<IrisI18nProvider {locale} {messages}>
  <IrisNavMenu {items} {collapsed} />
</IrisI18nProvider>
