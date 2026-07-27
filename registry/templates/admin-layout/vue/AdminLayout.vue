<script setup lang="ts">
import {
  IrisAdminLayout,
  useAdminPreferences,
  type AdminPreferences,
  type NavNode,
  type TabsNav,
} from '@iris-ui-kit/vue/admin'

const props = withDefaults(
  defineProps<{
    menus: NavNode[]
    activeKey: string
    preferences: AdminPreferences
    tabs?: TabsNav
    appTitle?: string
  }>(),
  { appTitle: 'Admin', tabs: undefined },
)
const emit = defineEmits<{ navigate: [key: string] }>()
const preferences = useAdminPreferences(props.preferences)
const state = preferences.state
</script>

<!--
  Stable admin application shell. Pages supplied through the default slot
  remain statically imported by the app; only declarative chrome preferences
  change at runtime.
-->
<template>
  <div data-admin-layout :data-density="state.density">
    <IrisAdminLayout
      :menus="menus"
      :active-key="activeKey"
      :collapsed="state.collapsed"
      :mode="state.navigationMode"
      :menu-align="state.menuAlign"
      :content-width="state.contentWidth"
      :content-height="state.contentHeight"
      :show-tabs="state.showTabs"
      :show-breadcrumb="state.showBreadcrumb"
      :sticky-header="state.stickyHeader"
      :sticky-tabs="state.stickyTabs"
      :tabs="tabs"
      :app-title="appTitle"
      @update:active-key="emit('navigate', $event)"
      @update:collapsed="preferences.set('collapsed', $event)"
    >
      <template #logo="scope">
        <slot name="logo" v-bind="scope">
          <strong>{{ scope.collapsed ? 'AD' : appTitle }}</strong>
        </slot>
      </template>
      <template #toolbar><slot name="toolbar" /></template>
      <template #default="{ activeKey: key }"><slot :active-key="key" /></template>
      <template #footer><slot name="footer" /></template>
    </IrisAdminLayout>
  </div>
</template>
