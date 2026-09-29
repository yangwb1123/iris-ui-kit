/**
 * One SVG child element of an icon, expressed as structured data rather than
 * raw markup. Adapters render these with `createElement` / `h()` so icon
 * content is never injected as a raw HTML string (no XSS surface, even when an
 * icon originates from a theme's `iconOverrides`).
 */
export interface IrisIconNode {
  /** SVG element tag, e.g. a shape ('path', 'circle') or container ('g', 'defs'). */
  tag: string
  /** Geometry and presentation attributes for this SVG element. */
  attrs: Record<string, string | number>
  /** Nested safe SVG elements, used by groups and definitions. */
  children?: IrisIconNode[]
}

/**
 * A single icon: a list of child elements plus an optional viewBox. Paint
 * (stroke / fill / currentColor) is applied by the renderer on the root `<svg>`.
 */
export interface IrisIcon {
  /** Semantic name (e.g. 'folder', 'close', 'chevron-down'). */
  name: string
  /** Structured child elements. */
  nodes: IrisIconNode[]
  /** Viewport (default '0 0 24 24'). */
  viewBox?: string
}

/**
 * A named collection of icons, addressable by semantic name. Themes reference
 * an icon set by its `name` via `IrisTheme.icons`.
 */
export interface IrisIconSet {
  name: string
  icons: Record<string, IrisIcon>
}

/**
 * Resolve an icon by name. Implementations may consult a registry of icon
 * sets and apply theme icon overrides.
 */
export type IrisIconResolver = (name: string) => IrisIcon | undefined
