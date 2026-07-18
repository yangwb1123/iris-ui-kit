/**
 * TodoItem — a single todo row.
 *
 * Composes IrisCheckbox (completed toggle), an inline-editable text span,
 * and a delete button. Double-clicking the text enters edit mode; blurring
 * or pressing Enter commits the edit; Escape cancels.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { IrisCheckbox } from '@iris-ui/react'
import { IrisButton } from '@iris-ui/react'
import type { Todo } from '../types/todo'

export interface TodoItemProps {
  todo: Todo
  onToggle: (id: string) => void
  onUpdate: (id: string, text: string) => void
  onDelete: (id: string) => void
}

export function TodoItem({ todo, onToggle, onUpdate, onDelete }: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(todo.text)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Enter edit mode on double-click.
  const handleDoubleClick = useCallback(() => {
    setEditText(todo.text)
    setEditing(true)
  }, [todo.text])

  // Focus the input when entering edit mode.
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commitEdit = useCallback(() => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== todo.text) {
      onUpdate(todo.id, trimmed)
    }
    setEditing(false)
  }, [editText, todo.id, todo.text, onUpdate])

  const cancelEdit = useCallback(() => {
    setEditText(todo.text)
    setEditing(false)
  }, [todo.text])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitEdit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelEdit()
      }
    },
    [commitEdit, cancelEdit],
  )

  return (
    <div
      data-todo-item=""
      data-completed={todo.completed ? 'true' : 'false'}
      data-editing={editing ? 'true' : 'false'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--iris-gap-md, 12px)',
        padding: 'var(--iris-padding-sm, 8px) var(--iris-padding-md, 12px)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        transition: 'background-color 120ms ease',
        background: editing ? 'var(--iris-surface)' : 'transparent',
      }}
    >
      {/* Completion toggle */}
      <IrisCheckbox
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        size="md"
        aria-label={`Mark "${todo.text}" as ${todo.completed ? 'incomplete' : 'complete'}`}
      />

      {/* Editable text area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            aria-label="Edit todo text"
            style={{
              width: '100%',
              border: 'none',
              outline: '1px solid var(--iris-primary)',
              background: 'var(--iris-background)',
              color: 'var(--iris-foreground)',
              fontFamily: 'inherit',
              fontSize: '14px',
              padding: '4px 8px',
              borderRadius: 'var(--iris-radius-sm, 4px)',
            }}
          />
        ) : (
          <span
            onDoubleClick={handleDoubleClick}
            title="Double-click to edit"
            style={{
              display: 'block',
              fontSize: '14px',
              lineHeight: 1.5,
              color: todo.completed ? 'var(--iris-muted)' : 'var(--iris-foreground)',
              textDecoration: todo.completed ? 'line-through' : 'none',
              cursor: 'text',
              padding: '4px 0',
              transition: 'color 120ms ease',
              wordBreak: 'break-word',
            }}
          >
            {todo.text}
          </span>
        )}
      </div>

      {/* Delete button — shown on hover via CSS */}
      <IrisButton
        variant="ghost"
        size="sm"
        onClick={() => onDelete(todo.id)}
        aria-label={`Delete "${todo.text}"`}
        style={{
          opacity: 0,
          transition: 'opacity 100ms ease',
          color: 'var(--iris-danger)',
          flexShrink: 0,
        }}
        data-todo-item-delete=""
      >
        ✕
      </IrisButton>

      {/* CSS hover selector for delete visibility — injected via style tag in app */}
      <style>{`
        [data-todo-item]:hover [data-todo-item-delete] {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  )
}
