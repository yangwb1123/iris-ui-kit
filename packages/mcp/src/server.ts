#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { ALL_FRAMEWORKS } from '@iris-ui-kit/manifest'
import { loadManifest } from './manifest-source'
import {
  listComponents,
  searchComponents,
  getComponentApi,
  getFrameworkComponentApi,
  scaffoldSnippet,
  scaffoldView,
  suggestComponents,
  validateUsage,
  generateView,
  generateTest,
  generateFormSchema,
} from './tools'

/**
 * Iris UI MCP server. Exposes the typed component manifest as agent tools so an
 * assistant can discover components and call them CORRECTLY (with real prop
 * names/types) across React/Vue/Solid/Svelte — instead of guessing. Thin wiring
 * over the pure logic in `tools.ts`.
 */
const manifest = loadManifest()
const json = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
})

const server = new McpServer({ name: 'iris-ui', version: manifest.schema })

server.registerTool(
  'list_components',
  {
    description:
      'List every Iris UI component (name, group, frameworks, owning plugin). Start here to discover what exists.',
    inputSchema: {},
  },
  async () => json(listComponents(manifest)),
)

server.registerTool(
  'search_components',
  {
    description: 'Find Iris UI components whose name or group matches a query (case-insensitive).',
    inputSchema: {
      query: z.string().describe('Substring to match against component name or group'),
    },
  },
  async ({ query }) => json(searchComponents(manifest, query)),
)

server.registerTool(
  'get_component_api',
  {
    description:
      'Get the full typed contract for one component: props (name/type/optional/JSDoc), frameworks, import path, and plugin (if any). Use before writing code with a component.',
    inputSchema: {
      name: z.string().describe('Exact component name, e.g. "IrisSelect"'),
      framework: z
        .enum(ALL_FRAMEWORKS as [string, ...string[]])
        .optional()
        .describe('Target framework; returns its native prop/event/slot/type contract'),
    },
  },
  async ({ name, framework }) => {
    const api = framework
      ? getFrameworkComponentApi(manifest, name, framework as (typeof ALL_FRAMEWORKS)[number])
      : getComponentApi(manifest, name)
    return api
      ? json(api)
      : { content: [{ type: 'text' as const, text: `Unknown component: ${name}` }] }
  },
)

server.registerTool(
  'scaffold_component',
  {
    description:
      'Emit a ready-to-edit import + usage snippet for a component in a framework, pre-filled with its required props.',
    inputSchema: {
      name: z.string().describe('Exact component name, e.g. "IrisButton"'),
      framework: z.enum(ALL_FRAMEWORKS as [string, ...string[]]).describe('Target framework'),
    },
  },
  async ({ name, framework }) => {
    const snippet = scaffoldSnippet(manifest, name, framework as (typeof ALL_FRAMEWORKS)[number])
    return {
      content: [
        { type: 'text' as const, text: snippet ?? `Cannot scaffold ${name} for ${framework}.` },
      ],
    }
  },
)

server.registerTool(
  'scaffold_view',
  {
    description:
      'Compose several components into one ready-to-edit view file: deduped imports + an optional layout container holding each component pre-filled with its required props. The multi-component counterpart to scaffold_component.',
    inputSchema: {
      framework: z.enum(ALL_FRAMEWORKS as [string, ...string[]]).describe('Target framework'),
      components: z
        .array(z.string())
        .describe(
          'Component names to place in the view, in order, e.g. ["IrisInput", "IrisButton"]',
        ),
      layout: z
        .string()
        .optional()
        .describe('Optional container component to wrap the children, e.g. "IrisCard"'),
    },
  },
  async ({ framework, components, layout }) => {
    const view = scaffoldView(manifest, {
      framework: framework as (typeof ALL_FRAMEWORKS)[number],
      components,
      layout,
    })
    return {
      content: [{ type: 'text' as const, text: view ?? `Cannot compose a view for ${framework}.` }],
    }
  },
)

