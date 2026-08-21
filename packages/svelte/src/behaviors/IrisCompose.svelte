<script lang="ts">
  import { composeFeatures, hasComposableFeatures, type ComposableFeature } from '@iris-ui-kit/core'
  import IrisResizable from './IrisResizable.svelte'
  import IrisMovable from './IrisMovable.svelte'
  import IrisSortable from './IrisSortable.svelte'
  import IrisClickOutside from './IrisClickOutside.svelte'
  import IrisHotkey from './IrisHotkey.svelte'

  /**
   * Capability composition interface — one declarative surface for composing
   * orthogonal capabilities onto any primitive (see core compose.ts).
   */
  let {
    resizable = undefined as Record<string, unknown> | undefined,
    movable = undefined as Record<string, unknown> | undefined,
    sortable = undefined as Record<string, unknown> | undefined,
    clickOutside = undefined as Record<string, unknown> | undefined,
    hotkey = undefined as Record<string, unknown> | undefined,
    children,
  }: {
    resizable?: Record<string, unknown>
    movable?: Record<string, unknown>
    sortable?: Record<string, unknown>
    clickOutside?: Record<string, unknown>
    hotkey?: Record<string, unknown>
    children: import('svelte').Snippet
  } = $props()

  const features = $derived<Partial<Record<ComposableFeature, unknown>>>({
    resizable,
    movable,
    sortable,
    clickOutside,
    hotkey,
  })
  const active = $derived(composeFeatures(features))
</script>

{#snippet wrapLayer(i: number, content: import('svelte').Snippet)}
  {#if i >= active.length}
    {@render content()}
  {:else}
    {@const feature = active[i]}
    {#if feature === 'hotkey'}
      <IrisHotkey
        shortcut={(hotkey as { shortcut: string | string[] }).shortcut}
        onTrigger={(hotkey as { onTrigger: (e: KeyboardEvent) => void }).onTrigger}
      >
        {@render wrapLayer(i + 1, content)}
      </IrisHotkey>
    {:else if feature === 'clickOutside'}
      <IrisClickOutside {...clickOutside as object}>
        {@render wrapLayer(i + 1, content)}
      </IrisClickOutside>
    {:else if feature === 'sortable'}
      <IrisSortable
        items={(sortable as { items: unknown[] }).items}
        onReorder={(sortable as { onReorder: (next: unknown[]) => void }).onReorder}
      >
        {@render wrapLayer(i + 1, content)}
      </IrisSortable>
    {:else if feature === 'movable'}
      <IrisMovable {...movable as object}>
        {@render wrapLayer(i + 1, content)}
      </IrisMovable>
    {:else if feature === 'resizable'}
      <IrisResizable {...resizable as object}>
        {@render wrapLayer(i + 1, content)}
      </IrisResizable>
    {/if}
  {/if}
{/snippet}

{#if !hasComposableFeatures(features)}
  {@render children()}
{:else}
  {@render wrapLayer(0, children)}
{/if}
