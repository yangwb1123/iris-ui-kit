/**
 * TodoFooter — status bar below the todo list.
 *
 * Shows the count of active (incomplete) items and a "Clear Completed" button
 * that only appears when at least one item is completed.
 */

import { IrisButton } from '@iris-ui-kit/react'
import { hasCompleted } from '../utils/filters'
import type { Todo } from '../types/todo'

export interface TodoFooterProps {
  /** The full (unfiltered) todo list, used for counts. */
  todos: Todo[]
  /** Number of active (incomplete) items. */
  activeCount: number
  /** Called to remove all completed todos. */
  onClearCompleted: () => void
}

export function TodoFooter({ todos, activeCount, onClearCompleted }: TodoFooterProps) {
  const anyCompleted = hasCompleted(todos)

  return (
    <div
      data-todo-footer=""
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--iris-padding-sm, 8px) var(--iris-padding-md, 12px)',
        fontSize: '13px',
        color: 'var(--iris-muted)',
        borderTop: '1px solid var(--iris-border)',
      }}
    >
      <span data-todo-count="">
        <strong>{activeCount}</strong> {activeCount === 1 ? 'item' : 'items'} left
      </span>

      {anyCompleted && (
        <IrisButton
          variant="ghost"
          size="sm"
          onClick={onClearCompleted}
          aria-label="Clear completed items"
          style={{ color: 'var(--iris-muted)' }}
        >
          Clear completed
        </IrisButton>
      )}
    </div>
  )
}
