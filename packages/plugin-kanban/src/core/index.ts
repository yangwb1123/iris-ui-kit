import { createStore, createPlugin } from '@iris-ui-kit/core'

/**
 * `@iris-ui-kit/plugin-kanban` — render a drag-and-drop Kanban board from a
 * declarative column/card config. This `core` entry is framework-agnostic:
 * it owns all state and mutations (moveCard, addCard, removeCard, WIP limits)
 * via a subscribable store. The four thin renderers draw from it.
 */

export interface KanbanCard {
  id: string
  title: string
  description?: string
  tags?: string[]
}

export interface KanbanColumn {
  id: string
  title: string
  cards: KanbanCard[]
  /** Max cards in this column (WIP limit). `undefined` = no limit. */
  limit?: number
}

export interface KanbanConfig {
  columns: KanbanColumn[]
  onMove?: (cardId: string, fromColumnId: string, toColumnId: string) => void
}

export interface KanbanState {
  columns: KanbanColumn[]
}

export interface KanbanStore {
  getState(): KanbanState
  subscribe(cb: (s: KanbanState) => void): () => void
  /**
   * Move card `cardId` to column `toColumnId`. No-op if the card is not found,
   * is already in the target column, or the target column has reached its WIP
   * `limit`. Fires `config.onMove` after a successful move.
   */
  moveCard(cardId: string, toColumnId: string): void
  /**
   * Add `card` to column `columnId`. No-op when the column is at its WIP
   * `limit` or when a card with the same `id` already exists in the column.
   */
  addCard(columnId: string, card: KanbanCard): void
  /** Remove the card with `cardId` from whichever column currently holds it. */
  removeCard(cardId: string): void
}

/** Create a live Kanban store from a config. Deep-copies the initial columns. */
export function createKanban(config: KanbanConfig): KanbanStore {
  // Deep-copy so mutations don't bleed into the caller's config object.
  const cloneColumns = (cols: KanbanColumn[]): KanbanColumn[] =>
    cols.map((col) => ({ ...col, cards: col.cards.map((c) => ({ ...c })) }))

  const store = createStore<KanbanState>({ columns: cloneColumns(config.columns) })

  const moveCard = (cardId: string, toColumnId: string): void => {
    const { columns } = store.getState()
    // Find which column currently owns the card.
    let fromColIndex = -1
    let cardIndex = -1
    for (let ci = 0; ci < columns.length; ci++) {
      const idx = columns[ci]!.cards.findIndex((c) => c.id === cardId)
      if (idx !== -1) {
        fromColIndex = ci
        cardIndex = idx
        break
      }
    }
    if (fromColIndex === -1) return // card not found

    const fromColumnId = columns[fromColIndex]!.id
    if (fromColumnId === toColumnId) return // already there

    const toColIndex = columns.findIndex((c) => c.id === toColumnId)
    if (toColIndex === -1) return // target column not found

    const toCol = columns[toColIndex]!
    if (toCol.limit !== undefined && toCol.cards.length >= toCol.limit) return // WIP limit

    const card = columns[fromColIndex]!.cards[cardIndex]!
    const newColumns = cloneColumns(columns)
    newColumns[fromColIndex]!.cards.splice(cardIndex, 1)
    newColumns[toColIndex]!.cards.push(card)
    store.setState({ columns: newColumns })
    config.onMove?.(cardId, fromColumnId, toColumnId)
  }

  const addCard = (columnId: string, card: KanbanCard): void => {
    const { columns } = store.getState()
    const colIndex = columns.findIndex((c) => c.id === columnId)
    if (colIndex === -1) return

    const col = columns[colIndex]!
    if (col.limit !== undefined && col.cards.length >= col.limit) return // WIP limit
    if (col.cards.some((c) => c.id === card.id)) return // duplicate id

    const newColumns = cloneColumns(columns)
    newColumns[colIndex]!.cards.push({ ...card })
    store.setState({ columns: newColumns })
  }

  const removeCard = (cardId: string): void => {
    const { columns } = store.getState()
    let changed = false
    const newColumns = cloneColumns(columns)
    for (const col of newColumns) {
      const idx = col.cards.findIndex((c) => c.id === cardId)
      if (idx !== -1) {
        col.cards.splice(idx, 1)
        changed = true
        break
      }
    }
    if (changed) store.setState({ columns: newColumns })
  }

  return {
    getState: store.getState.bind(store),
    subscribe: store.subscribe.bind(store),
    moveCard,
    addCard,
    removeCard,
  }
}

/** CSS custom properties the kanban board reads; overridable by the host theme. */
export const kanbanTokens: Record<string, string> = {
  '--iris-kanban-gap': 'var(--iris-gap-md)',
  '--iris-kanban-card-bg': 'var(--iris-surface)',
  '--iris-kanban-col-width': '280px',
}

/**
 * The kanban plugin. Pass to `<IrisProvider plugins={[kanbanPlugin]}>`.
 * Registers the kanban theme tokens.
 */
export const kanbanPlugin = createPlugin({
  name: 'kanban',
  install(registry) {
    registry.registerTokens(kanbanTokens)
  },
})
