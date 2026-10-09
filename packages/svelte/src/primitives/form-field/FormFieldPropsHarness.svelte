<script lang="ts">
  // Test fixture: IrisFormField with the full prop surface (including the
  // declarative layout props) wired around an IrisInput control.
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
    labelPlacement,
    labelWidth,
    controlWidth,
    fullWidth = false,
  }: Pick<
    IrisFormFieldProps,
    | 'label'
    | 'hint'
    | 'error'
    | 'required'
    | 'labelFor'
    | 'size'
    | 'labelPlacement'
    | 'labelWidth'
    | 'controlWidth'
    | 'fullWidth'
  > = $props()
</script>

<IrisFormField
  {label}
  {hint}
  {error}
  {required}
  {labelFor}
  {size}
  {labelPlacement}
  {labelWidth}
  {controlWidth}
  {fullWidth}
>
  <IrisInput />
</IrisFormField>
