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
 */

export type PathSegment = string | number
export type Path = string | readonly PathSegment[]

/**
 * Parse a path string into segments. Accepts dotted keys (`a.b`), bracket
 * indices (`a[0]`), and bracket keys (`a['b']`, `a["b c"]`). A flat key like
 * `email` parses to `['email']`.
 */
export function parsePath(path: Path): PathSegment[] {
  if (Array.isArray(path)) return [...path]
  const str = path as string
  if (str === '') return []
  const segments: PathSegment[] = []
  // Match either `[...]` brackets (numeric index or quoted/raw key) or a dotted
  // identifier run (anything up to the next `.` or `[`).
  const re = /\[([^\]]*)\]|[^.[\]]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(str)) !== null) {
    if (m[1] !== undefined) {
      // Bracket segment: a bare integer is an array index; a quoted string is a key.
      const inner = m[1]
      const unquoted = inner.replace(/^['"]|['"]$/g, '')
      if (unquoted === inner && /^\d+$/.test(inner)) segments.push(Number(inner))
      else segments.push(unquoted)
    } else {
      const seg = m[0]
      segments.push(/^\d+$/.test(seg) ? Number(seg) : seg)
    }
  }
  return segments
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