server.registerTool(
  'generate_view',
  {
    description:
      'Generate a WIRED, runnable-against-stub view: deduped imports + state scaffolding (useState/ref/createSignal/$state for each controlled component) + a deterministic data stub (createProTableStore for a table, a schema for IrisFormBuilder) + markup binding each component to its state/stub. The wired counterpart to scaffold_view — emit a composed view that already glues data and handlers.',
    inputSchema: {
      framework: z.enum(ALL_FRAMEWORKS as [string, ...string[]]).describe('Target framework'),
      components: z
        .array(z.string())
        .describe('Component names to compose, in order, e.g. ["IrisProTable", "IrisInput"]'),
      layout: z
        .string()
        .optional()
        .describe('Optional container component to wrap the children, e.g. "IrisCard"'),
    },
  },
  async ({ framework, components, layout }) => {
    const view = generateView(manifest, {
      framework: framework as (typeof ALL_FRAMEWORKS)[number],
      components,
      layout,
    })
    return {
      content: [
        { type: 'text' as const, text: view ?? `Cannot generate a view for ${framework}.` },
      ],
    }
  },
)

server.registerTool(
  'generate_test',
  {
    description:
      "Generate a minimal render/interaction test skeleton for a component using the framework's testing-library (@testing-library/react|svelte, @solidjs/testing-library, @vue/test-utils). Derived from the manifest: renders the component (controlled prop seeded, required props filled) and asserts on one declared event via a spy.",
    inputSchema: {
      name: z.string().describe('Exact component name, e.g. "IrisSwitch"'),
      framework: z.enum(ALL_FRAMEWORKS as [string, ...string[]]).describe('Target framework'),
    },
  },
  async ({ name, framework }) => {
    const test = generateTest(manifest, name, framework as (typeof ALL_FRAMEWORKS)[number])
    return {
      content: [
        {
          type: 'text' as const,
          text: test ?? `Cannot generate a test for ${name} (${framework}).`,
        },
      ],
    }
  },
)

server.registerTool(
  'suggest_components',
  {
    description:
      'Recommend Iris UI components for a free-text requirement (e.g. "a date picker for a form", "tabs with keyboard nav"). Returns a ranked list with the matched terms. Use to PICK a component instead of scanning the full list.',
    inputSchema: {
      requirement: z.string().describe('What you need, in plain words'),
      limit: z.number().int().positive().optional().describe('Max results (default 5)'),
    },
  },
  async ({ requirement, limit }) => json(suggestComponents(manifest, requirement, limit)),
)

server.registerTool(
  'get_architecture',
  {
    description:
      'Return the Iris UI architecture overview: layer model, data & resilience ' +
      'primitives (9 primitives: DisposableScope, EventBus, QueryCache, CircuitBreaker, ' +
      'RateLimiter, ResilientFetcher, Outbox, ReconnectingSource, DataSource), plugin ' +
      'ecosystem (12 plugins with descriptions), and design tokens. Use this to understand ' +
      'the system BEFORE generating code, so you choose the right architectural pattern.',
    inputSchema: {},
  },
  async () =>
    json({
      layerModel: manifest.layerModel,
      resilience: [
        {
          name: 'createDisposableScope',
          description: 'Lifecycle teardown (destroy, child scopes, error isolation).',
        },
        { name: 'createEventBus', description: 'Typed pub/sub for cross-plugin communication.' },
        {
          name: 'createQueryCache',
          description: 'Async fetch dedup with TTL + stale-while-revalidate (SWR).',
        },
        {
          name: 'createCircuitBreaker',
          description: 'Failure isolation: trips after N failures, resets after cooldown.',
        },
        {
          name: 'createRateLimiter',
          description: 'Token-bucket rate limiting with burst capacity.',
        },
        {
          name: 'createResilientFetcher',
          description:
            'Composes cache + circuit breaker + rate limiter into one hardened async fetcher.',
        },
        {
          name: 'createOutbox',
          description: 'Offline-first, durable FIFO mutation queue with at-least-once delivery.',
        },
        {
          name: 'createReconnectingSource',
          description: 'Realtime push transport with exponential-backoff reconnection.',
        },
        {
          name: 'createDataSource',
          description: 'Unified data engine: fetch + paginate + sort + filter + select + mutate.',
        },
        {
          name: 'createResourceController',
          description: 'Higher-level CRUD list controller for Table/ProTable.',
        },
      ],
      plugins: [
        {
          package: '@iris-ui-kit/plugin-locale-zh',
          description: 'Simplified-Chinese (zh-CN) message pack.',
        },
        {
          package: '@iris-ui-kit/plugin-editor',
          description: 'CodeMirror 6 code editor (SQL/JSON/JS/plain) with inline diff.',
        },
        {
          package: '@iris-ui-kit/plugin-pro-table',
          description: 'CRUD data table with sorting, filtering, inline editing.',
        },
        {
          package: '@iris-ui-kit/plugin-charts',
          description: 'Zero-dependency, token-themed SVG charts.',
        },
        {
          package: '@iris-ui-kit/plugin-form-builder',
          description: 'Schema-driven validated form builder.',
        },
        {
          package: '@iris-ui-kit/plugin-notifications',
          description: 'Persistent notification center with inbox.',
        },
        { package: '@iris-ui-kit/plugin-admin', description: 'Admin panel extensions.' },
        { package: '@iris-ui-kit/plugin-calendar', description: 'Calendar widget.' },
        { package: '@iris-ui-kit/plugin-dashboard', description: 'Dashboard grid layouts.' },
        { package: '@iris-ui-kit/plugin-kanban', description: 'Kanban board with drag-and-drop.' },
        { package: '@iris-ui-kit/plugin-markdown', description: 'Markdown editor and preview.' },
        {
          package: '@iris-ui-kit/plugin-query-builder',
          description: 'Visual query/filter builder.',
        },
      ],
      tokensCount: manifest.tokens.all.length,
      componentCount: manifest.stats.total,
      frameworks: manifest.frameworks,
    }),
)

