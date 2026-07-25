import { useState } from 'react'
import { IrisEventCalendar, type CalendarEvent } from '@iris-ui/plugin-calendar/react'

const SAMPLE_EVENTS: CalendarEvent[] = [
  { id: '1', title: 'Standup', date: new Date().toISOString().slice(0, 10), color: '#6366f1' },
  {
    id: '2',
    title: 'Lunch w/ team',
    date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    color: '#10b981',
  },
  {
    id: '3',
    title: 'Code review',
    date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    color: '#f59e0b',
  },
  {
    id: '4',
    title: 'Sprint planning',
    date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    color: '#ef4444',
  },
  {
    id: '5',
    title: '1:1 with manager',
    date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    color: '#8b5cf6',
  },
  {
    id: '6',
    title: 'Docs review',
    date: new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10),
    color: '#3b82f6',
  },
]

export function CalendarShowcase() {
  const [lastEvent, setLastEvent] = useState<string | null>(null)
  const [lastDate, setLastDate] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section className="section">
        <h2 className="section-title">Event Calendar</h2>
        <p style={{ color: 'var(--iris-muted)', fontSize: 14, margin: '0 0 16px' }}>
          Google Calendar-lite widget from <code>@iris-ui/plugin-calendar</code>. Months and events
          are fully interactive.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 24 }}>
          <IrisEventCalendar
            config={{
              events: SAMPLE_EVENTS,
              onEventClick: (event) => setLastEvent(event.title),
              onDateClick: (date) => setLastDate(date),
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Interactions</div>
            {lastEvent && (
              <div
                style={{
                  fontSize: 13,
                  padding: 8,
                  background: 'var(--iris-surface)',
                  borderRadius: 6,
                  border: '1px solid var(--iris-border)',
                }}
              >
                <div style={{ color: 'var(--iris-muted)', fontSize: 11 }}>Last event clicked</div>
                <div>{lastEvent}</div>
              </div>
            )}
            {lastDate && (
              <div
                style={{
                  fontSize: 13,
                  padding: 8,
                  background: 'var(--iris-surface)',
                  borderRadius: 6,
                  border: '1px solid var(--iris-border)',
                }}
              >
                <div style={{ color: 'var(--iris-muted)', fontSize: 11 }}>Last date clicked</div>
                <div>{lastDate}</div>
              </div>
            )}
            {!lastEvent && !lastDate && (
              <div style={{ fontSize: 13, color: 'var(--iris-muted)' }}>
                Click an event chip or a day cell above
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Today's Events</div>
              {SAMPLE_EVENTS.filter((e) => e.date === new Date().toISOString().slice(0, 10)).map(
                (e) => (
                  <div
                    key={e.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 0',
                      fontSize: 13,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: e.color,
                        display: 'inline-block',
                      }}
                    />
                    {e.title}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
