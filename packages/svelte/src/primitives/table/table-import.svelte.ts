import { rowsFromCsv } from '@iris-ui-kit/core'
import type { IrisTableToolbarConfig } from './types'

type Row = Record<string, unknown>

export interface TableImportController {
  readonly rows: Row[] | null
  handleFile: (event: Event) => void
  confirm: () => void
  cancel: () => void
}

/** Bridges CSV file selection and the optional import confirmation modal. */
export function createTableImportController(options: {
  getToolbar: () => IrisTableToolbarConfig | undefined
  isPreviewEnabled: () => boolean
}): TableImportController {
  let rows = $state<Row[] | null>(null)

  function handleFile(event: Event): void {
    const input = event.target as HTMLInputElement | null
    const file = input?.files?.[0]
    const onImport = options.getToolbar()?.onImport
    if (!file || !onImport || typeof FileReader === 'undefined') return
    const reader = new FileReader()
    reader.onload = () => {
      const next = rowsFromCsv(String(reader.result ?? ''))
      if (next.length === 0) return
      if (options.isPreviewEnabled()) rows = next
      else options.getToolbar()?.onImport?.(next)
    }
    reader.readAsText(file)
    if (input) input.value = ''
  }

  function confirm(): void {
    if (!rows) return
    options.getToolbar()?.onImport?.(rows)
    rows = null
  }

  function cancel(): void {
    rows = null
  }

  $effect(() => {
    if (!rows || typeof window === 'undefined') return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  })

  return {
    get rows() {
      return rows
    },
    handleFile,
    confirm,
    cancel,
  }
}
