/**
 * TodoHeader — input row for adding new todos.
 *
 * Renders an IrisInput with a leading icon and an IrisButton to submit.
 * Submits on button click or Enter key. Clears the input on successful add.
 */

import { useState, useCallback, type KeyboardEvent, type FormEvent } from 'react'
import { IrisInput } from '@iris-ui/react'
import { IrisButton } from '@iris-ui/react'

export interface TodoHeaderProps {
  /** Called with the trimmed, non-empty text when the user adds a todo. */
  onAdd: (text: string) => void
}

export function TodoHeader({ onAdd }: TodoHeaderProps) {
  const [value, setValue] = useState('')

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
  }, [value, onAdd])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit],
  )

  const handleFormSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      handleSubmit()
    },
    [handleSubmit],
  )

  return (
    <form
      onSubmit={handleFormSubmit}
      data-todo-header=""
      style={{
        display: 'flex',
        gap: 'var(--iris-gap-md, 12px)',
        alignItems: 'center',
      }}
    >
      <IrisInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What needs to be done?"
        aria-label="New todo text"
        size="md"
        style={{ flex: 1 }}
      />
      <IrisButton
        type="submit"
        variant="solid"
        size="md"
        disabled={!value.trim()}
        aria-label="Add todo"
      >
        Add
      </IrisButton>
    </form>
  )
}
