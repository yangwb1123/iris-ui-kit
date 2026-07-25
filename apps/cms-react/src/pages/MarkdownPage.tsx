import { IrisMarkdown } from '@iris-ui/plugin-markdown/react'

const README = `# Iris UI CMS

Welcome to the **Iris UI** CMS demo — a real-world application built with
\`@iris-ui/react\` and the \`@iris-ui/plugin-*\` ecosystem.

## Features

- **CRUD data management** — Users, Products, Orders
- **Schema-driven forms** — via \`@iris-ui/plugin-form-builder\`
- **Real-time data** — via \`createReconnectingSource\`
- **Advanced tables** — via \`@iris-ui/plugin-pro-table\`
- **i18n support** — Simplified Chinese via \`@iris-ui/plugin-locale-zh\`

### Architecture

| Layer | Technology |
|-------|-----------|
| UI | Iris UI components (React) |
| State | \`@iris-ui/core\` stores + React hooks |
| Data | \`createResourceController\` + resilience layer |
| Theme | Token-driven skins with light/dark mode |
| Plugins | 12 Iris plugins available |

### Getting Started

\`\`\`bash
pnpm add @iris-ui/react @iris-ui/theme @iris-ui/tokens
\`\`\`

\`\`\`tsx
import { ThemeProvider, IrisButton } from '@iris-ui/react'
import { createThemeStore } from '@iris-ui/theme'
import { lightTheme } from '@iris-ui/tokens'

const store = createThemeStore({ themes: { light: lightTheme }, default: 'light' })

function App() {
  return (
    <ThemeProvider store={store}>
      <IrisButton variant="solid">Hello Iris!</IrisButton>
    </ThemeProvider>
  )
}
\`\`\`

> **Tip**: Change the skin using the dropdown in the toolbar above — the markdown
> output re-themes instantly via CSS variables.
`

/**
 * Markdown page — renders a README-style document using @iris-ui/plugin-markdown.
 */
export function MarkdownPage() {
  return (
    <div data-page="markdown" style={{ maxWidth: 720 }}>
      <IrisMarkdown content={README} />
    </div>
  )
}
