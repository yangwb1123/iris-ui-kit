import { IrisButton, IrisBadge } from '@iris-ui/react'
import { CATALOG, INSTALLABLE_APPS, type AppManifest } from '../catalog'
import { useProfile, useProfileState, useLaunchApp } from '../shell'

const KIND_LABEL: Record<AppManifest['kind'], string> = {
  component: 'Built-in',
  link: 'Link',
  iframe: 'Embed',
}

const KIND_TONE: Record<AppManifest['kind'], 'primary' | 'success' | 'warning'> = {
  component: 'primary',
  link: 'success',
  iframe: 'warning',
}

function KindBadge({ kind }: { kind: AppManifest['kind'] }) {
  return (
    <IrisBadge tone={KIND_TONE[kind]} variant="subtle" size="sm">
      {KIND_LABEL[kind]}
    </IrisBadge>
  )
}

function AppCard({ app }: { app: AppManifest }) {
  const profile = useProfile()
  // Subscribe so install/uninstall re-renders the button state.
  useProfileState()
  const launch = useLaunchApp()
  const installed = app.builtin || profile.isInstalled(app.id)

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
        </div>
        {app.description && (
          <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>{app.description}</p>
        )}
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
              <IrisButton variant="outline" onClick={() => profile.uninstall(app.id)}>
                Uninstall
              </IrisButton>
            </>
          ) : (
            <IrisButton variant="solid" onClick={() => profile.install(app.id)}>
              Install
            </IrisButton>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, apps }: { title: string; apps: AppManifest[] }) {
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
          <AppCard key={app.id} app={app} />
        ))}
      </div>
    </section>
  )
}

/**
 * App Store — browse the catalog and install link / iframe apps into the user
 * profile. Built-in component apps are shown for reference but can't be removed.
 */
export function AppStoreView() {
  const links = INSTALLABLE_APPS.filter((a) => a.kind === 'link')
  const iframes = INSTALLABLE_APPS.filter((a) => a.kind === 'iframe')
  const builtins = CATALOG.filter((a) => a.builtin)

  return (
    <div style={{ padding: 18, display: 'grid', gap: 20 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <h2 style={{ margin: 0 }}>App Store</h2>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
          Install apps into your profile (persisted to this device). Link &amp; iframe apps
          aggregate external services — note that most major sites block iframe embedding for
          security, so those open in a new tab instead. Choose an embed below to see it run in a
          window.
        </p>
      </header>
      <Section title="Embedded apps" apps={iframes} />
      <Section title="Web links" apps={links} />
      <Section title="Built-in" apps={builtins} />
    </div>
  )
}
