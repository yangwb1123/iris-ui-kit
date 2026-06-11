#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { ALL_FRAMEWORKS } from '@iris-ui/manifest'
import { loadManifest } from './manifest-source'
import {
  listComponents,
  searchComponents,
  getComponentApi,
  scaffoldSnippet,
  scaffoldView,
  suggestComponents,
  validateUsage,
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
    inputSchema: { name: z.string().describe('Exact component name, e.g. "IrisSelect"') },
  },
  async ({ name }) => {
    const api = getComponentApi(manifest, name)
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

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  // The MCP host reads stdout; diagnostics go to stderr.
  console.error('[iris-ui-mcp] failed to start:', err)
  process.exitCode = 1
})
