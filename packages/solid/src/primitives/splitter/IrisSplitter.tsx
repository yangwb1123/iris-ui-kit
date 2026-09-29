import { createSignal, mergeProps, type JSX } from 'solid-js'
import { useI18n } from '../../i18n'
import { useDrag } from '../drag/useDrag'

export type IrisSplitterOrientation = 'horizontal' | 'vertical'

export interface IrisSplitterProps {
  orientation?: IrisSplitterOrientation
  /** Split ratio in [0, 1]. */
  value?: number
  defaultValue?: number
  onChange?: (value: number) => void
  /** Minimum size of the start pane in px. */
  minStart?: number
  /** Minimum size of the end pane in px. */
  minEnd?: number
  /** Disable dragging. */
  disabled?: boolean
  start?: JSX.Element
  end?: JSX.Element
  style?: JSX.CSSProperties
}

/**
 * Two-pane splitter with a draggable divider.
 * Orientation:
 *   - `horizontal` (default) — divider is a vertical bar; panes are side-by-side.
 *   - `vertical` — divider is a horizontal bar; panes are stacked.
 * Solid port of the Vue IrisSplitter.
 */
export function IrisSplitter(props: IrisSplitterProps): JSX.Element {
  const merged = mergeProps(
    {
      orientation: 'horizontal' as IrisSplitterOrientation,
      defaultValue: 0.5,
      minStart: 80,
      minEnd: 80,
      disabled: false,
    },
    props,
  )

  const { t } = useI18n()

  const isControlled = (): boolean => props.value !== undefined
  const [internalValue, setInternalValue] = createSignal(merged.defaultValue)
  const currentValue = (): number => (isControlled() ? (props.value ?? 0.5) : internalValue())

  const setRatio = (next: number): void => {
    if (!isControlled()) setInternalValue(next)
    merged.onChange?.(next)
  }

  const isHorizontal = (): boolean => merged.orientation === 'horizontal'
  const [dragging, setDragging] = createSignal(false)
  const [handleEl, setHandleEl] = createSignal<HTMLElement | null | undefined>()
  const [containerEl, setContainerEl] = createSignal<HTMLElement | null | undefined>()

  let startRatio = 0
  let totalSize = 0

  useDrag({
    handle: handleEl,
    disabled: () => merged.disabled,
    onStart: () => {
      const container = containerEl()
      if (!container) return false
      const rect = container.getBoundingClientRect()
      totalSize = isHorizontal() ? rect.width : rect.height
      if (totalSize <= 0) return false
      startRatio = currentValue()
      setDragging(true)
      return undefined
    },
    onDrag: ({ dx, dy }) => {
      if (totalSize <= 0) return
      const delta = isHorizontal() ? dx : dy
      const nextRatio = startRatio + delta / totalSize
      const minStartRatio = merged.minStart / totalSize
      const maxRatio = 1 - merged.minEnd / totalSize
      const clamped = Math.max(minStartRatio, Math.min(maxRatio, nextRatio))
      setRatio(clamped)
    },
    onEnd: () => {
      setDragging(false)
    },
  })

  const onKeyDown = (event: KeyboardEvent): void => {
    if (merged.disabled) return
    const rect = containerEl()?.getBoundingClientRect()
    const size = isHorizontal() ? rect?.width : rect?.height
    const min = size && size > 0 ? merged.minStart / size : 0
    const max = size && size > 0 ? 1 - merged.minEnd / size : 1
    const step = event.shiftKey ? 0.01 : 0.05
    let next: number | null = null

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        next = currentValue() - step
        break
      case 'ArrowRight':
      case 'ArrowDown':
        next = currentValue() + step
        break
      case 'Home':
        next = min
        break
      case 'End':
        next = max
        break
      default:
        return
    }

    event.preventDefault()
    setRatio(Math.max(min, Math.min(max, next)))
  }

  return (
    <div
      ref={setContainerEl}
      data-iris-splitter=""
      data-iris-splitter-orientation={merged.orientation}
      data-state={dragging() ? 'dragging' : 'idle'}
      style={{
        display: 'flex',
        'flex-direction': isHorizontal() ? 'row' : 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...(merged.style ?? {}),
      }}
    >
      <div
        data-iris-splitter-pane="start"
        style={{
          flex: `${currentValue()} 1 0`,
          'min-width': '0',
          'min-height': '0',
          overflow: 'auto',
        }}
      >
        {merged.start}
      </div>
      <div
        ref={setHandleEl}
        data-iris-splitter-handle=""
        role="separator"
        aria-label={t('splitter.resize')}
        aria-orientation={merged.orientation}
        aria-valuenow={Math.round(currentValue() * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-disabled={merged.disabled ? 'true' : undefined}
        tabindex={merged.disabled ? -1 : 0}
        onKeyDown={onKeyDown}
        style={{
          flex: '0 0 4px',
          background: dragging() ? 'var(--iris-primary)' : 'var(--iris-border)',
          cursor: merged.disabled ? 'not-allowed' : isHorizontal() ? 'col-resize' : 'row-resize',
          transition: 'background-color 120ms ease',
          position: 'relative',
          'touch-action': 'none',
        }}
      />
      <div
        data-iris-splitter-pane="end"
        style={{
          flex: `${1 - currentValue()} 1 0`,
          'min-width': '0',
          'min-height': '0',
          overflow: 'auto',
        }}
      >
        {merged.end}
      </div>
    </div>
  )
}
