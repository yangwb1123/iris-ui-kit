import { useState } from 'react'
import { IrisMarkdown } from '@iris-ui/plugin-markdown/react'

const INITIAL_MD = `# Iris UI Markdown

**@iris-ui/plugin-markdown** renders Markdown as themed HTML with zero external
dependencies. The output inherits the active theme via CSS variables.

## Features

- **Bold**, *italic*, ~~strikethrough~~
- [Links](https://github.com/iris-ui/iris-ui)
- \`Inline code\` and code blocks
- Lists (ordered and unordered)
- Headers (levels 1–6)
- Tables

### Code Block

\`\`\`typescript
import { IrisMarkdown } from '@iris-ui/plugin-markdown/react'

function Demo() {
  return (
    <IrisMarkdown content="# Hello, Iris!" />
  )
}
\`\`\`

### Table

| Feature | Status |
|---------|--------|
| Markdown rendering | ✅ |
| Theme integration | ✅ |
| XSS protection | ✅ |
| Zero dependencies | ✅ |

> **Tip**: Try switching skins above — the markdown output re-themes instantly!
`

export function MarkdownShowcase() {
  const [md, setMd] = useState(INITIAL_MD)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section className="section">
        <h2 className="section-title">Markdown Renderer</h2>
        <p style={{ color: 'var(--iris-muted)', fontSize: 14, margin: '0 0 16px' }}>
          Powered by <code>@iris-ui/plugin-markdown</code>. Edit the Markdown below and see the
          rendered output update in real-time.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Source</div>
            <textarea
              value={md}
              onChange={(e) => setMd(e.target.value)}
              style={{
                width: '100%',
                height: 400,
                padding: 12,
                fontFamily: 'var(--iris-font-mono, monospace)',
                fontSize: 13,
                background: 'var(--iris-surface)',
                color: 'var(--iris-foreground)',
                border: '1px solid var(--iris-border)',
                borderRadius: 'var(--iris-radius-md, 6px)',
                resize: 'vertical',
                lineHeight: 1.6,
              }}
            />
          </div>

          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Preview</div>
            <div
              style={{
                height: 400,
                overflow: 'auto',
                padding: 12,
                background: 'var(--iris-background)',
                border: '1px solid var(--iris-border)',
                borderRadius: 'var(--iris-radius-md, 6px)',
              }}
            >
              <IrisMarkdown content={md} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
