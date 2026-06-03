import { createSignal, type JSX } from 'solid-js'
import { IrisFormField, IrisInput, IrisSwitch, IrisButton, IrisStack } from '@iris-ui/solid'

export function SettingsPage(): JSX.Element {
  // Local form state — survives tab switches because inactive tabs stay mounted.
  const [siteName, setSiteName] = createSignal('Iris CMS')
  const [supportEmail, setSupportEmail] = createSignal('support@iris.dev')
  const [notifications, setNotifications] = createSignal(true)
  const [maintenance, setMaintenance] = createSignal(false)

  return (
    <section>
      <h1 class="page-title">Settings</h1>
      <p class="page-desc">
        A small form from Iris form primitives. Edit a field, switch tabs and return — your input is
        preserved by the keep-alive content cache.
      </p>
      <div style={{ 'max-width': '480px' }}>
        <IrisStack spacing={16}>
          <IrisFormField label="Site name">
            <IrisInput value={siteName()} onInput={(e) => setSiteName(e.currentTarget.value)} />
          </IrisFormField>
          <IrisFormField label="Support email">
            <IrisInput
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
            <IrisButton variant="solid">Save changes</IrisButton>
          </div>
        </IrisStack>
      </div>
    </section>
  )
}
