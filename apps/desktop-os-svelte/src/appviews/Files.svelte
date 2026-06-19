<script lang="ts">
  interface FileItem {
    name: string
    kind: string
    icon: string
  }

  const FILES: FileItem[] = [
    { name: 'Documents', kind: 'folder', icon: '📁' },
    { name: 'Pictures', kind: 'folder', icon: '📁' },
    { name: 'roadmap-v4.md', kind: 'file', icon: '📄' },
    { name: 'budget.xlsx', kind: 'file', icon: '📊' },
    { name: 'wallpaper.png', kind: 'file', icon: '🖼️' },
  ]
</script>

<div class="files">
  {#each FILES as f (f.name)}
    <div class="row">
      <span class="glyph">{f.icon}</span>
      <span style="flex:1">{f.name}</span>
      <span style="opacity:.5;font-size:12px">{f.kind}</span>
    </div>
  {/each}
</div>

<style>
  .files {
    padding: 12px;
    display: grid;
    gap: 4px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: default;
  }
  .row:hover {
    background: rgba(127, 127, 127, 0.12);
  }
  .glyph {
    font-size: 20px;
  }
</style>
