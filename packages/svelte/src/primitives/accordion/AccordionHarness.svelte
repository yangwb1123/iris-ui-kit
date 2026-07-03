<script lang="ts">
  import IrisAccordion from './IrisAccordion.svelte'
  import IrisAccordionItem from './IrisAccordionItem.svelte'

  let {
    collapsible = false,
    value = undefined,
    onValueChange = undefined,
  }: {
    collapsible?: boolean
    value?: string | string[] | null
    onValueChange?: (next: string | string[] | null) => void
  } = $props()
</script>

<IrisAccordion {collapsible} {value} {onValueChange}>
  <IrisAccordionItem value="a" title="Item A">Content A</IrisAccordionItem>
  <IrisAccordionItem value="b" title="Item B">Content B</IrisAccordionItem>
  <IrisAccordionItem value="c" title="Item C">Content C</IrisAccordionItem>
</IrisAccordion>
