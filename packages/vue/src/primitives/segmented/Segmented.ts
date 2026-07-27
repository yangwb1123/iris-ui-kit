import { defineComponent, h, type PropType } from 'vue'
import { createKeyboardNav, firstEnabledIndex } from '@iris-ui-kit/core'

export type IrisSegmentedSize = 'sm' | 'md' | 'lg'

export interface IrisSegmentedOption {
  label: string
  value: string
  disabled?: boolean
}

const SIZE_MAP: Record<IrisSegmentedSize, { padding: string; fontSize: string; height: string }> = {
  sm: { padding: '2px 8px', fontSize: '12px', height: '24px' },
  md: { padding: '4px 12px', fontSize: '14px', height: '30px' },
  lg: { padding: '6px 16px', fontSize: '16px', height: '36px' },
}

const normalize = (options: Array<IrisSegmentedOption | string>): IrisSegmentedOption[] =>
  options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o))

/**
 * Segmented control: a connected row of single-select segments with the active
 * one visually raised. Radiogroup semantics with roving tabindex and Arrow /
 * Home / End keyboard navigation (skipping disabled segments).
 */
export const IrisSegmented = defineComponent({
  name: 'IrisSegmented',
  inheritAttrs: false,
  props: {
    options: { type: Array as PropType<Array<IrisSegmentedOption | string>>, default: () => [] },
    modelValue: { type: String, default: '' },
    size: { type: String as PropType<IrisSegmentedSize>, default: 'md' },
    disabled: { type: Boolean, default: false },
    /** Stretch to fill the container width. */
    block: { type: Boolean, default: false },
    ariaLabel: { type: String, default: undefined },
  },
  emits: {
    'update:modelValue': (_value: string) => true,
  },
  setup(props, { attrs, emit }) {
    const btns: (HTMLButtonElement | null)[] = []

    const isEnabled = (i: number) => {
      const norm = normalize(props.options)
      return !norm[i]?.disabled && !props.disabled
    }

    const nav = createKeyboardNav({
      count: normalize(props.options).length,
      loop: true,
      orientation: 'horizontal',
      isEnabled,
    })

    const select = (norm: IrisSegmentedOption[], i: number) => {
      const opt = norm[i]
      if (!opt || opt.disabled || props.disabled) return
      emit('update:modelValue', opt.value)
      btns[i]?.focus()
    }

    return () => {
      const norm = normalize(props.options)
      const sz = SIZE_MAP[props.size]
      const selectedIndex = norm.findIndex((o) => o.value === props.modelValue)
      const firstEnabled = firstEnabledIndex(norm.length, (i) => !norm[i]?.disabled)
      const rovingIndex = selectedIndex >= 0 ? selectedIndex : firstEnabled

      // Keep nav in sync with the current options and selection
      if (nav.count !== norm.length) {
        nav.reset(norm.length)
      }
      if (nav.index !== rovingIndex) {
        nav.focus(rovingIndex)
      }

      return h(
        'div',
        {
          ...attrs,
          role: 'radiogroup',
          'aria-label': props.ariaLabel,
          'data-iris-segmented': '',
          'data-iris-segmented-size': props.size,
          'data-disabled': props.disabled ? 'true' : undefined,
          style: {
            display: props.block ? 'flex' : 'inline-flex',
            width: props.block ? '100%' : undefined,
            gap: '2px',
            padding: '2px',
            background: 'var(--iris-surface)',
            borderRadius: 'var(--iris-radius-md, 6px)',
            opacity: props.disabled ? '0.6' : '1',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        norm.map((opt, i) => {
          const selected = opt.value === props.modelValue
          return h(
            'button',
            {
              key: opt.value,
              ref: (el: unknown) => {
                btns[i] = (el ?? null) as HTMLButtonElement | null
              },
              type: 'button',
              role: 'radio',
              'aria-checked': selected ? 'true' : 'false',
              disabled: props.disabled || opt.disabled || undefined,
              tabindex: i === rovingIndex ? 0 : -1,
              'data-iris-segmented-item': '',
              'data-value': opt.value,
              'data-selected': selected ? 'true' : undefined,
              onClick: () => select(norm, i),
              onKeydown: (e: KeyboardEvent) => {
                if (props.disabled) {
                  return
                }
                const action = nav.handleKeyDown({
                  key: e.key,
                  preventDefault: () => e.preventDefault(),
                })
                if (action.type === 'focus') {
                  select(norm, action.target)
                } else if (action.type === 'next') {
                  nav.move(1)
                  select(norm, nav.index)
                } else if (action.type === 'previous') {
                  nav.move(-1)
                  select(norm, nav.index)
                }
              },
              style: {
                flex: props.block ? '1' : undefined,
                padding: sz.padding,
                minHeight: sz.height,
                fontSize: sz.fontSize,
                fontFamily: 'inherit',
                border: 'none',
                borderRadius: 'var(--iris-radius-sm, 4px)',
                cursor: props.disabled || opt.disabled ? 'not-allowed' : 'pointer',
                background: selected ? 'var(--iris-background)' : 'transparent',
                color: selected ? 'var(--iris-foreground)' : 'var(--iris-muted)',
                boxShadow: selected ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                fontWeight: selected ? '600' : '400',
                transition: 'background-color 120ms ease, color 120ms ease',
                whiteSpace: 'nowrap',
              },
            },
            opt.label,
          )
        }),
      )
    }
  },
})
