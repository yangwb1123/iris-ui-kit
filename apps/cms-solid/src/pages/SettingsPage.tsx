import { createSignal, type JSX } from 'solid-js'
import { IrisFormField, IrisInput, IrisSwitch, IrisButton, IrisStack } from '@iris-ui-kit/solid'
import { readCmsSettings, saveCmsSettings, type CmsSettings } from '@iris-ui-kit/cms-shared'

export function SettingsPage(): JSX.Element {
  const initial = readCmsSettings()
  const [siteName, setSiteName] = createSignal(initial.siteName)
  const [supportEmail, setSupportEmail] = createSignal(initial.supportEmail)
  const [notifications, setNotifications] = createSignal(initial.notifications)
  const [maintenance, setMaintenance] = createSignal(initial.maintenance)
  const [status, setStatus] = createSignal('')

  const save: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (event) => {
    event.preventDefault()
    if (!siteName().trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail())) {
      setStatus('Enter a site name and a valid support email.')
      return
    }
    const saved = saveCmsSettings({
      siteName: siteName().trim(),
      supportEmail: supportEmail().trim(),
      notifications: notifications(),
      maintenance: maintenance(),
    } satisfies CmsSettings)
    setStatus(saved ? 'Settings saved.' : 'Settings could not be saved in this browser.')
  }

  return (
    <section>
      <h1 class="page-title">Settings</h1>
      <p class="page-desc">
        A small form from Iris form primitives. Edit a field, switch tabs and return — your input is
        preserved by the keep-alive content cache.
      </p>
      <form style={{ 'max-width': '480px' }} onSubmit={save}>
        <IrisStack spacing={16}>
          <IrisFormField label="Site name">
            <IrisInput
              required
              value={siteName()}
              onInput={(e) => setSiteName(e.currentTarget.value)}
            />
          </IrisFormField>
          <IrisFormField label="Support email">
            <IrisInput
              required
              type="email"
              value={supportEmail()}
              onInput={(e) => setSupportEmail(e.currentTarget.value)}
            />
          </IrisFormField>
          <IrisFormField label="Email notifications">
            <IrisSwitch checked={notifications()} onChange={(next) => setNotifications(next)} />
          </IrisFormField>
          <IrisFormField label="Maintenance mode">
            <IrisSwitch checked={maintenance()} onChange={(next) => setMaintenance(next)} />
          </IrisFormField>
          <div>
            <IrisButton type="submit" variant="solid">
              Save changes
            </IrisButton>
          </div>
          <span role="status" aria-live="polite">
            {status()}
          </span>
        </IrisStack>
      </form>
    </section>
  )
}
