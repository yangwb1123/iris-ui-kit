import { IrisMarkdown } from '@iris-ui-kit/plugin-markdown/react'

const README = `# Iris UI CMS

Welcome to the **Iris UI** CMS demo — a real-world application built with
\`@iris-ui-kit/react\` and the \`@iris-ui-kit/plugin-*\` ecosystem.

## Features

- **CRUD data management** — Users, Products, Orders
- **Schema-driven forms** — via \`@iris-ui-kit/plugin-form-builder\`
- **Real-time data** — via \`createReconnectingSource\`
- **Advanced tables** — via \`@iris-ui-kit/plugin-pro-table\`
- **i18n support** — Simplified Chinese via \`@iris-ui-kit/plugin-locale-zh\`

### Architecture

| Layer | Technology |
|-------|-----------|
| UI | Iris UI components (React) |
| State | \`@iris-ui-kit/core\` stores + React hooks |
| Data | \`createResourceController\` + resilience layer |
| Theme | Token-driven skins with light/dark mode |
| Plugins | 12 Iris plugins available |

### Getting Started

\`\`\`bash
pnpm add @iris-ui-kit/react @iris-ui-kit/theme @iris-ui-kit/tokens
\`\`\`

\`\`\`tsx
import { ThemeProvider, IrisButton } from '@iris-ui-kit/react'
import { createThemeStore } from '@iris-ui-kit/theme'
import { lightTheme } from '@iris-ui-kit/tokens'

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
 * Markdown page — renders a README-style document using @iris-ui-kit/plugin-markdown.
 */
export function MarkdownPage() {
  return (
    <div data-page="markdown" style={{ maxWidth: 720 }}>
      <IrisMarkdown content={README} />
    </div>
  )
}
