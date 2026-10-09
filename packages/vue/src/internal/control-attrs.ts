import { normalizeStyle, type CSSProperties } from 'vue'

/** Vue StyleValue can be a string, object or array; normalize before merging. */
export function normalizeHostStyle(style: unknown): CSSProperties {
  return (normalizeStyle([style]) ?? {}) as CSSProperties
}

/** ARIA names belong on the native control; host styling stays on the host. */
export function splitControlAttrs(attrs: Record<string, unknown>): {
  aria: Record<string, unknown>
  host: Record<string, unknown>
} {
  const aria: Record<string, unknown> = {}
  const host: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('aria-')) aria[key] = value
    else host[key] = key === 'style' ? normalizeHostStyle(value) : value
  }
  return { aria, host }
}
