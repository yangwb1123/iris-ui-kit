<script lang="ts">
  /**
   * A faux shell: an input line + scrollback. `appNames` is passed in (rather
   * than imported from `../catalog`) so this view stays self-contained and avoids
   * a cycle — the catalog supplies the live app-name list when it wires the
   * component into a manifest. The Svelte 5 twin of the React `TerminalApp`.
   */
  interface Line {
    id: number
    /** `'in'` = the echoed command prompt, `'out'` = command output. */
    kind: 'in' | 'out'
    text: string
  }

  interface Props {
    appNames: string[]
  }

  let { appNames }: Props = $props()

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

  let lines = $state<Line[]>([{ id: 0, kind: 'out', text: BANNER }])
  let input = $state('')
  let nextId = 1
  let scrollEl = $state<HTMLDivElement | null>(null)

  // Keep the scrollback pinned to the newest line after each render.
  $effect(() => {
    void lines
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight
  })

  function push(kind: Line['kind'], text: string): void {
    lines = [...lines, { id: nextId++, kind, text }]
  }

  function run(raw: string): void {
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
        lines = []
        break
      default:
        push('out', `iris-sh: command not found: ${name}. Try 'help'.`)
        break
    }
  }

  function onSubmit(e: SubmitEvent): void {
    e.preventDefault()
    run(input)
    input = ''
  }
</script>

<div class="term">
  <div class="scroll" bind:this={scrollEl}>
    {#each lines as l (l.id)}
      <pre class="line" class:line--in={l.kind === 'in'}>{l.text}</pre>
    {/each}
  </div>
  <form class="prompt" onsubmit={onSubmit}>
    <span aria-hidden="true" class="sigil">$</span>
    <input
      class="input"
      bind:value={input}
      aria-label="Terminal input"
      autocomplete="off"
      spellcheck="false"
    />
  </form>
</div>

<style>
  .term {
    height: 100%;
    box-sizing: border-box;
    display: grid;
    grid-template-rows: 1fr auto;
    background: #0b0e14;
    color: #cdd6f4;
    font:
      13px/1.5 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
  }
  .scroll {
    overflow: auto;
    padding: 12px;
  }
  .line {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: #cdd6f4;
  }
  .line--in {
    color: #a6e3a1;
  }
  .prompt {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .sigil {
    color: #a6e3a1;
  }
  .input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
  }
</style>
