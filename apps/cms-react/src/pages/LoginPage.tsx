import { useState } from 'react'
import {
  IrisButton,
  IrisFormField,
  IrisIcon,
  IrisInput,
  IrisPasswordInput,
  IrisStack,
} from '@iris-ui-kit/react'
import { CMS_DEMO_ACCOUNTS } from '@iris-ui-kit/cms-shared'
import { useAuth } from '../auth'

/**
 * Demo credentials are `ada` / `secret` (admin) and `viewer` / `secret`
 * (viewer). The authentication client owns role assignment.
 */
export function LoginPage() {
  const { login, loading, error } = useAuth()
  const [username, setUsername] = useState<string>(CMS_DEMO_ACCOUNTS.admin.username)
  const [password, setPassword] = useState<string>(CMS_DEMO_ACCOUNTS.admin.password)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await login(username, password)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        padding: 24,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: 'min(400px, 100%)',
          background: 'var(--iris-surface)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-lg, 10px)',
          padding: 28,
          boxShadow: '0 20px 50px -24px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 'var(--iris-radius-md, 6px)',
              background: 'var(--iris-primary)',
              color: 'var(--iris-primary-foreground, #fff)',
            }}
          >
            <IrisIcon name="menu" size={20} />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Iris CMS</h1>
            <div style={{ color: 'var(--iris-muted)', fontSize: 13 }}>Sign in to continue</div>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <IrisStack spacing={16}>
            <IrisFormField label="Username" error={error ?? undefined}>
              <IrisInput
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ada or viewer"
                aria-label="Username"
                autoFocus
                disabled={loading}
              />
            </IrisFormField>
            <IrisFormField label="Password">
              <IrisPasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="secret"
                aria-label="Password"
                disabled={loading}
              />
            </IrisFormField>
            <IrisButton type="submit" variant="solid" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </IrisButton>
          </IrisStack>
        </div>
      </form>
    </div>
  )
}
