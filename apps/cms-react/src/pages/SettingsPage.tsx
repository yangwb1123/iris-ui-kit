import { useState } from 'react'
import { IrisFormField, IrisInput, IrisSwitch, IrisButton, IrisStack } from '@iris-ui-kit/react'

export function SettingsPage() {
  // Local form state — survives tab switches because inactive tabs stay mounted.
  const [siteName, setSiteName] = useState('Iris CMS')
  const [supportEmail, setSupportEmail] = useState('support@iris.dev')
  const [notifications, setNotifications] = useState(true)
  const [maintenance, setMaintenance] = useState(false)

  return (
    <section>
      <h1 className="page-title">Settings</h1>
      <p className="page-desc">
        A small form from Iris form primitives. Edit a field, switch tabs and return — your input is
        preserved by the keep-alive content cache.
      </p>
      <div style={{ maxWidth: 480 }}>
        <IrisStack spacing={16}>
          <IrisFormField label="Site name">
            <IrisInput value={siteName} onChange={(e) => setSiteName(e.target.value)} />
          </IrisFormField>
          <IrisFormField label="Support email">
            <IrisInput
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
            <IrisButton variant="solid">Save changes</IrisButton>
          </div>
        </IrisStack>
      </div>
    </section>
  )
}
