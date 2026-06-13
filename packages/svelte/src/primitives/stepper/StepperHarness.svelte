<script lang="ts">
  import IrisStepper from './IrisStepper.svelte'
  import IrisStepperStep from './IrisStepperStep.svelte'

  let {
    value = undefined,
    onchange,
    linear = true,
  }: { value?: number; onchange?: (v: number) => void; linear?: boolean } = $props()
</script>

<IrisStepper {value} {onchange} {linear}>
  <IrisStepperStep title="Step 1" />
  <IrisStepperStep title="Step 2" />
  <IrisStepperStep title="Step 3" />
</IrisStepper>
