<template>
  <div style="display: flex; flex-direction: column; gap: 24px">
    <section class="section">
      <h2 class="section-title">Markdown Renderer</h2>
      <p style="color: var(--iris-muted); font-size: 14px; margin: 0 0 16px">
        Powered by <code>@iris-ui-kit/plugin-markdown</code>.
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px">
        <div>
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px">Source</div>
          <textarea v-model="md" class="editor" />
        </div>
        <div>
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px">Preview</div>
          <div class="preview">
            <IrisMarkdown :content="md" />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IrisMarkdown } from '@iris-ui-kit/plugin-markdown/vue'

const md = ref(`# Iris UI Markdown

**@iris-ui-kit/plugin-markdown** renders Markdown as themed HTML.

## Features

- **Bold**, *italic*, ~~strikethrough~~
- \`Inline code\` and code blocks
- Lists (ordered and unordered)
- Tables

### Code Block

\`\`\`typescript
import { IrisMarkdown } from '@iris-ui-kit/plugin-markdown/vue'
\`\`\`

### Table

| Feature | Status |
|---------|--------|
| Rendering | ✅ |
| Theming | ✅ |
| Security | ✅ |
`)
</script>

<style scoped>
.editor {
  width: 100%;
  height: 400px;
  padding: 12px;
  font-family: var(--iris-font-mono, monospace);
  font-size: 13px;
  background: var(--iris-surface);
  color: var(--iris-foreground);
  border: 1px solid var(--iris-border);
  border-radius: var(--iris-radius-md, 6px);
  resize: vertical;
  line-height: 1.6;
}
.preview {
  height: 400px;
  overflow: auto;
  padding: 12px;
  background: var(--iris-background);
  border: 1px solid var(--iris-border);
  border-radius: var(--iris-radius-md, 6px);
}
</style>
