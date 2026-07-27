<script lang="ts">
  /**
   * Files — a real file MANAGER over `@iris-ui-kit/core/fs` (the virtual file system).
   * Navigate folders, create folders + text files, edit/rename/delete, all
   * persisted to the user profile. This is what makes the `storage` permission the
   * app requests actually do something (the old Files view was a static mock).
   * Mirrors the React reference (apps/desktop-os/src/appviews/Files.tsx).
   */
  import { IrisButton } from '@iris-ui-kit/svelte'
  import { normalizePath } from '@iris-ui-kit/core/fs'
  import { fs, useFsState } from '../fs.svelte'

  /** Join a directory + child name into a normalized absolute path. */
  const join = (dir: string, name: string) => normalizePath(`${dir}/${name}`)

  /** A non-colliding name in `taken` (appends " (n)"). */
  function uniqueName(base: string, ext: string, taken: Set<string>): string {
    let name = `${base}${ext}`
    let n = 2
    while (taken.has(name)) name = `${base} (${n++})${ext}`
    return name
  }

  // Re-render on any fs change.
  const fstate = useFsState()

  let cwd = $state('/')
  let editing = $state<string | null>(null)
  let draft = $state('')
  let renaming = $state<string | null>(null)
  let renameVal = $state('')

  // Recompute the listing whenever the fs snapshot OR `cwd` changes. The snapshot
  // (`fstate.value`) is the reactive dependency; `fs.list` derives the directory
  // view (folders first, then files; each sorted by name).
  const entries = $derived.by(() => {
    void fstate.value
    return fs.list(cwd)
  })
  const names = $derived(new Set(entries.map((e) => e.name)))
  const parent = $derived(
    cwd === '/' ? null : normalizePath(cwd.slice(0, cwd.lastIndexOf('/')) || '/'),
  )

  function openFile(path: string): void {
    editing = path
    draft = fs.read(path) ?? ''
  }
  function save(): void {
    if (editing) fs.write(editing, draft)
    editing = null
  }
  function newFolder(): void {
    fs.mkdir(join(cwd, uniqueName('New Folder', '', names)))
  }
  function newFile(): void {
    const path = join(cwd, uniqueName('Untitled', '.txt', names))
    fs.write(path, '')
    openFile(path)
  }
  function startRename(path: string, name: string): void {
    renaming = path
    renameVal = name
  }
  function commitRename(from: string): void {
    const to = join(cwd, renameVal.trim())
    if (renameVal.trim() && to !== from) fs.rename(from, to)
    renaming = null
  }
</script>

{#if editing}
  <!-- ── Editor view ──────────────────────────────────────────────────────── -->
  <div class="pane">
    <header class="bar">
      <span class="title">📄 {editing}</span>
      <IrisButton variant="solid" onclick={save}>Save</IrisButton>
      <IrisButton variant="outline" onclick={() => (editing = null)}>Close</IrisButton>
    </header>
    <textarea class="editor" bind:value={draft} aria-label="File content"></textarea>
  </div>
{:else}
  <!-- ── Browser view ─────────────────────────────────────────────────────── -->
  <div class="pane">
    <header class="bar">
      <button
        type="button"
        class="up"
        aria-label="Up"
        disabled={!parent}
        onclick={() => parent && (cwd = parent)}
      >
        ↑
      </button>
      <span class="cwd">📂 {cwd}</span>
      <IrisButton variant="outline" onclick={newFolder}>New folder</IrisButton>
      <IrisButton variant="solid" onclick={newFile}>New file</IrisButton>
    </header>

    <div class="list">
      {#each entries as e (e.path)}
        <div class="row">
          <span class="glyph">{e.type === 'folder' ? '📁' : '📄'}</span>
          {#if renaming === e.path}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="rename"
              autofocus
              bind:value={renameVal}
              onblur={() => commitRename(e.path)}
              onkeydown={(ev) => {
                if (ev.key === 'Enter') commitRename(e.path)
                if (ev.key === 'Escape') renaming = null
              }}
            />
          {:else}
            <button
              type="button"
              class="name"
              onclick={() => (e.type === 'folder' ? (cwd = e.path) : openFile(e.path))}
            >
              {e.name}
            </button>
          {/if}
          <button
            type="button"
            class="icon-btn"
            aria-label="Rename"
            onclick={() => startRename(e.path, e.name)}
          >
            ✎
          </button>
          <button
            type="button"
            class="icon-btn"
            aria-label="Delete"
            onclick={() => fs.remove(e.path)}
          >
            🗑
          </button>
        </div>
      {/each}
      {#if entries.length === 0}
        <div class="empty">Empty folder — use “New folder” or “New file”.</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .pane {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .bar {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(127, 127, 127, 0.2);
  }
  .title {
    flex: 1;
    font-weight: 600;
    font-size: 13px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cwd {
    flex: 1;
    font-size: 13px;
    opacity: 0.8;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .up {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 16px;
    opacity: 0.8;
  }
  .up:disabled {
    cursor: default;
    opacity: 0.25;
  }
  .editor {
    flex: 1;
    resize: none;
    border: none;
    outline: none;
    padding: 14px;
    background: transparent;
    color: inherit;
    font: 13px/1.5 var(--os-font);
  }
  .list {
    flex: 1;
    overflow: auto;
    padding: 8px;
    display: grid;
    gap: 2px;
    align-content: start;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px;
    border-radius: 6px;
  }
  .row:hover {
    background: rgba(127, 127, 127, 0.12);
  }
  .glyph {
    font-size: 18px;
  }
  .name {
    flex: 1;
    text-align: left;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: 13px var(--os-font);
  }
  .rename {
    flex: 1;
    font: 13px var(--os-font);
    border: 1px solid var(--os-accent);
    border-radius: 4px;
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.6);
    color: inherit;
    outline: none;
  }
  .icon-btn {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.55;
    font-size: 13px;
  }
  .empty {
    font-size: 13px;
    opacity: 0.6;
    padding: 10px;
  }
</style>
