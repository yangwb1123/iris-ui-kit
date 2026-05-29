import * as React from 'react'
import { useDrag } from '../drag/useDrag'

export type IrisSplitterOrientation = 'horizontal' | 'vertical'

export interface IrisSplitterProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  orientation?: IrisSplitterOrientation
  /** Split ratio in [0, 1]. */
  value?: number
  defaultValue?: number
  onValueChange?: (next: number) => void
  /** Minimum size of the start pane in px. */
  minStart?: number
  /** Minimum size of the end pane in px. */
  minEnd?: number
  disabled?: boolean
  /** Start pane content. */
  start?: React.ReactNode
  /** End pane content. */
  end?: React.ReactNode
}

/**
 * Two-pane splitter with a draggable divider. The split position is a number
 * in `[0, 1]`. Clamping respects `minStart` / `minEnd` (in px) so panes
 * cannot collapse below a usable size.
 */
export function IrisSplitter({
  orientation = 'horizontal',
  value: valueProp,
  defaultValue = 0.5,
  onValueChange,
  minStart = 80,
  minEnd = 80,
  disabled = false,
  style,
  start,
  end,
  ...rest
}: IrisSplitterProps): React.ReactElement {
  const isControlled = valueProp !== undefined
  const [internal, setInternal] = React.useState(defaultValue)
  const ratio = isControlled ? (valueProp as number) : internal
  const ratioRef = React.useRef(ratio)
  ratioRef.current = ratio

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const handleRef = React.useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = React.useState(false)

  const isHorizontal = orientation === 'horizontal'
  const startRatioRef = React.useRef(0)
  const totalSizeRef = React.useRef(0)

  const setRatio = (next: number) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  useDrag({
    handle: handleRef,
    disabled,
    onStart: () => {
      const container = containerRef.current
      if (!container) return false
      const rect = container.getBoundingClientRect()
      totalSizeRef.current = isHorizontal ? rect.width : rect.height
      if (totalSizeRef.current <= 0) return false
      startRatioRef.current = ratioRef.current
      setDragging(true)
      return undefined
    },
    onDrag: ({ dx, dy }) => {
      const total = totalSizeRef.current
      if (total <= 0) return
      const delta = isHorizontal ? dx : dy
      const nextRatio = startRatioRef.current + delta / total
      const minStartRatio = minStart / total
      const maxRatio = 1 - minEnd / total
      const clamped = Math.max(minStartRatio, Math.min(maxRatio, nextRatio))
      setRatio(clamped)
    },
    onEnd: () => {
      setDragging(false)
    },
  })

  return (
    <div
      {...rest}
      ref={containerRef}
      data-iris-splitter=""
      data-iris-splitter-orientation={orientation}
      data-state={dragging ? 'dragging' : 'idle'}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        data-iris-splitter-pane="start"
        style={{ flex: `${ratio} 1 0`, minWidth: 0, minHeight: 0, overflow: 'auto' }}
      >
        {start}
      </div>
      <div
        ref={handleRef}
        data-iris-splitter-handle=""
        role="separator"
        aria-orientation={orientation}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={disabled ? -1 : 0}
        style={{
          flex: '0 0 4px',
          background: dragging ? 'var(--iris-primary)' : 'var(--iris-border)',
          cursor: disabled ? 'not-allowed' : isHorizontal ? 'col-resize' : 'row-resize',
          transition: 'background-color 120ms ease',
          position: 'relative',
          touchAction: 'none',
        }}
      />
      <div
        data-iris-splitter-pane="end"
        style={{
          flex: `${1 - ratio} 1 0`,
          minWidth: 0,
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        {end}
      </div>
    </div>
  )
}
