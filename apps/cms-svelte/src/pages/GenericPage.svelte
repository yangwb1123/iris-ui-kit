<script lang="ts">
  import { IrisButton } from '@iris-ui/svelte'

  let { title, description }: { title?: string; description?: string } = $props()

  const FALLBACK =
    'A placeholder page rendered inside IrisAdminLayout. Increment the counter, switch to another tab, then come back — the value survives because inactive tabs stay mounted (keep-alive), keyed by the tab cache key.'

  let count = $state(0)
</script>

<section>
  <h1 class="page-title">{title}</h1>
  <p class="page-desc">{description ?? FALLBACK}</p>
  <IrisButton size="sm" variant="outline" onclick={() => (count += 1)}>
    Local counter: {count}
  </IrisButton>
</section>
