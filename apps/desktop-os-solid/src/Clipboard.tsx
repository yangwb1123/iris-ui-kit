import { For, Show, createSignal, type JSX } from 'solid-js'
import { IrisButton } from '@iris-ui-kit/solid'
import { useClipboard, useClipboardState } from './clipboard-context'

/** Write to the real system clipboard (best-effort; demo tolerates failure). */
async function writeSystemClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard?.writeText(text)
  } catch {
    /* clipboard API unavailable / denied — history still records it */
  }
}

/**
 * Clipboard — a desktop CLIPBOARD MANAGER (Win+V / macOS clipboard-manager feel)
 * over `@iris-ui-kit/core/clipboard-history`. Records copied text, lets you re-copy a
 * past clip (writes the real system clipboard), pin clips so they survive Clear,
 * and remove individual entries. This is what makes the `clipboard` permission the
 * app requests actually do something. Mirrors the React desktop, here on Solid.
 */
export function ClipboardApp(): JSX.Element {
  const clip = useClipboard()
  const state = useClipboardState()
  const [draft, setDraft] = createSignal('')

  const copy = async (text: string): Promise<void> => {
    await writeSystemClipboard(text)
    clip.add(text) // move-to-front / record
  }

  const submit = async (): Promise<void> => {
    const t = draft().trim()
    if (!t) return
    setDraft('')
    await copy(t)
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
      <div style={{ padding: '16px', 'border-bottom': '1px solid rgba(127,127,127,0.2)' }}>
        <div style={{ 'font-weight': 600, 'font-size': '14px' }}>
          📋 Clipboard history ({state().entries.length})
        </div>
        <div style={{ 'font-size': '12px', opacity: 0.7, 'margin-top': '4px', 'line-height': 1.5 }}>
          Recent clips. Click one to copy it again; ★ pins it (survives Clear).
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          display: 'grid',
          gap: '8px',
          'align-content': 'start',
        }}
      >
        <For each={state().entries}>
          {(e) => (
            <div
              style={{
                display: 'flex',
                'align-items': 'center',
                gap: '8px',
                padding: '8px 12px',
                'border-radius': '10px',
                background: 'rgba(127,127,127,0.1)',
              }}
            >
              <button
                type="button"
                onClick={() => void copy(e.text)}
                title="Copy again"
                style={{
                  flex: 1,
                  'min-width': 0,
                  'text-align': 'left',
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  font: '13px var(--os-font)',
                  'white-space': 'nowrap',
                  overflow: 'hidden',
                  'text-overflow': 'ellipsis',
                }}
              >
                {e.text}
              </button>
              <button
                type="button"
                aria-label={e.pinned ? 'Unpin' : 'Pin'}
                aria-pressed={e.pinned}
                onClick={() => clip.togglePin(e.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  'font-size': '13px',
                  opacity: e.pinned ? 1 : 0.4,
                  color: e.pinned ? 'var(--os-accent)' : 'inherit',
                }}
              >
                ★
              </button>
              <button
                type="button"
                aria-label="Remove"
                onClick={() => clip.remove(e.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  opacity: 0.5,
                  'font-size': '13px',
                }}
              >
                ✕
              </button>
            </div>
          )}
        </For>
        <Show when={state().entries.length === 0}>
          <div style={{ 'font-size': '13px', opacity: 0.6 }}>
            Nothing copied yet — type below and Copy, or copy from another app.
          </div>
        </Show>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        style={{
          display: 'flex',
          gap: '8px',
          padding: '12px',
          'border-top': '1px solid rgba(127,127,127,0.2)',
        }}
      >
        <input
          value={draft()}
          onInput={(e) => setDraft(e.currentTarget.value)}
          placeholder="Text to copy…"
          style={{
            flex: 1,
            padding: '9px 14px',
            'border-radius': '999px',
            border: '1px solid rgba(127,127,127,0.35)',
            background: 'rgba(255,255,255,0.5)',
            color: 'inherit',
            outline: 'none',
            'font-size': '14px',
          }}
        />
        <IrisButton type="submit" variant="solid">
          Copy
        </IrisButton>
        <IrisButton type="button" variant="outline" onClick={() => clip.clear()}>
          Clear
        </IrisButton>
      </form>
    </div>
  )
}
