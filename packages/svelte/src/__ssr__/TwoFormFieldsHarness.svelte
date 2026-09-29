<script lang="ts">
  // SSR fixture: two IrisFormField + control pairs in one tree, to prove that
  // Svelte's component-scoped ids remain distinct for sibling fields.
  import IrisFormField from '../primitives/form-field/FormField.svelte'
  import IrisInput from '../primitives/input/Input.svelte'
</script>

<div>
  <IrisFormField label="First">
    <IrisInput />
  </IrisFormField>
  <IrisFormField label="Second">
    <IrisInput />
  </IrisFormField>
</div>
