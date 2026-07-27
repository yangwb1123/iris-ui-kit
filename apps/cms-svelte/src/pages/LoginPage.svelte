<script lang="ts">
  import { CMS_DEMO_ACCOUNTS } from '@iris-ui-kit/cms-shared'
  import { IrisButton, IrisFormField, IrisInput, IrisIcon, IrisStack } from '@iris-ui-kit/svelte'
  import { useAuth } from '../auth'

  const { login, state: authState } = useAuth()
  // Roles are assigned by auth: ada/secret is admin; viewer/secret is read-only.
  let username = $state<string>(CMS_DEMO_ACCOUNTS.admin.username)
  let password = $state<string>(CMS_DEMO_ACCOUNTS.admin.password)

  async function submit(e: Event) {
    e.preventDefault()
    await login(username, password)
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
        <IrisFormField label="Username" error={$authState.error ?? undefined}>
          <IrisInput
            value={username}
            oninput={(e) => (username = e.currentTarget.value)}
            placeholder="ada or viewer"
            aria-label="Username"
            disabled={$authState.loading}
          />
        </IrisFormField>
        <IrisFormField label="Password">
          <IrisInput
            type="password"
            value={password}
            oninput={(e) => (password = e.currentTarget.value)}
            placeholder="secret"
            aria-label="Password"
            disabled={$authState.loading}
          />
        </IrisFormField>
        <IrisButton type="submit" variant="solid" style="width: 100%" disabled={$authState.loading}>
          {$authState.loading ? 'Signing in…' : 'Sign in'}
        </IrisButton>
      </IrisStack>
    </div>
  </form>
</div>
