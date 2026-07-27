<script lang="ts">
  import {
    IrisButton,
    IrisCard,
    useAdminPreferences,
    type AdminPreferences,
    type AdminPreferencesState,
  } from '@iris-ui-kit/svelte'

  let { preferences: controller }: { preferences: AdminPreferences } = $props()
  // svelte-ignore state_referenced_locally — controller identity is stable for the panel lifetime.
  const preferences = useAdminPreferences(controller, false)
  const { state } = preferences
  type BooleanKey = 'showTabs' | 'showBreadcrumb' | 'stickyHeader' | 'stickyTabs'
  const toggles: Array<{ key: BooleanKey; label: string }> = [
    { key: 'showTabs', label: 'Page tabs' },
    { key: 'showBreadcrumb', label: 'Breadcrumb' },
    { key: 'stickyHeader', label: 'Sticky header' },
    { key: 'stickyTabs', label: 'Sticky tabs' },
  ]
</script>

<IrisCard data-admin-layout-settings style="" header={undefined} footer={undefined}>
  <div class="settings-grid">
    <label>
      Navigation
      <select
        value={$state.navigationMode}
        onchange={(event) =>
          preferences.set(
            'navigationMode',
            event.currentTarget.value as AdminPreferencesState['navigationMode'],
          )}
      >
        <option value="sidebar">Sidebar</option>
        <option value="horizontal">Horizontal</option>
      </select>
    </label>
    <label>
      Menu alignment
      <select
        value={$state.menuAlign}
        onchange={(event) =>
          preferences.set(
            'menuAlign',
            event.currentTarget.value as AdminPreferencesState['menuAlign'],
          )}
      >
        <option value="start">Start</option>
        <option value="center">Center</option>
        <option value="end">End</option>
      </select>
    </label>
    <label>
      Content width
      <select
        value={$state.contentWidth}
        onchange={(event) =>
          preferences.set(
            'contentWidth',
            event.currentTarget.value as AdminPreferencesState['contentWidth'],
          )}
      >
        <option value="fluid">Fluid</option>
        <option value="centered">Centered</option>
      </select>
    </label>
    <label>
      Content height
      <select
        value={$state.contentHeight}
        onchange={(event) =>
          preferences.set(
            'contentHeight',
            event.currentTarget.value as AdminPreferencesState['contentHeight'],
          )}
      >
        <option value="viewport">Viewport</option>
        <option value="auto">Auto</option>
      </select>
    </label>
    <label>
      Density
      <select
        value={$state.density}
        onchange={(event) =>
          preferences.set('density', event.currentTarget.value as AdminPreferencesState['density'])}
      >
        <option value="compact">Compact</option>
        <option value="default">Default</option>
        <option value="comfortable">Comfortable</option>
      </select>
    </label>
  </div>
  <div class="settings-toggles">
    {#each toggles as toggle (toggle.key)}
      <label>
        <input
          type="checkbox"
          checked={$state[toggle.key]}
          onchange={(event) => preferences.set(toggle.key, event.currentTarget.checked)}
        />
        {toggle.label}
      </label>
    {/each}
  </div>
  <IrisButton variant="outline" onclick={preferences.reset}>Reset layout</IrisButton>
</IrisCard>

<style>
  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--iris-spacing-md);
  }

  .settings-grid label {
    display: grid;
    gap: var(--iris-spacing-xs);
  }

  .settings-toggles {
    display: flex;
    flex-wrap: wrap;
    gap: var(--iris-spacing-md);
    margin-block: var(--iris-spacing-md);
  }

  .settings-toggles label {
    display: inline-flex;
    gap: var(--iris-spacing-sm);
  }
</style>
