<script lang="ts">
  import {
    IrisFormField,
    IrisInput,
    IrisSegmented,
    IrisSwitch,
    IrisButton,
    IrisStack,
  } from '@iris-ui-kit/svelte'
  import { readCmsSettings, saveCmsSettings, type CmsSettings } from '@iris-ui-kit/cms-shared'

  const environmentOptions = [
    { label: 'Live', value: 'live' },
    { label: 'Maintenance', value: 'maintenance' },
    { label: 'Read-only preview', value: 'preview', disabled: true },
  ]

  const initial = readCmsSettings()
  let siteName = $state(initial.siteName)
  let supportEmail = $state(initial.supportEmail)
  let notifications = $state(initial.notifications)
  let maintenance = $state(initial.maintenance)
  let status = $state('')
  const selectedEnvironment = $derived(maintenance ? 'maintenance' : 'live')

  function selectEnvironment(value: string) {
    if (value === 'live') maintenance = false
    if (value === 'maintenance') maintenance = true
  }

  function save(event: SubmitEvent) {
    event.preventDefault()
    if (!siteName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
      status = 'Enter a site name and a valid support email.'
      return
    }
    const saved = saveCmsSettings({
      siteName: siteName.trim(),
      supportEmail: supportEmail.trim(),
      notifications,
      maintenance: selectedEnvironment === 'maintenance',
    } satisfies CmsSettings)
    status = saved ? 'Settings saved.' : 'Settings could not be saved in this browser.'
  }
</script>

<section>
  <h1 class="page-title">Settings</h1>
  <p class="page-desc">
    A small form from Iris form primitives. Edit a field, switch tabs and return — your input is
    preserved by the keep-alive content cache.
  </p>
  <form style="max-width: 480px" onsubmit={save}>
    <IrisStack spacing={16}>
      <IrisFormField label="Site name">
        <IrisInput required value={siteName} oninput={(e) => (siteName = e.currentTarget.value)} />
      </IrisFormField>
      <IrisFormField label="Support email">
        <IrisInput
          required
          type="email"
          value={supportEmail}
          oninput={(e) => (supportEmail = e.currentTarget.value)}
        />
      </IrisFormField>
      <IrisFormField label="Email notifications">
        <IrisSwitch checked={notifications} onChange={(next) => (notifications = next)} />
      </IrisFormField>
      <IrisFormField label="Maintenance mode">
        <IrisSegmented
          options={environmentOptions}
          value={selectedEnvironment}
          onchange={selectEnvironment}
          ariaLabel="Environment"
        />
      </IrisFormField>
      <div>
        <IrisButton type="submit" variant="solid">Save changes</IrisButton>
      </div>
      <span role="status" aria-live="polite">{status}</span>
    </IrisStack>
  </form>
</section>
