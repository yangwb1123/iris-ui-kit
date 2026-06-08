<script lang="ts">
  import IrisRadioGroup from './IrisRadioGroup.svelte'
  import IrisRadio from './IrisRadio.svelte'

  let { onchange }: { onchange?: (v: string | number | boolean) => void } = $props()
</script>

<IrisRadioGroup {onchange}>
  <IrisRadio value="a">Option A</IrisRadio>
  <IrisRadio value="b">Option B</IrisRadio>
</IrisRadioGroup>
