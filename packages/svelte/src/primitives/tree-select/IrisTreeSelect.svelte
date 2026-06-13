<script lang="ts">
  import IrisTree from '../tree/IrisTree.svelte'
  import { useI18n } from '../../i18n'
  import type { IrisTreeNode, IrisTreeSelectionMode } from '../tree/types'

  interface Props {
    nodes?: IrisTreeNode[]
    value?: string[]
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    selectionMode?: IrisTreeSelectionMode
    onValueChange?: (ids: string[]) => void
    style?: string
    class?: string
  }

  let {
    nodes = [],
    value = [],
    placeholder,
    disabled = false,
    invalid = false,
    selectionMode = 'single',
    onValueChange,
    style,
    class: className,
    ...rest
  }: Props = $props()

  const { t } = useI18n()

  let open = $state(false)
  let containerEl = $state<HTMLElement | undefined>(undefined)

  function findLabels(nodeList: IrisTreeNode[], ids: string[]): string[] {
    const found: string[] = []
    function traverse(nodes: IrisTreeNode[]) {
      for (const n of nodes) {
        if (ids.includes(n.id)) found.push(n.label)
        if (n.children) traverse(n.children)
      }
    }
    traverse(nodeList)
    return found
  }

  const display = $derived(findLabels(nodes, value).join(', '))

  function toggle() {
    if (disabled) return
    open = !open
  }

  // Trigger keyboard: Escape closes; ArrowDown/Enter open (mirrors React/Vue).
  function onTriggerKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      open = false
    } else if ((e.key === 'ArrowDown' || e.key === 'Enter') && !open) {
      e.preventDefault()
      if (!disabled) open = true
    }
  }

  function onSelect(ids: string[]) {
    onValueChange?.(ids)
    if (selectionMode === 'single') open = false
  }

  function onDocDown(e: MouseEvent) {
    if (open && containerEl && !containerEl.contains(e.target as Node)) open = false
  }

  $effect(() => {
    if (open) document.addEventListener('mousedown', onDocDown)
    else document.removeEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  })
</script>

<div
  bind:this={containerEl}
  data-iris-tree-select
  style:position="relative"
  style:display="inline-flex"
  style={style}
  class={className}
  {...rest}
>
  <button
    type="button"
    {disabled}
    aria-invalid={invalid ? 'true' : undefined}
    aria-expanded={open}
    aria-haspopup="tree"
    data-iris-tree-select-trigger
    data-state={open ? 'open' : 'closed'}
    onclick={toggle}
    onkeydown={onTriggerKeyDown}
    style:display="inline-flex"
    style:align-items="center"
    style:justify-content="space-between"
    style:gap="6px"
    style:padding="6px 12px"
    style:min-height="34px"
    style:min-width="180px"
    style:background="var(--iris-background)"
    style:color={value.length > 0 ? 'var(--iris-foreground)' : 'var(--iris-muted)'}
    style:border={`1px solid ${invalid ? 'var(--iris-danger)' : 'var(--iris-border)'}`}
    style:border-radius="var(--iris-radius-md, 6px)"
    style:cursor={disabled ? 'not-allowed' : 'pointer'}
    style:font-size="14px"
    style:font-family="inherit"
    style:text-align="start"
  >
    <span style:flex="1">{display || (placeholder ?? t('select.placeholder'))}</span>
    <span aria-hidden="true" style:font-size="10px">{open ? '▲' : '▼'}</span>
  </button>

  {#if open}
    <div
      data-iris-tree-select-panel
      role="dialog"
      style:position="absolute"
      style:top="calc(100% + 4px)"
      style:left="0"
      style:z-index="50"
      style:min-width="240px"
      style:max-height="320px"
      style:overflow-y="auto"
      style:background="var(--iris-background)"
      style:border="1px solid var(--iris-border)"
      style:border-radius="var(--iris-radius-md, 6px)"
      style:box-shadow="0 8px 24px rgba(0,0,0,0.12)"
      style:padding="4px"
    >
      <IrisTree
        {nodes}
        selected={value}
        {selectionMode}
        onSelectedChange={onSelect}
        style="min-width: 200px;"
      />
    </div>
  {/if}
</div>