server.registerTool(
  'validate_usage',
  {
    description:
      'Validate a component usage against the typed manifest BEFORE writing code: unknown component, unsupported framework, missing required prop, unknown prop, invalid enum value (checked against the allowed literal values), and plugin-activation reminders. Returns an array of issues (empty = valid).',
    inputSchema: {
      name: z.string().describe('Exact component name, e.g. "IrisButton"'),
      framework: z
        .enum(ALL_FRAMEWORKS as [string, ...string[]])
        .optional()
        .describe('Optional: also check the component is available in this framework'),
      props: z
        .record(z.string())
        .optional()
        .describe('prop name → value (as written), e.g. { "variant": "solid", "size": "md" }'),
    },
  },
  async ({ name, framework, props }) =>
    json(
      validateUsage(manifest, {
        name,
        framework: framework as (typeof ALL_FRAMEWORKS)[number] | undefined,
        props,
      }),
    ),
)

server.registerTool(
  'generate_form',
  {
    description:
      'Generate a complete, ready-to-use form from simple field descriptors. ' +
      'Pass an array of field definitions (name, type, label, required, options, ' +
      'etc.) and get back a full IrisFormBuilder schema + React/Vue code snippets.',
    inputSchema: {
      fields: z
        .array(
          z.object({
            name: z.string(),
            type: z
              .enum([
                'text',
                'number',
                'email',
                'password',
                'textarea',
                'select',
                'checkbox',
                'array',
              ])
              .optional(),
            label: z.string().optional(),
            placeholder: z.string().optional(),
            required: z.boolean().optional(),
            options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
            defaultValue: z.unknown().optional(),
            fields: z.array(z.any()).optional(),
            addLabel: z.string().optional(),
            removeLabel: z.string().optional(),
          }),
        )
        .describe('Field definitions'),
      submitLabel: z.string().optional(),
      framework: z.enum(['react', 'vue']).optional().describe('Target framework'),
    },
  },
  async (args: Record<string, unknown>) => {
    const fields = (args.fields ?? []) as never[]
    const result = generateFormSchema(fields, {
      submitLabel: args.submitLabel as string | undefined,
    })
    const code = (args.framework as string) === 'vue' ? result.vue : result.react
    return {
      content: [
        {
          type: 'text' as const,
          text: code + '\n\n// Schema:\n' + JSON.stringify(result.schema, null, 2),
        },
      ],
    }
  },
)

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  // The MCP host reads stdout; diagnostics go to stderr.
  console.error('[iris-ui-mcp] failed to start:', err)
  process.exitCode = 1
})
