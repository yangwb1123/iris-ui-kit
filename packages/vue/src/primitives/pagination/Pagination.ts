import { computed, defineComponent, h, type PropType } from 'vue'
import { getPageRange, type IrisPageItem } from './types'
import { useI18n } from '../../i18n'

export type IrisPaginationSize = 'sm' | 'md'

/**
 * Numeric page selector with prev/next + optional first/last buttons and
 * two-sided ellipsis. Stateless — caller owns the `current` page (via
 * `v-model`) and is told the page count implicitly through `total +
 * pageSize`.
 */
export const IrisPagination = defineComponent({
  name: 'IrisPagination',
  inheritAttrs: false,
  props: {
    modelValue: { type: Number, default: 1 },
    /** Total number of items across all pages. */
    total: { type: Number, required: true },
    pageSize: { type: Number, default: 10 },
    siblingCount: { type: Number, default: 1 },
    showFirstLast: { type: Boolean, default: false },
    size: { type: String as PropType<IrisPaginationSize>, default: 'md' },
    disabled: { type: Boolean, default: false },
  },
  emits: {
    'update:modelValue': (_value: number) => true,
  },
  setup(props, { attrs, emit }) {
    const { t } = useI18n()
    const totalPages = computed(() =>
      Math.max(1, Math.ceil(props.total / Math.max(1, props.pageSize))),
    )
    const current = computed(() => Math.min(totalPages.value, Math.max(1, props.modelValue)))
    const items = computed<IrisPageItem[]>(() =>
      getPageRange(current.value, totalPages.value, props.siblingCount),
    )

    const go = (page: number) => {
      if (props.disabled) return
      const next = Math.min(totalPages.value, Math.max(1, page))
      if (next === current.value) return
      emit('update:modelValue', next)
    }

    const btnSize = computed(() => (props.size === 'sm' ? '28px' : '32px'))
    const fontSize = computed(() => (props.size === 'sm' ? '12px' : '14px'))

    const baseBtnStyle = computed<Record<string, string>>(() => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: btnSize.value,
      height: btnSize.value,
      padding: '0 8px',
      background: 'transparent',
      color: 'var(--iris-foreground)',
      border: '1px solid var(--iris-border)',
      borderRadius: 'var(--iris-radius-md, 6px)',
      cursor: 'pointer',
      fontSize: fontSize.value,
      fontFamily: 'inherit',
      lineHeight: '1',
    }))

    const renderBtn = (
      page: number | null,
      label: string,
      opts: { kind: string; disabled?: boolean; active?: boolean },
    ) => {
      const isDisabled = opts.disabled || props.disabled
      const isActive = opts.active === true
      const style: Record<string, string> = {
        ...baseBtnStyle.value,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? '0.5' : '1',
        ...(isActive
          ? {
              background: 'var(--iris-primary)',
              color: 'var(--iris-primary-foreground, #fff)',
              borderColor: 'var(--iris-primary)',
            }
          : {}),
      }
      return h(
        'button',
        {
          type: 'button',
          'data-iris-pagination-item': opts.kind,
          'data-iris-pagination-active': isActive ? 'true' : undefined,
          'aria-label': label,
          'aria-current': isActive ? 'page' : undefined,
          disabled: isDisabled || undefined,
          onClick: () => {
            if (page !== null) go(page)
          },
          style,
        },
        opts.kind === 'page' ? String(page) : label,
      )
    }

    const renderEllipsis = (side: 'left' | 'right') =>
      h(
        'span',
        {
          'data-iris-pagination-ellipsis': side,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: btnSize.value,
            height: btnSize.value,
            color: 'var(--iris-muted)',
            fontSize: fontSize.value,
          },
        },
        '…',
      )

    return () =>
      h(
        'nav',
        {
          ...attrs,
          'aria-label': t('pagination.label'),
          'data-iris-pagination': '',
          'data-iris-pagination-size': props.size,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        [
          props.showFirstLast
            ? renderBtn(1, t('pagination.first'), { kind: 'first', disabled: current.value <= 1 })
            : null,
          renderBtn(current.value - 1, t('pagination.previous'), {
            kind: 'prev',
            disabled: current.value <= 1,
          }),
          ...items.value.map((item) => {
            if (item === 'ellipsis-left') return renderEllipsis('left')
            if (item === 'ellipsis-right') return renderEllipsis('right')
            return renderBtn(item, t('pagination.page', { page: item }), {
              kind: 'page',
              active: item === current.value,
            })
          }),
          renderBtn(current.value + 1, t('pagination.next'), {
            kind: 'next',
            disabled: current.value >= totalPages.value,
          }),
          props.showFirstLast
            ? renderBtn(totalPages.value, t('pagination.last'), {
                kind: 'last',
                disabled: current.value >= totalPages.value,
              })
            : null,
        ],
      )
  },
})
