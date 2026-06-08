<script lang="ts">
  import { getTabsContext } from './context'

  interface Props {
    value: string
    forceMount?: boolean
    style?: string
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { value, forceMount = false, style, children, ...rest }: Props = $props()

  const ctx = getTabsContext()

  const isActive = $derived(ctx.value === value)
  const shouldRender = $derived(isActive || !ctx.lazy || forceMount)
</script>

{#if shouldRender}
  <div
    {...rest}
    role="tabpanel"
    id="iris-tabs-content-{value}"
    aria-labelledby="iris-tabs-trigger-{value}"
    data-iris-tabs-content
    data-state={isActive ? 'active' : 'inactive'}
    hidden={!isActive || undefined}
    tabindex={0}
    style="padding: var(--iris-padding-md, 12px) 0; outline: none; {style ?? ''}"
  >
    {@render children?.()}
  </div>
{/if}
