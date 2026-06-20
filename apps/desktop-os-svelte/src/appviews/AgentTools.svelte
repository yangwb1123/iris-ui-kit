<script lang="ts">
  /**
   * Agent Tools — the MODEL-FACING view of the desktop. Every desktop capability
   * is a registered Command; `toMcpTools(registry)` projects that registry into the
   * exact tool list an external MCP agent (or Claude) would be handed. Any tool
   * here is invokable by an agent via `runMcpTool(registry, name)` — and so is the
   * demo input below: it calls the same bridge the model would.
   *
   * Mirrors `apps/desktop-os/src/appviews/AgentTools.tsx` (React), in idiomatic
   * Svelte 5 runes.
   */
  import { IrisButton } from '@iris-ui/svelte'
  import { toMcpTools, runMcpTool, type McpToolResult } from '@iris-ui/core/commands'
  import { useCommands } from '../commands.svelte'

  const registry = useCommands()

  // Re-derive the tool list whenever the registry contents change (apps register
  // commands as their windows open), so this mirrors what an agent sees live.
  const tools = $derived.by(() => {
    void registry.getState()
    return toMcpTools(registry)
  })

  let name = $state('')
  let result = $state<McpToolResult | null>(null)

  async function invoke(toolName: string) {
    result = await runMcpTool(registry, toolName)
  }

  function submit(e: SubmitEvent) {
    e.preventDefault()
    const n = name.trim()
    if (n) void invoke(n)
  }
</script>

<div class="agent-tools">
  <div class="header">
    <div class="title">🛠️ MCP Tools ({tools.length})</div>
    <div class="explainer">
      The model-callable tools an external MCP agent / Claude would see. Any of these is invokable
      by an agent via <code>runMcpTool(registry, name)</code>.
    </div>
  </div>

  <div class="list">
    {#each tools as t (t.name)}
      <div class="tool">
        <div class="tool-info">
          <code class="tool-name">{t.name}</code>
          <div class="tool-desc">{t.description}</div>
        </div>
        <button type="button" class="invoke" onclick={() => void invoke(t.name)}>Invoke</button>
      </div>
    {/each}
    {#if tools.length === 0}
      <div class="empty">No tools registered yet — open some apps to populate the registry.</div>
    {/if}
  </div>

  <form class="composer" onsubmit={submit}>
    <div class="composer-row">
      <input class="input" bind:value={name} placeholder="Tool name (what an agent calls)…" />
      <IrisButton type="submit" variant="solid">Run tool</IrisButton>
    </div>
    {#if result}
      <div class="result" class:result--ok={result.ok} class:result--err={!result.ok}>
        {result.ok ? `✓ ran ${result.ran}` : `✗ ${result.error}`}
      </div>
    {/if}
  </form>
</div>

<style>
  .agent-tools {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .header {
    padding: 16px;
    border-bottom: 1px solid rgba(127, 127, 127, 0.2);
  }
  .title {
    font-weight: 600;
    font-size: 14px;
  }
  .explainer {
    font-size: 12px;
    opacity: 0.7;
    margin-top: 4px;
    line-height: 1.5;
  }
  .list {
    flex: 1;
    overflow: auto;
    padding: 16px;
    display: grid;
    gap: 8px;
    align-content: start;
  }
  .tool {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(127, 127, 127, 0.1);
  }
  .tool-info {
    min-width: 0;
    flex: 1;
  }
  .tool-name {
    font-size: 13px;
    font-weight: 600;
  }
  .tool-desc {
    font-size: 12px;
    opacity: 0.7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .invoke {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 999px;
    cursor: pointer;
    border: 1px solid rgba(127, 127, 127, 0.4);
    background: transparent;
    color: inherit;
    white-space: nowrap;
  }
  .empty {
    font-size: 13px;
    opacity: 0.6;
  }
  .composer {
    display: grid;
    gap: 8px;
    padding: 12px;
    border-top: 1px solid rgba(127, 127, 127, 0.2);
  }
  .composer-row {
    display: flex;
    gap: 8px;
  }
  .input {
    flex: 1;
    padding: 9px 14px;
    border-radius: 999px;
    border: 1px solid rgba(127, 127, 127, 0.35);
    background: rgba(255, 255, 255, 0.5);
    color: inherit;
    outline: none;
    font-size: 14px;
  }
  .result {
    font-size: 12px;
    padding: 6px 12px;
    border-radius: 8px;
  }
  .result--ok {
    background: color-mix(in srgb, #28c840 22%, transparent);
  }
  .result--err {
    background: color-mix(in srgb, #ff5f57 22%, transparent);
  }
</style>
