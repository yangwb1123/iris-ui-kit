import { useState, useEffect, type ComponentType } from 'react'
import {
  SkinProvider,
  useSkin,
  IrisSidebarLayout,
  IrisHeaderLayout,
  IrisToastViewport,
  IrisButton,
  IrisKbd,
  IrisDialog,
  IrisDialogContent,
  IrisDialogTitle,
  IrisDialogDescription,
  IrisDialogClose,
} from '@iris-ui-kit/react'
import { skinEngine } from './demo-skins'
import { SkinsShowcase } from './sections/SkinsShowcase'
import { DisplayShowcase } from './sections/DisplayShowcase'
import { FormShowcase } from './sections/FormShowcase'
import { DatesShowcase } from './sections/DatesShowcase'
import { CompositeShowcase } from './sections/CompositeShowcase'
import { OverlayShowcase } from './sections/OverlayShowcase'
import { BehaviorsShowcase } from './sections/BehaviorsShowcase'
import { SkeletonsShowcase } from './sections/SkeletonsShowcase'
import { TokensShowcase } from './sections/TokensShowcase'
import { DataResilienceShowcase } from './sections/DataResilienceShowcase'
import { ThemeEditor } from './sections/ThemeEditor'
import { ChartsShowcase } from './sections/ChartsShowcase'
import { CalendarShowcase } from './sections/CalendarShowcase'
import { MarkdownShowcase } from './sections/MarkdownShowcase'
import { QueryBuilderShowcase } from './sections/QueryBuilderShowcase'
import { KanbanShowcase } from './sections/KanbanShowcase'
import { EditorShowcase } from './sections/EditorShowcase'
import { DashboardShowcase } from './sections/DashboardShowcase'
import { AdminShowcase } from './sections/AdminShowcase'
import { SkinComparison } from './sections/SkinComparison'

interface SectionEntry {
  id: string
  label: string
  group: string
  component: ComponentType
}

const sections: SectionEntry[] = [
  { id: 'skins', label: 'Skin System', group: 'Skins', component: SkinsShowcase },
  {
    id: 'data-resilience',
    label: 'Data &amp; Resilience',
    group: 'Core',
    component: DataResilienceShowcase,
  },
  { id: 'display', label: 'Display', group: 'Primitives', component: DisplayShowcase },
  { id: 'form', label: 'Form', group: 'Primitives', component: FormShowcase },
  { id: 'dates', label: 'Dates & Time', group: 'Primitives', component: DatesShowcase },
  { id: 'composite', label: 'Composite', group: 'Components', component: CompositeShowcase },
  { id: 'overlay', label: 'Overlays', group: 'Components', component: OverlayShowcase },
  { id: 'behaviors', label: 'Behaviors', group: 'Components', component: BehaviorsShowcase },
  { id: 'skeletons', label: 'System Skeletons', group: 'Layer 4', component: SkeletonsShowcase },
  { id: 'tokens', label: 'Theme Tokens', group: 'Foundation', component: TokensShowcase },
  { id: 'theme-editor', label: 'Theme Editor', group: 'Foundation', component: ThemeEditor },
  { id: 'charts', label: 'Charts', group: 'Components', component: ChartsShowcase },
  { id: 'calendar', label: 'Calendar', group: 'Components', component: CalendarShowcase },
  { id: 'skin-compare', label: 'Light / Dark', group: 'Skins', component: SkinComparison },
  { id: 'markdown', label: 'Markdown', group: 'Components', component: MarkdownShowcase },
  {
    id: 'query-builder',
    label: 'Query Builder',
    group: 'Components',
    component: QueryBuilderShowcase,
  },
  { id: 'kanban', label: 'Kanban', group: 'Components', component: KanbanShowcase },
  { id: 'editor', label: 'Code Editor', group: 'Components', component: EditorShowcase },
  { id: 'dashboard', label: 'Dashboard', group: 'Components', component: DashboardShowcase },
  { id: 'admin', label: 'Admin App', group: 'Components', component: AdminShowcase },
]

const groupOrder = ['Skins', 'Core', 'Primitives', 'Components', 'Layer 4', 'Foundation']

