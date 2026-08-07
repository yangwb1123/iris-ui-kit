import { createSignal, mergeProps, splitProps, Show, type JSX } from 'solid-js'

export interface IrisLoginSubmitPayload {
  email: string
  password: string
  remember: boolean
}

export interface IrisLoginTemplateProps {
  title?: string
  description?: string
  showRemember?: boolean
  error?: string
  submitLabel?: string
  loading?: boolean
  onSubmit?: (payload: IrisLoginSubmitPayload) => void
}

/**
 * Layer 4 system skeleton: a centered login page using Iris primitives.
 * Solid port of the Vue IrisLoginTemplate.
 */
export function IrisLoginTemplate(props: IrisLoginTemplateProps): JSX.Element {
  const merged = mergeProps(
    {
      title: 'Sign in',
      description: '',
      showRemember: true,
      error: '',
      submitLabel: 'Sign in',
      loading: false,
    },
    props,
  )
  const [local] = splitProps(merged, [
    'title',
    'description',
    'showRemember',
    'error',
    'submitLabel',
    'loading',
    'onSubmit',
  ])

  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [remember, setRemember] = createSignal(false)

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    local.onSubmit?.({ email: email(), password: password(), remember: remember() })
  }

  const inputStyle: JSX.CSSProperties = {
    'box-sizing': 'border-box',
    width: '100%',
    padding: '8px 12px',
    'font-size': 'var(--iris-font-size-md, 14px)',
    'font-family': 'inherit',
    background: 'var(--iris-surface)',
    border: '1px solid var(--iris-border)',
    'border-radius': 'var(--iris-radius-md, 6px)',
    color: 'var(--iris-foreground)',
    outline: 'none',
  }

  return (
    <div
      data-iris-login-template=""
      style={{
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        'min-height': '100vh',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          'max-width': '400px',
          background: 'var(--iris-surface)',
          border: '1px solid var(--iris-border)',
          'border-radius': 'var(--iris-radius-lg, 8px)',
          padding: '32px',
          'box-shadow': 'var(--iris-shadow-md)',
        }}
      >
        <h1
          style={{
            margin: '0 0 8px 0',
            'font-size': 'var(--iris-font-size-3xl, 24px)',
            'font-weight': '700',
          }}
        >
          {local.title}
        </h1>
        <Show when={local.description}>
          <p
            style={{
              margin: '0 0 24px 0',
              'font-size': 'var(--iris-font-size-md, 14px)',
              color: 'var(--iris-muted)',
            }}
          >
            {local.description}
          </p>
        </Show>

        <Show when={local.error}>
          <div
            data-iris-login-template-error=""
            role="alert"
            style={{
              padding: 'var(--iris-space-sm, 12px) var(--iris-space-md, 16px)',
              background: 'var(--iris-danger-subtle, #fef2f2)',
              color: 'var(--iris-danger, #ef4444)',
              'border-radius': 'var(--iris-radius-md, 6px)',
              'font-size': 'var(--iris-font-size-md, 14px)',
              'margin-bottom': '16px',
            }}
          >
            {local.error}
          </div>
        </Show>

        <form data-iris-login-template-form="" onSubmit={handleSubmit}>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
            <div>
              <label
                for="iris-login-email"
                style={{
                  display: 'block',
                  'font-size': 'var(--iris-font-size-sm, 13px)',
                  'font-weight': '500',
                  'margin-bottom': '4px',
                }}
              >
                Email
              </label>
              <input
                id="iris-login-email"
                type="email"
                data-iris-login-template-email=""
                placeholder="you@example.com"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                required
                disabled={local.loading || undefined}
                style={inputStyle}
              />
            </div>
            <div>
              <label
                for="iris-login-password"
                style={{
                  display: 'block',
                  'font-size': 'var(--iris-font-size-sm, 13px)',
                  'font-weight': '500',
                  'margin-bottom': '4px',
                }}
              >
                Password
              </label>
              <input
                id="iris-login-password"
                type="password"
                data-iris-login-template-password=""
                placeholder="••••••••"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                disabled={local.loading || undefined}
                style={inputStyle}
              />
            </div>
            <Show when={local.showRemember}>
              <label
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '8px',
                  'font-size': 'var(--iris-font-size-md, 14px)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  data-iris-login-template-remember=""
                  checked={remember()}
                  onChange={(e) => setRemember(e.currentTarget.checked)}
                  disabled={local.loading || undefined}
                />
                Remember me
              </label>
            </Show>
            <button
              type="submit"
              data-iris-login-template-submit=""
              disabled={local.loading || undefined}
              style={{
                width: '100%',
                padding: 'var(--iris-space-sm, 12px) var(--iris-space-md, 16px)',
                background: 'var(--iris-primary)',
                color: 'var(--iris-primary-foreground, #fff)',
                border: 'none',
                'border-radius': 'var(--iris-radius-md, 6px)',
                'font-size': 'var(--iris-font-size-md, 14px)',
                'font-weight': '500',
                'font-family': 'inherit',
                cursor: local.loading ? 'not-allowed' : 'pointer',
                opacity: local.loading ? '0.7' : '1',
              }}
            >
              {local.loading ? 'Signing in…' : local.submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
