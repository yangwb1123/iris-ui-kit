import * as React from 'react'
import { IrisButton, IrisBadge, IrisInput } from '@iris-ui-kit/react'
import { CATALOG, INSTALLABLE_APPS, type AppManifest } from '../catalog'
import { useProfile, useProfileState, useLaunchApp, useNotifications } from '../shell'
import { PERMISSION_META, useCustomApps } from '../permissions'

const KIND_LABEL: Record<AppManifest['kind'], string> = {
  component: 'Built-in',
  link: 'Link',
  iframe: 'Embed',
  remote: 'Remote',
}

const KIND_TONE: Record<AppManifest['kind'], 'primary' | 'success' | 'warning'> = {
  component: 'primary',
  link: 'success',
  iframe: 'warning',
  remote: 'warning',
}

function KindBadge({ kind }: { kind: AppManifest['kind'] }) {
  return (
    <IrisBadge tone={KIND_TONE[kind]} variant="subtle" size="sm">
      {KIND_LABEL[kind]}
    </IrisBadge>
  )
}

/** The capabilities an app requests, as small badges with hover tooltips. */
function PermissionBadges({ app }: { app: AppManifest }) {
  const perms = app.permissions ?? []
  if (perms.length === 0) return null
  return (
    <div
      style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}
      aria-label="Requested permissions"
    >
      {perms.map((perm) => {
        const meta = PERMISSION_META[perm]
        return (
          <span key={perm} title={`${meta.label} — ${meta.description}`} style={{ cursor: 'help' }}>
            <IrisBadge tone="neutral" variant="outline" size="sm">
              {meta.icon} {meta.label}
            </IrisBadge>
          </span>
        )
      })}
    </div>
  )
}

function AppCard({ app, onRemove }: { app: AppManifest; onRemove?: (id: string) => void }) {
  const profile = useProfile()
  // Subscribe so install/uninstall re-renders the button state.
  useProfileState()
  const launch = useLaunchApp()
  const nc = useNotifications()
  const installed = app.builtin || profile.isInstalled(app.id)

  const install = () => {
    profile.install(app.id)
    nc.post({
      title: `Installed ${app.name}`,
      body: 'Added to your desktop.',
      icon: app.icon,
      tone: 'success',
      appId: 'appstore',
    })
  }
  const uninstall = () => {
    profile.uninstall(app.id)
    nc.post({ title: `Uninstalled ${app.name}`, icon: app.icon, tone: 'info', appId: 'appstore' })
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr',
        gap: 12,
        padding: 14,
        borderRadius: 10,
        border: '1px solid rgba(127,127,127,0.25)',
        background: 'color-mix(in srgb, var(--os-window-fg) 4%, transparent)',
      }}
    >
      <div style={{ fontSize: 30, lineHeight: 1, textAlign: 'center' }}>{app.icon}</div>
      <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14 }}>{app.name}</strong>
          <KindBadge kind={app.kind} />
          {app.custom && (
            <IrisBadge tone="primary" variant="subtle" size="sm">
              Yours
            </IrisBadge>
          )}
        </div>
        {app.description && (
          <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>{app.description}</p>
        )}
        <PermissionBadges app={app} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
          {app.builtin ? (
            <IrisBadge tone="neutral" variant="subtle" size="sm">
              Built-in
            </IrisBadge>
          ) : installed ? (
            <>
              <IrisButton variant="solid" onClick={() => launch(app.id)}>
                Open
              </IrisButton>
              {onRemove ? (
                <IrisButton variant="outline" onClick={() => onRemove(app.id)}>
                  Remove
                </IrisButton>
              ) : (
                <IrisButton variant="outline" onClick={uninstall}>
                  Uninstall
                </IrisButton>
              )}
            </>
          ) : (
            <IrisButton variant="solid" onClick={install}>
              Install
            </IrisButton>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  apps,
  onRemove,
}: {
  title: string
  apps: AppManifest[]
  onRemove?: (id: string) => void
}) {
  if (apps.length === 0) return null
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <h3
        style={{
          margin: 0,
          fontSize: 13,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          opacity: 0.6,
        }}
      >
        {title}
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {apps.map((app) => (
          <AppCard key={app.id} app={app} onRemove={onRemove} />
        ))}
      </div>
    </section>
  )
}

