<script lang="ts">
  import IrisToggleGroup from './IrisToggleGroup.svelte'
  import IrisToggleGroupItem from './IrisToggleGroupItem.svelte'

  let {
    type = 'single',
    value = null,
    onchange,
  }: {
    type?: 'single' | 'multiple'
    value?: string | string[] | null
    onchange?: (v: string | string[] | null) => void
  } = $props()
</script>

<IrisToggleGroup {type} {value} {onchange}>
  <IrisToggleGroupItem value="bold">Bold</IrisToggleGroupItem>
  <IrisToggleGroupItem value="italic">Italic</IrisToggleGroupItem>
</IrisToggleGroup>
