<script lang="ts">
  import type { Snippet } from 'svelte'
  import { createSlotChildProps, type IrisSlotChildProps, type IrisSlotRef } from './slot'

  interface Props {
    /**
     * Kept for source compatibility. IrisSlot is always wrapper-free and
     * always renders through its single child snippet.
     */
    asChild?: boolean
    ref?: IrisSlotRef
    children?: Snippet<[IrisSlotChildProps]>
    [key: string]: unknown
  }

  let { asChild: _asChild, ref, children, ...rest }: Props = $props()
  const childProps = $derived(createSlotChildProps(rest, ref))
</script>

{@render children?.(childProps)}
