import { IrisAlert, IrisBadge, IrisButton, IrisInput } from '@iris-ui-kit/react'

interface FeedbackPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const params = await searchParams
  const status = first(params.status)
  const hasError = status === 'error'
  const nameError = hasError && first(params.fields)?.split(',').includes('name')
  const messageError = hasError && first(params.fields)?.split(',').includes('message')

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '40px 24px' }}>
      <header style={{ marginBottom: 28 }}>
        <IrisBadge tone="warning" variant="solid">
          Next.js route handler
        </IrisBadge>
        <h1 style={{ margin: '12px 0 6px', fontSize: 28 }}>Feedback</h1>
        <p style={{ margin: 0, color: 'var(--iris-muted-foreground)' }}>
          This native form remains usable without JavaScript and is validated by a production route
          handler.
        </p>
        <nav aria-label="SSR reference routes" style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <a href="/">Interactive demo</a>
          <a href="/data">Server data</a>
        </nav>
      </header>

      <form
        action="/api/feedback"
        method="post"
        style={{ display: 'grid', gap: 18, maxWidth: 620 }}
      >
        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor="feedback-name" style={{ fontWeight: 600 }}>
            Name
          </label>
          <IrisInput
            id="feedback-name"
            name="name"
            autoComplete="name"
            invalid={Boolean(nameError)}
            aria-describedby={nameError ? 'feedback-name-error' : undefined}
          />
          {nameError ? (
            <span id="feedback-name-error" style={{ color: 'var(--iris-danger)', fontSize: 13 }}>
              Enter at least 2 characters.
            </span>
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label htmlFor="feedback-message" style={{ fontWeight: 600 }}>
            Message
          </label>
          <textarea
            id="feedback-message"
            name="message"
            rows={5}
            aria-invalid={Boolean(messageError)}
            aria-describedby={messageError ? 'feedback-message-error' : undefined}
            style={{
              padding: 'var(--iris-padding-md)',
              border: '1px solid var(--iris-border)',
              borderRadius: 'var(--iris-radius-md)',
              background: 'var(--iris-background)',
              color: 'var(--iris-foreground)',
              font: 'inherit',
              resize: 'vertical',
            }}
          />
          {messageError ? (
            <span id="feedback-message-error" style={{ color: 'var(--iris-danger)', fontSize: 13 }}>
              Enter at least 10 characters.
            </span>
          ) : null}
        </div>

        <div>
          <IrisButton type="submit">Send feedback</IrisButton>
        </div>

        {status === 'success' ? (
          <IrisAlert tone="success" title="Feedback received" aria-live="polite">
            Thanks — your feedback was validated on the server.
          </IrisAlert>
        ) : null}
        {hasError ? (
          <IrisAlert tone="danger" title="Please check the form" aria-live="assertive">
            Name and message are required.
          </IrisAlert>
        ) : null}
      </form>
    </main>
  )
}