/** "Add a web app" form: aggregate ANY external service by URL into the desktop. */
function AddWebAppForm() {
  const { add } = useCustomApps()
  const profile = useProfile()
  const [name, setName] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [kind, setKind] = React.useState<'link' | 'iframe'>('iframe')
  const [icon, setIcon] = React.useState('')

  const canAdd = url.trim().length > 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canAdd) return
    const manifest = add({ name, url, kind, icon })
    // Install so it shows up across launchers immediately (custom apps are removable).
    profile.install(manifest.id)
    setName('')
    setUrl('')
    setIcon('')
  }

  const fieldLabel: React.CSSProperties = { fontSize: 12, opacity: 0.7, display: 'grid', gap: 4 }

  return (
    <section
      style={{
        display: 'grid',
        gap: 12,
        padding: 14,
        borderRadius: 10,
        border: '1px dashed rgba(127,127,127,0.4)',
        background: 'color-mix(in srgb, var(--os-accent) 6%, transparent)',
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <strong style={{ fontSize: 14 }}>Add a web app</strong>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
          Aggregate any service by URL. It appears across the desktop (Start menu, Dock, Spotlight)
          and requests the Network permission.
        </p>
      </div>
      <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
          }}
        >
          <label style={fieldLabel}>
            Name
            <IrisInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Service"
            />
          </label>
          <label style={fieldLabel}>
            URL
            <IrisInput
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </label>
          <label style={fieldLabel}>
            Icon (emoji)
            <IrisInput
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🔗"
              maxLength={4}
            />
          </label>
          <label style={fieldLabel}>
            How it opens
            <div style={{ display: 'flex', gap: 6 }}>
              {(['iframe', 'link'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 12,
                    color: 'inherit',
                    border:
                      kind === k ? '2px solid var(--os-accent)' : '1px solid rgba(127,127,127,0.3)',
                    background:
                      kind === k
                        ? 'color-mix(in srgb, var(--os-accent) 14%, transparent)'
                        : 'transparent',
                  }}
                >
                  {k === 'iframe' ? '🪟 Embed' : '🔗 New tab'}
                </button>
              ))}
            </div>
          </label>
        </div>
        <div>
          <IrisButton type="submit" variant="solid" disabled={!canAdd}>
            Add to desktop
          </IrisButton>
        </div>
      </form>
    </section>
  )
}

/**
 * App Store — browse the catalog and install link / iframe apps into the user
 * profile. Each app shows the permissions it requests (badges with tooltips).
 * Add ANY external service via "Add a web app"; manage them under "My apps".
 * Built-in component apps are shown for reference but can't be removed.
 */
export function AppStoreView() {
  const { list: customApps, remove } = useCustomApps()
  const links = INSTALLABLE_APPS.filter((a) => a.kind === 'link')
  const iframes = INSTALLABLE_APPS.filter((a) => a.kind === 'iframe')
  const builtins = CATALOG.filter((a) => a.builtin)

  return (
    <div style={{ padding: 18, display: 'grid', gap: 20 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <h2 style={{ margin: 0 }}>App Store</h2>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
          Install apps into your profile (persisted to this device). Each app declares the{' '}
          <strong>permissions</strong> it requests — review them, then grant or revoke per app in{' '}
          <em>Settings → Privacy &amp; permissions</em>. Link &amp; iframe apps aggregate external
          services — note that most major sites block iframe embedding for security, so those open
          in a new tab instead.
        </p>
      </header>
      <AddWebAppForm />
      <Section title="My apps" apps={customApps} onRemove={remove} />
      <Section title="Embedded apps" apps={iframes} />
      <Section title="Web links" apps={links} />
      <Section title="Built-in" apps={builtins} />
    </div>
  )
}
