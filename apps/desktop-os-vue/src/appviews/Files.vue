<script setup lang="ts">
interface FileEntry {
  name: string
  kind: string
  icon: string
}

const files: FileEntry[] = [
  { name: 'Documents', kind: 'folder', icon: '📁' },
  { name: 'Pictures', kind: 'folder', icon: '📁' },
  { name: 'roadmap-v4.md', kind: 'file', icon: '📄' },
  { name: 'budget.xlsx', kind: 'file', icon: '📊' },
  { name: 'wallpaper.png', kind: 'file', icon: '🖼️' },
]
</script>

<template>
  <div class="files">
    <div v-for="f in files" :key="f.name" class="file-row">
      <span style="font-size: 20px">{{ f.icon }}</span>
      <span style="flex: 1">{{ f.name }}</span>
      <span style="opacity: 0.5; font-size: 12px">{{ f.kind }}</span>
    </div>
  </div>
</template>

<style scoped>
.files {
  padding: 12px;
  display: grid;
  gap: 4px;
}
.file-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: default;
}
.file-row:hover {
  background: rgba(127, 127, 127, 0.12);
}
</style>
