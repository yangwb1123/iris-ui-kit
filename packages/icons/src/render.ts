import type { IrisIcon, IrisIconNode } from './types'

export interface RenderIconOptions {
  /** Width & height (number → px). Default 24. */
  size?: number | string
  /** Stroke width for line icons. Default 2. */
  strokeWidth?: number
  /** Render as a filled glyph instead of a stroked line icon. Default false. */
  fill?: boolean
  /** Accessible title. When set, the icon is exposed as `role="img"`. */
  title?: string
  /** Extra attributes merged onto the root `<svg>` (e.g. `class`, `id`). */
  attrs?: Record<string, string | number>
}

const DEFAULT_VIEW_BOX = '0 0 24 24'

function serializeAttrs(attrs: Record<string, string | number>): string {
  return Object.entries(attrs)
    .map(([key, value]) => `${key}="${String(value)}"`)
    .join(' ')
}

function serializeNode(node: IrisIconNode): string {
  const attrs = serializeAttrs(node.attrs)
  return `<${node.tag}${attrs ? ` ${attrs}` : ''}/>`
}

/**
 * Serialize an {@link IrisIcon} to a standalone SVG string from its structured
 * nodes. Framework-agnostic and SSR-safe. Colors follow `currentColor`, so a
 * single CSS `color` themes the icon.
 */
export function renderIconSvg(icon: IrisIcon, options: RenderIconOptions = {}): string {
  const { size = 24, strokeWidth = 2, fill = false, title, attrs = {} } = options

  const root: Record<string, string | number> = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: icon.viewBox ?? DEFAULT_VIEW_BOX,
    width: size,
    height: size,
    fill: fill ? 'currentColor' : 'none',
  }
  if (!fill) {
    root.stroke = 'currentColor'
    root['stroke-width'] = strokeWidth
    root['stroke-linecap'] = 'round'
    root['stroke-linejoin'] = 'round'
  }
  if (title) {
    root.role = 'img'
    root['aria-label'] = title
  } else {
    root['aria-hidden'] = 'true'
  }
  Object.assign(root, attrs)

  const titleEl = title ? `<title>${title}</title>` : ''
  const body = icon.nodes.map(serializeNode).join('')
  return `<svg ${serializeAttrs(root)}>${titleEl}${body}</svg>`
}
