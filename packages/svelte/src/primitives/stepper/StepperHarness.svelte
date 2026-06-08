<script lang="ts">
  import IrisStepper from './IrisStepper.svelte'
  import IrisStepperStep from './IrisStepperStep.svelte'

  let { value = 0, onchange }: { value?: number; onchange?: (v: number) => void } = $props()
</script>

<IrisStepper {value} {onchange}>
  <IrisStepperStep title="Step 1" />
  <IrisStepperStep title="Step 2" />
  <IrisStepperStep title="Step 3" />
</IrisStepper>
