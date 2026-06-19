<script lang="ts">
  import { useField } from '@iris-ui/svelte/form'
  import type { FieldSpec } from '../core'
  import { labelOf, pathOf } from './helpers'

  // A single scalar control (text/number/email/password/textarea/select/checkbox).
  // Binds through `@iris-ui/svelte`'s `useField`, which keys per-field state by
  // CANONICAL PATH — so a sub-field nested under an array row (`items[2].sku`)
  // tracks its own error/touched/dirty independently of its siblings.
  let { field, prefix }: { field: FieldSpec; prefix?: string } = $props()

  // The field spec + its bound path are read ONCE on mount: rows are keyed by
  // index in the `{#each}`, so a row remounts (re-binds its `useField`) when the
  // array mutates — the same read-once-per-mount contract as the React renderer.
  // svelte-ignore state_referenced_locally
  const path = pathOf(field, prefix)
  const f = useField<unknown>(path)
  const { value, error, setValue, setTouched } = f

  const id = `iris-fb-${path}`
  // svelte-ignore state_referenced_locally
  const type = field.type ?? 'text'
  const describedBy = $derived($error ? `${id}-error` : undefined)
</script>

<div data-iris-form-field={path}>
  {#if type !== 'checkbox'}
    <label for={id} style="display:block;color:var(--iris-form-label)">
      {labelOf(field)}{field.required ? ' *' : ''}
    </label>
  {/if}

  {#if type === 'textarea'}
    <textarea
      {id}
      value={String($value ?? '')}
      placeholder={field.placeholder}
      aria-required={field.required || undefined}
      aria-invalid={$error ? true : undefined}
      aria-describedby={describedBy}
      oninput={(e) => setValue(e.currentTarget.value)}
      onblur={() => setTouched()}
    ></textarea>
  {:else if type === 'select'}
    <select
      {id}
      value={String($value ?? '')}
      aria-required={field.required || undefined}
      aria-invalid={$error ? true : undefined}
      aria-describedby={describedBy}
      onchange={(e) => setValue(e.currentTarget.value)}
      onblur={() => setTouched()}
    >
      <option value="">{field.placeholder ?? 'Select…'}</option>
      {#each field.options ?? [] as opt (opt.value)}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  {:else if type === 'checkbox'}
    <label for={id} style="display:flex;gap:8px;align-items:center">
      <input
        {id}
        type="checkbox"
        checked={Boolean($value)}
        aria-describedby={describedBy}
        onchange={(e) => setValue(e.currentTarget.checked)}
        onblur={() => setTouched()}
      />
      {labelOf(field)}{field.required ? ' *' : ''}
    </label>
  {:else}
    <input
      {id}
      {type}
      value={String($value ?? '')}
      placeholder={field.placeholder}
      aria-required={field.required || undefined}
      aria-invalid={$error ? true : undefined}
      aria-describedby={describedBy}
      oninput={(e) => setValue(e.currentTarget.value)}
      onblur={() => setTouched()}
    />
  {/if}

  {#if $error}
    <div id={`${id}-error`} role="alert" style="color:var(--iris-form-error)">
      {$error}
    </div>
  {/if}
</div>
