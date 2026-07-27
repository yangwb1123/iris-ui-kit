import { useState } from 'react'
import {
  IrisButton,
  IrisFormField,
  IrisIcon,
  IrisInput,
  IrisPasswordInput,
  IrisSelect,
  IrisStack,
  type IrisSelectItem,
} from '@iris-ui-kit/react'
import { useAuth, type Role } from '../auth'

const roleItems: IrisSelectItem<Role>[] = [
  { value: 'admin', label: 'Administrator (full access)' },
  { value: 'viewer', label: 'Viewer (read-only, fewer menus)' },
]

/**
 * Mock login. Any non-empty username + password signs you in; the chosen role
 * (admin vs viewer) is what later drives the RBAC nav filtering — sign in as a
 * viewer to see the Admin/Settings section disappear from the sidebar.
 */
export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('ada')
  const [password, setPassword] = useState('secret')
  const [role, setRole] = useState<Role>('admin')
  const [error, setError] = useState<string | undefined>(undefined)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const session = login(username, password, role)
    if (!session) setError('Enter any non-empty username and password.')
    else setError(undefined)
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
            <IrisFormField label="Username" error={error}>
              <IrisInput
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="any non-empty value"
                aria-label="Username"
                autoFocus
              />
            </IrisFormField>
            <IrisFormField label="Password">
              <IrisPasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="any non-empty value"
                aria-label="Password"
              />
            </IrisFormField>
            <IrisFormField label="Sign in as" hint="Drives RBAC: viewers see fewer menu items.">
              <IrisSelect<Role>
                items={roleItems}
                value={role}
                onValueChange={setRole}
                style={{ width: '100%' }}
              />
            </IrisFormField>
            <IrisButton type="submit" variant="solid" style={{ width: '100%' }}>
              Sign in
            </IrisButton>
          </IrisStack>
        </div>
      </form>
    </div>
  )
}
