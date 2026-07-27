/**
 * Tiny field-PATH model (v3 R19) — the nested-path engine that lets the form
 * key errors / touched / dirty / validating by a FULL path (`address.city`,
 * `items[2].sku`) instead of only a flat top-level key. A bare top-level key is
 * just a 1-segment path, so every flat-key API stays 100% back-compatible.
 *
 * A path is either a string (`'a.b[2].c'`) or an already-parsed segment array
 * (`['a', 'b', 2, 'c']`). String segments index objects; number segments index
 * arrays. The string form is the CANONICAL key under which per-field state is
 * stored (so `formatPath(parsePath(key)) === key` for any flat or dotted key).
 *
 * ## Security & Validation
 *
 * `parsePath` validates input in development mode — malformed paths (unclosed
 * brackets, empty segments, null bytes, reserved prototype keys) throw a
 * `PathError` to catch bugs early.  In production, the function gracefully
 * truncates / recovers and emits a `console.warn`. Use {@link escapePathSegment}
 * to safely encode field names that contain dots or brackets, and
 * {@link isPathSafe} to check before parsing user-supplied path strings.
 *
 * ## Prototype Pollution Prevention
 *
 * `parsePath` rejects path segments that could enable prototype pollution via
 * `__proto__`, `constructor`, or `prototype` **in nested context** (i.e. not
 * the first segment).  Top-level `parsePath('constructor')` is allowed — it
 * addresses a legitimate top-level property.  Use the `allowReserved` option
 * or the segment-array form of {@link Path} to bypass the check when needed.
 *
 * @see isKeyReserved Check whether a segment key is a reserved prototype key.
 */

export type PathSegment = string | number
export type Path = string | readonly PathSegment[]

/**
 * Reserved JavaScript keys that, when used as nested path segments, can enable
 * prototype pollution via `__proto__`, `constructor`, or `prototype`.
 */
const RESERVED_PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Check whether `key` is a reserved prototype-key that could enable
 * prototype pollution when used as a nested path segment.
 *
 * Pass `{ allowReserved: true }` to {@link parsePath} to bypass the check.
 *
 * @example
 * ```ts
 * isKeyReserved('__proto__')    // => true
 * isKeyReserved('constructor')  // => true
 * isKeyReserved('prototype')    // => true
 * isKeyReserved('name')         // => false
 * ```
 */
export function isKeyReserved(key: string): boolean {
  return RESERVED_PROTOTYPE_KEYS.has(key)
}

/**
 * Error thrown by {@link parsePath} when the input is malformed in development
 * mode. In production, parsePath recovers gracefully and warns via console.
 */
export class PathError extends Error {
  /**
   * @param message Human-readable error description.
   * @param input The original malformed path string.
   */
  constructor(
    message: string,
    readonly input: string,
  ) {
    super(message)
    this.name = 'PathError'
  }
}

/** Report a path error in dev mode (throw) or prod mode (console.warn + return fallback). */
function pathError(message: string, input: string, fallback: PathSegment[]): PathSegment[] {
  if (process.env.NODE_ENV === 'development') {
    throw new PathError(message, input)
  }
  console.warn('[iris-ui] ' + message + ' (path: "' + input + '")')
  return fallback
}

/** Validate the input string has no null bytes and balanced brackets. */
function validatePathSafety(str: string, segments: PathSegment[]): PathSegment[] | null {
  if (str.includes('\0')) {
    return pathError('parsePath: null byte (\\x00) in path string is not allowed', str, segments)
  }
  let depth = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '[') depth++
    else if (str[i] === ']') depth--
    if (depth < 0) {
      return pathError(
        'parsePath: unexpected closing bracket "]" without opening "["',
        str,
        segments,
      )
    }
  }
  if (depth > 0) {
    return pathError('parsePath: unclosed bracket — missing "]"', str, segments)
  }
  return null
}

