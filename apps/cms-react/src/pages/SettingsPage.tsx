import { useState, type FormEvent } from 'react'
import { IrisFormField, IrisInput, IrisSwitch, IrisButton, IrisStack } from '@iris-ui-kit/react'
import { readCmsSettings, saveCmsSettings, type CmsSettings } from '@iris-ui-kit/cms-shared'

export function SettingsPage() {
  const initial = readCmsSettings()
  const [siteName, setSiteName] = useState(initial.siteName)
  const [supportEmail, setSupportEmail] = useState(initial.supportEmail)
  const [notifications, setNotifications] = useState(initial.notifications)
  const [maintenance, setMaintenance] = useState(initial.maintenance)
  const [status, setStatus] = useState('')

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
      maintenance,
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
            <IrisSwitch checked={maintenance} onChange={(next) => setMaintenance(next)} />
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
      </form>
    </section>
  )
}
