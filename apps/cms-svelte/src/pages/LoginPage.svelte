<script lang="ts">
  import {
    IrisButton,
    IrisFormField,
    IrisInput,
    IrisSelect,
    IrisIcon,
    IrisStack,
  } from '@iris-ui/svelte'
  import type { IrisSelectItem } from '@iris-ui/svelte'
  import { useAuth, type Role } from '../auth'

  const roleItems: IrisSelectItem<Role>[] = [
    { value: 'admin', label: 'Administrator (full access)' },
    { value: 'viewer', label: 'Viewer (read-only, fewer menus)' },
  ]

  const { login } = useAuth()

  let username = $state('ada')
  let password = $state('secret')
  let role = $state<Role>('admin')
  let error = $state<string | undefined>(undefined)

  function submit(e: Event) {
    e.preventDefault()
    const session = login(username, password, role)
    if (!session) error = 'Enter any non-empty username and password.'
    else error = undefined
  }
</script>

<div
  style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--iris-background); color: var(--iris-foreground); padding: 24px"
>
  <form
    onsubmit={submit}
    style="width: min(400px, 100%); background: var(--iris-surface); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-lg, 10px); padding: 28px; box-shadow: 0 20px 50px -24px rgba(0,0,0,0.35)"
  >
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px">
      <span
        style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--iris-radius-md, 6px); background: var(--iris-primary); color: var(--iris-primary-foreground, #fff)"
      >
        <IrisIcon name="menu" size={20} />
      </span>
      <div>
        <h1 style="margin: 0; font-size: 20px; font-weight: 700">Iris CMS</h1>
        <div style="color: var(--iris-muted); font-size: 13px">Sign in to continue</div>
      </div>
    </div>

    <div style="margin-top: 20px">
      <IrisStack spacing={16}>
        <IrisFormField label="Username" {error}>
          <IrisInput
            value={username}
            oninput={(e) => (username = e.currentTarget.value)}
            placeholder="any non-empty value"
            aria-label="Username"
          />
        </IrisFormField>
        <IrisFormField label="Password">
          <IrisInput
            type="password"
            value={password}
            oninput={(e) => (password = e.currentTarget.value)}
            placeholder="any non-empty value"
            aria-label="Password"
          />
        </IrisFormField>
        <IrisFormField label="Sign in as" hint="Drives RBAC: viewers see fewer menu items.">
          <IrisSelect
            items={roleItems}
            value={role}
            onValueChange={(v) => (role = v as Role)}
            style="width: 100%"
          />
        </IrisFormField>
        <IrisButton type="submit" variant="solid" style="width: 100%">Sign in</IrisButton>
      </IrisStack>
    </div>
  </form>
</div>
