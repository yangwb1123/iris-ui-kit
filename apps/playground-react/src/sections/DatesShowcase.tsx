import { useState } from 'react'
import {
  IrisCalendar,
  IrisDatePicker,
  IrisDateRangePicker,
  IrisTimePicker,
  IrisFormField,
  type IrisDateRange,
  type IrisTimeValue,
} from '@iris-ui/react'

export function DatesShowcase() {
  const [inline, setInline] = useState<Date | null>(new Date())
  const [popover, setPopover] = useState<Date | null>(null)
  const [range, setRange] = useState<IrisDateRange>({ start: null, end: null })
  const [time24, setTime24] = useState<IrisTimeValue>({ hours: 14, minutes: 30 })
  const [time12, setTime12] = useState<IrisTimeValue>({ hours: 9, minutes: 15 })

  return (
    <section className="section">
      <h2 className="section-title">Dates &amp; Time</h2>

      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="row-label">inline calendar</span>
        <IrisCalendar value={inline} onValueChange={setInline} locale="en-US" />
        <span style={{ fontSize: 12, color: 'var(--iris-muted)' }}>
          → {inline?.toLocaleDateString() ?? '—'}
        </span>
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="row-label">date picker</span>
        <IrisFormField label="Pick a date">
          <IrisDatePicker value={popover} onValueChange={setPopover} locale="en-US" />
        </IrisFormField>
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="row-label">date range</span>
        <IrisFormField label="Pick a range">
          <IrisDateRangePicker value={range} onValueChange={setRange} locale="en-US" />
        </IrisFormField>
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="row-label">time (24h)</span>
        <IrisFormField label="Meeting time">
          <IrisTimePicker value={time24} onValueChange={setTime24} format="24h" minuteStep={5} />
        </IrisFormField>
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="row-label">time (12h)</span>
        <IrisFormField label="Alarm">
          <IrisTimePicker value={time12} onValueChange={setTime12} format="12h" minuteStep={15} />
        </IrisFormField>
      </div>
    </section>
  )
}
