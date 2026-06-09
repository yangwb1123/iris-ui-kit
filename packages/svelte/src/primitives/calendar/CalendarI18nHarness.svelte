<!--
  Test-only harness: mounts IrisCalendar inside an IrisI18nProvider so the
  calendar reads i18n nav labels from provider context (Svelte context flows
  through the component tree, so the provider must wrap the calendar here).
-->
<script lang="ts">
  import type { I18nMessages } from '@iris-ui/core'
  import { IrisI18nProvider } from '../../i18n'
  import IrisCalendar from './IrisCalendar.svelte'

  let { messages }: { messages?: I18nMessages } = $props()
</script>

<IrisI18nProvider {messages}>
  <IrisCalendar />
</IrisI18nProvider>
