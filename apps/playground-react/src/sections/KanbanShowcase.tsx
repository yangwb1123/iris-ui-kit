import { IrisKanban, type KanbanConfig } from '@iris-ui-kit/plugin-kanban/react'

const KANBAN_CONFIG: KanbanConfig = {
  columns: [
    {
      id: 'backlog',
      title: 'Backlog',
      cards: [
        {
          id: '1',
          title: 'Design system audit',
          description: 'Review all components for consistency',
        },
        { id: '2', title: 'Accessibility pass', description: 'Run axe-core on every page' },
      ],
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      limit: 3,
      cards: [
        { id: '3', title: 'API integration', description: 'Connect to the backend service' },
        { id: '4', title: 'User onboarding flow', description: 'Design the first-run experience' },
      ],
    },
    {
      id: 'review',
      title: 'Review',
      cards: [
        { id: '5', title: 'Theme editor', description: 'Interactive token customization UI' },
      ],
    },
    {
      id: 'done',
      title: 'Done',
      cards: [
        { id: '6', title: 'Project setup', description: 'Monorepo with pnpm and Turborepo' },
        { id: '7', title: 'Core components', description: 'Button, Input, Dialog primitives' },
        { id: '8', title: 'Theme system', description: 'CSS variable-based theming engine' },
      ],
    },
  ],
  onMove: (cardId, fromCol, toCol) => {
    console.log(`Moved card ${cardId} from ${fromCol} to ${toCol}`)
  },
}

export function KanbanShowcase() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section className="section">
        <h2 className="section-title">Kanban Board</h2>
        <p style={{ color: 'var(--iris-muted)', fontSize: 14, margin: '0 0 16px' }}>
          Drag-and-drop Kanban board from <code>@iris-ui-kit/plugin-kanban</code>. Cards can be
          moved between columns; WIP-limited columns refuse cards when at capacity.
        </p>

        <IrisKanban config={KANBAN_CONFIG} />
      </section>
    </div>
  )
}
