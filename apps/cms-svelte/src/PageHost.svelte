<script lang="ts">
  import { isCmsWorkspaceRoute } from '@iris-ui-kit/cms-shared'
  import DashboardPage from './pages/DashboardPage.svelte'
  import UsersPage from './pages/UsersPage.svelte'
  import SettingsPage from './pages/SettingsPage.svelte'
  import WorkspacePage from './pages/WorkspacePage.svelte'
  import FormBuilderPage from './pages/FormBuilderPage.svelte'

  let { routeKey }: { routeKey: string } = $props()
</script>

{#if routeKey === 'dashboard'}
  <DashboardPage />
{:else if routeKey === 'all-users'}
  <UsersPage />
{:else if routeKey === 'settings'}
  <SettingsPage />
{:else if isCmsWorkspaceRoute(routeKey)}
  <WorkspacePage {routeKey} />
{:else if routeKey === 'form-builder'}
  <FormBuilderPage />
{:else}
  <DashboardPage />
{/if}
