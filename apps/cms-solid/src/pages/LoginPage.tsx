import { createSignal, type JSX } from 'solid-js'
import {
  IrisButton,
  IrisFormField,
  IrisIcon,
  IrisInput,
  IrisPasswordInput,
  IrisSelect,
  type IrisSelectItem,
} from '@iris-ui/solid'
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
export function LoginPage(): JSX.Element {
  const { login } = useAuth()
  const [username, setUsername] = createSignal('ada')
  const [password, setPassword] = createSignal('secret')
  const [role, setRole] = createSignal<Role>('admin')
  const [error, setError] = createSignal<string | undefined>(undefined)

  const submit = (e: Event) => {
    e.preventDefault()
    const session = login(username(), password(), role())
    if (!session) setError('Enter any non-empty username and password.')
    else setError(undefined)
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
            <IrisFormField label="Username" error={error()}>
              <IrisInput
                value={username()}
                onInput={(e) => setUsername((e.currentTarget as HTMLInputElement).value)}
                placeholder="any non-empty value"
                aria-label="Username"
                autofocus
              />
            </IrisFormField>
            <IrisFormField label="Password">
              <IrisPasswordInput
                value={password()}
                onChange={(v: string) => setPassword(v)}
                placeholder="any non-empty value"
                aria-label="Password"
              />
            </IrisFormField>
            <IrisFormField label="Sign in as" hint="Drives RBAC: viewers see fewer menu items.">
              <IrisSelect<Role>
                items={roleItems}
                value={role()}
                onChange={(v: Role) => setRole(v)}
                style={{ width: '100%' }}
              />
            </IrisFormField>
            <IrisButton type="submit" variant="solid" style={{ width: '100%' }}>
              Sign in
            </IrisButton>
          </div>
        </div>
      </form>
    </div>
  )
}
