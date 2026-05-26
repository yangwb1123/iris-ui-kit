import * as React from 'react'
import { IrisStack } from '../layouts/Stack'
import { IrisContainer } from '../layouts/Container'
import { IrisInput } from '../primitives/input/Input'
import { IrisPasswordInput } from '../primitives/password-input/PasswordInput'
import { IrisCheckbox } from '../primitives/checkbox/Checkbox'
import { IrisButton } from '../primitives/button/Button'
import { IrisFormField } from '../primitives/form-field/FormField'
import { IrisAlert } from '../primitives/alert/Alert'
import { IrisDivider } from '../primitives/divider/Divider'

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
  /** Custom header replaces title/description block. */
  header?: React.ReactNode
  /** Slot for "Forgot password?" link (rendered next to Remember checkbox). */
  forgot?: React.ReactNode
  /** Content rendered below the form (separated by a divider). */
  footer?: React.ReactNode
  onSubmit?: (payload: IrisLoginSubmitPayload) => void
  style?: React.CSSProperties
  className?: string
}

/**
 * Layer 4 system skeleton: centered login page composed from Iris primitives.
 */
export function IrisLoginTemplate({
  title = 'Sign in',
  description = '',
  showRemember = true,
  error = '',
  submitLabel = 'Sign in',
  loading = false,
  header,
  forgot,
  footer,
  onSubmit,
  style,
  className,
}: IrisLoginTemplateProps): React.ReactElement {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [remember, setRemember] = React.useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.({ email, password, remember })
  }

  return (
    <div
      data-iris-login-template=""
      className={className}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        padding: 24,
        ...style,
      }}
    >
      <IrisContainer maxWidth="420px" padding={0}>
        <form
          onSubmit={handleSubmit}
          data-iris-login-form=""
          style={{
            background: 'var(--iris-surface)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-lg, 8px)',
            padding: 32,
            boxShadow: '0 6px 20px -8px rgba(0, 0, 0, 0.16)',
          }}
        >
          <IrisStack spacing="lg">
            {header ?? (
              <div style={{ textAlign: 'center' }}>
                <h1 style={{ margin: '0 0 4px 0', fontSize: 22, fontWeight: 700 }}>{title}</h1>
                {description ? (
                  <p
                    style={{
                      margin: 0,
                      color: 'var(--iris-muted)',
                      fontSize: 14,
                    }}
                  >
                    {description}
                  </p>
                ) : null}
              </div>
            )}
            {error ? <IrisAlert tone="danger" title={error} /> : null}
            <IrisFormField label="Email" required>
              <IrisInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                autoComplete="email"
              />
            </IrisFormField>
            <IrisFormField label="Password" required>
              <IrisPasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={loading}
                autoComplete="current-password"
              />
            </IrisFormField>
            {showRemember ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <IrisCheckbox
                  checked={remember}
                  onChange={(next) => setRemember(next)}
                  disabled={loading}
                >
                  Remember me
                </IrisCheckbox>
                {forgot ?? null}
              </div>
            ) : null}
            <IrisButton
              type="submit"
              variant="solid"
              loading={loading}
              style={{ width: '100%' }}
            >
              {submitLabel}
            </IrisButton>
            {footer ? (
              <div>
                <IrisDivider spacing="md" label="or" />
                {footer}
              </div>
            ) : null}
          </IrisStack>
        </form>
      </IrisContainer>
    </div>
  )
}
