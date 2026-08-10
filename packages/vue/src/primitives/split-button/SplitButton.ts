import { defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType } from 'vue'
import { useI18n } from '../../i18n'

export type IrisSplitButtonVariant = 'primary' | 'default'
export type IrisSplitButtonSize = 'sm' | 'md' | 'lg'

export interface IrisSplitButtonAction {
  key: string
  label: string
  disabled?: boolean
  onClick?: () => void
}

const SIZE_MAP: Record<IrisSplitButtonSize, { padding: string; fontSize: string; height: string }> =
  {
    sm: {
      padding: 'var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px)',
      fontSize: 'var(--iris-font-size-xs, 12px)',
      height: '28px',
    },
    md: {
      padding: 'var(--iris-space-xs, 8px) var(--iris-space-md, 16px)',
      fontSize: 'var(--iris-font-size-md, 14px)',
      height: '34px',
    },
    lg: {
      padding: 'var(--iris-space-xs, 8px) var(--iris-space-lg, 20px)',
      fontSize: 'var(--iris-font-size-lg, 16px)',
      height: '40px',
    },
  }

/**
 * Split button: a primary action joined to a caret that opens a `role="menu"`
 * of secondary actions (dismissed by selection, Escape, or outside click).
 */
export const IrisSplitButton = defineComponent({
  name: 'IrisSplitButton',
  inheritAttrs: false,
  props: {
    actions: { type: Array as PropType<IrisSplitButtonAction[]>, default: undefined },
    variant: { type: String as PropType<IrisSplitButtonVariant>, default: 'primary' },
    size: { type: String as PropType<IrisSplitButtonSize>, default: 'md' },
    disabled: { type: Boolean, default: false },
    menuAriaLabel: { type: String, default: undefined },
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

    const select = (a: IrisSplitButtonAction) => {
      if (a.disabled) return
      a.onClick?.()
      open.value = false
    }

    return () => {
      const sz = SIZE_MAP[props.size]
      const colors: Record<string, string> =
        props.variant === 'primary'
          ? {
              background: 'var(--iris-primary)',
              color: '#fff',
              border: '1px solid var(--iris-primary)',
            }
          : {
              background: 'var(--iris-surface)',
              color: 'var(--iris-foreground)',
              border: '1px solid var(--iris-border)',
            }
      const label = props.menuAriaLabel ?? t('splitButton.more')
      const children = [
        h(
          'button',
          {
            type: 'button',
            'data-iris-split-button-main': '',
            disabled: props.disabled || undefined,
            onClick: () => {
              if (!props.disabled) emit('click')
            },
            style: {
              ...colors,
              padding: sz.padding,
              minHeight: sz.height,
              fontSize: sz.fontSize,
              fontFamily: 'inherit',
              borderStartStartRadius: 'var(--iris-radius-md, 6px)',
              borderEndStartRadius: 'var(--iris-radius-md, 6px)',
              cursor: props.disabled ? 'not-allowed' : 'pointer',
              opacity: props.disabled ? '0.6' : '1',
            },
          },
          slots.default ? slots.default() : undefined,
        ),
      ]

      if (hasActions()) {
        children.push(
          h(
            'button',
            {
              type: 'button',
              'data-iris-split-button-trigger': '',
              'aria-haspopup': 'menu',
              'aria-expanded': open.value ? 'true' : 'false',
              'aria-label': label,
              disabled: props.disabled || undefined,
              onClick: () => {
                if (!props.disabled) open.value = !open.value
              },
              style: {
                ...colors,
                borderInlineStart:
                  props.variant === 'primary'
                    ? '1px solid rgba(255,255,255,0.3)'
                    : '1px solid var(--iris-border)',
                padding: '0 var(--iris-space-xs, 8px)',
                minHeight: sz.height,
                fontSize: 'var(--iris-font-size-xs, 12px)',
                borderStartEndRadius: 'var(--iris-radius-md, 6px)',
                borderEndEndRadius: 'var(--iris-radius-md, 6px)',
                cursor: props.disabled ? 'not-allowed' : 'pointer',
                opacity: props.disabled ? '0.6' : '1',
                display: 'inline-flex',
                alignItems: 'center',
              },
            },
            '▾',
          ),
        )
      }

      if (open.value && hasActions()) {
        children.push(
          h(
            'ul',
            {
              role: 'menu',
              'aria-label': label,
              'data-iris-split-button-menu': '',
              style: {
                position: 'absolute',
                insetInlineEnd: '0',
                top: '100%',
                marginBlockStart: '4px',
                minWidth: '140px',
                listStyle: 'none',
                margin: '0',
                padding: '4px',
                zIndex: '50',
                background: 'var(--iris-background)',
                border: '1px solid var(--iris-border)',
                borderRadius: 'var(--iris-radius-md, 6px)',
                boxShadow: 'var(--iris-shadow-lg)',
              },
            },
            props.actions!.map((a) =>
              h(
                'li',
                {
                  key: a.key,
                  role: 'menuitem',
                  'aria-disabled': a.disabled ? 'true' : undefined,
                  'data-iris-split-button-item': '',
                  'data-key': a.key,
                  onClick: () => select(a),
                  style: {
                    padding: 'var(--iris-space-xs, 8px) var(--iris-space-sm, 12px)',
                    fontSize: 'var(--iris-font-size-md, 14px)',
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                    cursor: a.disabled ? 'not-allowed' : 'pointer',
                    color: a.disabled ? 'var(--iris-muted)' : 'var(--iris-foreground)',
                  },
                },
                a.label,
              ),
            ),
          ),
        )
      }

      return h(
        'div',
        {
          ...attrs,
          ref: rootEl,
          'data-iris-split-button': '',
          'data-state': open.value ? 'open' : 'closed',
          style: {
            position: 'relative',
            display: 'inline-flex',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        children,
      )
    }
  },
})
