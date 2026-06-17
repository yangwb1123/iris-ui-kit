<script lang="ts">
  import { untrack } from 'svelte'
  import { getDialogContext } from './context'

  interface Props {
    as?: string
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { as: tag = 'h2', children, ...rest }: Props = $props()
  const ctx = getDialogContext('IrisDialogTitle')

  // Tell the dialog a title is present so it wires aria-labelledby. untrack
  // the register call so the counter's read-modify-write inside it doesn't
  // make this effect depend on (and re-trigger from) its own mutation.
  $effect(() => untrack(() => ctx.registerTitle()))
</script>

<svelte:element
  this={tag}
  {...rest}
  id={ctx.titleId}
  data-iris-dialog-title
  style="margin: 0 0 var(--iris-gap-md, 12px) 0; font-size: 18px; font-weight: 600;{(rest.style as string)
    ? ' ' + (rest.style as string)
    : ''}"
>
  {@render children?.()}
</svelte:element>