function Shell() {
  const { skin, setSkin, setMode, getActiveId, availableSkins } = useSkin()
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setHelpOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const [activeId, setActiveId] = useState(sections[0]!.id)
  const [collapsed, setCollapsed] = useState(false)

  // Route every skin pick through the engine's mode: picking 'auto' follows the
  // system; any other id pins a fixed skin. Keeps the picker, gallery, and the
  // follow toggle reading the same logical selection (engine.getActiveId()).
  const selectSkin = (id: string) => {
    if (id === 'auto') setMode('system')
    else setMode('fixed')
    setSkin(id)
  }

  const active = sections.find((s) => s.id === activeId)
  const Active = active?.component

  const grouped = groupOrder.map((g) => ({
    group: g,
    items: sections.filter((s) => s.group === g),
  }))

  return (
    <IrisSidebarLayout
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      width={240}
      collapsedWidth={60}
      style={{ height: '100vh' }}
      sidebar={(state) => (
        <div className="side">
          <div className="brand">
            <div className="brand-mark">I</div>
            {state.collapsed ? null : (
              <div className="brand-text">
                <div className="brand-title">Iris UI</div>
                <div className="brand-sub">React Playground</div>
              </div>
            )}
          </div>
          <nav className="nav" aria-label="Sections">
            {grouped.map((g) => (
              <div key={g.group} className="nav-group">
                {state.collapsed ? null : <div className="nav-group-label">{g.group}</div>}
                {g.items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`nav-item${s.id === activeId ? ' active' : ''}`}
                    aria-current={s.id === activeId ? 'page' : undefined}
                    onClick={() => setActiveId(s.id)}
                  >
                    {state.collapsed ? s.label[0] : s.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </div>
      )}
    >
      <IrisHeaderLayout
        header={
          <div className="header">
            <div className="header-title">
              <span className="header-active">{active?.label ?? '—'}</span>
              <span className="header-meta">
                skin: {skin.name} ({skin.type})
              </span>
            </div>
            <label className="skin-picker">
              <span className="skin-picker-label">Skin</span>
              <select
                aria-label="Active skin"
                className="skin-select"
                value={getActiveId()}
                onChange={(e) => selectSkin(e.target.value)}
              >
                {availableSkins().map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name ?? s.id}
                  </option>
                ))}
              </select>
            </label>
            <IrisButton
              variant="ghost"
              size="sm"
              aria-label="Keyboard shortcuts"
              onClick={() => setHelpOpen((o) => !o)}
              style={{ fontSize: 14, minWidth: 32, padding: 4 }}
            >
              ?
            </IrisButton>
          </div>
        }
      >
        <div className="content">{Active ? <Active /> : null}</div>
      </IrisHeaderLayout>

      {/* Keyboard shortcut help dialog */}
      <IrisDialog open={helpOpen} onOpenChange={setHelpOpen}>
        <IrisDialogContent style={{ maxWidth: 420 }}>
          <IrisDialogTitle>Keyboard Shortcuts</IrisDialogTitle>
          <IrisDialogDescription>
            Navigate the playground quickly using these shortcuts.
          </IrisDialogDescription>
          <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
            {[
              { keys: ['?'], desc: 'Toggle this help dialog' },
              { keys: ['↑', '↓'], desc: 'Navigate section list' },
              { keys: ['Enter'], desc: 'Open selected section' },
              { keys: ['⌘K', 'Ctrl+K'], desc: 'Search sections (when available)' },
            ].map((shortcut) => (
              <div
                key={shortcut.desc}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span style={{ fontSize: 14 }}>{shortcut.desc}</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  {shortcut.keys.map((k) => (
                    <IrisKbd key={k}>{k}</IrisKbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <IrisDialogClose asChild>
              <IrisButton variant="solid">Close</IrisButton>
            </IrisDialogClose>
          </div>
        </IrisDialogContent>
      </IrisDialog>
    </IrisSidebarLayout>
  )
}

export function App() {
  return (
    <SkinProvider engine={skinEngine}>
      <Shell />
      <IrisToastViewport position="bottom-right" />
    </SkinProvider>
  )
}
