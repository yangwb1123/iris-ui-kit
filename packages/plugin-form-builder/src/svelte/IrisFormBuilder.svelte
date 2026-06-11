<script lang="ts">
  import {
    createFormBuilder,
    type FormSchema,
    type FieldSpec,
    type FormBuilderConfig,
  } from '../core'
  import type { FormState, FormValues } from '@iris-ui/core'

  let {
    schema,
    onSubmit,
    validateOnChange,
    class: klass = '',
    style = '',
  }: FormBuilderConfig & {
    schema: FormSchema
    class?: string
    style?: string
  } = $props()

  // Build the schema→form engine ONCE; the schema/config are read-once props
  // (mirrors the React renderer's lazy-ref). No new form logic lives here.
  // svelte-ignore state_referenced_locally
  const builder = createFormBuilder(schema, { onSubmit, validateOnChange })
  const { form, submitLabel, labelOf } = builder

  // NB: do not name this `state` — a leading `$` would make Svelte read
  // `$state` as a store auto-subscription instead of the rune.
  let formState: FormState<FormValues> = $state(form.getState())

  $effect(() => form.subscribe((s) => (formState = s)))

  const setValue = (field: FieldSpec, value: unknown) =>
    form.setFieldValue(field.name, value as FormValues[string])

  const idOf = (name: string) => `iris-fb-${name}`

  const gridStyle = $derived(
    `display:grid;gap:var(--iris-form-gap, 16px);${style}`,
  )
</script>

<form
  data-iris-form-builder
  class={klass}
  style={gridStyle}
  novalidate
  onsubmit={(e) => {
    e.preventDefault()
    void form.handleSubmit()
  }}
>
  {#each builder.visibleFields(formState.values) as field (field.name)}
    {@const type = field.type ?? 'text'}
    {@const id = idOf(field.name)}
    {@const value = formState.values[field.name]}
    {@const error = formState.errors[field.name]}
    {@const describedBy = error ? `${id}-error` : undefined}
    <div data-iris-form-field={field.name}>
      {#if type !== 'checkbox'}
        <label for={id} style="display:block;color:var(--iris-form-label)">
          {labelOf(field)}{field.required ? ' *' : ''}
        </label>
      {/if}

      {#if type === 'textarea'}
        <textarea
          {id}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          aria-required={field.required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          oninput={(e) => setValue(field, e.currentTarget.value)}
          onblur={() => form.setFieldTouched(field.name)}
        ></textarea>
      {:else if type === 'select'}
        <select
          {id}
          value={String(value ?? '')}
          aria-required={field.required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onchange={(e) => setValue(field, e.currentTarget.value)}
          onblur={() => form.setFieldTouched(field.name)}
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
            checked={Boolean(value)}
            aria-describedby={describedBy}
            onchange={(e) => setValue(field, e.currentTarget.checked)}
            onblur={() => form.setFieldTouched(field.name)}
          />
          {labelOf(field)}{field.required ? ' *' : ''}
        </label>
      {:else}
        <input
          {id}
          {type}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          aria-required={field.required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          oninput={(e) => setValue(field, e.currentTarget.value)}
          onblur={() => form.setFieldTouched(field.name)}
        />
      {/if}

      {#if error}
        <div id={`${id}-error`} role="alert" style="color:var(--iris-form-error)">
          {error}
        </div>
      {/if}
    </div>
  {/each}

  <button type="submit" disabled={formState.isSubmitting}>{submitLabel}</button>
</form>
