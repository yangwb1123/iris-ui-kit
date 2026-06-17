<script lang="ts">
  // Test fixture: IrisFormField with the full prop surface wired around an
  // IrisInput control (so the FormField context wiring can be asserted).
  import IrisFormField from './FormField.svelte'
  import IrisInput from '../input/Input.svelte'
  import type { IrisFormFieldProps } from './types'

  let {
    label,
    hint,
    error,
    required = false,
    labelFor,
    size = 'md',
  }: Pick<
    IrisFormFieldProps,
    'label' | 'hint' | 'error' | 'required' | 'labelFor' | 'size'
  > = $props()
</script>

<IrisFormField {label} {hint} {error} {required} {labelFor} {size}>
  <IrisInput />
</IrisFormField>
