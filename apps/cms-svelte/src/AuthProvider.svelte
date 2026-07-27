<script lang="ts">
  import { onDestroy, setContext } from 'svelte'
  import type { CmsAuthClient, KeyValueStorage } from '@iris-ui-kit/cms-shared'
  import { createAuthContext, AUTH_KEY } from './auth'
  import type { AuthContextValue } from './auth'

  let {
    children,
    client,
    storage,
  }: {
    children: import('svelte').Snippet
    client?: CmsAuthClient
    storage?: KeyValueStorage
  } = $props()

  // svelte-ignore state_referenced_locally — dependencies are construction-time injections.
  const auth = createAuthContext({ client, storage })
  setContext<AuthContextValue>(AUTH_KEY, auth)
  onDestroy(auth.destroy)
</script>

{@render children()}
