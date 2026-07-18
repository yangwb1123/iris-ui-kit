/**
 * TodoFilters — filter toggle row.
 *
 * Renders three filter buttons (All / Active / Completed) using IrisButton
 * with the `ghost` variant. The active filter gets a visual highlight via
 * the `solid` variant for clear affordance.
 */

import { IrisButton } from '@iris-ui/react'
import type { TodoFilter } from '../types/todo'

export interface TodoFiltersProps {
  /** The currently active filter. */
  active: TodoFilter
  /** Called when the user clicks a filter. */
  onChange: (filter: TodoFilter) => void
}

const FILTERS: { value: TodoFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

export function TodoFilters({ active, onChange }: TodoFiltersProps) {
  return (
    <div
      data-todo-filters=""
      role="group"
      aria-label="Filter todos"
      style={{
        display: 'flex',
        gap: 'var(--iris-gap-sm, 8px)',
        alignItems: 'center',
      }}
    >
      {FILTERS.map((f) => (
        <IrisButton
          key={f.value}
          variant={active === f.value ? 'solid' : 'ghost'}
          size="sm"
          onClick={() => onChange(f.value)}
          aria-pressed={active === f.value}
        >
          {f.label}
        </IrisButton>
      ))}
    </div>
  )
}
