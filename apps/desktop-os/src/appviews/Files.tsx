import * as React from 'react'
import { IrisButton } from '@iris-ui/react'
import { normalizePath } from '@iris-ui/core/fs'
import { useFs, useFsState } from '../shell'

/** Join a directory + child name into a normalized absolute path. */
const join = (dir: string, name: string) => normalizePath(`${dir}/${name}`)

/** A non-colliding name in `taken` (appends " (n)"). */
function uniqueName(base: string, ext: string, taken: Set<string>): string {
  let name = `${base}${ext}`
  let n = 2
  while (taken.has(name)) name = `${base} (${n++})${ext}`
  return name
}

/**
 * Files — a real file MANAGER over `@iris-ui/core/fs` (the virtual file system).
 * Navigate folders, create folders + text files, edit/rename/delete, all persisted
 * to the user profile. This is what makes the `storage` permission it requests
 * actually do something (the old Files view was a static mock).
 */
export function FilesApp() {
  const fs = useFs()
  useFsState() // re-render on any fs change
  const [cwd, setCwd] = React.useState('/')
  const [editing, setEditing] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState('')
  const [renaming, setRenaming] = React.useState<string | null>(null)
  const [renameVal, setRenameVal] = React.useState('')

  const entries = fs.list(cwd)
  const names = new Set(entries.map((e) => e.name))
  const parent = cwd === '/' ? null : normalizePath(cwd.slice(0, cwd.lastIndexOf('/')) || '/')

  const openFile = (path: string) => {
    setEditing(path)
    setDraft(fs.read(path) ?? '')
  }
  const save = () => {
    if (editing) fs.write(editing, draft)
    setEditing(null)
  }
  const newFolder = () => fs.mkdir(join(cwd, uniqueName('New Folder', '', names)))
  const newFile = () => {
    const path = join(cwd, uniqueName('Untitled', '.txt', names))
    fs.write(path, '')
    openFile(path)
  }
  const commitRename = (from: string) => {
    const to = join(cwd, renameVal.trim())
    if (renameVal.trim() && to !== from) fs.rename(from, to)
    setRenaming(null)
  }

  const iconBtn: React.CSSProperties = {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    opacity: 0.55,
    fontSize: 13,
  }

  // ── Editor view ─────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: 12,
            borderBottom: '1px solid rgba(127,127,127,0.2)',
          }}
        >
          <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>📄 {editing}</span>
          <IrisButton variant="solid" onClick={save}>
            Save
          </IrisButton>
          <IrisButton variant="outline" onClick={() => setEditing(null)}>
            Close
          </IrisButton>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{
            flex: 1,
            resize: 'none',
            border: 'none',
            outline: 'none',
            padding: 14,
            background: 'transparent',
            color: 'inherit',
            font: '13px/1.5 var(--os-font)',
          }}
        />
      </div>
    )
  }

  // ── Browser view ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: '10px 12px',
          borderBottom: '1px solid rgba(127,127,127,0.2)',
        }}
      >
        <button
          type="button"
          aria-label="Up"
          disabled={!parent}
          onClick={() => parent && setCwd(parent)}
          style={{ ...iconBtn, opacity: parent ? 0.8 : 0.25, fontSize: 16 }}
        >
          ↑
        </button>
        <span style={{ flex: 1, fontSize: 13, opacity: 0.8 }}>📂 {cwd}</span>
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
          padding: 8,
          display: 'grid',
          gap: 2,
          alignContent: 'start',
        }}
      >
        {entries.map((e) => (
          <div
            key={e.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 10px',
              borderRadius: 6,
            }}
            onMouseEnter={(ev) => (ev.currentTarget.style.background = 'rgba(127,127,127,0.12)')}
            onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 18 }}>{e.type === 'folder' ? '📁' : '📄'}</span>
            {renaming === e.path ? (
              <input
                autoFocus
                value={renameVal}
                onChange={(ev) => setRenameVal(ev.target.value)}
                onBlur={() => commitRename(e.path)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') commitRename(e.path)
                  if (ev.key === 'Escape') setRenaming(null)
                }}
                style={{
                  flex: 1,
                  font: '13px var(--os-font)',
                  border: '1px solid var(--os-accent)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  background: 'rgba(255,255,255,0.6)',
                  color: 'inherit',
                  outline: 'none',
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => (e.type === 'folder' ? setCwd(e.path) : openFile(e.path))}
                style={{
                  flex: 1,
                  textAlign: 'left',
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  font: '13px var(--os-font)',
                }}
              >
                {e.name}
              </button>
            )}
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
        ))}
        {entries.length === 0 && (
          <div style={{ fontSize: 13, opacity: 0.6, padding: 10 }}>
            Empty folder — use “New folder” or “New file”.
          </div>
        )}
      </div>
    </div>
  )
}
