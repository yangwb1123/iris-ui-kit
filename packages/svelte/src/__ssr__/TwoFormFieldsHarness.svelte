<script lang="ts">
  // SSR fixture: two IrisFormField + control pairs in one tree, to prove that
  // generateId() hands out non-colliding ids within a single server render.
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
