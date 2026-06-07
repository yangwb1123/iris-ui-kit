<script lang="ts">
  // Test fixture: IrisFormField wired around an IrisInput control.
  import IrisFormField from './FormField.svelte'
  import IrisInput from '../input/Input.svelte'

  let { label, hint, error }: { label?: string; hint?: string; error?: string } = $props()
</script>

<IrisFormField {label} {hint} {error}>
  <IrisInput />
</IrisFormField>
