import { For, Show, createSignal, type JSX } from 'solid-js'
import { IrisButton } from '@iris-ui/solid'
import { normalizePath } from '@iris-ui/core/fs'
import { useFs, useFsState } from './fs-context'

/** Join a directory + child name into a normalized absolute path. */
const join = (dir: string, name: string): string => normalizePath(`${dir}/${name}`)

/** A non-colliding name in `taken` (appends " (n)"). */
function uniqueName(base: string, ext: string, taken: Set<string>): string {
  let name = `${base}${ext}`
  let n = 2
  while (taken.has(name)) name = `${base} (${n++})${ext}`
  return name
}

const iconBtn: JSX.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  opacity: 0.55,
  'font-size': '13px',
}

/**
 * Files — a real file MANAGER over `@iris-ui/core/fs` (the virtual file system).
 * Navigate folders, create folders + text files, edit/rename/delete, all persisted
 * to the user profile. This is what makes the `storage` permission it requests
 * actually do something (the old Files view was a static mock). Mirrors the React
 * desktop, here on Solid.
 */
export function FilesApp(): JSX.Element {
  const fs = useFs()
  const state = useFsState() // re-render on any fs change
  const [cwd, setCwd] = createSignal('/')
  const [editing, setEditing] = createSignal<string | null>(null)
  const [draft, setDraft] = createSignal('')
  const [renaming, setRenaming] = createSignal<string | null>(null)
  const [renameVal, setRenameVal] = createSignal('')

  // Reading `state()` keeps these listings reactive (recomputed on every fs change).
  const entries = (): ReturnType<typeof fs.list> => (state(), fs.list(cwd()))
  const names = (): Set<string> => new Set(entries().map((e) => e.name))
  const parent = (): string | null => {
    const d = cwd()
    return d === '/' ? null : normalizePath(d.slice(0, d.lastIndexOf('/')) || '/')
  }

  const openFile = (path: string): void => {
    setEditing(path)
    setDraft(fs.read(path) ?? '')
  }
  const save = (): void => {
    const path = editing()
    if (path) fs.write(path, draft())
    setEditing(null)
  }
  const newFolder = (): void => fs.mkdir(join(cwd(), uniqueName('New Folder', '', names())))
  const newFile = (): void => {
    const path = join(cwd(), uniqueName('Untitled', '.txt', names()))
    fs.write(path, '')
    openFile(path)
  }
  const commitRename = (from: string): void => {
    const to = join(cwd(), renameVal().trim())
    if (renameVal().trim() && to !== from) fs.rename(from, to)
    setRenaming(null)
  }

  return (
    <Show
      when={editing()}
      fallback={
        // ── Browser view ───────────────────────────────────────────────────────
        <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              'align-items': 'center',
              padding: '10px 12px',
              'border-bottom': '1px solid rgba(127,127,127,0.2)',
            }}
          >
            <button
              type="button"
              aria-label="Up"
              disabled={!parent()}
              onClick={() => {
                const p = parent()
                if (p) setCwd(p)
              }}
              style={{ ...iconBtn, opacity: parent() ? 0.8 : 0.25, 'font-size': '16px' }}
            >
              ↑
            </button>
            <span style={{ flex: 1, 'font-size': '13px', opacity: 0.8 }}>📂 {cwd()}</span>
            <IrisButton variant="outline" onClick={newFolder}>
              New folder
            </IrisButton>
            <IrisButton variant="solid" onClick={newFile}>
              New file
            </IrisButton>
          </div>

          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '8px',
              display: 'grid',
              gap: '2px',
              'align-content': 'start',
            }}
          >
            <For each={entries()}>
              {(e) => (
                <div
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    gap: '10px',
                    padding: '7px 10px',
                    'border-radius': '6px',
                  }}
                  onMouseEnter={(ev) =>
                    (ev.currentTarget.style.background = 'rgba(127,127,127,0.12)')
                  }
                  onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ 'font-size': '18px' }}>{e.type === 'folder' ? '📁' : '📄'}</span>
                  <Show
                    when={renaming() === e.path}
                    fallback={
                      <button
                        type="button"
                        onClick={() => (e.type === 'folder' ? setCwd(e.path) : openFile(e.path))}
                        style={{
                          flex: 1,
                          'text-align': 'left',
                          border: 'none',
                          background: 'transparent',
                          color: 'inherit',
                          cursor: 'pointer',
                          font: '13px var(--os-font)',
                        }}
                      >
                        {e.name}
                      </button>
                    }
                  >
                    <input
                      ref={(el) => queueMicrotask(() => el.focus())}
                      value={renameVal()}
                      onInput={(ev) => setRenameVal(ev.currentTarget.value)}
                      onBlur={() => commitRename(e.path)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter') commitRename(e.path)
                        if (ev.key === 'Escape') setRenaming(null)
                      }}
                      style={{
                        flex: 1,
                        font: '13px var(--os-font)',
                        border: '1px solid var(--os-accent)',
                        'border-radius': '4px',
                        padding: '2px 6px',
                        background: 'rgba(255,255,255,0.6)',
                        color: 'inherit',
                        outline: 'none',
                      }}
                    />
                  </Show>
                  <button
                    type="button"
                    aria-label="Rename"
                    onClick={() => {
                      setRenaming(e.path)
                      setRenameVal(e.name)
                    }}
                    style={iconBtn}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={() => fs.remove(e.path)}
                    style={iconBtn}
                  >
                    🗑
                  </button>
                </div>
              )}
            </For>
            <Show when={entries().length === 0}>
              <div style={{ 'font-size': '13px', opacity: 0.6, padding: '10px' }}>
                Empty folder — use “New folder” or “New file”.
              </div>
            </Show>
          </div>
        </div>
      }
    >
      {/* ── Editor view ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            'align-items': 'center',
            padding: '12px',
            'border-bottom': '1px solid rgba(127,127,127,0.2)',
          }}
        >
          <span style={{ flex: 1, 'font-weight': 600, 'font-size': '13px' }}>📄 {editing()}</span>
          <IrisButton variant="solid" onClick={save}>
            Save
          </IrisButton>
          <IrisButton variant="outline" onClick={() => setEditing(null)}>
            Close
          </IrisButton>
        </div>
        <textarea
          value={draft()}
          onInput={(e) => setDraft(e.currentTarget.value)}
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            padding: '14px',
            background: 'transparent',
            color: 'inherit',
            font: '13px/1.5 var(--os-font)',
          }}
        />
      </div>
    </Show>
  )
}
