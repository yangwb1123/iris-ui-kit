import * as React from 'react'
import { defaultIconRegistry, resolveThemedIcon, type IrisIconRegistry } from '@iris-ui/icons'
import { useThemeOptional } from '../../theme'

export interface IrisIconProps
  extends Omit<
    React.SVGAttributes<SVGSVGElement>,
    'name' | 'children' | 'dangerouslySetInnerHTML' | 'fill'
  > {
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
}

/**
 * Renders a registered icon as inline SVG. Resolves `name` through an
 * `@iris-ui/icons` registry and renders the icon's structured nodes as real
 * SVG child elements (no raw-HTML injection). Colors follow `currentColor`, so
 * the surrounding CSS `color` themes it. Renders nothing for an unresolved name.
 */
export function IrisIcon({
  name,
  size = 24,
  strokeWidth = 2,
  fill = false,
  title,
  registry = defaultIconRegistry,
  style,
  ...rest
}: IrisIconProps): React.ReactElement | null {
  const theme = useThemeOptional()
  const icon = resolveThemedIcon(registry, name, theme)
  if (!icon) return null

  const paint: React.SVGAttributes<SVGSVGElement> = fill
    ? { fill: 'currentColor' }
    : {
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }

  return (
    <svg
      {...rest}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={icon.viewBox ?? '0 0 24 24'}
      width={size}
      height={size}
      {...paint}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      data-iris-icon={name}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    >
      {title ? <title>{title}</title> : null}
      {icon.nodes.map((node, i) => React.createElement(node.tag, { key: i, ...node.attrs }))}
    </svg>
  )
}