/** Parse the regex loop: extract segments from a validated path string. */
function parseSegments(str: string): PathSegment[] {
  const segments: PathSegment[] = []
  const re = /\[([^\]]*)\]|[^.[\]]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(str)) !== null) {
    if (m[1] !== undefined) {
      // Bracket segment
      const inner = m[1]
      if (inner === '') {
        return pathError('parsePath: empty bracket "[]" is not allowed', str, segments)
      }
      const unquoted = inner.replace(/^['"]|['"]$/g, '')
      if (unquoted === inner && /^\d+$/.test(inner)) segments.push(Number(inner))
      else segments.push(unquoted)
    } else {
      const seg = m[0]
      if (seg === '') {
        return pathError(
          'parsePath: empty segment from consecutive dots ".." is not allowed',
          str,
          segments,
        )
      }
      segments.push(/^\d+$/.test(seg) ? Number(seg) : seg)
    }
  }
  return segments
}

/**
 * Parse a path string into segments. Accepts dotted keys (`a.b`), bracket
 * indices (`a[0]`), and bracket keys (`a['b']`, `a["b c"]`). A flat key like
 * `email` parses to `['email']`.
 *
 * When `options.allowReserved` is `true`, the reserved-key check
 * ({@link isKeyReserved}) is bypassed.
 *
 * @throws {PathError} In development mode when the input is malformed (unclosed
 *   brackets, empty segments after split, null bytes, reserved prototype keys
 *   in nested context, etc.). In production, malformed input produces a
 *   best-effort parse with a console.warn.
 */
export function parsePath(path: Path, options?: { allowReserved?: boolean }): PathSegment[] {
  if (Array.isArray(path)) return [...path]
  const str = path as string
  if (str === '') return []

  const safety = validatePathSafety(str, [])
  if (safety) return safety

  const segments = parseSegments(str)

  // Prototype pollution key check (skip when options.allowReserved is true).
  if (!options?.allowReserved) {
    const checked = validateReservedKeys(segments, str)
    if (checked !== segments) return checked
  }

  return segments
}

/**
 * Validate that no segment in the path is a reserved prototype key in a
 * dangerous context. Returns filtered segments in prod mode, or throws in dev.
 *
 * - `__proto__` is rejected at ANY level (even top-level: `obj.__proto__` is
 *   direct prototype pollution).
 * - `constructor` and `prototype` are rejected only in NESTED context
 *   (segment index > 0), because top-level `obj.constructor` is a legitimate
 *   property access.
 */
function validateReservedKeys(segments: PathSegment[], input: string): PathSegment[] {
  let found = false

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (typeof seg !== 'string' || !isKeyReserved(seg)) continue

    // __proto__ is always dangerous, even at top level.
    if (seg === '__proto__') {
      found = true
      break
    }

    // constructor / prototype: dangerous only in nested context.
    if (i > 0) {
      found = true
      break
    }
  }

  if (!found) return segments

  const msg = 'parsePath: path contains reserved key(s) that could enable prototype pollution'
  if (process.env.NODE_ENV === 'development') {
    throw new PathError(msg, input)
  }
  console.warn('[iris-ui] ' + msg + ' — reserved keys removed (path: "' + input + '")')

  // In production, filter out the reserved keys for safety.
  return segments.filter((seg, i) => {
    if (typeof seg !== 'string' || !isKeyReserved(seg)) return true
    if (seg === '__proto__') return false
    if (i > 0) return false
    return true
  })
}

/** Format segments back into the canonical string key (`['a',2,'b'] → 'a[2].b'`). */
export function formatPath(path: Path): string {
  const segments = Array.isArray(path) ? path : parsePath(path as string)
  let out = ''
  for (const seg of segments) {
    if (typeof seg === 'number') out += `[${seg}]`
    else out += out === '' ? seg : `.${seg}`
  }
  return out
}

/** Read the value at `path` from `obj`, or `undefined` if any segment is missing. */
export function getByPath(obj: unknown, path: Path): unknown {
  const segments = Array.isArray(path) ? path : parsePath(path as string)
  let cur: unknown = obj
  for (const seg of segments) {
    if (cur == null) return undefined
    cur = (cur as Record<PathSegment, unknown>)[seg]
  }
  return cur
}

const isIndex = (seg: PathSegment): boolean => typeof seg === 'number'

/** Shallow-clone a container, preserving array-ness (so set on an index keeps an array). */
function cloneContainer(node: unknown, nextSeg: PathSegment): Record<PathSegment, unknown> {
  if (Array.isArray(node)) return [...node] as unknown as Record<PathSegment, unknown>
  if (node != null && typeof node === 'object') return { ...(node as Record<PathSegment, unknown>) }
  // Missing/primitive: create the right container for the NEXT segment.
  return (isIndex(nextSeg) ? [] : {}) as Record<PathSegment, unknown>
}

/**
 * Return a copy of `obj` with the value at `path` set to `value`, cloning ONLY
 * the containers along the touched path (structural sharing — siblings keep
 * their reference identity, so a keystroke clones a spine, not the whole tree).
 */
export function setByPath<T>(obj: T, path: Path, value: unknown): T {
  const segments = Array.isArray(path) ? path : parsePath(path as string)
  if (segments.length === 0) return value as T
  const root = cloneContainer(obj, segments[0]!)
  let cur = root
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!
    const child = cloneContainer(cur[seg], segments[i + 1]!)
    cur[seg] = child
    cur = child
  }
  cur[segments[segments.length - 1]!] = value
  return root as T
}

