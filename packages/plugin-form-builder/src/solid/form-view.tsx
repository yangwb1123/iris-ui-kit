import { createMemo, createSignal, For, onCleanup, type JSX } from 'solid-js'
import { FormContext } from '@iris-ui-kit/solid/form'
import type { FormStore, FormValues } from '@iris-ui-kit/core'
import { type FieldSpec, type FormBuilder } from '../core'
import { FieldControl } from './fields'
import { FormBuilderActions } from './form-actions'

export interface FormBuilderViewProps {
  builder: FormBuilder
  class?: string
  style?: JSX.CSSProperties
}

/** Bind the shared form store to Solid controls and navigation actions. */
export function FormBuilderView(props: FormBuilderViewProps): JSX.Element {
  const {
    form,
    submitLabel,
    stepCount,
    nextStepLabel,
    stepFields,
    isLastStep,
    nextStep,
    prevStep,
  } = props.builder
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
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
        noValidate
      >
        <For each={visibleFields()}>{(field: FieldSpec) => <FieldControl field={field} />}</For>
        <FormBuilderActions
          isLastStep={() => isLastStep(state())}
          isSubmitting={() => state().isSubmitting}
          currentStep={() => state().currentStep}
          stepCount={stepCount}
          nextStepLabel={nextStepLabel}
          submitLabel={submitLabel}
          nextStep={nextStep}
          prevStep={prevStep}
        />
      </form>
    </FormContext.Provider>
  )
}
