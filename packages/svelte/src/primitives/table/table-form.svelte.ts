import { buildFormValues, mergeFormFilters, seedFormValues } from '@iris-ui-kit/core'
import { untrack } from 'svelte'
import type { RemoteTableSource } from '@iris-ui-kit/core'
import type { IrisTableFilterValues } from './types'
import type { IrisTableProps } from './props'
import { mergeFilterValues } from './tableUtils'

type TableRow = Record<string, unknown>

export interface TableFormController {
  readonly draft: Record<string, string>
  readonly applied: Record<string, string>
  setValue: (key: string, value: string) => void
  submit: (event: Event) => void
  reset: (event: Event) => void
  clear: () => void
}

/** Adapter-owned form draft/apply bridge for IrisTable's search toolbar. */
export function createTableFormController(options: {
  config: () => IrisTableProps['formConfig']
  filters: () => Record<string, string>
  filterValues: () => IrisTableFilterValues
  hasProxy: () => boolean
  remoteFilter: () => boolean
  proxy: () => RemoteTableSource<TableRow> | null
}): TableFormController {
  // svelte-ignore state_referenced_locally — initial seed only; re-seeding is keyed on the field signature below.
  let draft = $state<Record<string, string>>(seedFormValues(options.config()?.fields))
  let applied = $state<Record<string, string>>({})
  const fieldSignature = $derived(
    (options.config()?.fields ?? [])
      .map((field) => `${field.key}=${field.defaultValue ?? ''}`)
      .join('\u0000'),
  )
  // svelte-ignore state_referenced_locally — the object is read untracked by design: re-seeding is keyed on the field signature only.
  let lastSignature: string | undefined

  $effect(() => {
    const config = untrack(() => options.config())
    const signature = fieldSignature
    if (signature === lastSignature) return
    lastSignature = signature
    draft = seedFormValues(config?.fields)
    applied = {}
  })

  const activeFilters = (values: Record<string, string>): Record<string, string> =>
    mergeFilterValues(mergeFormFilters(options.filters(), values), options.filterValues())

  function setValue(key: string, value: string): void {
    if (draft[key] === value) return
    draft = { ...draft, [key]: value }
  }

  function submit(event: Event): void {
    event.preventDefault()
    const values = buildFormValues(options.config()?.fields, draft)
    options.config()?.onSearch?.(values)
    applied = values
    const proxy = options.proxy()
    if (proxy) {
      void proxy.setParams({ filters: activeFilters(values), page: 1 })
    }
  }

  function reset(event: Event): void {
    event.preventDefault()
    const defaults = seedFormValues(options.config()?.fields)
    draft = defaults
    const values = buildFormValues(options.config()?.fields, defaults)
    applied = values
    options.config()?.onReset?.(values)
    const proxy = options.proxy()
    if (!proxy) return
    if (proxy.setParams({ filters: activeFilters(values), page: 1 }) === false) {
      void proxy.refetch()
    }
  }

  function clear(): void {
    draft = seedFormValues(options.config()?.fields)
    applied = {}
  }

  $effect(() => {
    if (!options.hasProxy() || !options.remoteFilter()) return
    options.proxy()?.setParams({
      filters: mergeFilterValues(
        mergeFormFilters(options.filters(), applied),
        options.filterValues(),
      ),
    })
  })

  return {
    get draft() {
      return draft
    },
    get applied() {
      return applied
    },
    setValue,
    submit,
    reset,
    clear,
  }
}
