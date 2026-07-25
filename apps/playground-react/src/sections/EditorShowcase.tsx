import { IrisCodeEditor } from '@iris-ui/plugin-editor/react'

const SQL_EXAMPLE = `-- Sample SQL query
SELECT
  u.name,
  u.email,
  COUNT(o.id) AS order_count,
  SUM(o.total) AS total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active'
  AND o.created_at >= '2024-01-01'
GROUP BY u.id, u.name, u.email
HAVING COUNT(o.id) > 5
ORDER BY total_spent DESC
LIMIT 10;
`

const JSON_EXAMPLE = `{
  "name": "Iris UI",
  "version": "0.0.0",
  "frameworks": ["react", "vue", "solid", "svelte"],
  "plugins": [
    { "name": "editor", "status": "active" },
    { "name": "charts", "status": "active" },
    { "name": "kanban", "status": "active" }
  ],
  "features": {
    "theming": "token-driven",
    "resilience": true,
    "ssr": true,
    "i18n": true
  }
}`

export function EditorShowcase() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section className="section">
        <h2 className="section-title">Code Editor</h2>
        <p style={{ color: 'var(--iris-muted)', fontSize: 14, margin: '0 0 16px' }}>
          CodeMirror 6 editor from <code>@iris-ui/plugin-editor</code> with syntax highlighting,
          autocompletion, and diff view. Switch skins above to see the editor theme adapt.
        </p>

        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>SQL</div>
            <IrisCodeEditor
              language="sql"
              defaultValue={SQL_EXAMPLE}
              style={{ borderRadius: 8, overflow: 'hidden' }}
            />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>JSON</div>
            <IrisCodeEditor
              language="json"
              defaultValue={JSON_EXAMPLE}
              style={{ borderRadius: 8, overflow: 'hidden' }}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
