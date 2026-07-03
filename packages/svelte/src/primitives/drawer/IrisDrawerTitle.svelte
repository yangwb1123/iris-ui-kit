<script lang="ts">
  import { untrack } from 'svelte'
  import { getDrawerContext } from './context'

  interface Props {
    as?: string
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { as: tag = 'h2', children, ...rest }: Props = $props()
  const ctx = getDrawerContext('IrisDrawerTitle')

  // Tell the drawer a title is present so it wires aria-labelledby. untrack so
  // the counter's read-modify-write doesn't make this effect self-trigger.
  $effect(() => untrack(() => ctx.registerTitle()))
</script>

<svelte:element
  this={tag}
  {...rest}
  id={ctx.titleId}
  data-iris-drawer-title
  style="margin: 0 0 var(--iris-gap-md, 12px) 0; font-size: var(--iris-font-size-lg, 18px); font-weight: 600;{(rest.style as string)
    ? ' ' + (rest.style as string)
    : ''}"
>
  {@render children?.()}
</svelte:element>
