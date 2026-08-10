import { createSignal, onCleanup, createMemo, For, Show, type JSX } from 'solid-js'
import { FormContext } from '@iris-ui-kit/solid/form'
import type { FormStore, FormValues } from '@iris-ui-kit/core'
import { createFormBuilder, type FormSchema, type FieldSpec, type FormBuilderConfig } from '../core'
import { FieldControl } from './fields'

export type { FormSchema, FieldSpec } from '../core'

export interface IrisFormBuilderProps extends FormBuilderConfig {
  schema: FormSchema
  class?: string
  style?: JSX.CSSProperties
}

/**
 * Render a validated form from a declarative schema (SolidJS). Each field becomes
 * an accessible native control wired to the core form engine; required fields
 * validate inline; submit runs the schema's `onSubmit`. Themed via CSS vars.
 *
 * The form body is wrapped in `<FormContext.Provider>` so each control binds via
 * `@iris-ui-kit/solid/form`'s `useField` (canonical-path keyed). This is what lets an
 * `array` (repeater) field use `useFieldArray` and bind its per-row sub-fields to
 * nested paths (`items[2].sku`), with per-row state that re-keys on remove/move.
 */
export function IrisFormBuilder(props: IrisFormBuilderProps) {
  // Create the builder ONCE (forms are per-instance; props are read once).
  const builder = createFormBuilder(props.schema, {
    onSubmit: props.onSubmit,
    validateOnChange: props.validateOnChange,
    parse: props.parse,
    transform: props.transform,
    dependencies: props.dependencies,
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

  const [state, setState] = createSignal(form.getState())
  onCleanup(form.subscribe(setState))

  const visibleFields = createMemo(() => stepFields(state()))

  return (
    <FormContext.Provider value={form as unknown as FormStore<FormValues>}>
      <form
        data-iris-form-builder=""
        class={props.class}
        style={{
          display: 'grid',
          gap: 'var(--iris-form-gap, var(--iris-space-md, 16px))',
          ...props.style,
        }}
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
        noValidate
      >
        <For each={visibleFields()}>{(field: FieldSpec) => <FieldControl field={field} />}</For>
        <Show
          when={isLastStep(state())}
          fallback={
            <button type="button" onClick={() => void nextStep()}>
              {nextStepLabel}
            </button>
          }
        >
          <button type="submit" disabled={state().isSubmitting}>
            {submitLabel}
          </button>
        </Show>
        <Show when={stepCount > 1 && state().currentStep > 0}>
          <button type="button" onClick={prevStep}>
            Previous
          </button>
        </Show>
      </form>
    </FormContext.Provider>
  )
}
