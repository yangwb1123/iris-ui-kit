<script lang="ts">
  // a11y fixture: IrisSwitch self-wires its label via IrisFormField context
  // (the FormField <label for={controlId}> names the switch input).
  import IrisFormField from '../form-field/FormField.svelte'
  import IrisSwitch from './Switch.svelte'
</script>

<IrisFormField label="Notifications">
  <IrisSwitch />
</IrisFormField>
