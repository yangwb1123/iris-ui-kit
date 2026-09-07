import type { InternalFormResult, ValidationCoordinator } from './coordinator'
import type { FormValues } from './types'

/** @internal Dependencies for the snapshot-safe form submission loop. */
export interface SubmissionControllerOptions<V extends FormValues> {
  coordinator: ValidationCoordinator<V>
  readValues: () => V
  runValidation: (values: V) => Promise<InternalFormResult<V>>
  isDisposed: () => boolean
  isSubmitting: () => boolean
  startSubmission: () => void
  setSubmitting: (on: boolean) => void
  transform: (values: V) => V
  onSubmit?: (values: V) => void | Promise<void>
}

export interface SubmissionController {
  handleSubmit(): Promise<void>
  cancel(): void
}

/**
 * @internal Run validation and submission against one immutable snapshot at a
 * time. A value revision can invalidate a pass, in which case one retry is
 * allowed against the latest effective values.
 */
export function createSubmissionController<V extends FormValues>(
  options: SubmissionControllerOptions<V>,
): SubmissionController {
  let nextSubmissionId = 0
  let activeSubmissionId: number | null = null

  const isCurrent = (id: number): boolean => !options.isDisposed() && activeSubmissionId === id

  const cancel = (): void => {
    activeSubmissionId = null
    options.setSubmitting(false)
  }

  const handleSubmit = async (): Promise<void> => {
    if (options.isDisposed() || options.isSubmitting() || activeSubmissionId !== null) return

    const submissionId = ++nextSubmissionId
    activeSubmissionId = submissionId
    options.startSubmission()

    try {
      for (let retry = 0; retry < 2; retry++) {
        if (!isCurrent(submissionId)) return

        const snapshot = options.readValues()
        const revision = options.coordinator.revision()
        const result: InternalFormResult<V> = await options.runValidation(snapshot)

        if (!isCurrent(submissionId)) return
        if (result.status !== 'current') continue
        if (!options.coordinator.isCurrent(result)) continue
        if (revision !== options.coordinator.revision()) continue
        if (Object.keys(result.errors).length > 0) return

        const transformed = options.transform(snapshot)
        if (!isCurrent(submissionId)) return
        if (revision !== options.coordinator.revision()) continue

        // There is no await between this authority check and invoking the user
        // callback, so a synchronous callback is never called for a stale pass.
        await options.onSubmit?.(transformed)
        return
      }
    } catch (error) {
      // Cancellation/reset/hydration/destroy may happen while an active
      // validator or onSubmit promise is settling. Such late failures are
      // intentionally suppressed; active failures retain their old contract.
      if (isCurrent(submissionId)) throw error
    } finally {
      if (isCurrent(submissionId)) {
        activeSubmissionId = null
        options.setSubmitting(false)
      }
    }
  }

  return { handleSubmit, cancel }
}
