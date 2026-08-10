<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import {
  IrisAdminLayout,
  IrisAvatar,
  IrisButton,
  IrisDropdown,
  IrisDropdownTrigger,
  IrisDropdownMenu,
  IrisDropdownItem,
  IrisIcon,
  useSkin,
  useTabsNav,
} from '@iris-ui-kit/vue'
import { filterNavByAccess, type NavNode } from '@iris-ui-kit/core'
import { isCmsWorkspaceRoute } from '@iris-ui-kit/cms-shared'
import { authStore, logout } from './auth'
import { menus as flatMenus } from './menus'
import { tabsNav } from './tabs'

const role = computed(() => authStore.getState()?.session?.role ?? 'viewer')
const menus = computed(() => filterNavByAccess(flatMenus, [role.value]))
const paletteOpen = ref(false)
const commandItems = computed(() => {
  const items = []
  const walk = (nodes: NavNode[]) => {
    for (const n of nodes) {
      if (n.children && n.children.length > 0) walk(n.children)
      else
        items.push({
          id: 'nav:' + n.key,
          label: 'Go to ' + n.title,
          group: 'Navigate',
          icon: '\u2192',
          action: () => {
            activeKey.value = n.key
          },
        })
    }
  }
  walk(menus.value)
  items.push({
    id: 'action:log-out',
    label: 'Sign out',
    group: 'Actions',
    icon: '\u2716',
    action: () => logout(),
  })
  return items
})
// Register Cmd+K keyboard shortcut
function onKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    paletteOpen.value = !paletteOpen.value
  }
}
if (typeof window !== 'undefined') window.addEventListener('keydown', onKeyDown)
onUnmounted(() => typeof window !== 'undefined' && window.removeEventListener('keydown', onKeyDown))
import DashboardPage from './pages/DashboardPage.vue'
import UsersPage from './pages/UsersPage.vue'
import SettingsPage from './pages/SettingsPage.vue'
import WorkspacePage from './pages/WorkspacePage.vue'
import FormBuilderPage from './pages/FormBuilderPage.vue'

const { skin, setSkin, setMode, getActiveId, availableSkins } = useSkin()
const t = useTabsNav(tabsNav)

const activeKey = ref('dashboard')

// Skin switcher (mirrors the playground): 'auto' follows the system, anything
// else pins a fixed skin.
function selectSkin(id: string) {
  if (id === 'auto') setMode('system')
  else setMode('fixed')
  setSkin(id)
}
const isDark = computed(() => skin.value.type === 'dark')
function toggleDark() {
  setMode('fixed')
  setSkin(isDark.value ? 'light' : 'dark')
}

// Map every menu leaf to either a dedicated shell page or the shared,
// schema-driven workspace renderer.
const pages: Record<string, unknown> = {
  dashboard: DashboardPage,
  'all-users': UsersPage,
  settings: SettingsPage,
  'form-builder': FormBuilderPage,
}
const pageComp = (key: string): unknown =>
  isCmsWorkspaceRoute(key) ? WorkspacePage : (pages[key] ?? DashboardPage)
const pageProps = (key: string): Record<string, unknown> =>
  isCmsWorkspaceRoute(key) ? { routeKey: key } : {}

// Keep-alive cache key for the active tab (changes on refresh → remount).
const activeCacheKey = computed(() => {
  const found = t.cacheKeys.value.find((k) => k.slice(0, k.lastIndexOf(':')) === activeKey.value)
  return found ?? activeKey.value
})
</script>

<template>
  <IrisAdminLayout
    v-model:activeKey="activeKey"
    :menus="menus"
    :tabs="tabsNav"
    app-title="Iris CMS"
  >
    <template #toolbar>
      <select
        class="skin-select"
        aria-label="Theme"
        :value="getActiveId()"
        @change="selectSkin(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="s in availableSkins()" :key="s.id" :value="s.id">
          {{ s.name ?? s.id }}
        </option>
      </select>

      <IrisButton
        size="sm"
        variant="outline"
        :aria-label="isDark ? 'Light mode' : 'Dark mode'"
        @click="toggleDark"
      >
        <IrisIcon :name="isDark ? 'sun' : 'moon'" :size="16" />
      </IrisButton>

      <IrisDropdown>
        <IrisDropdownTrigger
          aria-label="Account"
          style="border: none; background: transparent; cursor: pointer; padding: 0"
        >
          <span style="display: inline-flex">
            <IrisAvatar :name="authStore.getState().session?.username ?? 'User'" :size="32" />
          </span>
        </IrisDropdownTrigger>
        <IrisDropdownMenu>
          <IrisDropdownItem>Profile</IrisDropdownItem>
          <IrisDropdownItem>Account settings</IrisDropdownItem>
          <IrisDropdownItem @click="logout">Sign out</IrisDropdownItem>
        </IrisDropdownMenu>
      </IrisDropdown>
      <IrisCommandPalette
        v-model:open="paletteOpen"
        :items="commandItems"
        placeholder="Search pages and actions…"
      />
    </template>

    <template #default="{ activeKey: key }">
      <KeepAlive>
        <component :is="pageComp(key)" :key="activeCacheKey" v-bind="pageProps(key)" />
      </KeepAlive>
    </template>

    <template #footer>
      <div class="cms-footer">
        <span>Iris CMS — built with @iris-ui-kit/vue/admin</span>
        <span>v0.1.x</span>
      </div>
    </template>
  </IrisAdminLayout>
</template>
