/**
 * `splitSearchHits` — a pure, framework-agnostic text-search hit splitter
 * (batch CK, iris 独有 — vxe has no inline search highlight; its cells are
 * plain text unless the find bar is open).
 *
 * Given the DISPLAY text of a cell and a query, splits the text into
 * alternating `[plain, hit, plain, hit, …]` segments so adapters can render
 * each occurrence with a `<mark data-iris-search-hit>` inline highlight.
 * Matching is a case-insensitive LITERAL substring (no regex
 * interpretation — metacharacters like `.`/`*`/`(` match themselves, fnr
 * parity) with a non-overlapping forward scan (fnr replace-all `gi`
 * parity — `'aaa'` + query `'aa'` = ONE hit, and adjacent hits stay
 * adjacent with an empty plain gap between them). Segments always
 * alternate starting with plain (an empty string when the text begins with
 * a hit), so adapters can mark odd indices unconditionally; empty segments
 * render as nothing.
 *
 * Returns `null` on an empty query / empty text / no match — the adapter
 * fast-path returns the original string byte-identical (the `detectAutoLink`
 * null contract). Never throws.
 */
export function splitSearchHits(text: string, query: string): string[] | null {
  if (text === '' || query === '') return null
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const out: string[] = []
  let cursor = 0
  let found = false
  for (;;) {
    const idx = lowerText.indexOf(lowerQuery, cursor)
    if (idx === -1) break
    found = true
    out.push(text.slice(cursor, idx))
    out.push(text.slice(idx, idx + query.length))
    cursor = idx + query.length
  }
  if (!found) return null
  out.push(text.slice(cursor))
  return out
}
