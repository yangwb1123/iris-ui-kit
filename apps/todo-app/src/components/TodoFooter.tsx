/**
 * TodoFooter — status bar below the todo list.
 *
 * Shows sync status, active item count, and a "Clear Completed" button.
 * Sync status uses useResilientFetcher to demonstrate the resilience layer.
 */

import { useEffect, useState } from 'react'
import { IrisButton, IrisBadge } from '@iris-ui/react'
import { useResilientFetcher } from '@iris-ui/react'
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

/** SyncStatus — live badge showing simulated persistence status. */
function SyncStatus() {
  const rf = useResilientFetcher<{ ok: boolean }>({ ttlMs: 30_000 })
  const [status, setStatus] = useState<'synced' | 'syncing' | 'error'>('synced')

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus('syncing')
      void rf
        .fetch('sync:health', async () => {
          await new Promise((r) => setTimeout(r, 300))
          return { ok: true }
        })
        .then(() => setStatus('synced'))
        .catch(() => setStatus('error'))
    }, 10_000)
    return () => clearInterval(interval)
  }, [rf])

  return (
    <IrisBadge
      tone={status === 'synced' ? 'success' : status === 'syncing' ? 'warning' : 'danger'}
      variant="subtle"
      style={{ fontSize: 11 }}
    >
      {status === 'synced' ? '☁ Synced' : status === 'syncing' ? '⟳ Saving' : '⚠ Error'}
    </IrisBadge>
  )
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
      <SyncStatus />

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
