<script setup lang="ts">
import { computed, reactive, ref, type Ref } from 'vue'
import { IrisButton } from '@iris-ui-kit/vue'
import {
  toMcpTools,
  runMcpTool,
  type McpToolDef,
  type McpToolResult,
} from '@iris-ui-kit/core/commands'
import { useCommands } from '../commands'
import { useWmState } from '../wm'

/**
 * Agent Tools (Vue) — the MODEL-FACING view of the desktop. Every desktop
 * capability is a registered Command; `toMcpTools(registry)` projects that
 * registry into the exact tool list an external MCP agent (or Claude) would be
 * handed — including each tool's argument schema. Any tool here is invokable by
 * an agent via `runMcpTool(registry, name, args)`; for parameterized tools the
 * inline fields below let you fill those args by hand. The Vue twin of the React
 * demo's AgentTools.
 */

const registry = useCommands()
// Re-derive the tool list whenever the registry contents change (apps register
// commands as their windows open/close). `wmState` is the reactive change
// signal; reading `registry.getState()` ties this to the registry store too —
// mirrors the CommandPalette idiom so this shows what an agent sees live.
const wmState = useWmState()
const tools = computed(() => {
  void wmState.value
  void registry.getState()
  return toMcpTools(registry)
})

const name = ref('')
const result = ref<McpToolResult | null>(null)
// Per-tool argument drafts: toolName → paramName → raw string.
const drafts = reactive<Record<string, Record<string, string>>>({})

function draftFor(toolName: string): Record<string, string> {
  return (drafts[toolName] ??= {})
}

/** Coerce the raw string drafts into typed args per the tool's JSON schema. */
function buildArgs(tool: McpToolDef): Record<string, unknown> {
  const draft = drafts[tool.name] ?? {}
  const args: Record<string, unknown> = {}
  for (const [param, prop] of Object.entries(tool.inputSchema.properties)) {
    const raw = draft[param]
    if (raw == null || raw === '') continue
    args[param] =
      prop.type === 'number' ? Number(raw) : prop.type === 'boolean' ? raw === 'true' : raw
  }
  return args
}

function paramsOf(tool: McpToolDef): [string, McpToolDef['inputSchema']['properties'][string]][] {
  return Object.entries(tool.inputSchema.properties)
}

async function invoke(toolName: string, args?: Record<string, unknown>) {
  result.value = await runMcpTool(registry, toolName, args)
}

function submit() {
  const n = name.value.trim()
  if (n) void invoke(n)
}

// Plain ref typed for the template (avoids unwrap quirks in some setups).
const nameModel = name as Ref<string>
</script>

<template>
  <div class="agent-tools">
    <div class="header">
      <div class="title">🛠️ MCP Tools ({{ tools.length }})</div>
      <div class="explainer">
        The model-callable tools an external MCP agent / Claude would see — with their argument
        schemas. Any of these is invokable via <code>runMcpTool(registry, name, args)</code>.
      </div>
    </div>

    <div class="list">
      <div v-for="t in tools" :key="t.name" class="tool">
        <div class="tool-head">
          <div class="tool-text">
            <code class="tool-name">{{ t.name }}</code>
            <div class="tool-desc">{{ t.description }}</div>
          </div>
          <button type="button" class="invoke" @click="invoke(t.name, buildArgs(t))">Invoke</button>
        </div>
        <div v-if="paramsOf(t).length > 0" class="params">
          <label
            v-for="[param, prop] in paramsOf(t)"
            :key="param"
            class="param"
            :class="{ 'param--checkbox': prop.type === 'boolean' && !prop.enum }"
          >
            <template v-if="prop.enum">
              <span class="param-label"
                >{{ param }}<span v-if="t.inputSchema.required.includes(param)"> *</span></span
              >
              <select v-model="draftFor(t.name)[param]" class="param-input">
                <option value="">—</option>
                <option v-for="o in prop.enum" :key="o" :value="o">{{ o }}</option>
              </select>
            </template>
            <template v-else-if="prop.type === 'boolean'">
              <input
                type="checkbox"
                :checked="draftFor(t.name)[param] === 'true'"
                @change="
                  draftFor(t.name)[param] = ($event.target as HTMLInputElement).checked
                    ? 'true'
                    : 'false'
                "
              />
              <span class="param-label"
                >{{ param }}<span v-if="t.inputSchema.required.includes(param)"> *</span></span
              >
            </template>
            <template v-else>
              <span class="param-label"
                >{{ param }}<span v-if="t.inputSchema.required.includes(param)"> *</span></span
              >
              <input
                :type="prop.type === 'number' ? 'number' : 'text'"
                v-model="draftFor(t.name)[param]"
                :placeholder="prop.description ?? param"
                class="param-input"
              />
            </template>
          </label>
        </div>
      </div>
      <div v-if="tools.length === 0" class="empty">
        No tools registered yet — open some apps to populate the registry.
      </div>
    </div>

    <form class="composer" @submit.prevent="submit">
      <div class="composer-row">
        <input
          v-model="nameModel"
          class="text-input"
          placeholder="Tool name (what an agent calls)…"
        />
        <IrisButton type="submit" variant="solid">Run tool</IrisButton>
      </div>
      <div v-if="result" class="result" :class="result.ok ? 'result--ok' : 'result--err'">
        {{ result.ok ? `✓ ran ${result.ran}` : `✗ ${result.error}` }}
      </div>
    </form>
  </div>
</template>

<style scoped>
.agent-tools {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--os-window-fg);
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
  display: grid;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(127, 127, 127, 0.1);
}
.tool-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.tool-text {
  min-width: 0;
  flex: 1;
}
.params {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.param {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  flex: 1;
}
.param--checkbox {
  flex: 0 0 auto;
}
.param-label {
  opacity: 0.7;
}
.param-input {
  flex: 1;
  min-width: 90px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(127, 127, 127, 0.35);
  background: rgba(255, 255, 255, 0.5);
  color: inherit;
  outline: none;
  font-size: 12px;
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
.text-input {
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
