<script lang="ts">
  import IrisAccordion from './IrisAccordion.svelte'
  import IrisAccordionItem from './IrisAccordionItem.svelte'

  let { collapsible = false }: { collapsible?: boolean } = $props()
</script>

<IrisAccordion {collapsible}>
  <IrisAccordionItem value="a" title="Item A">Content A</IrisAccordionItem>
  <IrisAccordionItem value="b" title="Item B">Content B</IrisAccordionItem>
</IrisAccordion>
