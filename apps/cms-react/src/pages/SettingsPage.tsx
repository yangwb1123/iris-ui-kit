import { useState, type FormEvent } from 'react'
import {
  IrisFormField,
  IrisInput,
  IrisSegmented,
  IrisSwitch,
  IrisButton,
  IrisFieldset,
  IrisStack,
} from '@iris-ui-kit/react'
import { readCmsSettings, saveCmsSettings, type CmsSettings } from '@iris-ui-kit/cms-shared'

const environmentOptions = [
  { label: 'Live', value: 'live' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Read-only preview', value: 'preview', disabled: true },
]

export function SettingsPage() {
  const initial = readCmsSettings()
  const [siteName, setSiteName] = useState(initial.siteName)
  const [supportEmail, setSupportEmail] = useState(initial.supportEmail)
  const [notifications, setNotifications] = useState(initial.notifications)
  const [maintenance, setMaintenance] = useState(initial.maintenance)
  const [status, setStatus] = useState('')
  const [settingsLocked, setSettingsLocked] = useState(false)
  const selectedEnvironment = maintenance ? 'maintenance' : 'live'

  const selectEnvironment = (value: string) => {
    if (value === 'live') setMaintenance(false)
    if (value === 'maintenance') setMaintenance(true)
  }

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!siteName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
      setStatus('Enter a site name and a valid support email.')
      return
    }
    const saved = saveCmsSettings({
      siteName: siteName.trim(),
      supportEmail: supportEmail.trim(),
      notifications,
      maintenance: selectedEnvironment === 'maintenance',
    } satisfies CmsSettings)
    setStatus(saved ? 'Settings saved.' : 'Settings could not be saved in this browser.')
  }

  return (
    <section>
      <h1 className="page-title">Settings</h1>
      <p className="page-desc">
        A small form from Iris form primitives. Edit a field, switch tabs and return — your input is
        preserved by the keep-alive content cache.
      </p>
      <form style={{ maxWidth: 480 }} onSubmit={save}>
        <div style={{ marginBlockEnd: 'var(--iris-space-md, 16px)' }}>
          <IrisButton
            type="button"
            variant="outline"
            onClick={() => setSettingsLocked((locked) => !locked)}
          >
            {settingsLocked ? 'Unlock settings' : 'Lock settings'}
          </IrisButton>
        </div>
        <IrisFieldset
          legend="Site settings"
          hint="These settings apply to the entire site."
          disabled={settingsLocked}
        >
          <IrisStack spacing={16}>
            <IrisFormField label="Site name">
              <IrisInput required value={siteName} onChange={(e) => setSiteName(e.target.value)} />
            </IrisFormField>
            <IrisFormField label="Support email">
              <IrisInput
                required
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
              />
            </IrisFormField>
            <IrisFormField label="Email notifications">
              <IrisSwitch checked={notifications} onChange={(next) => setNotifications(next)} />
            </IrisFormField>
            <IrisFormField label="Maintenance mode">
              <IrisSegmented
                options={environmentOptions}
                value={selectedEnvironment}
                onValueChange={selectEnvironment}
                ariaLabel="Environment"
              />
            </IrisFormField>
            <div>
              <IrisButton type="submit" variant="solid">
                Save changes
              </IrisButton>
            </div>
            <span role="status" aria-live="polite">
              {status}
            </span>
          </IrisStack>
        </IrisFieldset>
      </form>
    </section>
  )
}
