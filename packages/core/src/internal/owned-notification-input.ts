/** PRIVATE D1–D3 pilot admission. No general graph engine or public entry. */
import {
  DEFAULT_NOTIFICATION_TIMEOUT,
  type DesktopNotification,
  type NotificationTone,
} from '../notifications'

export const OWNED_NOTIFICATION_LIMITS = Object.freeze({
  nodes: 100_000,
  depth: 32,
  keys: 256,
  elements: 10_000,
  keyText: 256,
  stringText: 65_536,
  totalText: 1_048_576,
})
type Scalar = null | undefined | boolean | number | string
type Fields = Record<string, Scalar>
export interface AdmittedNotification {
  readonly record: Readonly<DesktopNotification>
  readonly text: number
}
const fields = ['id', 'title', 'body', 'icon', 'appId', 'tone', 'timeout'] as const
// Exhaustive key/value identity: both a misspelled tone and a missing union member fail tsc.
const tones = Object.values({
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} satisfies { [Tone in NotificationTone]: Tone })

export function refuse(code: string, path = '$'): never {
  throw new TypeError(`Owned notification ${code} at ${path.slice(0, 256)}`)
}

export function appendOwn<T>(array: T[], value: T): void {
  Object.defineProperty(array, String(array.length), {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  })
}

class AdmissionBudget {
  nodes = 0
  text = 0
  node(path: string): void {
    if (++this.nodes > OWNED_NOTIFICATION_LIMITS.nodes) refuse('NODE_LIMIT', path)
  }
  string(value: string, key: boolean, path: string): void {
    const limit = key ? OWNED_NOTIFICATION_LIMITS.keyText : OWNED_NOTIFICATION_LIMITS.stringText
    this.text += value.length
    if (value.length > limit || this.text > OWNED_NOTIFICATION_LIMITS.totalText)
      refuse('TEXT_LIMIT', path)
  }
  leaf(value: unknown, path: string): Scalar {
    this.node(path)
    if (typeof value === 'string') this.string(value, false, path)
    else if (typeof value === 'number') {
      if (!Number.isFinite(value)) refuse('FINITE_NUMBER', path)
    } else if (value !== null && value !== undefined && typeof value !== 'boolean')
      refuse('SCALAR', path)
    return value as Scalar
  }
}

function dataValue(input: object, key: string, path: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(input, key)
  if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
    refuse('DATA_PROPERTY', path)
  return descriptor.value
}

function captureRecord(
  input: unknown,
  budget: AdmissionBudget,
  path: string,
  imported: boolean,
): Fields {
  if (!input || typeof input !== 'object' || Array.isArray(input)) refuse('RECORD', path)
  const prototype = Object.getPrototypeOf(input)
  if (prototype !== Object.prototype && prototype !== null) refuse('PROTOTYPE', path)
  const keys = Reflect.ownKeys(input)
  if (keys.length > OWNED_NOTIFICATION_LIMITS.keys) refuse('KEY_LIMIT', path)
  budget.node(path)
  const captured: Fields = Object.create(null)
  for (const key of keys) {
    if (typeof key !== 'string') refuse('STRING_KEY', path)
    budget.string(key, true, path)
    if (!fields.some((field) => field === key) || (!imported && key === 'id')) refuse('FIELD', path)
    captured[key] = budget.leaf(dataValue(input, key, path), `${path}.${key}`)
  }
  return captured
}

function requiredString(value: Scalar, path: string, nonempty = false): string {
  if (typeof value !== 'string' || (nonempty && value.length === 0)) refuse('STRING', path)
  return value
}

function optionalString(value: Scalar, path: string): string | undefined {
  return value === undefined ? undefined : requiredString(value, path)
}

function normalize(
  data: Fields,
  id: string,
  imported: boolean,
  path: string,
): AdmittedNotification {
  const tone = tones.find((candidate) => candidate === data.tone)
  const validTimeout = typeof data.timeout === 'number' && data.timeout >= 0
  if (imported && (tone === undefined || !validTimeout)) refuse('NORMALIZED_RECORD', path)
  const record: DesktopNotification = {
    id: requiredString(id, `${path}.id`, true),
    title: requiredString(data.title, `${path}.title`),
    body: optionalString(data.body, `${path}.body`),
    icon: optionalString(data.icon, `${path}.icon`),
    appId: optionalString(data.appId, `${path}.appId`),
    tone: tone ?? 'info',
    timeout: validTimeout ? (data.timeout as number) : DEFAULT_NOTIFICATION_TIMEOUT,
  }
  // Include generated IDs, optional/defaulted fields and their keys in exported-state costs.
  const budget = new AdmissionBudget()
  budget.node(path)
  for (const key of fields) {
    budget.string(key, true, path)
    budget.leaf(record[key], `${path}.${key}`)
  }
  return { record: Object.freeze(record), text: budget.text }
}

export function admitPost(input: unknown, generate: () => string): AdmittedNotification {
  const data = captureRecord(input, new AdmissionBudget(), '$', false)
  return normalize(data, generate(), false, '$')
}

function captureArray(input: unknown): { array: object; length: number } {
  if (!Array.isArray(input)) refuse('ARRAY')
  if (Object.getPrototypeOf(input) !== Array.prototype) refuse('ARRAY_PROTOTYPE')
  const keys = Reflect.ownKeys(input)
  const descriptor = Object.getOwnPropertyDescriptor(input, 'length')
  const length: unknown = descriptor?.value
  if (
    typeof length !== 'number' ||
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > OWNED_NOTIFICATION_LIMITS.elements
  )
    refuse('ARRAY_LIMIT')
  if (
    keys.length !== length + 1 ||
    keys.some(
      (key) =>
        key !== 'length' &&
        (typeof key !== 'string' ||
          key.length > OWNED_NOTIFICATION_LIMITS.keyText ||
          !/^(0|[1-9]\d*)$/.test(key) ||
          Number(key) >= length),
    )
  )
    refuse('DENSE_ARRAY')
  return { array: input, length }
}

export function admitImport(input: unknown): AdmittedNotification[] {
  const { array, length } = captureArray(input)
  const budget = new AdmissionBudget()
  budget.node('$')
  budget.node('$.length')
  budget.string('length', true, '$')
  const seen = new WeakSet<object>()
  const ids = new Set<string>()
  const result: AdmittedNotification[] = []
  for (let index = 0; index < length; index++) {
    const key = String(index),
      path = `$[${key}]`
    budget.string(key, true, path)
    const value = dataValue(array, key, path)
    if (value && typeof value === 'object') {
      if (seen.has(value)) refuse('ALIAS', path)
      seen.add(value)
    }
    const captured = captureRecord(value, budget, path, true)
    const item = normalize(captured, requiredString(captured.id, `${path}.id`, true), true, path)
    if (ids.has(item.record.id)) refuse('DUPLICATE_ID', path)
    ids.add(item.record.id)
    appendOwn(result, item)
  }
  return result
}
