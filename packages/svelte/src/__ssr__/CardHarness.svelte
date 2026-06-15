<script lang="ts">
  // SSR fixture: IrisCard with header, body and footer snippets.
  import IrisCard from '../primitives/card/IrisCard.svelte'
</script>

<IrisCard style="">
  {#snippet header()}<span>Header</span>{/snippet}
  Card body
  {#snippet footer()}<span>Footer</span>{/snippet}
</IrisCard>
