import type { IrisTableFilterValues } from './types'

export interface TableFilterController {
  readonly values: IrisTableFilterValues
  readonly openKey: string | null
  readonly draft: string[]
  open: (key: string) => void
  close: () => void
  toggle: (value: string) => void
  apply: (key: string, values?: string[]) => void
  clear: (key: string) => void
  clearAll: () => void
}

export function createTableFilterController(options: {
  getControlled: () => IrisTableFilterValues | undefined
  onChange?: (next: IrisTableFilterValues) => void
}): TableFilterController {
  let internal = $state<IrisTableFilterValues>({})
  let openKey = $state<string | null>(null)
  let draft = $state<string[]>([])
  const values = $derived(options.getControlled() ?? internal)

  function open(key: string): void {
    openKey = key
    draft = [...(values[key] ?? [])]
  }

  function close(): void {
    openKey = null
  }

  function toggle(value: string): void {
    draft = draft.includes(value) ? draft.filter((item) => item !== value) : [...draft, value]
  }

  function commit(key: string, nextValues: string[]): void {
    const next = { ...values }
    if (nextValues.length > 0) next[key] = [...nextValues]
    else delete next[key]
    if (options.getControlled() === undefined) internal = next
    options.onChange?.(next)
  }

  function apply(key: string, nextValues = draft): void {
    commit(key, nextValues)
    close()
  }

  function clear(key: string): void {
    commit(key, [])
    close()
  }

  function clearAll(): void {
    if (options.getControlled() === undefined) internal = {}
    options.onChange?.({})
    close()
  }

  return {
    get values() {
      return values
    },
    get openKey() {
      return openKey
    },
    get draft() {
      return draft
    },
    open,
    close,
    toggle,
    apply,
    clear,
    clearAll,
  }
}
