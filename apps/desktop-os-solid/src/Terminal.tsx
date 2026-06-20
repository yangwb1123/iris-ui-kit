import { For, createEffect, createSignal, type JSX } from 'solid-js'

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
 * imported from the catalog) so this view stays self-contained and avoids a
 * cycle. Solid mirror of the React `TerminalApp`.
 */
export function TerminalApp(props: { appNames: string[] }): JSX.Element {
  const [lines, setLines] = createSignal<Line[]>([{ id: 0, kind: 'out', text: BANNER }])
  const [input, setInput] = createSignal('')
  let nextId = 1
  let scrollRef: HTMLDivElement | undefined

  // Keep the scrollback pinned to the bottom as new lines arrive.
  createEffect(() => {
    lines()
    const el = scrollRef
    if (el) el.scrollTop = el.scrollHeight
  })

  const push = (kind: Line['kind'], text: string): void => {
    setLines((prev) => [...prev, { id: nextId++, kind, text }])
  }

  const run = (raw: string): void => {
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
        push('out', props.appNames.map((a) => `  • ${a}`).join('\n'))
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

  const onSubmit = (e: Event): void => {
    e.preventDefault()
    run(input())
    setInput('')
  }

  return (
    <div
      style={{
        height: '100%',
        'box-sizing': 'border-box',
        display: 'grid',
        'grid-template-rows': '1fr auto',
        background: '#0b0e14',
        color: '#cdd6f4',
        font: '13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <div ref={scrollRef} style={{ overflow: 'auto', padding: '12px' }}>
        <For each={lines()}>
          {(l) => (
            <pre
              style={{
                margin: 0,
                'white-space': 'pre-wrap',
                'word-break': 'break-word',
                color: l.kind === 'in' ? '#a6e3a1' : '#cdd6f4',
              }}
            >
              {l.text}
            </pre>
          )}
        </For>
      </div>
      <form
        onSubmit={onSubmit}
        style={{
          display: 'flex',
          'align-items': 'center',
          gap: '8px',
          padding: '8px 12px',
          'border-top': '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span aria-hidden style={{ color: '#a6e3a1' }}>
          $
        </span>
        <input
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          aria-label="Terminal input"
          autocomplete="off"
          spellcheck={false}
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

/** Catalog wrapper so the manifest can supply the live app-name list. */
export function TerminalView(props: { appNames: string[] }): JSX.Element {
  return <TerminalApp appNames={props.appNames} />
}
