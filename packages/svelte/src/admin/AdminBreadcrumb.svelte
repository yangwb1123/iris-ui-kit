<script lang="ts">
  import IrisBreadcrumb from '../primitives/breadcrumb/Breadcrumb.svelte'
  import IrisBreadcrumbItem from '../primitives/breadcrumb/BreadcrumbItem.svelte'
  import IrisIcon from '../primitives/icon/IrisIcon.svelte'
  import type { IrisAdminBreadcrumbProps } from './types'

  let {
    trail,
    showIcon = true,
    hideSingle = false,
    separator = '/',
    onSelect,
  }: IrisAdminBreadcrumbProps = $props()

  const visible = $derived(trail.length > 0 && !(hideSingle && trail.length === 1))
</script>

{#if visible}
  <IrisBreadcrumb {separator}>
    {#each trail as node, i (node.key)}
      {@const last = i === trail.length - 1}
      <IrisBreadcrumbItem
        current={last}
        data-iris-admin-crumb
        onclick={last ? undefined : () => onSelect?.(node.key, node)}
      >
        {#if showIcon && node.icon}<IrisIcon
            name={node.icon}
            size={14}
            style="margin-inline-end: 4px"
          />{/if}
        <span>{node.title}</span>
      </IrisBreadcrumbItem>
    {/each}
  </IrisBreadcrumb>
{/if}
