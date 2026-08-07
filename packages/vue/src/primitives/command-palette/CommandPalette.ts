import {
  Teleport,
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type PropType,
} from 'vue'
import { useBodyScrollLock, useFocusTrap } from '../modal-utils'
import { useI18n } from '../../i18n'
import { defaultFilter, type IrisCommandItem } from './types'

/**
 * Command palette: searchable, keyboard-driven action launcher. Built on the
 * modal-utils suite (scroll lock + focus trap). Pattern is: open via shortcut
 * (consumer wires the keyboard listener), type to filter, ↑/↓ to navigate,
 * Enter to execute the focused item, Escape to dismiss.
 */
export const IrisCommandPalette = defineComponent({
  name: 'IrisCommandPalette',
  inheritAttrs: false,
  props: {
    open: { type: Boolean, default: false },
    items: { type: Array as PropType<IrisCommandItem[]>, required: true },
    placeholder: { type: String, default: undefined },
    /** Empty state text when no item matches. */
    emptyText: { type: String, default: undefined },
    /** Custom filter; default is a tolerant subsequence/fuzzy match. */
    filter: {
      type: Function as PropType<(query: string, item: IrisCommandItem) => number | null>,
      default: defaultFilter,
    },
  },
  emits: {
    'update:open': (_value: boolean) => true,
    select: (_item: IrisCommandItem) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    const resolvedPlaceholder = computed(() => props.placeholder ?? t('commandPalette.placeholder'))
    const resolvedEmptyText = computed(() => props.emptyText ?? t('commandPalette.empty'))
    const query = ref('')
    const inputRef = ref<HTMLInputElement | null>(null)
    const surfaceRef = ref<HTMLElement | null>(null)
    const activeIndex = ref(0)

    const matches = computed(() => {
      const result: { item: IrisCommandItem; score: number }[] = []
      for (const item of props.items) {
        const score = props.filter(query.value, item)
        if (score !== null) result.push({ item, score })
      }
      result.sort((a, b) => a.score - b.score)
      return result
    })

    const groupedFlat = computed(() => {
      // Preserve sort order but group by `group` label (last-seen wins).
      const out: ({ kind: 'header'; label: string } | { kind: 'item'; item: IrisCommandItem })[] =
        []
      let currentGroup: string | undefined = undefined
      for (const m of matches.value) {
        const g = m.item.group
        if (g !== currentGroup) {
          if (g) out.push({ kind: 'header', label: g })
          currentGroup = g
        }
        out.push({ kind: 'item', item: m.item })
      }
      return out
    })

    const itemRows = computed(() =>
      groupedFlat.value
        .map((row, i) => (row.kind === 'item' ? { row, i } : null))
        .filter((x): x is { row: { kind: 'item'; item: IrisCommandItem }; i: number } => x !== null)
        .filter((x) => !x.row.item.disabled),
    )

    // Reset filter / active index when (re)opening.
    watch(
      () => props.open,
      (open) => {
        if (open) {
          query.value = ''
          activeIndex.value = 0
          nextTick(() => inputRef.value?.focus())
        }
      },
    )
    watch(query, () => {
      activeIndex.value = 0
    })

    useBodyScrollLock(computed(() => props.open))
    useFocusTrap({
      container: surfaceRef,
      active: computed(() => props.open),
    })

    const close = () => emit('update:open', false)

    const triggerActive = () => {
      const target = itemRows.value[activeIndex.value]
      if (!target) return
      const item = target.row.item
      if (item.disabled) return
      item.action?.()
      emit('select', item)
      close()
    }

    const move = (delta: 1 | -1) => {
      const total = itemRows.value.length
      if (total === 0) return
      activeIndex.value = (activeIndex.value + delta + total) % total
    }

    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          move(1)
          break
        case 'ArrowUp':
          event.preventDefault()
          move(-1)
          break
        case 'Enter':
          event.preventDefault()
          triggerActive()
          break
        case 'Escape':
          event.preventDefault()
          close()
          break
      }
    }

    // Document Escape (for clicks outside the input).
    const onDocKeyDown = (event: KeyboardEvent) => {
      if (!props.open) return
      if (event.key === 'Escape') close()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', onDocKeyDown)
    }
    onBeforeUnmount(() => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('keydown', onDocKeyDown)
      }
    })

    const onBackdropPointerDown = (event: PointerEvent) => {
      if (event.target === event.currentTarget) close()
    }

    return () => {
      if (!props.open) return null

      return h(Teleport, { to: 'body' }, [
        h(
          'div',
          {
            'data-iris-command-palette-backdrop': '',
            onPointerdown: onBackdropPointerDown,
            style: {
              position: 'fixed',
              inset: '0',
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: '15vh',
              zIndex: '1300',
            },
          },
          h(
            'div',
            {
              ...attrs,
              ref: (el: unknown) => {
                surfaceRef.value = (el ?? null) as HTMLElement | null
              },
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': t('commandPalette.label'),
              'data-iris-command-palette': '',
              tabindex: -1,
              onKeydown: onKeyDown,
              style: {
                width: 'min(640px, 92vw)',
                maxHeight: '70vh',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--iris-surface)',
                color: 'var(--iris-foreground)',
                border: '1px solid var(--iris-border)',
                borderRadius: 'var(--iris-radius-lg, 8px)',
                boxShadow: 'var(--iris-shadow-xl)',
                overflow: 'hidden',
                ...((attrs.style as Record<string, string> | undefined) ?? {}),
              },
            },
            [
              h(
                'div',
                {
                  style: {
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--iris-border)',
                  },
                },
                h('input', {
                  ref: (el: unknown) => {
                    inputRef.value = (el ?? null) as HTMLInputElement | null
                  },
                  type: 'text',
                  value: query.value,
                  placeholder: resolvedPlaceholder.value,
                  'data-iris-command-palette-input': '',
                  'aria-label': t('commandPalette.search'),
                  onInput: (e: Event) => {
                    query.value = (e.target as HTMLInputElement).value
                  },
                  style: {
                    width: '100%',
                    padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 'var(--iris-font-size-lg, 16px)',
                    fontFamily: 'inherit',
                    color: 'inherit',
                  },
                }),
              ),
              h(
                'ul',
                {
                  role: 'listbox',
                  'aria-label': t('commandPalette.commands'),
                  'data-iris-command-palette-list': '',
                  style: {
                    listStyle: 'none',
                    margin: '0',
                    padding: '4px',
                    overflow: 'auto',
                    flex: '1',
                  },
                },
                groupedFlat.value.length === 0
                  ? [
                      h(
                        'li',
                        {
                          'data-iris-command-palette-empty': '',
                          style: {
                            padding: '20px',
                            textAlign: 'center',
                            color: 'var(--iris-muted)',
                            fontSize: 'var(--iris-font-size-sm, 13px)',
                          },
                        },
                        resolvedEmptyText.value,
                      ),
                    ]
                  : groupedFlat.value.map((row, i) => {
                      if (row.kind === 'header') {
                        return h(
                          'li',
                          {
                            key: `g-${row.label}-${i}`,
                            'data-iris-command-palette-group': '',
                            style: {
                              padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
                              fontSize: 'var(--iris-font-size-xs, 12px)',
                              fontWeight: '600',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              color: 'var(--iris-muted)',
                            },
                          },
                          row.label,
                        )
                      }
                      const item = row.item
                      const enabledIdx = itemRows.value.findIndex((r) => r.i === i)
                      const isActive = enabledIdx === activeIndex.value
                      return h(
                        'li',
                        {
                          key: item.id,
                          role: 'option',
                          'aria-selected': isActive ? 'true' : 'false',
                          'aria-disabled': item.disabled ? 'true' : undefined,
                          'data-iris-command-palette-item': item.id,
                          'data-state': isActive ? 'active' : item.disabled ? 'disabled' : 'idle',
                          onClick: () => {
                            if (item.disabled) return
                            activeIndex.value = enabledIdx
                            triggerActive()
                          },
                          onMouseenter: () => {
                            if (item.disabled) return
                            activeIndex.value = enabledIdx
                          },
                          style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--iris-space-sm, 12px)',
                            padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
                            borderRadius: 'var(--iris-radius-sm, 4px)',
                            cursor: item.disabled ? 'not-allowed' : 'pointer',
                            opacity: item.disabled ? '0.5' : '1',
                            background: isActive ? 'var(--iris-surface-hover)' : 'transparent',
                            color: 'inherit',
                            fontSize: 'var(--iris-font-size-md, 14px)',
                          },
                        },
                        [
                          item.icon
                            ? h(
                                'span',
                                {
                                  'aria-hidden': 'true',
                                  style: { width: '20px', textAlign: 'center' },
                                },
                                item.icon,
                              )
                            : null,
                          h('span', { style: { flex: '1', minWidth: '0' } }, item.label),
                          item.shortcut
                            ? h(
                                'span',
                                {
                                  'data-iris-command-palette-shortcut': '',
                                  style: {
                                    fontSize: 'var(--iris-font-size-xs, 12px)',
                                    padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
                                    background: 'var(--iris-background)',
                                    border: '1px solid var(--iris-border)',
                                    borderRadius: 'var(--iris-radius-sm, 4px)',
                                    color: 'var(--iris-muted)',
                                    fontFamily: 'monospace',
                                  },
                                },
                                item.shortcut,
                              )
                            : null,
                        ],
                      )
                    }),
              ),
            ],
          ),
        ),
      ])
    }
  },
})
