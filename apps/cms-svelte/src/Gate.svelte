<script lang="ts">
  import { useAuth } from './auth'
  import Shell from './Shell.svelte'
  import LoginPage from './pages/LoginPage.svelte'

  const { session } = useAuth()
</script>

{#if $session}
  <Shell />
{:else}
  <LoginPage />
{/if}
