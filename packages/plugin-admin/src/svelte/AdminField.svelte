<script lang="ts">
  import { IrisInput } from '@iris-ui-kit/svelte'
  import {
    adminFieldName,
    coerceAdminFieldValue,
    type AdminColumn,
  } from '@iris-ui-kit/plugin-admin/core'

  let {
    column,
    value,
    error,
    id,
    onvalue,
  }: {
    column: AdminColumn
    value: unknown
    error?: string
    id: string
    onvalue: (value: unknown) => void
  } = $props()

  const field = $derived(adminFieldName(column))
  const errorId = $derived(`${id}-error`)
  const invalid = $derived(Boolean(error))
</script>

<div
  data-iris-admin-field={field}
  style="display:flex;flex-direction:column;gap:var(--iris-gap-sm)"
>
  <label for={id}>{column.title}{column.required ? ' *' : ''}</label>
  {#if column.type === 'boolean'}
    <input
      {id}
      type="checkbox"
      checked={Boolean(value)}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId : undefined}
      onchange={(event) => onvalue(event.currentTarget.checked)}
    />
  {:else if column.type === 'select'}
    <select
      {id}
      value={String(value ?? '')}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId : undefined}
      onchange={(event) => onvalue(coerceAdminFieldValue(column, event.currentTarget.value))}
    >
      <option value="">{column.placeholder ?? ''}</option>
      {#each column.options ?? [] as option (option.value)}
        <option value={String(option.value)}>{option.label}</option>
      {/each}
    </select>
  {:else if column.type === 'date'}
    <input
      {id}
      type="date"
      value={String(value ?? '')}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? errorId : undefined}
      oninput={(event) => onvalue(event.currentTarget.value)}
    />
  {:else}
    <IrisInput
      {id}
      type={column.type === 'email' || column.type === 'number' ? column.type : 'text'}
      value={String(value ?? '')}
      placeholder={column.placeholder}
      {invalid}
      ariaDescribedby={invalid ? errorId : undefined}
      oninput={(event) => onvalue(coerceAdminFieldValue(column, event.currentTarget.value))}
    />
  {/if}
  {#if invalid}
    <span id={errorId} role="alert">{error}</span>
  {/if}
</div>
