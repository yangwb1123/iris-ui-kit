import { For, Show, createSignal, type JSX } from 'solid-js'
import { IrisButton, IrisBadge, IrisInput } from '@iris-ui/solid'
import { CATALOG, INSTALLABLE_APPS, type AppManifest } from './catalog'
import { useProfile, useProfileState, useLaunchApp, useCustomApps } from './profile'

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

function KindBadge(props: { kind: AppManifest['kind'] }): JSX.Element {
  return (
    <IrisBadge tone={KIND_TONE[props.kind]} variant="subtle" size="sm">
      {KIND_LABEL[props.kind]}
    </IrisBadge>
  )
}

function AppCard(props: { app: AppManifest; onRemove?: (id: string) => void }): JSX.Element {
  const profile = useProfile()
  // Subscribe so install/uninstall re-renders the button state.
  const state = useProfileState()
  const launch = useLaunchApp()
  const installed = (): boolean =>
    Boolean(props.app.builtin) || state().installed.some((a) => a.appId === props.app.id)

  return (
    <div
      style={{
        display: 'grid',
        'grid-template-columns': '40px 1fr',
        gap: '12px',
        padding: '14px',
        'border-radius': '10px',
        border: '1px solid rgba(127,127,127,0.25)',
        background: 'color-mix(in srgb, var(--os-window-fg) 4%, transparent)',
      }}
    >
      <div style={{ 'font-size': '30px', 'line-height': 1, 'text-align': 'center' }}>
        {props.app.icon}
      </div>
      <div style={{ display: 'grid', gap: '6px', 'min-width': 0 }}>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'flex-wrap': 'wrap' }}>
          <strong style={{ 'font-size': '14px' }}>{props.app.name}</strong>
          <KindBadge kind={props.app.kind} />
          <Show when={props.app.custom}>
            <IrisBadge tone="primary" variant="subtle" size="sm">
              Yours
            </IrisBadge>
          </Show>
        </div>
        <Show when={props.app.description}>
          <p style={{ margin: 0, 'font-size': '12px', opacity: 0.7 }}>{props.app.description}</p>
        </Show>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            'flex-wrap': 'wrap',
            'margin-top': '2px',
            'align-items': 'center',
          }}
        >
          <Show
            when={!props.app.builtin}
            fallback={
              <IrisBadge tone="neutral" variant="subtle" size="sm">
                Built-in
              </IrisBadge>
            }
          >
            <Show
              when={installed()}
              fallback={
                <IrisButton variant="solid" onClick={() => profile.install(props.app.id)}>
                  Install
                </IrisButton>
              }
            >
              <IrisButton variant="solid" onClick={() => launch(props.app.id)}>
                Open
              </IrisButton>
              <Show
                when={props.onRemove}
                fallback={
                  <IrisButton variant="outline" onClick={() => profile.uninstall(props.app.id)}>
                    Uninstall
                  </IrisButton>
                }
              >
                {(onRemove) => (
                  <IrisButton variant="outline" onClick={() => onRemove()(props.app.id)}>
                    Remove
                  </IrisButton>
                )}
              </Show>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  )
}

function Section(props: {
  title: string
  apps: AppManifest[]
  onRemove?: (id: string) => void
}): JSX.Element {
  return (
    <Show when={props.apps.length > 0}>
      <section style={{ display: 'grid', gap: '10px' }}>
        <h3
          style={{
            margin: 0,
            'font-size': '13px',
            'text-transform': 'uppercase',
            'letter-spacing': '0.5px',
            opacity: 0.6,
          }}
        >
          {props.title}
        </h3>
        <div
          style={{
            display: 'grid',
            'grid-template-columns': 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '12px',
          }}
        >
          <For each={props.apps}>{(app) => <AppCard app={app} onRemove={props.onRemove} />}</For>
        </div>
      </section>
    </Show>
  )
}

