<script lang="ts" generics="T">
  // Test fixture: drives useUndoStack and exposes both the live controller (via
  // `onready`) and the reactive state through the DOM so assertions can read it.
  import type { UndoStackOptions } from '@iris-ui-kit/core/undo'
  import { useUndoStack } from './useUndoStack.svelte'

  let {
    options,
    onready,
  }: {
    options?: UndoStackOptions<T>
    onready?: (api: ReturnType<typeof useUndoStack<T>>) => void
  } = $props()

  // svelte-ignore state_referenced_locally — the hook constructs its stack once.
  const u = useUndoStack<T>(options)
  // svelte-ignore state_referenced_locally — fixture: hand the controller out once.
  onready?.(u)
</script>

<span data-can-undo>{u.state.canUndo}</span>
<span data-can-redo>{u.state.canRedo}</span>
<span data-depth>{u.state.depth}</span>
<span data-index>{u.state.index}</span>
