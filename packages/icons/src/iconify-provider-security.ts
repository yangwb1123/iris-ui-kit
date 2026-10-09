import { iconifyFail as fail } from './iconify-provider-errors'
import { ATTRIBUTE_VALUE_VALIDATORS, isNumberValue } from './svg-safety'

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

/**
 * `clip-rule` is allowlisted for shapes but the provider has never accepted a
 * textual fill rule here — it falls through to the numeric check. Keep that
 * asymmetry explicit instead of inheriting the renderer's fill-rule predicate.
 */
function isValidAttributeValue(name: string, value: string): boolean {
  if (name === 'clip-rule') return isNumberValue(value)
  return ATTRIBUTE_VALUE_VALIDATORS[name]?.(value) ?? isNumberValue(value)
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
