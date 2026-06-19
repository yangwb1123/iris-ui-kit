import * as React from 'react'

interface Line {
  id: number
  /** `'in'` = the echoed command prompt, `'out'` = command output. */
  kind: 'in' | 'out'
  text: string
}

const BANNER = "iris-sh — type 'help' for commands."

const HELP = [
  'Available commands:',
  '  help          show this help',
  '  apps          list installed apps',
  '  echo <text>   print <text>',
  '  about         about this shell',
  '  clear         clear the screen',
].join('\n')

const ABOUT = 'iris-sh v1.0 — a faux shell running inside an Iris OS window.'

/**
 * A faux shell: an input line + scrollback. `appNames` is passed in (rather than
 * imported from `../apps`) so this view stays self-contained and avoids a cycle.
 */
export function TerminalApp({ appNames }: { appNames: string[] }) {
  const [lines, setLines] = React.useState<Line[]>([{ id: 0, kind: 'out', text: BANNER }])
  const [input, setInput] = React.useState('')
  const nextId = React.useRef(1)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  const push = (kind: Line['kind'], text: string) =>
    setLines((prev) => [...prev, { id: nextId.current++, kind, text }])

  const run = (raw: string) => {
    const cmd = raw.trim()
    push('in', `$ ${raw}`)
    if (cmd === '') return

    const name = cmd.split(/\s+/)[0]
    const arg = cmd.slice(name.length).trim()

    switch (name) {
      case 'help':
        push('out', HELP)
        break
      case 'apps':
        push('out', appNames.map((a) => `  • ${a}`).join('\n'))
        break
      case 'echo':
        push('out', arg)
        break
      case 'about':
        push('out', ABOUT)
        break
      case 'clear':
        setLines([])
        break
      default:
        push('out', `iris-sh: command not found: ${name}. Try 'help'.`)
        break
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    run(input)
    setInput('')
  }

  return (
    <div
      style={{
        height: '100%',
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateRows: '1fr auto',
        background: '#0b0e14',
        color: '#cdd6f4',
        font: '13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <div ref={scrollRef} style={{ overflow: 'auto', padding: 12 }}>
        {lines.map((l) => (
          <pre
            key={l.id}
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: l.kind === 'in' ? '#a6e3a1' : '#cdd6f4',
            }}
          >
            {l.text}
          </pre>
        ))}
      </div>
      <form
        onSubmit={onSubmit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span aria-hidden style={{ color: '#a6e3a1' }}>
          $
        </span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Terminal input"
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'inherit',
            font: 'inherit',
          }}
        />
      </form>
    </div>
  )
}
