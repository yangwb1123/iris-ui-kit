<script lang="ts">
  import { useField, useFieldArray } from '@iris-ui-kit/svelte/form'
  import { arrayRowDefaults, type FieldSpec } from '../core'
  import { labelOf } from './helpers'
  import ScalarField from './ScalarField.svelte'

  // An `array` (repeater) field: zero rows initially, an "Add" button appends a
  // row built from `arrayRowDefaults`, and each row renders the sub-fields bound
  // to their nested path plus a "Remove" button. Mutations route through
  // `useFieldArray`, which re-keys per-row state across remove/move.
  let { field }: { field: FieldSpec } = $props()

  // The array field's name is its read-once binding key (one array field per
  // mount), mirroring the React renderer reading `field.name` once.
  // svelte-ignore state_referenced_locally
  const arr = useFieldArray<Record<string, unknown>>(field.name)
  const { fields: rows, push, remove } = arr
  // svelte-ignore state_referenced_locally
  const { error } = useField<unknown>(field.name)

  // svelte-ignore state_referenced_locally
  const id = `iris-fb-${field.name}`
  // svelte-ignore state_referenced_locally
  const subFields = field.fields ?? []
</script>

<div data-iris-form-field={field.name}>
  <!-- Group heading for the repeater. A bare <label> (no `for`) is the React
       reference's contract — the group has no single associated control. -->
  <!-- svelte-ignore a11y_label_has_associated_control -->
  <label style="display:block;color:var(--iris-form-label)">
    {labelOf(field)}{field.required ? ' *' : ''}
  </label>
  <div data-iris-fb-array={field.name}>
    {#each $rows as _, index (index)}
      <div data-iris-fb-row={index}>
        {#if field.itemLabel}
          <div data-iris-fb-item-label>{`${field.itemLabel} ${index + 1}`}</div>
        {/if}
        {#each subFields as sub (sub.name)}
          <ScalarField field={sub} prefix={`${field.name}[${index}]`} />
        {/each}
        <button type="button" data-iris-fb-remove={index} onclick={() => remove(index)}>
          {field.removeLabel ?? 'Remove'}
        </button>
      </div>
    {/each}
  </div>
  <button type="button" data-iris-fb-add={field.name} onclick={() => push(arrayRowDefaults(field))}>
    {field.addLabel ?? 'Add'}
  </button>
  {#if $error}
    <div id={`${id}-error`} role="alert" style="color:var(--iris-form-error)">
      {$error}
    </div>
  {/if}
</div>
