import * as React from 'react'
import { IrisButton } from '@iris-ui-kit/react'
import {
  toMcpTools,
  runMcpTool,
  type McpToolDef,
  type McpToolResult,
} from '@iris-ui-kit/core/commands'
import { useCommands } from '../commands-context'

/**
 * Agent Tools — the MODEL-FACING view of the desktop. Every desktop capability
 * is a registered Command; `toMcpTools(registry)` projects that registry into the
 * exact tool list an external MCP agent (or Claude) would be handed — including
 * each tool's argument schema. Any tool here is invokable via
 * `runMcpTool(registry, name, args)`, the same bridge the model uses; for
 * parameterized tools the inline fields below let you fill those args by hand.
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

export function AgentToolsView() {
  const registry = useCommands()
  // Re-derive the tool list whenever the registry contents change (apps register
  // commands as their windows open), so this mirrors what an agent sees live.
  const state = React.useSyncExternalStore(registry.subscribe, registry.getState, registry.getState)
  const tools = React.useMemo(() => toMcpTools(registry), [registry, state])

  const [name, setName] = React.useState('')
  const [result, setResult] = React.useState<McpToolResult | null>(null)
  // Per-tool argument drafts: toolName → paramName → raw string.
  const [drafts, setDrafts] = React.useState<Record<string, Record<string, string>>>({})

  const setArg = (toolName: string, param: string, value: string) =>
    setDrafts((d) => ({ ...d, [toolName]: { ...d[toolName], [param]: value } }))

  const invoke = async (toolName: string, args?: Record<string, unknown>) => {
    setResult(await runMcpTool(registry, toolName, args))
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 90,
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid rgba(127,127,127,0.35)',
    background: 'rgba(255,255,255,0.5)',
    color: 'inherit',
    outline: 'none',
    fontSize: 12,
  }

  const renderParam = (
    toolName: string,
    param: string,
    prop: McpToolDef['inputSchema']['properties'][string],
    required: boolean,
  ) => {
    const draft = drafts[toolName] ?? {}
    const value = draft[param] ?? ''
    const label = `${param}${required ? ' *' : ''}`
    if (prop.enum) {
      return (
        <label key={param} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ opacity: 0.7 }}>{label}</span>
          <select
            value={value}
            onChange={(e) => setArg(toolName, param, e.target.value)}
            style={inputStyle}
          >
            <option value="">—</option>
            {prop.enum.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      )
    }
    if (prop.type === 'boolean') {
      return (
        <label key={param} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => setArg(toolName, param, e.target.checked ? 'true' : 'false')}
          />
          <span style={{ opacity: 0.7 }}>{label}</span>
        </label>
      )
    }
    return (
      <label
        key={param}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flex: 1 }}
      >
        <span style={{ opacity: 0.7 }}>{label}</span>
        <input
          type={prop.type === 'number' ? 'number' : 'text'}
          value={value}
          placeholder={prop.description ?? param}
          onChange={(e) => setArg(toolName, param, e.target.value)}
          style={inputStyle}
        />
      </label>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 16, borderBottom: '1px solid rgba(127,127,127,0.2)' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>🛠️ MCP Tools ({tools.length})</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4, lineHeight: 1.5 }}>
          The model-callable tools an external MCP agent / Claude would see — with their argument
          schemas. Any of these is invokable via <code>runMcpTool(registry, name, args)</code>.
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'grid', gap: 8 }}>
        {tools.map((t) => {
          const params = Object.entries(t.inputSchema.properties)
          return (
            <div
              key={t.name}
              style={{
                display: 'grid',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 10,
                background: 'rgba(127,127,127,0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                  onClick={() => void invoke(t.name, buildArgs(t, drafts[t.name] ?? {}))}
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
              {params.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {params.map(([param, prop]) =>
                    renderParam(t.name, param, prop, t.inputSchema.required.includes(param)),
                  )}
                </div>
              )}
            </div>
          )
        })}
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
