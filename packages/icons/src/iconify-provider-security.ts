import { iconifyFail as fail } from './iconify-provider-errors'

export const MAX_BODY_LENGTH = 65_536
export const MAX_NODE_COUNT = 512
export const MAX_TREE_DEPTH = 16
export const MAX_ATTRIBUTE_COUNT = 32
export const MAX_ATTRIBUTE_LENGTH = 32_768

export const SHAPE_TAG_SET = new Set([
  'circle',
  'ellipse',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
])
const PRESENTATION_ATTRIBUTES = [
  'clip-rule',
  'fill',
  'fill-rule',
  'fill-opacity',
  'mask',
  'opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'stroke-width',
  'transform',
  'vector-effect',
  'clip-path',
] as const
const SAFE_SHAPE_ATTRIBUTES = new Set([
  ...PRESENTATION_ATTRIBUTES,
  'clip-rule',
  'cx',
  'cy',
  'd',
  'height',
  'pathLength',
  'points',
  'r',
  'rx',
  'ry',
  'width',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
])
const SAFE_ATTRIBUTES: Record<string, Set<string>> = {
  circle: SAFE_SHAPE_ATTRIBUTES,
  ellipse: SAFE_SHAPE_ATTRIBUTES,
  line: SAFE_SHAPE_ATTRIBUTES,
  path: SAFE_SHAPE_ATTRIBUTES,
  polygon: SAFE_SHAPE_ATTRIBUTES,
  polyline: SAFE_SHAPE_ATTRIBUTES,
  rect: SAFE_SHAPE_ATTRIBUTES,
  g: new Set(PRESENTATION_ATTRIBUTES),
  defs: new Set(),
  clipPath: new Set(['clipPathUnits', 'id', 'transform']),
  mask: new Set([
    ...PRESENTATION_ATTRIBUTES,
    'height',
    'id',
    'mask-type',
    'maskContentUnits',
    'maskUnits',
    'width',
    'x',
    'y',
  ]),
  linearGradient: new Set([
    'gradientTransform',
    'gradientUnits',
    'id',
    'spreadMethod',
    'x1',
    'x2',
    'y1',
    'y2',
  ]),
  radialGradient: new Set([
    'cx',
    'cy',
    'fr',
    'fx',
    'fy',
    'gradientTransform',
    'gradientUnits',
    'id',
    'r',
    'spreadMethod',
  ]),
  stop: new Set(['offset', 'stop-color', 'stop-opacity']),
}
export const DEFINITION_TAGS = new Set(['clipPath', 'linearGradient', 'mask', 'radialGradient'])
export const GRADIENT_TAGS = new Set(['linearGradient', 'radialGradient'])
export const XML_NAME = /^[A-Za-z_][A-Za-z0-9_.:-]*/
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?%?$/
const NUMBER_LIST = /^[\s,+\-.\deE]+$/
const PATH_DATA = /^[\s,+\-.\deEMmZzLlHhVvCcSsQqTtAa]+$/
const TRANSFORM = /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\s*\(\s*[+\-.\deE,\s]+\)\s*)+$/
export const LOCAL_REFERENCE = /^url\(#([A-Za-z_][A-Za-z0-9_.:-]{0,127})\)$/
const SAFE_ID = /^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/
const SAFE_PAINT = new Set([
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
function isValidXmlCharacter(codePoint: number): boolean {
  return (
    codePoint === 0x9 ||
    codePoint === 0xa ||
    codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    (codePoint >= 0x10000 && codePoint <= 0x10ffff)
  )
}

function decodeXmlEntity(token: string, iconName: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
  }
  if (Object.hasOwn(named, token)) return named[token]!

  const codePoint = token.startsWith('#x')
    ? Number.parseInt(token.slice(2), 16)
    : Number.parseInt(token.slice(1), 10)
  if (!isValidXmlCharacter(codePoint)) {
    return fail('unsafe-icon', `invalid XML character in Iconify icon "${iconName}"`)
  }
  return String.fromCodePoint(codePoint)
}

export function decodeXmlAttribute(value: string, iconName: string): string {
  const decoded = value.replace(
    /&(#x[\da-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g,
    (_entity, token: string) => decodeXmlEntity(token, iconName),
  )
  if (decoded.includes('&')) {
    return fail('unsafe-icon', `unsupported XML entity in Iconify icon "${iconName}"`)
  }
  return decoded
}

function isSafeColor(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    SAFE_PAINT.has(normalized) ||
    /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(normalized) ||
    /^(?:rgb|rgba|hsl|hsla)\([\d\s,.%+\-/]+\)$/i.test(normalized)
  )
}

function isSafePaint(value: string): boolean {
  return isSafeColor(value) || LOCAL_REFERENCE.test(value)
}

const ATTRIBUTE_VALIDATORS: Record<string, (value: string) => boolean> = {
  d: (value) => value.length <= MAX_ATTRIBUTE_LENGTH && PATH_DATA.test(value),
  points: isNumberList,
  'stroke-dasharray': isNumberList,
  transform: (value) => value.length <= 512 && TRANSFORM.test(value),
  gradientTransform: (value) => value.length <= 512 && TRANSFORM.test(value),
  fill: isSafePaint,
  stroke: isSafePaint,
  'clip-path': isLocalReferenceOrNone,
  mask: isLocalReferenceOrNone,
  id: (value) => SAFE_ID.test(value),
  gradientUnits: (value) => value === 'objectBoundingBox' || value === 'userSpaceOnUse',
  clipPathUnits: (value) => value === 'objectBoundingBox' || value === 'userSpaceOnUse',
  maskUnits: (value) => value === 'objectBoundingBox' || value === 'userSpaceOnUse',
  maskContentUnits: (value) => value === 'objectBoundingBox' || value === 'userSpaceOnUse',
  'mask-type': (value) => value === 'alpha' || value === 'luminance',
  spreadMethod: (value) => value === 'pad' || value === 'reflect' || value === 'repeat',
  'stop-color': isSafeColor,
  'fill-rule': (value) => value === 'nonzero' || value === 'evenodd',
  'stroke-linecap': (value) => ['butt', 'round', 'square'].includes(value),
  'stroke-linejoin': (value) => ['miter', 'round', 'bevel', 'miter-clip'].includes(value),
  'vector-effect': (value) => value === 'none' || value === 'non-scaling-stroke',
}

function isNumberList(value: string): boolean {
  return value === 'none' || (value.length <= MAX_ATTRIBUTE_LENGTH && NUMBER_LIST.test(value))
}

function isLocalReferenceOrNone(value: string): boolean {
  return value === 'none' || LOCAL_REFERENCE.test(value)
}

function isValidAttributeValue(name: string, value: string): boolean {
  return (ATTRIBUTE_VALIDATORS[name] ?? isNumberValue)(value)
}

function isNumberValue(value: string): boolean {
  return NUMBER.test(value)
}

export function validateAttribute(
  tag: string,
  name: string,
  value: string,
  iconName: string,
): void {
  if (!SAFE_ATTRIBUTES[tag]?.has(name)) {
    fail('unsafe-icon', `unsupported SVG attribute "${name}" in Iconify icon "${iconName}"`)
  }
  if (!isValidAttributeValue(name, value)) {
    fail('unsafe-icon', `invalid SVG value for "${name}" in Iconify icon "${iconName}"`)
  }
}
