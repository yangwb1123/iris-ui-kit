import { useState, type ComponentType } from 'react'
import {
  ThemeProvider,
  createThemeStore,
  lightTheme,
  darkTheme,
  useTheme,
  IrisSidebarLayout,
  IrisHeaderLayout,
  IrisButton,
  IrisToastViewport,
} from '@iris-ui/react'
import { DisplayShowcase } from './sections/DisplayShowcase'
import { FormShowcase } from './sections/FormShowcase'
import { DatesShowcase } from './sections/DatesShowcase'
import { CompositeShowcase } from './sections/CompositeShowcase'
import { OverlayShowcase } from './sections/OverlayShowcase'
import { BehaviorsShowcase } from './sections/BehaviorsShowcase'
import { SkeletonsShowcase } from './sections/SkeletonsShowcase'
import { TokensShowcase } from './sections/TokensShowcase'

const themeStore = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})

interface SectionEntry {
  id: string
  label: string
  group: string
  component: ComponentType
}

const sections: SectionEntry[] = [
  { id: 'display', label: 'Display', group: 'Primitives', component: DisplayShowcase },
  { id: 'form', label: 'Form', group: 'Primitives', component: FormShowcase },
  { id: 'dates', label: 'Dates & Time', group: 'Primitives', component: DatesShowcase },
  { id: 'composite', label: 'Composite', group: 'Components', component: CompositeShowcase },
  { id: 'overlay', label: 'Overlays', group: 'Components', component: OverlayShowcase },
  { id: 'behaviors', label: 'Behaviors', group: 'Components', component: BehaviorsShowcase },
  { id: 'skeletons', label: 'System Skeletons', group: 'Layer 4', component: SkeletonsShowcase },
  { id: 'tokens', label: 'Theme Tokens', group: 'Foundation', component: TokensShowcase },
]

const groupOrder = ['Primitives', 'Components', 'Layer 4', 'Foundation']

function Shell() {
  const { theme, setTheme } = useTheme()
  const isDark = theme.type === 'dark'
  const [activeId, setActiveId] = useState(sections[0]!.id)
  const [collapsed, setCollapsed] = useState(false)

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
                theme: {theme.name} ({theme.type})
              </span>
            </div>
            <IrisButton
              variant="outline"
              size="sm"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
            >
              Switch to {isDark ? 'Light' : 'Dark'}
            </IrisButton>
          </div>
        }
      >
        <div className="content">{Active ? <Active /> : null}</div>
      </IrisHeaderLayout>
    </IrisSidebarLayout>
  )
}

export function App() {
  return (
    <ThemeProvider store={themeStore}>
      <Shell />
      <IrisToastViewport position="bottom-right" />
    </ThemeProvider>
  )
}
