<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { IrisButton } from '@iris-ui-kit/vue'
import { normalizePath } from '@iris-ui-kit/core/fs'
import { useFs, useFsState } from '../fs'

/**
 * Files — a real file MANAGER over `@iris-ui-kit/core/fs` (the virtual file system).
 * Navigate folders, create folders + text files, edit/rename/delete, all persisted
 * to the user profile. This is what makes the `storage` permission it requests
 * actually do something (the old Files view was a static mock). The Vue twin of
 * the React demo's Files.tsx.
 */

const fs = useFs()
const fsState = useFsState() // reactive — list() re-derives on any fs change

/** Join a directory + child name into a normalized absolute path. */
const join = (dir: string, name: string) => normalizePath(`${dir}/${name}`)

/** A non-colliding name in `taken` (appends " (n)"). */
function uniqueName(base: string, ext: string, taken: Set<string>): string {
  let name = `${base}${ext}`
  let n = 2
  while (taken.has(name)) name = `${base} (${n++})${ext}`
  return name
}

const cwd = ref('/')
const editing = ref<string | null>(null)
const draft = ref('')
const renaming = ref<string | null>(null)
const renameVal = ref('')

// Re-derive the listing whenever the cwd or the fs state changes.
const entries = computed(() => {
  void fsState.value // track fs changes
  return fs.list(cwd.value)
})
const names = computed(() => new Set(entries.value.map((e) => e.name)))
const parent = computed(() =>
  cwd.value === '/' ? null : normalizePath(cwd.value.slice(0, cwd.value.lastIndexOf('/')) || '/'),
)

const renameInput = ref<HTMLInputElement | null>(null)
// Focus the inline rename field once it renders (mirrors React's autoFocus).
watch(renaming, async (val) => {
  if (val) {
    await nextTick()
    renameInput.value?.focus()
  }
})

function openFile(path: string): void {
  editing.value = path
  draft.value = fs.read(path) ?? ''
}
function save(): void {
  if (editing.value) fs.write(editing.value, draft.value)
  editing.value = null
}
function newFolder(): void {
  fs.mkdir(join(cwd.value, uniqueName('New Folder', '', names.value)))
}
function newFile(): void {
  const path = join(cwd.value, uniqueName('Untitled', '.txt', names.value))
  fs.write(path, '')
  openFile(path)
}
function startRename(path: string, name: string): void {
  renaming.value = path
  renameVal.value = name
}
function commitRename(from: string): void {
  const to = join(cwd.value, renameVal.value.trim())
  if (renameVal.value.trim() && to !== from) fs.rename(from, to)
  renaming.value = null
}
function openEntry(e: { path: string; type: 'file' | 'folder' }): void {
  if (e.type === 'folder') cwd.value = e.path
  else openFile(e.path)
}
</script>

<template>
  <!-- ── Editor view ───────────────────────────────────────────────────────── -->
  <div v-if="editing" class="files">
    <header class="files-bar">
      <span class="files-editing">📄 {{ editing }}</span>
      <IrisButton variant="solid" @click="save">Save</IrisButton>
      <IrisButton variant="outline" @click="editing = null">Close</IrisButton>
    </header>
    <textarea v-model="draft" class="files-editor" />
  </div>

  <!-- ── Browser view ──────────────────────────────────────────────────────── -->
  <div v-else class="files">
    <header class="files-bar">
      <button
        type="button"
        aria-label="Up"
        class="files-up"
        :disabled="!parent"
        @click="parent && (cwd = parent)"
      >
        ↑
      </button>
      <span class="files-cwd">📂 {{ cwd }}</span>
      <IrisButton variant="outline" @click="newFolder">New folder</IrisButton>
      <IrisButton variant="solid" @click="newFile">New file</IrisButton>
    </header>

    <div class="files-list">
      <div v-for="e in entries" :key="e.path" class="files-row">
        <span class="files-glyph">{{ e.type === 'folder' ? '📁' : '📄' }}</span>
        <input
          v-if="renaming === e.path"
          ref="renameInput"
          v-model="renameVal"
          class="files-rename"
          @blur="commitRename(e.path)"
          @keydown.enter="commitRename(e.path)"
          @keydown.escape="renaming = null"
        />
        <button v-else type="button" class="files-name" @click="openEntry(e)">
          {{ e.name }}
        </button>
        <button
          type="button"
          aria-label="Rename"
          class="files-icon-btn"
          @click="startRename(e.path, e.name)"
        >
          ✎
        </button>
        <button type="button" aria-label="Delete" class="files-icon-btn" @click="fs.remove(e.path)">
          🗑
        </button>
      </div>
      <div v-if="entries.length === 0" class="files-empty">
        Empty folder — use “New folder” or “New file”.
      </div>
    </div>
  </div>
</template>

<style scoped>
.files {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--os-window-fg);
}
.files-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(127, 127, 127, 0.2);
}
.files-editing {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
}
.files-editor {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  padding: 14px;
  background: transparent;
  color: inherit;
  font: 13px/1.5 var(--os-font);
}
.files-up {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.8;
  font-size: 16px;
}
.files-up:disabled {
  opacity: 0.25;
  cursor: default;
}
.files-cwd {
  flex: 1;
  font-size: 13px;
  opacity: 0.8;
}
.files-list {
  flex: 1;
  overflow: auto;
  padding: 8px;
  display: grid;
  gap: 2px;
  align-content: start;
}
.files-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
}
.files-row:hover {
  background: rgba(127, 127, 127, 0.12);
}
.files-glyph {
  font-size: 18px;
}
.files-name {
  flex: 1;
  text-align: left;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: 13px var(--os-font);
}
.files-rename {
  flex: 1;
  font: 13px var(--os-font);
  border: 1px solid var(--os-accent);
  border-radius: 4px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.6);
  color: inherit;
  outline: none;
}
.files-icon-btn {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.55;
  font-size: 13px;
}
.files-empty {
  font-size: 13px;
  opacity: 0.6;
  padding: 10px;
}
</style>
