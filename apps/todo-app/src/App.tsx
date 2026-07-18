/**
 * App — root component for the Iris UI Todo App.
 *
 * Renders SkinProvider for theming, a centered card-based layout, and all todo
 * sub-components. Follows the production patterns from cms-react and
 * playground-react: one SkinProvider at the top, one ToastViewport, and a clean
 * component hierarchy.
 *
 * Architecture:
 * ```
 * SkinProvider        ← skin/token theming via createSkinEngine
 * ├─ IrisToastViewport ← global toast queue (bottom-right)
 * └─ TodoAppShell     ← the actual app
 *    ├─ TodoHeader    ← input + add button
 *    ├─ TodoFilters   ← All / Active / Completed
 *    ├─ TodoList      ← filtered items (or IrisEmptyState)
 *    └─ TodoFooter    ← count + clear completed
 * ```
 */

import {
  SkinProvider,
  IrisProvider,
  useSkin,
  IrisCard,
  IrisToastViewport,
  createSkinEngine,
  localStorageSkinStorage,
} from '@iris-ui/react'
import type { Skin } from '@iris-ui/react'
import { TodoHeader } from './components/TodoHeader'
import { TodoFilters } from './components/TodoFilters'
import { TodoList } from './components/TodoList'
import { TodoFooter } from './components/TodoFooter'
import { useTodos } from './hooks/useTodos'

// ── Custom skins ───────────────────────────────────────────────────────────
// Two thematic skins that extend the built-in light/dark. The "Auto" skin
// follows the OS color-scheme preference via `variants`.

const forest: Skin = {
  id: 'forest',
  name: 'Forest',
  extends: 'dark',
  tokens: {
    'iris.background': '#0f1a12',
    'iris.surface': '#16291c',
    'iris.surface.hover': '#1e3827',
    'iris.border': '#2d4d3b',
    'iris.foreground': '#e6f0e9',
    'iris.muted': '#7ba384',
    'iris.primary': '#4ade80',
    'iris.primary.foreground': '#052e16',
    'iris.accent': '#22d3ee',
  },
}

const sunset: Skin = {
  id: 'sunset',
  name: 'Sunset',
  extends: 'light',
  tokens: {
    'iris.background': '#fef2f2',
    'iris.surface': '#fff7f7',
    'iris.surface.hover': '#fee7e7',
    'iris.border': '#fecaca',
    'iris.foreground': '#450a0a',
    'iris.muted': '#b91c1c',
    'iris.primary': '#ef4444',
    'iris.primary.foreground': '#fff5f5',
    'iris.accent': '#f59e0b',
  },
}

const auto: Skin = {
  id: 'auto',
  name: 'Auto (system)',
  extends: 'light',
  variants: { light: 'sunrise', dark: 'forest' },
}

const sunrise: Skin = {
  id: 'sunrise',
  name: 'Sunrise',
  extends: 'light',
  tokens: {
    'iris.primary': '#f97316',
    'iris.primary.foreground': '#fff7ed',
    'iris.accent': '#f43f5e',
  },
}

/** Skin engine for the todo app, persisted to localStorage. */
export const skinEngine = createSkinEngine({
  skins: [forest, sunset, sunrise, auto],
  default: 'light',
  storage: localStorageSkinStorage('iris-todo-app-skin'),
})

// ── App shell ──────────────────────────────────────────────────────────────

function TodoAppShell() {
  const {
    filteredTodos,
    todos,
    filter,
    setFilter,
    activeCount,
    addTodo,
    toggleTodo,
    updateTodo,
    deleteTodo,
    clearCompleted,
  } = useTodos()

  const { skin, setSkin, availableSkins, getActiveId } = useSkin()

  return (
    <div
      data-todo-app=""
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '48px 16px',
        background: 'var(--iris-background)',
        color: 'var(--iris-foreground)',
        transition: 'background-color 200ms ease, color 200ms ease',
      }}
    >
      {/* ── App header ──────────────────────────────────────────── */}
      <header
        style={{
          textAlign: 'center',
          marginBottom: '32px',
          width: '100%',
          maxWidth: '560px',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--iris-foreground)',
          }}
        >
          Iris Todo
        </h1>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: '13px',
            color: 'var(--iris-muted)',
          }}
        >
          Built with{' '}
          <code style={{ fontFamily: 'ui-monospace, SF Mono, monospace' }}>@iris-ui/react</code>
        </p>

        {/* Skin / theme toggle */}
        <div
          style={{
            marginTop: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <label
            style={{
              fontSize: '12px',
              color: 'var(--iris-muted)',
              fontFamily: 'ui-monospace, SF Mono, monospace',
            }}
          >
            Theme:
          </label>
          <select
            aria-label="Select theme"
            value={getActiveId()}
            onChange={(e) => setSkin(e.target.value)}
            style={{
              fontFamily: 'inherit',
              fontSize: '13px',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--iris-border)',
              background: 'var(--iris-surface)',
              color: 'var(--iris-foreground)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {availableSkins().map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ?? s.id}
              </option>
            ))}
          </select>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--iris-muted)',
              fontFamily: 'ui-monospace, SF Mono, monospace',
            }}
          >
            {skin.type === 'dark' ? '🌙' : '☀️'}
          </span>
        </div>
      </header>

      {/* ── Main card ───────────────────────────────────────────── */}
      <IrisCard
        variant="outline"
        padding="none"
        style={{
          width: '100%',
          maxWidth: '560px',
        }}
      >
        {/* Header section: add form + filters */}
        <div style={{ padding: 'var(--iris-padding-lg, 20px)' }}>
          <TodoHeader onAdd={addTodo} />
          <div style={{ marginTop: '16px' }}>
            <TodoFilters active={filter} onChange={setFilter} />
          </div>
        </div>

        {/* List section — 4px horizontal padding for hover full-bleed */}
        <div style={{ padding: '0 4px' }}>
          <TodoList
            items={filteredTodos}
            activeFilter={filter}
            onToggle={toggleTodo}
            onUpdate={updateTodo}
            onDelete={deleteTodo}
          />
        </div>

        {/* Footer — only shown when there are todos */}
        {todos.length > 0 && (
          <div style={{ padding: '0 var(--iris-padding-lg, 20px)' }}>
            <TodoFooter todos={todos} activeCount={activeCount} onClearCompleted={clearCompleted} />
          </div>
        )}
      </IrisCard>

      {/* ── Attribution footer ──────────────────────────────────── */}
      <footer
        style={{
          marginTop: '32px',
          fontSize: '12px',
          color: 'var(--iris-muted)',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0 }}>
          Powered by{' '}
          <a
            href="https://github.com/earendil-works/iris-ui"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--iris-primary)', textDecoration: 'none' }}
          >
            Iris UI
          </a>
          {' · '}React · TypeScript · Vite
        </p>
      </footer>
    </div>
  )
}

// ── Exported App ───────────────────────────────────────────────────────────

export function App() {
  return (
    <SkinProvider engine={skinEngine}>
      <IrisProvider>
        <TodoAppShell />
        <IrisToastViewport position="bottom-right" />
      </IrisProvider>
    </SkinProvider>
  )
}
