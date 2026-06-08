<script lang="ts">
  import IrisBanner from './IrisBanner.svelte'

  let { closable = false, onclose }: { closable?: boolean; onclose?: () => void } = $props()
</script>

<IrisBanner {closable} {onclose}>This is a banner message</IrisBanner>
