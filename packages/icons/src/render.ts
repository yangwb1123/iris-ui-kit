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

const SAFE_NODE_TAGS = new Set(['circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect'])

const SAFE_ROOT_ATTRS = new Set([
  'aria-hidden',
  'aria-label',
  'class',
  'fill',
  'focusable',
  'height',
  'id',
  'preserveAspectRatio',
  'role',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-width',
  'tabindex',
  'transform',
  'viewBox',
  'width',
  'xmlns',
])

const SAFE_NODE_ATTRS = new Set([
  'aria-hidden',
  'aria-label',
  'class',
  'clip-rule',
  'cx',
  'cy',
  'd',
  'fill',
  'fill-rule',
  'height',
  'id',
  'opacity',
  'pathLength',
  'points',
  'r',
  'role',
  'rx',
  'ry',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-width',
  'transform',
  'vector-effect',
  'width',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
])

const SAFE_EXTENSION_ATTR = /^(?:aria|data)-[A-Za-z0-9_.:-]+$/

function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function isAllowedAttr(name: string, allowed: Set<string>): boolean {
  return allowed.has(name) || SAFE_EXTENSION_ATTR.test(name)
}

function serializeAttrs(attrs: Record<string, string | number>, allowed: Set<string>): string {
  return Object.entries(attrs)
    .filter(([key]) => isAllowedAttr(key, allowed))
    .map(([key, value]) => `${key}="${escapeXml(value)}"`)
    .join(' ')
}

function serializeNode(node: IrisIconNode): string {
  if (!SAFE_NODE_TAGS.has(node.tag)) return ''
  const attrs = serializeAttrs(node.attrs, SAFE_NODE_ATTRS)
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
  for (const [key, value] of Object.entries(attrs)) {
    if (isAllowedAttr(key, SAFE_ROOT_ATTRS)) root[key] = value
  }

  const titleEl = title ? `<title>${escapeXml(title)}</title>` : ''
  const body = icon.nodes.map(serializeNode).join('')
  return `<svg ${serializeAttrs(root, SAFE_ROOT_ATTRS)}>${titleEl}${body}</svg>`
}
