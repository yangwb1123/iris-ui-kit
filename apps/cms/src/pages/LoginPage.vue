<script setup lang="ts">
import { ref } from 'vue'
import { IrisButton, IrisInput, IrisSelect } from '@iris-ui/vue'
import { login, type Role } from '../auth'

const username = ref('')
const role = ref<Role>('admin')
const loading = ref(false)

function handleLogin() {
  if (!username.value.trim()) return
  loading.value = true
  login(username.value.trim(), role.value)
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
      <IrisInput v-model="username" placeholder="Username" :disabled="loading" />
      <IrisSelect
        :model-value="role"
        @update:model-value="(v: unknown) => (role = v as Role)"
        :items="[
          { value: 'admin', label: 'Admin' },
          { value: 'viewer', label: 'Viewer' },
        ]"
        placeholder="Role"
        :disabled="loading"
      />
      <IrisButton variant="solid" type="submit" :disabled="loading || !username.trim()">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </IrisButton>
    </form>
  </div>
</template>
