import { useState } from 'react'
import {
  IrisLoginTemplate,
  IrisDashboardTemplate,
  IrisCard,
  useToast,
  type IrisDashboardNavItem,
  type IrisDashboardCardSpec,
} from '@iris-ui-kit/react'

const dashNav: IrisDashboardNavItem[] = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'team', label: 'Team', icon: '👥' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

const dashCards: IrisDashboardCardSpec[] = [
  { id: 'a', title: 'Revenue', body: '$128,400', colSpan: 4 },
  { id: 'b', title: 'New Users', body: '+512', colSpan: 4 },
  { id: 'c', title: 'Open Issues', body: '47', colSpan: 4 },
  { id: 'd', title: 'Recent Activity', body: 'Loading…', colSpan: 'full' },
]

export function SkeletonsShowcase() {
  const toast = useToast()
  const [active, setActive] = useState('home')

  return (
    <section className="section">
      <h2 className="section-title">Layer 4 · System Skeletons</h2>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">login template</span>
        <IrisCard style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ height: 600, overflow: 'hidden', position: 'relative' }}>
            <IrisLoginTemplate
              title="Welcome back"
              description="Sign in to your workspace"
              onSubmit={(p) =>
                toast.success({
                  title: 'Submitted',
                  description: `${p.email} (remember = ${p.remember})`,
                })
              }
            />
          </div>
        </IrisCard>
      </div>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">dashboard template</span>
        <IrisCard style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ height: 520, overflow: 'hidden' }}>
            <IrisDashboardTemplate
              title="Iris Dashboard"
              sidebarTitle="Workspace"
              nav={dashNav}
              activeId={active}
              onActiveIdChange={setActive}
              cards={dashCards}
            />
          </div>
        </IrisCard>
        <span style={{ fontSize: 12, color: 'var(--iris-muted)' }}>active section → {active}</span>
      </div>
    </section>
  )
}
