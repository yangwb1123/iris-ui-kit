<script lang="ts">
  import { get } from 'svelte/store'
  import { defaultIconRegistry, normalizeIconNodes, resolveThemedIcon } from '@iris-ui-kit/icons'
  import type { IrisTheme } from '@iris-ui-kit/tokens'
  import { useThemeOptional } from '../../theme/useTheme'
  import { mergeStyle } from '../../internal/style'
  import type { IrisIconNode } from '@iris-ui-kit/icons'
  import type { IrisIconProps } from './types'

  let {
    name,
    size = 24,
    strokeWidth = 2,
    fill = false,
    title,
    registry = defaultIconRegistry,
    class: className,
    style,
  }: IrisIconProps = $props()

  // Optional theme (undefined when standalone) — mirrors Solid's useThemeOptional().
  // Subscribe so theme-level icon overrides re-resolve reactively, like the
  // React/Vue/Solid adapters; IrisTheme is a structural superset of ThemeIconConfig.
  const themeStore = useThemeOptional()
  let themeValue = $state<IrisTheme | undefined>(themeStore ? get(themeStore) : undefined)
  $effect(() => {
    if (!themeStore) return
    return themeStore.subscribe((v) => {
      themeValue = v
    })
  })

  const icon = $derived(resolveThemedIcon(registry, name, themeValue))
  const iconNodes = $derived(icon ? normalizeIconNodes(icon.nodes) : [])
  const css = $derived(
    mergeStyle('display: inline-block; vertical-align: middle; flex-shrink: 0', style),
  )
</script>

{#if icon}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox={icon.viewBox ?? '0 0 24 24'}
    width={size}
    height={size}
    fill={fill ? 'currentColor' : 'none'}
    stroke={fill ? undefined : 'currentColor'}
    stroke-width={fill ? undefined : strokeWidth}
    stroke-linecap={fill ? undefined : 'round'}
    stroke-linejoin={fill ? undefined : 'round'}
    role={title ? 'img' : undefined}
    aria-label={title || undefined}
    aria-hidden={title ? undefined : 'true'}
    data-iris-icon={name}
    class={className}
    style={css}
  >
    {#snippet renderNode(node: IrisIconNode)}
      <svelte:element this={node.tag} {...node.attrs} xmlns="http://www.w3.org/2000/svg">
        {#each node.children ?? [] as child, index (index)}
          {@render renderNode(child)}
        {/each}
      </svelte:element>
    {/snippet}
    {#if title}<title>{title}</title>{/if}
    {#each iconNodes as node, index (index)}
      {@render renderNode(node)}
    {/each}
  </svg>
{/if}
