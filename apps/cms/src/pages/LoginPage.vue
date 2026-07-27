<script setup lang="ts">
import { ref } from 'vue'
import { IrisButton, IrisFormField, IrisInput } from '@iris-ui-kit/vue'
import { CMS_DEMO_ACCOUNTS } from '@iris-ui-kit/cms-shared'
import { authState, login } from '../auth'

// Roles are assigned by auth: ada/secret is admin; viewer/secret is read-only.
const username = ref<string>(CMS_DEMO_ACCOUNTS.admin.username)
const password = ref<string>(CMS_DEMO_ACCOUNTS.admin.password)

async function handleLogin() {
  await login(username.value, password.value)
}
</script>

<template>
  <div
    style="
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: var(--iris-background);
      padding: 24px;
    "
  >
    <form
      @submit.prevent="handleLogin"
      style="
        display: flex;
        flex-direction: column;
        gap: 16px;
        width: 320px;
        padding: 32px;
        border: 1px solid var(--iris-border);
        border-radius: 12px;
        background: var(--iris-surface);
      "
    >
      <h1 style="margin: 0 0 8px; font-size: 20px; font-weight: 600">Sign in</h1>
      <IrisFormField label="Username" :error="authState.error ?? undefined">
        <IrisInput
          v-model="username"
          aria-label="Username"
          placeholder="ada or viewer"
          :disabled="authState.loading"
          autofocus
        />
      </IrisFormField>
      <IrisFormField label="Password">
        <IrisInput
          v-model="password"
          type="password"
          aria-label="Password"
          placeholder="secret"
          :disabled="authState.loading"
        />
      </IrisFormField>
      <IrisButton variant="solid" type="submit" :disabled="authState.loading">
        {{ authState.loading ? 'Signing in…' : 'Sign in' }}
      </IrisButton>
    </form>
  </div>
</template>
