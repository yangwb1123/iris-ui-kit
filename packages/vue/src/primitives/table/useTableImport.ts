import { ref, watch, type Ref } from 'vue'
import { rowsFromCsv } from '@iris-ui-kit/core'

type Row = Record<string, unknown>

export interface UseTableImportResult {
  importFileInput: Ref<HTMLInputElement | null>
  importPreviewRows: Ref<Row[] | null>
  handleImportFile: (event: Event) => void
  confirmImportPreview: () => void
  cancelImportPreview: () => void
}

/** Bridges CSV file selection and the optional import confirmation modal. */
export function useTableImport(
  isPreviewEnabled: () => boolean,
  getOnImport: () => ((rows: Row[]) => void) | undefined,
): UseTableImportResult {
  const importFileInput = ref<HTMLInputElement | null>(null)
  const importPreviewRows = ref<Row[] | null>(null)

  const handleImportFile = (event: Event): void => {
    const input = event.target as HTMLInputElement | null
    const file = input?.files?.[0]
    if (!file || !getOnImport() || typeof FileReader === 'undefined') return
    const reader = new FileReader()
    reader.onload = () => {
      const rows = rowsFromCsv(String(reader.result ?? ''))
      if (rows.length === 0) return
      if (isPreviewEnabled()) importPreviewRows.value = rows
      else getOnImport()?.(rows)
    }
    reader.readAsText(file)
    if (input) input.value = ''
  }

  const confirmImportPreview = (): void => {
    if (!importPreviewRows.value) return
    getOnImport()?.(importPreviewRows.value)
    importPreviewRows.value = null
  }

  const cancelImportPreview = (): void => {
    importPreviewRows.value = null
  }

  watch(importPreviewRows, (rows, _previous, onCleanup) => {
    if (!rows || typeof window === 'undefined') return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') cancelImportPreview()
    }
    window.addEventListener('keydown', closeOnEscape)
    onCleanup(() => window.removeEventListener('keydown', closeOnEscape))
  })

  return {
    importFileInput,
    importPreviewRows,
    handleImportFile,
    confirmImportPreview,
    cancelImportPreview,
  }
}
