<script lang="ts">
  // Test fixture: an IrisFormField whose layout props are reactive, so a test
  // can flip placement/width after mount and assert the DOM follows.
  import IrisFormField from './FormField.svelte'
  import IrisInput from '../input/Input.svelte'
  import type { FormFieldLabelPlacement, LayoutLength } from '@iris-ui-kit/core'

  let {
    labelPlacement = 'top',
    labelWidth = undefined,
    controlWidth = undefined,
  }: {
    labelPlacement?: FormFieldLabelPlacement
    labelWidth?: LayoutLength
    controlWidth?: LayoutLength
  } = $props()
</script>

<IrisFormField label="Email" hint="Work address" {labelPlacement} {labelWidth} {controlWidth}>
  <IrisInput />
</IrisFormField>
