<script lang="ts">
  import { setFormContext } from '@iris-ui-kit/svelte/form'
  import type { FormState, FormStore, FormValues } from '@iris-ui-kit/core'
  import { createFormBuilder, type FormSchema, type FormBuilderConfig } from '../core'
  import FieldControl from './FieldControl.svelte'

  interface IrisFormBuilderProps extends FormBuilderConfig {
    schema: FormSchema
    class?: string
    style?: string
  }

  let {
    schema,
    onSubmit,
    validateOnChange,
    parse,
    transform,
    dependencies,
    class: klass = '',
    style = '',
  }: IrisFormBuilderProps = $props()

  // Build the schema→form engine ONCE; the schema/config are read-once props
  // (mirrors the React renderer's lazy-ref). No new form logic lives here.
  // svelte-ignore state_referenced_locally
  const builder = createFormBuilder(schema, {
    onSubmit,
    validateOnChange,
    parse,
    transform,
    dependencies,
  })
  const {
    form,
    submitLabel,
    stepCount,
    nextStepLabel,
    stepFields,
    isLastStep,
    nextStep,
    prevStep,
  } = builder

  // Expose the builder's store through Svelte's form context so each control
  // binds via `@iris-ui-kit/svelte`'s `useField` (canonical-path keyed). This is what
  // lets an `array` field use `useFieldArray` and bind its per-row sub-fields to
  // nested paths (`items[2].sku`), with per-row state that re-keys on remove/move.
  // svelte-ignore state_referenced_locally — store ref is stable
  setFormContext(form as unknown as FormStore<FormValues>)

  // NB: do not name this `state` — a leading `$` would make Svelte read
  // `$state` as a store auto-subscription instead of the rune.
  let formState: FormState<FormValues> = $state(form.getState())

  $effect(() => form.subscribe((s) => (formState = s)))

  const gridStyle = $derived(
    `display:grid;gap:var(--iris-form-gap,var(--iris-space-md,16px));${style}`,
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
  {#each stepFields(formState) as field (field.name)}
    <FieldControl {field} />
  {/each}

  {#if isLastStep(formState)}
    <button type="submit" disabled={formState.isSubmitting}>{submitLabel}</button>
  {:else}
    <button type="button" onclick={() => void nextStep()}>{nextStepLabel}</button>
  {/if}
  {#if stepCount > 1 && formState.currentStep > 0}
    <button type="button" onclick={prevStep}>Previous</button>
  {/if}
</form>
