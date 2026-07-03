<script lang="ts">
  import IrisRadioGroup from './IrisRadioGroup.svelte'
  import IrisRadio from './IrisRadio.svelte'

  let {
    onchange,
    defaultValue,
  }: {
    onchange?: (v: string | number | boolean) => void
    defaultValue?: string | number | boolean | null
  } = $props()
</script>

<IrisRadioGroup {onchange} {defaultValue}>
  <IrisRadio value="a">Option A</IrisRadio>
  <IrisRadio value="b">Option B</IrisRadio>
</IrisRadioGroup>
