import { Show, type Accessor, type JSX } from 'solid-js'

export interface FormBuilderActionsProps {
  isLastStep: Accessor<boolean>
  isSubmitting: Accessor<boolean>
  currentStep: Accessor<number>
  stepCount: number
  nextStepLabel: string
  submitLabel: string
  nextStep: () => void | Promise<unknown>
  prevStep: () => void
}

/** Step navigation and submit controls kept separate from field rendering. */
export function FormBuilderActions(props: FormBuilderActionsProps): JSX.Element {
  return (
    <>
      <Show
        when={props.isLastStep()}
        fallback={
          <button type="button" onClick={() => void props.nextStep()}>
            {props.nextStepLabel}
          </button>
        }
      >
        <button type="submit" disabled={props.isSubmitting()}>
          {props.submitLabel}
        </button>
      </Show>
      <Show when={props.stepCount > 1 && props.currentStep() > 0}>
        <button type="button" onClick={props.prevStep}>
          Previous
        </button>
      </Show>
    </>
  )
}