/** "Add a web app" form: aggregate ANY external service by URL into the desktop. */
function AddWebAppForm(): JSX.Element {
  const { add } = useCustomApps()
  const profile = useProfile()
  const [name, setName] = createSignal('')
  const [url, setUrl] = createSignal('')
  const [kind, setKind] = createSignal<'link' | 'iframe'>('iframe')
  const [icon, setIcon] = createSignal('')

  const canAdd = (): boolean => url().trim().length > 0

  const submit = (e: Event): void => {
    e.preventDefault()
    if (!canAdd()) return
    const manifest = add({ name: name(), url: url(), kind: kind(), icon: icon() })
    // Install so it shows up across launchers immediately (custom apps are removable).
    profile.install(manifest.id)
    setName('')
    setUrl('')
    setIcon('')
  }

  const fieldLabel = { 'font-size': '12px', opacity: 0.7, display: 'grid', gap: '4px' }

  return (
    <section
      style={{
        display: 'grid',
        gap: '12px',
        padding: '14px',
        'border-radius': '10px',
        border: '1px dashed rgba(127,127,127,0.4)',
        background: 'color-mix(in srgb, var(--os-accent) 6%, transparent)',
      }}
    >
      <div style={{ display: 'grid', gap: '4px' }}>
        <strong style={{ 'font-size': '14px' }}>Add a web app</strong>
        <p style={{ margin: 0, 'font-size': '12px', opacity: 0.7, 'line-height': 1.5 }}>
          Aggregate any service by URL. It appears across the desktop (Start menu, taskbar, command
          palette). Most major sites block iframe embedding, so those open in a new tab instead.
        </p>
      </div>
      <form onSubmit={submit} style={{ display: 'grid', gap: '10px' }}>
        <div
          style={{
            display: 'grid',
            'grid-template-columns': 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '10px',
          }}
        >
          <label style={fieldLabel}>
            Name
            <IrisInput
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="My Service"
            />
          </label>
          <label style={fieldLabel}>
            URL
            <IrisInput
              value={url()}
              onInput={(e) => setUrl(e.currentTarget.value)}
              placeholder="https://example.com"
            />
          </label>
          <label style={fieldLabel}>
            Icon (emoji)
            <IrisInput
              value={icon()}
              onInput={(e) => setIcon(e.currentTarget.value)}
              placeholder="🔗"
              maxlength={4}
            />
          </label>
          <label style={fieldLabel}>
            How it opens
            <div style={{ display: 'flex', gap: '6px' }}>
              <For each={['iframe', 'link'] as const}>
                {(k) => (
                  <button
                    type="button"
                    onClick={() => setKind(k)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      'border-radius': '8px',
                      cursor: 'pointer',
                      'font-size': '12px',
                      color: 'inherit',
                      border:
                        kind() === k
                          ? '2px solid var(--os-accent)'
                          : '1px solid rgba(127,127,127,0.3)',
                      background:
                        kind() === k
                          ? 'color-mix(in srgb, var(--os-accent) 14%, transparent)'
                          : 'transparent',
                    }}
                  >
                    {k === 'iframe' ? '🪟 Embed' : '🔗 New tab'}
                  </button>
                )}
              </For>
            </div>
          </label>
        </div>
        <div>
          <IrisButton type="submit" variant="solid" disabled={!canAdd()}>
            Add to desktop
          </IrisButton>
        </div>
      </form>
    </section>
  )
}

/**
 * App Store — browse the catalog and install link / iframe apps into the user
 * profile (persisted via `@iris-ui/core/profile`). Add ANY external service via
 * "Add a web app"; manage them under "My apps". Built-in component apps are
 * shown for reference but can't be removed.
 */
export function AppStoreApp(): JSX.Element {
  const { list: customApps, remove } = useCustomApps()
  const links = INSTALLABLE_APPS.filter((a) => a.kind === 'link')
  const iframes = INSTALLABLE_APPS.filter((a) => a.kind === 'iframe')
  const builtins = CATALOG.filter((a) => a.builtin)

  return (
    <div style={{ padding: '18px', display: 'grid', gap: '20px' }}>
      <header style={{ display: 'grid', gap: '6px' }}>
        <h2 style={{ margin: 0 }}>App Store</h2>
        <p style={{ margin: 0, 'font-size': '12px', opacity: 0.7, 'line-height': 1.5 }}>
          Install apps into your profile (persisted to this device via{' '}
          <code>@iris-ui/core/profile</code>). Link &amp; iframe apps aggregate external services.
        </p>
      </header>
      <AddWebAppForm />
      <Section title="My apps" apps={customApps()} onRemove={remove} />
      <Section title="Embedded apps" apps={iframes} />
      <Section title="Web links" apps={links} />
      <Section title="Built-in" apps={builtins} />
    </div>
  )
}
