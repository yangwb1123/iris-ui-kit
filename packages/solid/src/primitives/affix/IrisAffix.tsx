import { createSignal, mergeProps, onCleanup, onMount, splitProps, type JSX } from 'solid-js'

export interface IrisAffixProps {
  offsetTop?: number
  offsetBottom?: number
  target?: () => HTMLElement | Window | null
  onChange?: (affixed: boolean) => void
  children?: JSX.Element
  style?: JSX.CSSProperties | string
  class?: string
  [key: string]: unknown
}

const resolve = (target?: () => HTMLElement | Window | null): HTMLElement | Window =>
  (target ? target() : window) ?? window

/** Solid port of IrisAffix — pins content to viewport after scroll threshold. */
export function IrisAffix(props: IrisAffixProps): JSX.Element {
  return <IrisAffixInner {...props} />
}

function IrisAffixInner(props: IrisAffixProps): JSX.Element {
  const [local, rest] = splitProps(mergeProps({}, props), [
    'offsetTop',
    'offsetBottom',
    'target',
    'onChange',
    'children',
    'style',
  ])

  const [affixed, setAffixed] = createSignal(false)
  const [fixedStyle, setFixedStyle] = createSignal<JSX.CSSProperties | undefined>(undefined)
  const [reserve, setReserve] = createSignal<number | undefined>(undefined)

  let placeholderEl: HTMLElement | undefined
  let contentEl: HTMLElement | undefined
  let scrollEl: HTMLElement | Window | undefined
  let isAffixed = false

  const update = (): void => {
    const ph = placeholderEl
    if (!ph) return
    const useTop = local.offsetTop != null || local.offsetBottom == null
    const ot = local.offsetTop ?? 0
    const ob = local.offsetBottom ?? 0
    const rect = ph.getBoundingClientRect()
    const vh = window.innerHeight || 0
    const next = useTop ? rect.top <= ot : rect.bottom >= vh - ob
    if (next === isAffixed) return
    isAffixed = next
    const width = ph.offsetWidth
    setFixedStyle(
      next
        ? {
            position: 'fixed',
            'inset-inline-start': `${rect.left}px`,
            width: `${width}px`,
            'z-index': '10',
            ...(useTop ? { top: `${ot}px` } : { bottom: `${ob}px` }),
          }
        : undefined,
    )
    setReserve(next ? (contentEl?.offsetHeight ?? 0) : undefined)
    setAffixed(next)
    local.onChange?.(next)
  }

  onMount(() => {
    scrollEl = resolve(local.target)
    scrollEl.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
  })

  onCleanup(() => {
    scrollEl?.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
  })

  return (
    <div
      {...rest}
      ref={(el) => {
        placeholderEl = el
      }}
      data-iris-affix=""
      data-affixed={affixed() ? 'true' : undefined}
      style={{
        ...(affixed() && reserve() != null ? { height: `${reserve()}px` } : {}),
        ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
      }}
    >
      <div
        ref={(el) => {
          contentEl = el
        }}
        data-iris-affix-content=""
        style={affixed() ? fixedStyle() : undefined}
      >
        {local.children}
      </div>
    </div>
  )
}
