import * as React from 'react'
import { FormContext } from '@iris-ui-kit/react/form'
import type { FormStore, FormValues } from '@iris-ui-kit/core'
import { createFormBuilder, type FormSchema, type FieldSpec, type FormBuilderConfig } from '../core'
import { FieldControl } from './fields'

export type { FormSchema, FieldSpec } from '../core'

export interface IrisFormBuilderProps extends FormBuilderConfig {
  schema: FormSchema
  className?: string
  style?: React.CSSProperties
}

/**
 * Render a validated form from a declarative schema (React). Each field becomes
 * an accessible native control wired to the core form engine; required fields
 * validate inline; submit runs the schema's `onSubmit`. Themed via CSS vars.
 *
 * The form body is wrapped in `<FormContext.Provider>` so each control binds via
 * `@iris-ui-kit/react/form`'s `useField` (canonical-path keyed). This is what lets an
 * `array` (repeater) field use `useFieldArray` and bind its per-row sub-fields to
 * nested paths (`items[2].sku`), with per-row state that re-keys on remove/move.
 */
export function IrisFormBuilder({
  schema,
  onSubmit,
  validateOnChange,
  parse,
  transform,
  dependencies,
  className,
  style,
}: IrisFormBuilderProps) {
  const builderRef = React.useRef<ReturnType<typeof createFormBuilder> | null>(null)
  if (builderRef.current === null) {
    builderRef.current = createFormBuilder(schema, {
      onSubmit,
      validateOnChange,
      parse,
      transform,
      dependencies,
    })
  }
  const builder = builderRef.current
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
  const state = React.useSyncExternalStore(form.subscribe, form.getState, form.getState)

  return (
    <FormContext.Provider value={form as unknown as FormStore<FormValues>}>
      <form
        data-iris-form-builder=""
        className={className}
        style={{
          display: 'grid',
          gap: 'var(--iris-form-gap, var(--iris-space-md, 16px))',
          ...style,
        }}
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
        noValidate
      >
        {stepFields(state).map((field: FieldSpec) => (
          <FieldControl key={field.name} field={field} />
        ))}
        {isLastStep(state) ? (
          <button type="submit" disabled={state.isSubmitting}>
            {submitLabel}
          </button>
        ) : (
          <button type="button" onClick={() => void nextStep()}>
            {nextStepLabel}
          </button>
        )}
        {stepCount > 1 && state.currentStep > 0 && (
          <button type="button" onClick={prevStep}>
            Previous
          </button>
        )}
      </form>
    </FormContext.Provider>
  )
}
