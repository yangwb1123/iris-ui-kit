<script lang="ts">
  import { findNavNode } from '@iris-ui-kit/svelte'
  import { menus } from './menus'
  import DashboardPage from './pages/DashboardPage.svelte'
  import UsersPage from './pages/UsersPage.svelte'
  import SettingsPage from './pages/SettingsPage.svelte'
  import GenericPage from './pages/GenericPage.svelte'
  import FormBuilderPage from './pages/FormBuilderPage.svelte'

  let { routeKey }: { routeKey: string } = $props()

  const title = $derived(findNavNode(menus, routeKey)?.title ?? routeKey)
</script>

{#if routeKey === 'dashboard'}
  <DashboardPage />
{:else if routeKey === 'all-users'}
  <UsersPage />
{:else if routeKey === 'settings'}
  <SettingsPage />
{:else if routeKey === 'form-builder'}
  <FormBuilderPage />
{:else}
  <GenericPage {title} />
{/if}
