import { For, Show, createMemo, createSignal, onCleanup, type JSX } from 'solid-js'
import { IrisButton } from '@iris-ui/solid'
import { toMcpTools, runMcpTool, type McpToolResult } from '@iris-ui/core/commands'
import { useCommands } from './commands'

/**
 * Agent Tools — the MODEL-FACING view of the desktop. Every desktop capability
 * is a registered Command; `toMcpTools(registry)` projects that registry into the
 * exact tool list an external MCP agent (or Claude) would be handed. Any tool
 * here is invokable by an agent via `runMcpTool(registry, name)` — and so is the
 * demo input below: it calls the same bridge the model would. The React desktop's
 * Agent Tools, on Solid.
 */
export function AgentToolsApp(): JSX.Element {
  const registry = useCommands()

  // Re-derive the tool list whenever the registry contents change (apps register
  // commands as their windows open), so this mirrors what an agent sees live —
  // tracked via the same subscribe→version idiom Assistant/commands use.
  const [version, setVersion] = createSignal(0)
  const unsubscribe = registry.subscribe(() => setVersion((v) => v + 1))
  onCleanup(unsubscribe)
  const tools = createMemo(() => {
    version() // re-run when the registry contents change
    return toMcpTools(registry)
  })

  const [name, setName] = createSignal('')
  const [result, setResult] = createSignal<McpToolResult | null>(null)

  const invoke = async (toolName: string): Promise<void> => {
    const r = await runMcpTool(registry, toolName)
    setResult(r)
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
      <div style={{ padding: '16px', 'border-bottom': '1px solid rgba(127,127,127,0.2)' }}>
        <div style={{ 'font-weight': 600, 'font-size': '14px' }}>
          🛠️ MCP Tools ({tools().length})
        </div>
        <div style={{ 'font-size': '12px', opacity: 0.7, 'margin-top': '4px', 'line-height': 1.5 }}>
          The model-callable tools an external MCP agent / Claude would see. Any of these is
          invokable by an agent via <code>runMcpTool(registry, name)</code>.
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'grid', gap: '8px' }}>
        <For each={tools()}>
          {(t) => (
            <div
              style={{
                display: 'flex',
                'align-items': 'center',
                gap: '10px',
                padding: '8px 12px',
                'border-radius': '10px',
                background: 'rgba(127,127,127,0.1)',
              }}
            >
              <div style={{ 'min-width': 0, flex: 1 }}>
                <code style={{ 'font-size': '13px', 'font-weight': 600 }}>{t.name}</code>
                <div
                  style={{
                    'font-size': '12px',
                    opacity: 0.7,
                    'white-space': 'nowrap',
                    overflow: 'hidden',
                    'text-overflow': 'ellipsis',
                  }}
                >
                  {t.description}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void invoke(t.name)}
                style={{
                  'font-size': '12px',
                  padding: '4px 10px',
                  'border-radius': '999px',
                  cursor: 'pointer',
                  border: '1px solid rgba(127,127,127,0.4)',
                  background: 'transparent',
                  color: 'inherit',
                  'white-space': 'nowrap',
                }}
              >
                Invoke
              </button>
            </div>
          )}
        </For>
        <Show when={tools().length === 0}>
          <div style={{ 'font-size': '13px', opacity: 0.6 }}>
            No tools registered yet — open some apps to populate the registry.
          </div>
        </Show>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const n = name().trim()
          if (n) void invoke(n)
        }}
        style={{
          display: 'grid',
          gap: '8px',
          padding: '12px',
          'border-top': '1px solid rgba(127,127,127,0.2)',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="Tool name (what an agent calls)…"
            style={{
              flex: 1,
              padding: '9px 14px',
              'border-radius': '999px',
              border: '1px solid rgba(127,127,127,0.35)',
              background: 'rgba(255,255,255,0.5)',
              color: 'inherit',
              outline: 'none',
              'font-size': '14px',
            }}
          />
          <IrisButton type="submit" variant="solid">
            Run tool
          </IrisButton>
        </div>
        <Show when={result()}>
          {(r) => (
            <div
              style={{
                'font-size': '12px',
                padding: '6px 12px',
                'border-radius': '8px',
                background: r().ok
                  ? 'color-mix(in srgb, #28c840 22%, transparent)'
                  : 'color-mix(in srgb, #ff5f57 22%, transparent)',
              }}
            >
              {r().ok ? `✓ ran ${r().ran}` : `✗ ${r().error}`}
            </div>
          )}
        </Show>
      </form>
    </div>
  )
}
