import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js'
import { rowsFromCsv } from '@iris-ui-kit/core'
import type { IrisTableToolbarConfig } from './types'

type Row = Record<string, unknown>

export interface TableImportController {
  importFileInput: Accessor<HTMLInputElement | null>
  setImportFileInput: (node: HTMLInputElement | null) => void
  importPreviewRows: Accessor<Row[] | null>
  handleImportFile: (event: Event) => void
  confirmImportPreview: () => void
  cancelImportPreview: () => void
}

/** Bridges CSV file selection and the optional import confirmation modal. */
export function createTableImportController(options: {
  getToolbar: () => IrisTableToolbarConfig | undefined
  importPreview: () => boolean | undefined
}): TableImportController {
  const [importFileInput, setImportFileInput] = createSignal<HTMLInputElement | null>(null)
  const [importPreviewRows, setImportPreviewRows] = createSignal<Row[] | null>(null)

  const handleImportFile = (event: Event): void => {
    const input = event.target as HTMLInputElement | null
    const file = input?.files?.[0]
    const onImport = options.getToolbar()?.onImport
    if (!file || !onImport || typeof FileReader === 'undefined') return
    const reader = new FileReader()
    reader.onload = () => {
      const rows = rowsFromCsv(String(reader.result ?? ''))
      if (rows.length === 0) return
      if (options.importPreview()) setImportPreviewRows(rows)
      else options.getToolbar()?.onImport?.(rows)
    }
    reader.readAsText(file)
    if (input) input.value = ''
  }

  const confirmImportPreview = (): void => {
    const rows = importPreviewRows()
    if (!rows) return
    options.getToolbar()?.onImport?.(rows)
    setImportPreviewRows(null)
  }

  const cancelImportPreview = (): void => {
    setImportPreviewRows(null)
  }

  createEffect(() => {
    if (!importPreviewRows() || typeof window === 'undefined') return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') cancelImportPreview()
    }
    window.addEventListener('keydown', closeOnEscape)
    onCleanup(() => window.removeEventListener('keydown', closeOnEscape))
  })

  return {
    importFileInput,
    setImportFileInput,
    importPreviewRows,
    handleImportFile,
    confirmImportPreview,
    cancelImportPreview,
  }
}
