/**
 * Value masking (batch AY, iris 独有 — vxe has no built-in masking).
 * Framework-agnostic display-time redaction for sensitive columns: the
 * adapter's display chain, export serializer and clipboard path apply it
 * BEFORE any formatter, while editing/validation keep reading the raw value.
 */

/** Built-in masking kinds. `'sensitive'` is the only kind today. */
export type MaskKind = 'sensitive'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\d{11}$/

/** Mask the middle of a string: ≥6 chars → first two + `****` + last two;
 * shorter → `'****'` wholesale (too short to keep an identifiable prefix). */
function maskCore(text: string): string {
  return text.length >= 6 ? `${text.slice(0, 2)}****${text.slice(-2)}` : '****'
}

/**
 * Mask a value for display. `null`/`undefined` → `''` (export parity: `toCsv`
 * renders null cells as empty fields). Non-strings are string-coerced FIRST,
 * then masked. `'sensitive'` precedence:
 *
 * 1. email (`local@domain`) — the local part is masked (generic rule), the
 *    domain is kept verbatim (the routing address stays usable);
 * 2. 11-digit phone (CN mobile) — `3****` + last 4;
 * 3. generic ≥6 chars — first 2 + `****` + last 2;
 * 4. shorter — `'****'` wholesale.
 *
 * Future kinds are additive: an unknown kind passes the value through
 * string-coerced (fail-open, never throws).
 */
export function maskValue(value: unknown, kind: MaskKind = 'sensitive'): string {
  const text = value == null ? '' : String(value)
  if (kind !== 'sensitive') return text
  if (text === '') return ''
  if (EMAIL_RE.test(text)) {
    const at = text.indexOf('@')
    return `${maskCore(text.slice(0, at))}${text.slice(at)}`
  }
  if (PHONE_RE.test(text)) return `${text.slice(0, 3)}****${text.slice(7)}`
  return maskCore(text)
}