/**
 * Return a copy of `obj` with the value at `path` removed (delete a key, or
 * splice out an array index), cloning only along the touched path. A no-op copy
 * when the parent is missing.
 */
export function deleteByPath<T>(obj: T, path: Path): T {
  const segments = Array.isArray(path) ? path : parsePath(path as string)
  if (segments.length === 0) return obj
  const parentSegs = segments.slice(0, -1)
  const last = segments[segments.length - 1]!
  const parent = getByPath(obj, parentSegs)
  if (parent == null || typeof parent !== 'object') return obj
  let nextParent: unknown
  if (Array.isArray(parent)) {
    if (typeof last !== 'number' || last < 0 || last >= parent.length) return obj
    const arr = [...parent]
    arr.splice(last, 1)
    nextParent = arr
  } else {
    if (!(last in (parent as object))) return obj
    const rec = { ...(parent as Record<PathSegment, unknown>) }
    delete rec[last]
    nextParent = rec
  }
  return parentSegs.length === 0 ? (nextParent as T) : setByPath(obj, parentSegs, nextParent)
}

/**
 * Escape a field name so it is treated as a literal path segment, not split
 * on dots or brackets. Wraps the name in bracket-notation with single quotes,
 * which {@link parsePath} interprets as a single string segment.
 *
 * **Note**: Field names containing `[` or `]` cannot be round-tripped through
 * the bracket-quoted form because those characters are path syntax. For such
 * names, use the segment-array form of {@link Path} directly, or escape the
 * brackets via a custom encoding before wrapping.
 *
 * Example:
 * ```
 * escapePathSegment('video.url')   // => `['video.url']`
 * escapePathSegment('name')        // => `['name']`
 * escapePathSegment("it's")        // => `['it's']`  (single quotes are safe inside brackets)
 * ```
 */
export function escapePathSegment(seg: string): string {
  // No escaping needed: bracket-quoted form already handles any character
  // except `]` inside the quoted string. For field names containing `]`,
  // use the segment-array form directly.
  return `['${seg}']`
}

/**
 * Check whether a path string is safe to parse — no null bytes, no unclosed
 * brackets, no consecutive dots producing empty segments, and no reserved
 * prototype keys ({@link isKeyReserved}) in dangerous context.
 *
 * Use this before calling {@link parsePath} on user-supplied path strings.
 */
export function isPathSafe(path: string): boolean {
  if (path.includes('\0')) return false
  // Check for unclosed brackets
  let depth = 0
  for (let i = 0; i < path.length; i++) {
    if (path[i] === '[') depth++
    else if (path[i] === ']') depth--
    if (depth < 0) return false
  }
  if (depth !== 0) return false
  // Check for consecutive dots (empty segment)
  if (/\.\./.test(path)) return false
  // Check for empty brackets
  if (/\[\s*\]/.test(path)) return false
  // Check for reserved prototype keys — parse with allowReserved to avoid
  // throwing, then manually validate.
  const segments = parsePath(path, { allowReserved: true })
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (typeof seg !== 'string' || !isKeyReserved(seg)) continue
    if (seg === '__proto__') return false
    if (i > 0) return false
  }
  return true
}

/**
 * Re-key a per-field flat map (errors / touched / dirty / validating) when an
 * array field at `prefix` is mutated, so per-element state tracks its element
 * across insert / remove / move / swap. Keys NOT under `prefix[i]…` pass through
 * untouched; keys under it have their FIRST index segment remapped by `remap`
 * (a remap returning `null` drops that key — e.g. the removed row).
 *
 * `prefix` is the canonical array path (`'items'`, `'a.b'`); the remap takes the
 * 0-based element index and returns its new index, or `null` to drop it.
 */
export function rekeyByArrayMutation<T>(
  map: Record<string, T>,
  prefix: string,
  remap: (index: number) => number | null,
): Record<string, T> {
  const prefixSegs = parsePath(prefix)
  const out: Record<string, T> = {}
  for (const key of Object.keys(map)) {
    const segs = parsePath(key)
    // Does this key live under `prefix[<index>]…`?
    const under =
      segs.length > prefixSegs.length &&
      prefixSegs.every((p, i) => p === segs[i]) &&
      typeof segs[prefixSegs.length] === 'number'
    if (!under) {
      out[key] = map[key]!
      continue
    }
    const idx = segs[prefixSegs.length] as number
    const nextIdx = remap(idx)
    if (nextIdx == null) continue // dropped (e.g. the removed element)
    const nextSegs = [...segs]
    nextSegs[prefixSegs.length] = nextIdx
    out[formatPath(nextSegs)] = map[key]!
  }
  return out
}
