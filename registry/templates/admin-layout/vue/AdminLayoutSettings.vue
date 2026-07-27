<script setup lang="ts">
import {
  IrisButton,
  IrisCard,
  useAdminPreferences,
  type AdminPreferences,
  type AdminPreferencesState,
} from '@iris-ui-kit/vue'

const props = defineProps<{ preferences: AdminPreferences }>()
const preferences = useAdminPreferences(props.preferences, false)
const state = preferences.state
type BooleanKey = 'showTabs' | 'showBreadcrumb' | 'stickyHeader' | 'stickyTabs'
const toggles: Array<{ key: BooleanKey; label: string }> = [
  { key: 'showTabs', label: 'Page tabs' },
  { key: 'showBreadcrumb', label: 'Breadcrumb' },
  { key: 'stickyHeader', label: 'Sticky header' },
  { key: 'stickyTabs', label: 'Sticky tabs' },
]
const setBoolean = (key: BooleanKey, event: Event): void => {
  preferences.set(key, (event.currentTarget as HTMLInputElement).checked)
}
</script>

<template>
  <IrisCard data-admin-layout-settings>
    <div class="admin-layout-settings-grid">
      <label>
        Navigation
        <select
          :value="state.navigationMode"
          @change="
            preferences.set(
              'navigationMode',
              ($event.currentTarget as HTMLSelectElement)
                .value as AdminPreferencesState['navigationMode'],
            )
          "
        >
          <option value="sidebar">Sidebar</option>
          <option value="horizontal">Horizontal</option>
        </select>
      </label>
      <label>
        Menu alignment
        <select
          :value="state.menuAlign"
          @change="
            preferences.set(
              'menuAlign',
              ($event.currentTarget as HTMLSelectElement)
                .value as AdminPreferencesState['menuAlign'],
            )
          "
        >
          <option value="start">Start</option>
          <option value="center">Center</option>
          <option value="end">End</option>
        </select>
      </label>
      <label>
        Content width
        <select
          :value="state.contentWidth"
          @change="
            preferences.set(
              'contentWidth',
              ($event.currentTarget as HTMLSelectElement)
                .value as AdminPreferencesState['contentWidth'],
            )
          "
        >
          <option value="fluid">Fluid</option>
          <option value="centered">Centered</option>
        </select>
      </label>
      <label>
        Content height
        <select
          :value="state.contentHeight"
          @change="
            preferences.set(
              'contentHeight',
              ($event.currentTarget as HTMLSelectElement)
                .value as AdminPreferencesState['contentHeight'],
            )
          "
        >
          <option value="viewport">Viewport</option>
          <option value="auto">Auto</option>
        </select>
      </label>
      <label>
        Density
        <select
          :value="state.density"
          @change="
            preferences.set(
              'density',
              ($event.currentTarget as HTMLSelectElement).value as AdminPreferencesState['density'],
            )
          "
        >
          <option value="compact">Compact</option>
          <option value="default">Default</option>
          <option value="comfortable">Comfortable</option>
        </select>
      </label>
    </div>
    <div class="admin-layout-settings-toggles">
      <label v-for="toggle in toggles" :key="toggle.key">
        <input
          type="checkbox"
          :checked="state[toggle.key]"
          @change="setBoolean(toggle.key, $event)"
        />
        {{ toggle.label }}
      </label>
    </div>
    <IrisButton variant="outline" @click="preferences.reset">Reset layout</IrisButton>
  </IrisCard>
</template>

<style scoped>
.admin-layout-settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--iris-spacing-md);
}

.admin-layout-settings-grid label {
  display: grid;
  gap: var(--iris-spacing-xs);
}

.admin-layout-settings-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--iris-spacing-md);
  margin-block: var(--iris-spacing-md);
}

.admin-layout-settings-toggles label {
  display: inline-flex;
  gap: var(--iris-spacing-sm);
}
</style>
