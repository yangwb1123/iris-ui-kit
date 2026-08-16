/**
 * `detectAutoLink` — a pure, framework-agnostic cell auto-link detector
 * (batch CA, iris 独有 — vxe has no URL/email auto-detection; its cells are
 * plain text unless a `link` column is configured manually).
 *
 * Given the DISPLAY text of a cell (mask → formatter ?? raw chain, resolved
 * by the adapter before calling), returns the same string when the WHOLE
 * text is a detectable hyperlink, or `null` otherwise — so adapters can
 * decide "render an anchor or fall through to the plain formatter/raw
 * branch".
 *
 * Detection is deliberately whole-text anchored with no embedding or
 * punctuation stripping (fiat): both patterns are anchored with `^...$`, so
 * a URL embedded mid-sentence (`Visit https://example.com now`) is NOT a
 * match, and trailing punctuation (`https://example.com.`) IS part of the
 * link. Only `http`/`https` schemes qualify (no `ftp://`, no `www.` prefix).
 *
 * The email pattern is byte-identical to `mask.ts`'s `EMAIL_RE` (a
 * `local@domain.tld` shape), keeping the two link/redaction recognizers
 * consistent. `detectAutoLink` never throws — non-matching input (including
 * any non-string call, guarded by the adapter's `typeof` check) yields
 * `null`.
 */

/** URL regex — full-text anchored `http(s)://` link, any non-space tail. */
const URL_RE = /^https?:\/\/\S+$/i

/** Email regex — byte-identical to `mask.ts`'s `EMAIL_RE` (line 11). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Detect whether `text` is a whole-string hyperlink. Returns `text` itself
 * when it matches the URL or email pattern, `null` otherwise.
 */
export function detectAutoLink(text: string): string | null {
  if (text === '') return null
  if (URL_RE.test(text)) return text
  if (EMAIL_RE.test(text)) return text
  return null
}
