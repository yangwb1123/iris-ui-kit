import type { Accessor, JSX } from 'solid-js'
import type { CalendarStore } from '../core'

interface CalendarHeaderProps {
  monthLabel: Accessor<string>
  store: CalendarStore
}

const headerStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  'margin-bottom': '8px',
}

const buttonStyle: JSX.CSSProperties = {
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  'font-size': '1.2em',
}

/** Month label and navigation controls for the calendar renderer. */
export function CalendarHeader(props: CalendarHeaderProps): JSX.Element {
  return (
    <div data-iris-event-cal-header="" style={headerStyle}>
      <button
        data-iris-event-cal-prev=""
        aria-label="Previous month"
        onClick={() => props.store.prevMonth()}
        style={buttonStyle}
      >
        ‹
      </button>
      <span data-iris-event-cal-title="" style={{ 'font-weight': '600' }}>
        {props.monthLabel()}
      </span>
      <button
        data-iris-event-cal-next=""
        aria-label="Next month"
        onClick={() => props.store.nextMonth()}
        style={buttonStyle}
      >
        ›
      </button>
    </div>
  )
}
