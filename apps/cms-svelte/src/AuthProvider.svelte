<script lang="ts">
  import { setContext } from 'svelte'
  import { createAuthContext, AUTH_KEY } from './auth'
  import type { AuthContextValue } from './auth'

  const auth = createAuthContext()
  setContext<AuthContextValue>(AUTH_KEY, auth)

  let { children }: { children: import('svelte').Snippet } = $props()
</script>

{@render children()}
