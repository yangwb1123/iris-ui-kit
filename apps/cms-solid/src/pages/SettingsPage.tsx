import { createSignal, type JSX } from 'solid-js'
import {
  IrisFormField,
  IrisInput,
  IrisSegmented,
  IrisSwitch,
  IrisButton,
  IrisFieldset,
  IrisStack,
} from '@iris-ui-kit/solid'
import { readCmsSettings, saveCmsSettings, type CmsSettings } from '@iris-ui-kit/cms-shared'

const environmentOptions = [
  { label: 'Live', value: 'live' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Read-only preview', value: 'preview', disabled: true },
]

export function SettingsPage(): JSX.Element {
  const initial = readCmsSettings()
  const [siteName, setSiteName] = createSignal(initial.siteName)
  const [supportEmail, setSupportEmail] = createSignal(initial.supportEmail)
  const [notifications, setNotifications] = createSignal(initial.notifications)
  const [maintenance, setMaintenance] = createSignal(initial.maintenance)
  const [status, setStatus] = createSignal('')
  const [settingsLocked, setSettingsLocked] = createSignal(false)
  const selectedEnvironment = () => (maintenance() ? 'maintenance' : 'live')

  const selectEnvironment = (value: string): void => {
    if (value === 'live') setMaintenance(false)
    if (value === 'maintenance') setMaintenance(true)
  }

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
      maintenance: selectedEnvironment() === 'maintenance',
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
        <div style={{ 'margin-block-end': 'var(--iris-space-md, 16px)' }}>
          <IrisButton
            type="button"
            variant="outline"
            onClick={() => setSettingsLocked((locked) => !locked)}
          >
            {settingsLocked() ? 'Unlock settings' : 'Lock settings'}
          </IrisButton>
        </div>
        <IrisFieldset
          legend="Site settings"
          hint="These settings apply to the entire site."
          disabled={settingsLocked()}
        >
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
              <IrisSegmented
                options={environmentOptions}
                value={selectedEnvironment()}
                onChange={selectEnvironment}
                ariaLabel="Environment"
              />
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
        </IrisFieldset>
      </form>
    </section>
  )
}
