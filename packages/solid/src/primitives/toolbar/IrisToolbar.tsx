import { mergeProps, onMount, splitProps, type JSX } from 'solid-js'

export type IrisToolbarOrientation = 'horizontal' | 'vertical'

const SELECTOR = 'button, [href], input, select, textarea, [tabindex]'

export interface IrisToolbarProps {
  orientation?: IrisToolbarOrientation
  ariaLabel?: string
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
  [key: string]: unknown
}

/** Solid port of IrisToolbar — role="toolbar" with roving-tabindex keyboard nav. */
export function IrisToolbar(props: IrisToolbarProps): JSX.Element {
  const merged = mergeProps({ orientation: 'horizontal' as IrisToolbarOrientation }, props)
  const [local, rest] = splitProps(merged, ['orientation', 'ariaLabel', 'children', 'style'])

  let rootRef: HTMLElement | undefined

  const getItems = (): HTMLElement[] => {
    if (!rootRef) return []
    // Filter ONLY disabled items — NOT `tabIndex >= 0`. Roving sets non-active
    // items to tabIndex -1, so a `>= 0` filter would collapse the list to the
    // single active item and break arrow navigation (matches React/Vue/Svelte).
    return (Array.from(rootRef.querySelectorAll(SELECTOR)) as HTMLElement[]).filter(
      (el) => !el.hasAttribute('disabled'),
    )
  }

  onMount(() => {
    getItems().forEach((el, i) => {
      el.tabIndex = i === 0 ? 0 : -1
    })
  })

  const onKeyDown = (e: KeyboardEvent): void => {
    const nextKey = local.orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
    const prevKey = local.orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
    const list = getItems()
    if (list.length === 0) return
    const cur = list.indexOf(document.activeElement as HTMLElement)
    let target: number
    if (e.key === nextKey) target = ((cur < 0 ? 0 : cur) + 1) % list.length
    else if (e.key === prevKey) target = ((cur < 0 ? 0 : cur) - 1 + list.length) % list.length
    else if (e.key === 'Home') target = 0
    else if (e.key === 'End') target = list.length - 1
    else return
    e.preventDefault()
    list.forEach((el, i) => {
      el.tabIndex = i === target ? 0 : -1
    })
    list[target]?.focus()
  }

  return (
    <div
      {...rest}
      ref={(el) => {
        rootRef = el
      }}
      role="toolbar"
      aria-orientation={local.orientation}
      aria-label={local.ariaLabel}
      data-iris-toolbar=""
      data-orientation={local.orientation}
      onKeyDown={onKeyDown}
      style={{
        display: 'inline-flex',
        'flex-direction': local.orientation === 'vertical' ? 'column' : 'row',
        'align-items': 'center',
        gap: '4px',
        ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
      }}
    >
      {local.children}
    </div>
  )
}
