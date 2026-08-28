import { createSignal, type JSX } from 'solid-js'
import { useDrag } from '../drag/useDrag'

export function PinnedDragHandle(props: {
  colKey: string
  label: string
  resolvePinnedCount: (dx: number) => number
  commitPinnedCount: (count: number) => void
}): JSX.Element {
  const [element, setElement] = createSignal<HTMLElement | null>(null)
  const [dx, setDx] = createSignal(0)
  useDrag({
    handle: element,
    onStart: () => {
      setDx(0)
    },
    onDrag: ({ dx: next }) => setDx(next),
    onEnd: ({ dx: next }) => {
      props.commitPinnedCount(props.resolvePinnedCount(next))
      setDx(0)
    },
  })
  const nudge = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    props.commitPinnedCount(props.resolvePinnedCount(0) + (event.key === 'ArrowRight' ? 1 : -1))
  }
  return (
    <span
      ref={setElement}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Adjust pinned column count at ${props.label}`}
      tabIndex={0}
      data-iris-pinned-drag-handle=""
      data-column-key={props.colKey}
      data-iris-pinned-drag-active={dx() !== 0 ? 'true' : undefined}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={nudge}
      style={{
        position: 'absolute',
        top: '0',
        right: '0',
        bottom: '0',
        width: '8px',
        cursor: 'col-resize',
        'touch-action': 'none',
        'user-select': 'none',
        'z-index': '2',
        transform: dx() !== 0 ? `translateX(${dx()}px)` : undefined,
      }}
    >
      <span
        aria-hidden="true"
        data-iris-pinned-drag-line=""
        style={{
          position: 'absolute',
          top: '0',
          bottom: '0',
          'inset-inline-start': '50%',
          width: '2px',
          background: 'var(--iris-primary)',
          transform: 'translateX(-50%)',
        }}
      />
    </span>
  )
}
