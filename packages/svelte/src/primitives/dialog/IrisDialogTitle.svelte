<script lang="ts">
  import { getDialogContext } from './context'

  interface Props {
    as?: string
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { as: tag = 'h2', children, ...rest }: Props = $props()
  const ctx = getDialogContext('IrisDialogTitle')
</script>

<svelte:element
  this={tag}
  {...rest}
  id={ctx.titleId}
  data-iris-dialog-title
  style="margin: 0 0 var(--iris-gap-md, 12px) 0; font-size: 18px; font-weight: 600;{(rest.style as string) ? ' ' + (rest.style as string) : ''}"
>
  {@render children?.()}
</svelte:element>
