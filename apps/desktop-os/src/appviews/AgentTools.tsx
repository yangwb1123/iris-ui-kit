import * as React from 'react'
import { IrisButton } from '@iris-ui/react'
import { toMcpTools, runMcpTool, type McpToolResult } from '@iris-ui/core/commands'
import { useCommands } from '../commands-context'

/**
 * Agent Tools — the MODEL-FACING view of the desktop. Every desktop capability
 * is a registered Command; `toMcpTools(registry)` projects that registry into the
 * exact tool list an external MCP agent (or Claude) would be handed. Any tool
 * here is invokable by an agent via `runMcpTool(registry, name)` — and so is the
 * demo input below: it calls the same bridge the model would.
 */
export function AgentToolsView() {
  const registry = useCommands()
  // Re-derive the tool list whenever the registry contents change (apps register
  // commands as their windows open), so this mirrors what an agent sees live.
  const state = React.useSyncExternalStore(registry.subscribe, registry.getState, registry.getState)
  const tools = React.useMemo(() => toMcpTools(registry), [registry, state])

  const [name, setName] = React.useState('')
  const [result, setResult] = React.useState<McpToolResult | null>(null)

  const invoke = async (toolName: string) => {
    const r = await runMcpTool(registry, toolName)
    setResult(r)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 16, borderBottom: '1px solid rgba(127,127,127,0.2)' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>🛠️ MCP Tools ({tools.length})</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4, lineHeight: 1.5 }}>
          The model-callable tools an external MCP agent / Claude would see. Any of these is
          invokable by an agent via <code>runMcpTool(registry, name)</code>.
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'grid', gap: 8 }}>
        {tools.map((t) => (
          <div
            key={t.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 10,
              background: 'rgba(127,127,127,0.1)',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <code style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</code>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.7,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {t.description}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void invoke(t.name)}
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 999,
                cursor: 'pointer',
                border: '1px solid rgba(127,127,127,0.4)',
                background: 'transparent',
                color: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              Invoke
            </button>
          </div>
        ))}
        {tools.length === 0 && (
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            No tools registered yet — open some apps to populate the registry.
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const n = name.trim()
          if (n) void invoke(n)
        }}
        style={{
          display: 'grid',
          gap: 8,
          padding: 12,
          borderTop: '1px solid rgba(127,127,127,0.2)',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tool name (what an agent calls)…"
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: 999,
              border: '1px solid rgba(127,127,127,0.35)',
              background: 'rgba(255,255,255,0.5)',
              color: 'inherit',
              outline: 'none',
              fontSize: 14,
            }}
          />
          <IrisButton type="submit" variant="solid">
            Run tool
          </IrisButton>
        </div>
        {result && (
          <div
            style={{
              fontSize: 12,
              padding: '6px 12px',
              borderRadius: 8,
              background: result.ok
                ? 'color-mix(in srgb, #28c840 22%, transparent)'
                : 'color-mix(in srgb, #ff5f57 22%, transparent)',
            }}
          >
            {result.ok ? `✓ ran ${result.ran}` : `✗ ${result.error}`}
          </div>
        )}
      </form>
    </div>
  )
}
