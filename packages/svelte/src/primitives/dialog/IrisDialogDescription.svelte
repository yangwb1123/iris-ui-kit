<script lang="ts">
  import { getDialogContext } from './context'

  interface Props {
    as?: string
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { as: tag = 'p', children, ...rest }: Props = $props()
  const ctx = getDialogContext('IrisDialogDescription')
</script>

<svelte:element
  this={tag}
  {...rest}
  id={ctx.descriptionId}
  data-iris-dialog-description
  style="margin: 0 0 var(--iris-gap-lg, 16px) 0; color: var(--iris-muted); font-size: 14px;{(rest.style as string) ? ' ' + (rest.style as string) : ''}"
>
  {@render children?.()}
</svelte:element>
