import { IrisAlert, IrisBadge, IrisButton, IrisInput } from '@iris-ui-kit/solid'
import { useLocation, useSubmission } from '@solidjs/router'
import { createMemo, Show } from 'solid-js'
import { submitFeedback, type FeedbackResult } from '../demo-server'

const controlStyle = {
  width: '100%',
  padding: 'var(--iris-padding-md)',
  border: '1px solid var(--iris-border)',
  'border-radius': 'var(--iris-radius-md)',
  background: 'var(--iris-background)',
  color: 'var(--iris-foreground)',
  font: 'inherit',
  resize: 'vertical',
} as const

function feedbackFromSearch(search: string): FeedbackResult | undefined {
  const params = new URLSearchParams(search)
  const status = params.get('status')
  if (status === 'success') {
    const name = params.get('name') ?? 'there'
    return {
      ok: true,
      message: `Thanks, ${name}. Your feedback was validated on the server.`,
    }
  }
  if (status !== 'error') return undefined

  const fields = new Set((params.get('fields') ?? '').split(','))
  const errors: Record<string, string> = {}
  if (fields.has('name')) errors.name = 'Enter at least 2 characters.'
  if (fields.has('message')) errors.message = 'Enter at least 10 characters.'
  return { ok: false, message: 'Name and message are required.', errors }
}

function describedBy(error: string | undefined, id: string): string | undefined {
  return error ? id : undefined
}

function SubmitButton(props: { pending: boolean }) {
  return (
    <IrisButton type="submit" loading={props.pending} disabled={props.pending}>
      {props.pending ? 'Sending feedback…' : 'Send feedback'}
    </IrisButton>
  )
}

function FeedbackAlert(props: { feedback: FeedbackResult }) {
  return (
    <IrisAlert
      tone={props.feedback.ok ? 'success' : 'danger'}
      title={props.feedback.ok ? 'Feedback received' : 'Please check the form'}
      aria-live={props.feedback.ok ? 'polite' : 'assertive'}
    >
      {props.feedback.message}
    </IrisAlert>
  )
}

export default function FeedbackPage() {
  const location = useLocation()
  const submission = useSubmission(submitFeedback)
  const result = createMemo(
    () => (submission.result as FeedbackResult | undefined) ?? feedbackFromSearch(location.search),
  )
  const initialName = () => new URLSearchParams(location.search).get('name') ?? ''
  const errors = () => result()?.errors ?? {}
  const nameError = () => errors().name
  const messageError = () => errors().message

  return (
    <>
      <header style={{ 'margin-bottom': '28px' }}>
        <IrisBadge tone="warning" variant="solid">
          SolidStart action
        </IrisBadge>
        <h1 style={{ margin: '12px 0 6px', 'font-size': '28px' }}>Feedback</h1>
        <p style={{ margin: 0, color: 'var(--iris-muted-foreground)' }}>
          The form posts through a native SolidStart server action and progressively enhances after
          hydration.
        </p>
      </header>

      <form
        action={submitFeedback}
        method="post"
        style={{ display: 'grid', gap: '18px', 'max-width': '620px' }}
      >
        <div style={{ display: 'grid', gap: '6px' }}>
          <label for="feedback-name" style={{ 'font-weight': 600 }}>
            Name
          </label>
          <IrisInput
            id="feedback-name"
            name="name"
            autocomplete="name"
            value={initialName()}
            invalid={Boolean(nameError())}
            ariaDescribedby={describedBy(nameError(), 'feedback-name-error')}
            style={{ width: '100%' }}
          />
          <Show when={nameError()}>
            {(error) => (
              <span
                id="feedback-name-error"
                style={{ color: 'var(--iris-danger)', 'font-size': '13px' }}
              >
                {error()}
              </span>
            )}
          </Show>
        </div>

        <div style={{ display: 'grid', gap: '6px' }}>
          <label for="feedback-message" style={{ 'font-weight': 600 }}>
            Message
          </label>
          <textarea
            id="feedback-message"
            name="message"
            rows={5}
            aria-invalid={Boolean(messageError())}
            aria-describedby={describedBy(messageError(), 'feedback-message-error')}
            style={controlStyle}
          />
          <Show when={messageError()}>
            {(error) => (
              <span
                id="feedback-message-error"
                style={{ color: 'var(--iris-danger)', 'font-size': '13px' }}
              >
                {error()}
              </span>
            )}
          </Show>
        </div>

        <div>
          <SubmitButton pending={Boolean(submission.pending)} />
        </div>

        <Show when={submission.pending}>
          <p role="status" aria-live="polite" style={{ margin: 0 }}>
            Sending your feedback…
          </p>
        </Show>
        <Show when={result()}>{(feedback) => <FeedbackAlert feedback={feedback()} />}</Show>
        <Show when={submission.error}>
          <IrisAlert tone="danger" title="Server error" aria-live="assertive">
            The server could not accept the feedback.
          </IrisAlert>
        </Show>
      </form>
    </>
  )
}
