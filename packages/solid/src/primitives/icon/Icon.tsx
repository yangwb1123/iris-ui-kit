import { For, mergeProps, Show, type JSX } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { defaultIconRegistry, resolveThemedIcon, type IrisIconRegistry } from '@iris-ui/icons'
import { useThemeOptional } from '../../theme'

export interface IrisIconProps {
  /** Semantic icon name resolved via the registry (e.g. 'check', 'chevron-down'). */
  name: string
  /** Width & height (number → px). Default 24. */
  size?: number | string
  /** Stroke width for line icons. Default 2. */
  strokeWidth?: number
  /** Render as a filled glyph instead of a stroked line icon. */
  fill?: boolean
  /** Accessible title; sets `role="img"` + `aria-label`. Omit for decorative icons. */
  title?: string
  /** Registry to resolve `name` against. Defaults to the built-in set. */
  registry?: IrisIconRegistry
  class?: string
  style?: JSX.CSSProperties
}

/**
 * Renders a registered icon as inline SVG — the icon's structured nodes become
 * real SVG children (no raw-HTML injection). Colors follow `currentColor`.
 * Renders nothing for an unresolved name. Solid port of the React/Vue IrisIcon.
 */
export function IrisIcon(props: IrisIconProps): JSX.Element {
  const merged = mergeProps(
    { size: 24, strokeWidth: 2, fill: false, registry: defaultIconRegistry },
    props,
  )
  const theme = useThemeOptional()
  const icon = () => resolveThemedIcon(merged.registry, merged.name, theme?.())

  return (
    <Show when={icon()}>
      {(ic) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={ic().viewBox ?? '0 0 24 24'}
          width={merged.size}
          height={merged.size}
          fill={merged.fill ? 'currentColor' : 'none'}
          stroke={merged.fill ? undefined : 'currentColor'}
          stroke-width={merged.fill ? undefined : merged.strokeWidth}
          stroke-linecap={merged.fill ? undefined : 'round'}
          stroke-linejoin={merged.fill ? undefined : 'round'}
          role={merged.title ? 'img' : undefined}
          aria-label={merged.title || undefined}
          aria-hidden={merged.title ? undefined : 'true'}
          data-iris-icon={merged.name}
          class={merged.class}
          style={{
            display: 'inline-block',
            'vertical-align': 'middle',
            'flex-shrink': 0,
            ...(merged.style ?? {}),
          }}
        >
          <Show when={merged.title}>{(t) => <title>{t()}</title>}</Show>
          <For each={ic().nodes}>{(node) => <Dynamic component={node.tag} {...node.attrs} />}</For>
        </svg>
      )}
    </Show>
  )
}
