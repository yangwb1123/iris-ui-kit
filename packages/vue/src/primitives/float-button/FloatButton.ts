import { defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType } from 'vue'
import { useI18n } from '../../i18n'

export type IrisFloatButtonShape = 'circle' | 'square'

export interface IrisFloatButtonAction {
  key: string
  icon?: string
  label?: string
  ariaLabel?: string
  onClick?: () => void
}

const fab = (size: number, primary: boolean): Record<string, string> => ({
  width: `${size}px`,
  height: `${size}px`,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: primary ? 'none' : '1px solid var(--iris-border)',
  background: primary ? 'var(--iris-primary)' : 'var(--iris-background)',
  color: primary ? '#fff' : 'var(--iris-foreground)',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
  fontSize: size > 44 ? '22px' : '16px',
  lineHeight: '1',
})

/**
 * Floating action button: a fixed-position FAB. With `actions` it becomes a
 * speed-dial — click toggles a `role="menu"` stack of actions (dismissed by
 * selection, Escape, or outside click). Otherwise click emits `click`.
 */
export const IrisFloatButton = defineComponent({
  name: 'IrisFloatButton',
  inheritAttrs: false,
  props: {
    icon: { type: String, default: '+' },
    ariaLabel: { type: String, default: undefined },
    shape: { type: String as PropType<IrisFloatButtonShape>, default: 'circle' },
    actions: { type: Array as PropType<IrisFloatButtonAction[]>, default: undefined },
    /** Corner offsets (logical: distance from block-end / inline-end). */
    offset: { type: Object as PropType<{ bottom?: number; right?: number }>, default: undefined },
  },
  emits: {
    click: () => true,
  },
  setup(props, { attrs, slots, emit }) {
    const { t } = useI18n()
    const rootEl = ref<HTMLElement | null>(null)
    const open = ref(false)
    const hasActions = () => !!props.actions && props.actions.length > 0

    const onDown = (e: MouseEvent) => {
      if (open.value && rootEl.value && !rootEl.value.contains(e.target as Node)) open.value = false
    }
    const onKey = (e: KeyboardEvent) => {
      if (open.value && e.key === 'Escape') open.value = false
    }
    onMounted(() => {
      document.addEventListener('mousedown', onDown)
      document.addEventListener('keydown', onKey)
    })
    onBeforeUnmount(() => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    })

    return () => {
      const radius = props.shape === 'circle' ? '50%' : 'var(--iris-radius-md, 6px)'
      const children = []

      if (hasActions() && open.value) {
        children.push(
          h(
            'div',
            {
              'data-iris-float-button-actions': '',
              role: 'menu',
              style: {
                display: 'flex',
                flexDirection: 'column-reverse',
                gap: '12px',
                alignItems: 'center',
              },
            },
            props.actions!.map((a) =>
              h(
                'button',
                {
                  key: a.key,
                  type: 'button',
                  role: 'menuitem',
                  'data-iris-float-button-action': '',
                  'data-key': a.key,
                  'aria-label': a.ariaLabel ?? a.label,
                  onClick: () => {
                    a.onClick?.()
                    open.value = false
                  },
                  style: { ...fab(40, false), borderRadius: radius },
                },
                a.icon ?? a.label,
              ),
            ),
          ),
        )
      }

      children.push(
        h(
          'button',
          {
            type: 'button',
            'data-iris-float-button': '',
            'aria-label': props.ariaLabel ?? (hasActions() ? t('floatButton.actions') : undefined),
            'aria-haspopup': hasActions() ? 'menu' : undefined,
            'aria-expanded': hasActions() ? (open.value ? 'true' : 'false') : undefined,
            onClick: () => {
              if (hasActions()) open.value = !open.value
              else emit('click')
            },
            style: { ...fab(48, true), borderRadius: radius },
          },
          slots.default ? slots.default() : props.icon,
        ),
      )

      return h(
        'div',
        {
          ...attrs,
          ref: rootEl,
          'data-iris-float-button-root': '',
          style: {
            position: 'fixed',
            insetBlockEnd: `${props.offset?.bottom ?? 24}px`,
            insetInlineEnd: `${props.offset?.right ?? 24}px`,
            zIndex: '1000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        children,
      )
    }
  },
})
