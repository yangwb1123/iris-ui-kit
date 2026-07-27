import * as React from 'react'
import { IrisButton } from '@iris-ui-kit/react'
import { useClipboard, useClipboardState } from '../shell'

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
 * app requests actually do something.
 */
export function ClipboardApp() {
  const clip = useClipboard()
  const { entries } = useClipboardState()
  const [draft, setDraft] = React.useState('')

  const copy = async (text: string) => {
    await writeSystemClipboard(text)
    clip.add(text) // move-to-front / record
  }

  const submit = async () => {
    const t = draft.trim()
    if (!t) return
    setDraft('')
    await copy(t)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 16, borderBottom: '1px solid rgba(127,127,127,0.2)' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>📋 Clipboard history ({entries.length})</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4, lineHeight: 1.5 }}>
          Recent clips. Click one to copy it again; ★ pins it (survives Clear).
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          display: 'grid',
          gap: 8,
          alignContent: 'start',
        }}
      >
        {entries.map((e) => (
          <div
            key={e.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 10,
              background: 'rgba(127,127,127,0.1)',
            }}
          >
            <button
              type="button"
              onClick={() => void copy(e.text)}
              title="Copy again"
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                font: '13px var(--os-font)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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
                fontSize: 13,
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
                fontSize: 13,
              }}
            >
              ✕
            </button>
          </div>
        ))}
        {entries.length === 0 && (
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            Nothing copied yet — type below and Copy, or copy from another app.
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          borderTop: '1px solid rgba(127,127,127,0.2)',
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Text to copy…"
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: 999,
            border: '1px solid rgba(127,127,127,0.35)',
            background: 'rgba(255,255,255,0.5)',
            color: 'inherit',
            outline: 'none',
            fontSize: 14,
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
