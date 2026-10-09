/**
 * Shared SVG limits and value grammars. Renderer filtering and provider rejection
 * retain their own allowlists and compatibility differences (including clip-rule).
 * Centralizing their common predicates removes duplicate validation tables.
 */

/**
 * Hard bounds applied to any icon node tree, whether it came from the built-in
 * set, a consumer-built registry, or an Iconify response.
 */
export const MAX_BODY_LENGTH = 65_536
export const MAX_NODE_COUNT = 512
export const MAX_TREE_DEPTH = 16
export const MAX_ATTRIBUTE_COUNT = 32
export const MAX_ATTRIBUTE_LENGTH = 32_768
/** Transform lists are tiny in practice; bound them far tighter than text. */
export const MAX_TRANSFORM_LENGTH = 512

/** Geometry-only elements: always safe as a node or as a container's child. */
export const SHAPE_TAGS = /* @__PURE__ */ new Set([
  'circle',
  'ellipse',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
])

/** Containers whose `id` may be referenced by `url(#id)` attributes. */
export const DEFINITION_TAGS = /* @__PURE__ */ new Set([
  'clipPath',
  'linearGradient',
  'mask',
  'radialGradient',
])
/** The subset of {@link DEFINITION_TAGS} usable as a `fill`/`stroke` paint. */
export const GRADIENT_TAGS = /* @__PURE__ */ new Set(['linearGradient', 'radialGradient'])

/** An XML/attribute name — also the first step of the provider's scanner. */
export const XML_NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*/
/** `aria-*` / `data-*` attributes are passed through on both node + root. */
export const SAFE_EXTENSION_ATTR = /^(?:aria|data)-[A-Za-z0-9_.:-]+$/

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?%?$/
const NUMBER_LIST = /^[\s,+\-.\deE]+$/
const PATH_DATA = /^[\s,+\-.\deEMmZzLlHhVvCcSsQqTtAa]+$/
const TRANSFORM = /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\s*\(\s*[+\-.\deE,\s]+\)\s*)+$/
const SAFE_ID = /^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/
/** `url(#id)` — same-document only; an external reference is rejected. */
export const LOCAL_REFERENCE = /^url\(#([A-Za-z_][A-Za-z0-9_.:-]{0,127})\)$/
const SAFE_PAINT = /* @__PURE__ */ new Set([
  'aqua',
  'black',
  'blue',
  'brown',
  'currentcolor',
  'cyan',
  'fuchsia',
  'gray',
  'green',
  'grey',
  'lime',
  'magenta',
  'maroon',
  'navy',
  'none',
  'olive',
  'orange',
  'purple',
  'red',
  'silver',
  'teal',
  'transparent',
  'white',
  'yellow',
])

export function isNumberValue(value: string): boolean {
  return NUMBER.test(value)
}

export function isSafeColor(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    SAFE_PAINT.has(normalized) ||
    /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(normalized) ||
    /^(?:rgb|rgba|hsl|hsla)\([\d\s,.%+\-/]+\)$/i.test(normalized)
  )
}

/** A paint value: a known keyword/hex/functional color, or a local `url(#id)`. */
export function isSafePaint(value: string): boolean {
  return isSafeColor(value) || LOCAL_REFERENCE.test(value)
}

/** `points` / `stroke-dasharray`: a plain number list, or `none`. */
export function isSafeNumberList(value: string): boolean {
  return value === 'none' || (value.length <= MAX_ATTRIBUTE_LENGTH && NUMBER_LIST.test(value))
}

/** `clip-path` / `mask`: `none`, or a same-document `url(#id)`. */
export function isSafeLocalReference(value: string): boolean {
  return value === 'none' || LOCAL_REFERENCE.test(value)
}

/** The `*Units` attribute family shared by gradients, masks and clip paths. */
export function isSafeCoordinateUnits(value: string): boolean {
  return value === 'objectBoundingBox' || value === 'userSpaceOnUse'
}

const isTransform = (value: string): boolean =>
  value.length <= MAX_TRANSFORM_LENGTH && TRANSFORM.test(value)
const isFillRule = (value: string): boolean => value === 'nonzero' || value === 'evenodd'

/**
 * Value grammar per attribute name, shared by the renderer sanitizer and the
 * Iconify provider. An attribute absent from this table is validated by the
 * consumer: the renderer also permits allowlisted metadata, while the provider
 * requires a numeric value after applying its stricter per-tag allowlist.
 */
export const ATTRIBUTE_VALUE_VALIDATORS: Record<string, (value: string) => boolean> = {
  'clip-path': isSafeLocalReference,
  'clip-rule': isFillRule,
  'fill-rule': isFillRule,
  mask: isSafeLocalReference,
  'mask-type': (value) => value === 'alpha' || value === 'luminance',
  maskContentUnits: isSafeCoordinateUnits,
  maskUnits: isSafeCoordinateUnits,
  clipPathUnits: isSafeCoordinateUnits,
  gradientUnits: isSafeCoordinateUnits,
  gradientTransform: isTransform,
  id: (value) => SAFE_ID.test(value),
  d: (value) => value.length <= MAX_ATTRIBUTE_LENGTH && PATH_DATA.test(value),
  points: isSafeNumberList,
  'stop-color': isSafeColor,
  'stroke-linecap': (value) => value === 'butt' || value === 'round' || value === 'square',
  'stroke-linejoin': (value) =>
    value === 'miter' || value === 'round' || value === 'bevel' || value === 'miter-clip',
  'stroke-dasharray': isSafeNumberList,
  spreadMethod: (value) => value === 'pad' || value === 'reflect' || value === 'repeat',
  transform: isTransform,
  'vector-effect': (value) => value === 'none' || value === 'non-scaling-stroke',
  fill: isSafePaint,
  stroke: isSafePaint,
}
