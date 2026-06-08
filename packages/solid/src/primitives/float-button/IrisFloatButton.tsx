import {
  createSignal,
  For,
  mergeProps,
  onCleanup,
  onMount,
  Show,
  splitProps,
  type JSX,
} from 'solid-js'

export type IrisFloatButtonShape = 'circle' | 'square'

export interface IrisFloatButtonAction {
  key: string
  icon?: string
  label?: string
  ariaLabel?: string
  onClick?: () => void
}

function fabStyle(size: number, primary: boolean): JSX.CSSProperties {
  return {
    width: `${size}px`,
    height: `${size}px`,
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    border: primary ? 'none' : '1px solid var(--iris-border)',
    background: primary ? 'var(--iris-primary)' : 'var(--iris-background)',
    color: primary ? '#fff' : 'var(--iris-foreground)',
    cursor: 'pointer',
    'box-shadow': '0 4px 12px rgba(0,0,0,0.18)',
    'font-size': size > 44 ? '22px' : '16px',
    'line-height': '1',
  }
}

export interface IrisFloatButtonProps {
  icon?: string
  ariaLabel?: string
  shape?: IrisFloatButtonShape
  actions?: IrisFloatButtonAction[]
  offset?: { bottom?: number; right?: number }
  onClick?: () => void
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
  [key: string]: unknown
}

/** Solid port of IrisFloatButton — fixed FAB with optional speed-dial. */
export function IrisFloatButton(props: IrisFloatButtonProps): JSX.Element {
  const merged = mergeProps({ icon: '+', shape: 'circle' as IrisFloatButtonShape }, props)
  const [local, rest] = splitProps(merged, [
    'icon',
    'ariaLabel',
    'shape',
    'actions',
    'offset',
    'onClick',
    'children',
    'style',
  ])

  const [open, setOpen] = createSignal(false)
  let rootEl: HTMLElement | undefined

  const hasActions = (): boolean => !!(local.actions && local.actions.length > 0)

  const onDown = (e: MouseEvent): void => {
    if (open() && rootEl && !rootEl.contains(e.target as Node)) setOpen(false)
  }
  const onKey = (e: KeyboardEvent): void => {
    if (open() && e.key === 'Escape') setOpen(false)
  }

  onMount(() => {
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
  })

  onCleanup(() => {
    document.removeEventListener('mousedown', onDown)
    document.removeEventListener('keydown', onKey)
  })

  const radius = (): string => (local.shape === 'circle' ? '50%' : 'var(--iris-radius-md, 6px)')

  return (
    <div
      {...rest}
      ref={(el) => {
        rootEl = el
      }}
      data-iris-float-button-root=""
      style={{
        position: 'fixed',
        'inset-block-end': `${local.offset?.bottom ?? 24}px`,
        'inset-inline-end': `${local.offset?.right ?? 24}px`,
        'z-index': '1000',
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        gap: '12px',
        ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
      }}
    >
      <Show when={hasActions() && open()}>
        <div
          data-iris-float-button-actions=""
          role="menu"
          style={{
            display: 'flex',
            'flex-direction': 'column-reverse',
            gap: '12px',
            'align-items': 'center',
          }}
        >
          <For each={local.actions ?? []}>
            {(a) => (
              <button
                type="button"
                role="menuitem"
                data-iris-float-button-action=""
                data-key={a.key}
                aria-label={a.ariaLabel ?? a.label}
                onClick={() => {
                  a.onClick?.()
                  setOpen(false)
                }}
                style={{ ...fabStyle(40, false), 'border-radius': radius() }}
              >
                {a.icon ?? a.label}
              </button>
            )}
          </For>
        </div>
      </Show>
      <button
        type="button"
        data-iris-float-button=""
        aria-label={local.ariaLabel ?? (hasActions() ? 'Actions' : undefined)}
        aria-haspopup={hasActions() ? 'menu' : undefined}
        aria-expanded={hasActions() ? (open() ? 'true' : 'false') : undefined}
        onClick={() => {
          if (hasActions()) setOpen((o) => !o)
          else local.onClick?.()
        }}
        style={{ ...fabStyle(48, true), 'border-radius': radius() }}
      >
        {local.children ?? local.icon}
      </button>
    </div>
  )
}
