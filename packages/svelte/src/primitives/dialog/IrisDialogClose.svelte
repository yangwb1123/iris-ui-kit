<script lang="ts">
  import { getDialogContext } from './context'

  interface Props {
    onclick?: (e: MouseEvent) => void
    children?: import('svelte').Snippet
    [key: string]: unknown
  }

  let { onclick, children, ...rest }: Props = $props()
  const ctx = getDialogContext('IrisDialogClose')

  function handleClick(e: MouseEvent): void {
    if (e.defaultPrevented) return
    onclick?.(e)
    ctx.setOpen(false)
  }
</script>

<button
  type="button"
  {...rest}
  data-iris-dialog-close
  onclick={handleClick}
>
  {@render children?.()}
</button>
