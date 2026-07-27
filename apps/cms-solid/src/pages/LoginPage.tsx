import { createSignal, type JSX } from 'solid-js'
import {
  IrisButton,
  IrisFormField,
  IrisIcon,
  IrisInput,
  IrisPasswordInput,
} from '@iris-ui-kit/solid'
import { CMS_DEMO_ACCOUNTS } from '@iris-ui-kit/cms-shared'
import { useAuth } from '../auth'

/**
 * Demo credentials are `ada` / `secret` (admin) and `viewer` / `secret`
 * (viewer). The authentication client owns role assignment.
 */
export function LoginPage(): JSX.Element {
  const auth = useAuth()
  const [username, setUsername] = createSignal<string>(CMS_DEMO_ACCOUNTS.admin.username)
  const [password, setPassword] = createSignal<string>(CMS_DEMO_ACCOUNTS.admin.password)

  const submit = async (e: Event) => {
    e.preventDefault()
    await auth.login(username(), password())
  }

  return (
    <div
      style={{
        'min-height': '100vh',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        padding: '24px',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: 'min(400px, 100%)',
          background: 'var(--iris-surface)',
          border: '1px solid var(--iris-border)',
          'border-radius': 'var(--iris-radius-lg, 10px)',
          padding: '28px',
          'box-shadow': '0 20px 50px -24px rgba(0,0,0,0.35)',
        }}
      >
        <div
          style={{ display: 'flex', 'align-items': 'center', gap: '10px', 'margin-bottom': '6px' }}
        >
          <span
            style={{
              display: 'inline-flex',
              'align-items': 'center',
              'justify-content': 'center',
              width: '36px',
              height: '36px',
              'border-radius': 'var(--iris-radius-md, 6px)',
              background: 'var(--iris-primary)',
              color: 'var(--iris-primary-foreground, #fff)',
            }}
          >
            <IrisIcon name="menu" size={20} />
          </span>
          <div>
            <h1 style={{ margin: 0, 'font-size': '20px', 'font-weight': 700 }}>Iris CMS</h1>
            <div style={{ color: 'var(--iris-muted)', 'font-size': '13px' }}>
              Sign in to continue
            </div>
          </div>
        </div>

        <div style={{ 'margin-top': '20px' }}>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
            <IrisFormField label="Username" error={auth.error ?? undefined}>
              <IrisInput
                value={username()}
                onInput={(e) => setUsername((e.currentTarget as HTMLInputElement).value)}
                placeholder="ada or viewer"
                aria-label="Username"
                autofocus
                disabled={auth.loading}
              />
            </IrisFormField>
            <IrisFormField label="Password">
              <IrisPasswordInput
                value={password()}
                onChange={(v: string) => setPassword(v)}
                placeholder="secret"
                aria-label="Password"
                disabled={auth.loading}
              />
            </IrisFormField>
            <IrisButton
              type="submit"
              variant="solid"
              style={{ width: '100%' }}
              disabled={auth.loading}
            >
              {auth.loading ? 'Signing in…' : 'Sign in'}
            </IrisButton>
          </div>
        </div>
      </form>
    </div>
  )
}
