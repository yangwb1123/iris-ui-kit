import { For, Show, createMemo, createSignal, onCleanup, type JSX } from 'solid-js'
import { createStore } from 'solid-js/store'
import { IrisButton } from '@iris-ui-kit/solid'
import {
  toMcpTools,
  runMcpTool,
  type McpToolDef,
  type McpToolProperty,
  type McpToolResult,
} from '@iris-ui-kit/core/commands'
import { useCommands } from './commands'

/**
 * Agent Tools — the MODEL-FACING view of the desktop. Every desktop capability
 * is a registered Command; `toMcpTools(registry)` projects that registry into the
 * exact tool list an external MCP agent (or Claude) would be handed — including
 * each tool's argument schema. Any tool here is invokable via
 * `runMcpTool(registry, name, args)`, the same bridge the model uses; for
 * parameterized tools the inline fields below let you fill those args by hand.
 * The React desktop's Agent Tools, on Solid.
 */

/** Coerce the raw string drafts into typed args per the tool's JSON schema. */
function buildArgs(tool: McpToolDef, draft: Record<string, string>): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  for (const [name, prop] of Object.entries(tool.inputSchema.properties)) {
    const raw = draft[name]
    if (raw == null || raw === '') continue
    args[name] =
      prop.type === 'number' ? Number(raw) : prop.type === 'boolean' ? raw === 'true' : raw
  }
  return args
}

const inputStyle: JSX.CSSProperties = {
  flex: 1,
  'min-width': '90px',
  padding: '4px 8px',
  'border-radius': '6px',
  border: '1px solid rgba(127,127,127,0.35)',
  background: 'rgba(255,255,255,0.5)',
  color: 'inherit',
  outline: 'none',
  'font-size': '12px',
}

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
  // Per-tool argument drafts: toolName → paramName → raw string.
  const [drafts, setDrafts] = createStore<Record<string, Record<string, string>>>({})

  const setArg = (toolName: string, param: string, value: string): void =>
    setDrafts(toolName, (d) => ({ ...d, [param]: value }))

  const invoke = async (toolName: string, args?: Record<string, unknown>): Promise<void> => {
    const r = await runMcpTool(registry, toolName, args)
    setResult(r)
  }

  const renderParam = (
    toolName: string,
    param: string,
    prop: McpToolProperty,
    required: boolean,
  ): JSX.Element => {
    const value = (): string => drafts[toolName]?.[param] ?? ''
    const label = `${param}${required ? ' *' : ''}`
    return (
      <Show
        when={prop.enum}
        fallback={
          <Show
            when={prop.type === 'boolean'}
            fallback={
              <label
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '6px',
                  'font-size': '12px',
                  flex: 1,
                }}
              >
                <span style={{ opacity: 0.7 }}>{label}</span>
                <input
                  type={prop.type === 'number' ? 'number' : 'text'}
                  value={value()}
                  placeholder={prop.description ?? param}
                  onInput={(e) => setArg(toolName, param, e.currentTarget.value)}
                  style={inputStyle}
                />
              </label>
            }
          >
            <label
              style={{ display: 'flex', 'align-items': 'center', gap: '6px', 'font-size': '12px' }}
            >
              <input
                type="checkbox"
                checked={value() === 'true'}
                onChange={(e) =>
                  setArg(toolName, param, e.currentTarget.checked ? 'true' : 'false')
                }
              />
              <span style={{ opacity: 0.7 }}>{label}</span>
            </label>
          </Show>
        }
      >
        {(options) => (
          <label
            style={{ display: 'flex', 'align-items': 'center', gap: '6px', 'font-size': '12px' }}
          >
            <span style={{ opacity: 0.7 }}>{label}</span>
            <select
              value={value()}
              onChange={(e) => setArg(toolName, param, e.currentTarget.value)}
              style={inputStyle}
            >
              <option value="">—</option>
              <For each={options()}>{(o) => <option value={o}>{o}</option>}</For>
            </select>
          </label>
        )}
      </Show>
    )
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
      <div style={{ padding: '16px', 'border-bottom': '1px solid rgba(127,127,127,0.2)' }}>
        <div style={{ 'font-weight': 600, 'font-size': '14px' }}>
          🛠️ MCP Tools ({tools().length})
        </div>
        <div style={{ 'font-size': '12px', opacity: 0.7, 'margin-top': '4px', 'line-height': 1.5 }}>
          The model-callable tools an external MCP agent / Claude would see — with their argument
          schemas. Any of these is invokable via <code>runMcpTool(registry, name, args)</code>.
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'grid', gap: '8px' }}>
        <For each={tools()}>
          {(t) => {
            const params = createMemo(() => Object.entries(t.inputSchema.properties))
            return (
              <div
                style={{
                  display: 'grid',
                  gap: '8px',
                  padding: '8px 12px',
                  'border-radius': '10px',
                  background: 'rgba(127,127,127,0.1)',
                }}
              >
                <div style={{ display: 'flex', 'align-items': 'center', gap: '10px' }}>
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
                    onClick={() => void invoke(t.name, buildArgs(t, drafts[t.name] ?? {}))}
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
                <Show when={params().length > 0}>
                  <div style={{ display: 'flex', gap: '8px', 'flex-wrap': 'wrap' }}>
                    <For each={params()}>
                      {([param, prop]) =>
                        renderParam(t.name, param, prop, t.inputSchema.required.includes(param))
                      }
                    </For>
                  </div>
                </Show>
              </div>
            )
          }}
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
