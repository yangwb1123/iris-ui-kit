import { computed, defineComponent, h, type PropType, type VNode } from 'vue'
import type { IrisButtonSize, IrisButtonType, IrisButtonVariant } from './types'
import { installButtonStyles } from './styles'
import { findFirstElement, mergeSlotProps } from '../slot/Slot'

type StyleMap = Record<string, string>

const SIZE_STYLES: Record<IrisButtonSize, StyleMap> = {
  sm: {
    padding: 'var(--iris-padding-sm) var(--iris-padding-md)',
    fontSize: 'var(--iris-font-size-xs, 12px)',
  },
  md: {
    padding: 'var(--iris-padding-sm) var(--iris-padding-lg)',
    fontSize: 'var(--iris-font-size-md, 14px)',
  },
  lg: {
    padding: 'var(--iris-padding-md) var(--iris-padding-lg)',
    fontSize: 'var(--iris-font-size-lg, 16px)',
  },
}

const VARIANT_STYLES: Record<IrisButtonVariant, StyleMap> = {
  solid: {
    background: 'var(--iris-primary)',
    color: 'var(--iris-primary-foreground)',
    border: '1px solid var(--iris-primary)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--iris-primary)',
    border: '1px solid var(--iris-border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--iris-foreground)',
    border: '1px solid transparent',
  },
  link: {
    background: 'transparent',
    color: 'var(--iris-primary)',
    border: '1px solid transparent',
    textDecoration: 'none',
  },
}

function buildInlineStyle(variant: IrisButtonVariant, size: IrisButtonSize): StyleMap {
  const base: StyleMap = { ...SIZE_STYLES[size], ...VARIANT_STYLES[variant] }
  if (variant === 'link') {
    base.padding = '0'
  }
  return base
}

function renderSpinner(): VNode {
  return h(
    'svg',
    {
      class: 'iris-button-spinner',
      viewBox: '0 0 24 24',
      fill: 'none',
      'aria-hidden': 'true',
    },
    [
      h('circle', {
        cx: '12',
        cy: '12',
        r: '10',
        stroke: 'currentColor',
        'stroke-opacity': '0.25',
        'stroke-width': '3',
      }),
      h('path', {
        d: 'M22 12a10 10 0 0 1-10 10',
        stroke: 'currentColor',
        'stroke-width': '3',
        'stroke-linecap': 'round',
      }),
    ],
  )
}

/**
 * Foundational button primitive. Props-driven, no internal state machine —
 * Button's behavior is fully derived from `variant`, `size`, `disabled`, and
 * `loading`. Composite primitives (Popover, Tooltip, Dialog, Select) **do**
 * need state machines; Button does not, and forcing one on it would violate
 * the project's "use a machine only when there is observable state to model"
 * rule.
 *
 * Styling: variant colors and size paddings ship as inline `style` referencing
 * `var(--iris-*)` so theme switching is instant. A small singleton stylesheet
 * (auto-installed on first mount, removable in tests) covers `:hover`,
 * `:focus-visible`, and the spinner keyframe — things inline `style` cannot
 * express.
 *
 * Accessibility:
 *   - native `<button>` (focusable, keyboard-activatable by default)
 *   - `disabled` → HTML `disabled` + `aria-disabled="true"`
 *   - `loading` → `aria-busy="true"` + click swallowed
 *   - default `type="button"` to prevent accidental form submission
 *
 * @example
 * <IrisButton variant="solid" size="md" @click="save">Save</IrisButton>
 *
 * @example
 * <IrisButton variant="outline" :loading="isSaving" @click="save">
 *   <template #leading><CheckIcon /></template>
 *   Save
 * </IrisButton>
 */
export const IrisButton = defineComponent({
  name: 'IrisButton',
  props: {
    variant: { type: String as PropType<IrisButtonVariant>, default: 'solid' },
    size: { type: String as PropType<IrisButtonSize>, default: 'md' },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    type: { type: String as PropType<IrisButtonType>, default: 'button' },
    asChild: { type: Boolean, default: false },
  },
  emits: {
    click: (_event: MouseEvent) => true,
  },
  setup(props, { slots, emit }) {
    installButtonStyles()

    const isInteractive = computed(() => !props.disabled && !props.loading)
    const inlineStyle = computed(() => buildInlineStyle(props.variant, props.size))

    const onClick = (event: MouseEvent) => {
      if (!isInteractive.value) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      emit('click', event)
    }

    return () => {
      const baseProps: Record<string, unknown> = {
        class: 'iris-button',
        'data-iris-button-variant': props.variant,
        'data-iris-button-size': props.size,
        'aria-disabled': props.disabled ? 'true' : undefined,
        'aria-busy': props.loading ? 'true' : undefined,
        style: inlineStyle.value,
        onClick,
      }

      if (props.asChild) {
        const root = findFirstElement(slots.default?.())
        if (!root) {
          if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'production') {
            console.warn('[iris-ui] IrisButton: as-child requires a single child element')
          }
          return null
        }
        // For non-<button> roots, the `disabled` HTML attribute may be a no-op.
        // We still set `aria-disabled` (above) and intercept clicks via
        // `composeEventHandlers` inside `mergeSlotProps`, which bails out if
        // the parent handler calls `event.preventDefault()`.
        const parentProps: Record<string, unknown> = {
          ...baseProps,
          disabled: isInteractive.value ? undefined : true,
        }
        const merged = mergeSlotProps(parentProps, (root.props ?? {}) as Record<string, unknown>)
        return h(root.type as string, merged, root.children as unknown as VNode[])
      }

      const leadingContent: VNode | VNode[] | undefined = props.loading
        ? renderSpinner()
        : slots.leading?.()

      const children: Array<VNode | VNode[] | undefined> = []
      if (leadingContent) {
        children.push(h('span', { class: 'iris-button-leading' }, leadingContent))
      }
      const defaultSlot = slots.default?.()
      if (defaultSlot) children.push(defaultSlot)

      return h(
        'button',
        {
          ...baseProps,
          type: props.type,
          disabled: isInteractive.value ? undefined : true,
        },
        children,
      )
    }
  },
})
