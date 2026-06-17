import { createSignal } from 'solid-js'
import type { JSX } from 'solid-js'
import { useDrag } from '../drag/useDrag'
import { RESIZE_STEP } from './styles'

export function ColumnResizeHandle(props: {
  colKey: string
  label: string
  /** Reads the column's current resolved width at drag/keypress time. */
  width: () => number
  minWidth: number
  maxWidth: number
  onResize: (key: string, width: number) => void
}): JSX.Element {
  const [handle, setHandle] = createSignal<HTMLElement | null>(null)
  let startWidth = 0
  const clamp = (w: number): number =>
    Math.max(props.minWidth, Math.min(props.maxWidth, Math.round(w)))

  useDrag({
    handle,
    onStart: () => {
      startWidth = props.width()
    },
    onDrag: ({ dx }) => props.onResize(props.colKey, clamp(startWidth + dx)),
  })

  return (
    <span
      ref={setHandle}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${props.label}`}
      tabindex={0}
      data-iris-table-resize-handle=""
      data-column-key={props.colKey}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          e.stopPropagation()
          props.onResize(props.colKey, clamp(props.width() - RESIZE_STEP))
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          props.onResize(props.colKey, clamp(props.width() + RESIZE_STEP))
        }
      }}
      style={{
        position: 'absolute',
        top: '0',
        right: '0',
        bottom: '0',
        width: '8px',
        cursor: 'col-resize',
        'touch-action': 'none',
        'user-select': 'none',
      }}
    />
  )
}
