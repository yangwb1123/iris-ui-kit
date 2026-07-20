import type { Codemod } from './types.js'

// Matches `tone: 'error'` / `tone: "error"` / `variant: 'error'` / `variant: "error"`
// (any amount of whitespace around the colon, either quote style). Scoped to
// the exact `key: 'error'` object-literal-property shape used by
// `notify({ tone: 'error' })` and `pushToast({ variant: 'error' })` call
// sites — the real shape this rename actually took (see commit 163f9e2).
const TONE_ERROR = /(\btone\s*:\s*)(['"])error\2/g
const VARIANT_ERROR = /(\bvariant\s*:\s*)(['"])error\2/g

/**
 * Example codemod: `NotificationTone` / `IrisToastVariant`'s `'error'` member
 * was renamed to `'danger'` (commit 163f9e2, docs/ROADMAP.md 2026-07-16
 * session entry — "Unified NotificationTone/ToastVariant on 'danger' (was
 * split 'error'/'danger' across core vs. Alert/Banner)"). That commit fixed
 * every call site inside packages/{core,react,vue,solid,svelte}, but a
 * downstream consumer's own code — e.g. calls to `notify({ tone: 'error' })`
 * or `pushToast({ variant: 'error' })` — would still need this rewrite after
 * upgrading. `useToast().error()` itself is unrenamed (it's an idiomatic
 * convenience method name, not a tone/variant value) and is intentionally
 * left untouched by this transform.
 *
 * Idempotent: once `'error'` becomes `'danger'` neither pattern matches
 * again, so a second run is a no-op.
 */
export const toastErrorToDanger: Codemod = {
  name: 'toast-error-to-danger',
  description:
    "Rename the removed NotificationTone/ToastVariant 'error' member to 'danger' (tone/variant object props only)",
  transform(source) {
    return source.replace(TONE_ERROR, '$1$2danger$2').replace(VARIANT_ERROR, '$1$2danger$2')
  },
}
