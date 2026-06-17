<script lang="ts">
  import IrisSelect from './primitives/select/IrisSelect.svelte'
</script>

<div>
  <IrisSelect
    items={[
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana' },
      { label: 'Apricot', value: 'apricot' },
      { label: 'Grape', value: 'grape' },
    ]}
    placeholder="Select fruit"
    portalTarget={false}
  />
</div>
