#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { ALL_FRAMEWORKS } from '@iris-ui/manifest'
import { loadManifest } from './manifest-source'
import { listComponents, searchComponents, getComponentApi, scaffoldSnippet } from './tools'

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

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  // The MCP host reads stdout; diagnostics go to stderr.
  console.error('[iris-ui-mcp] failed to start:', err)
  process.exitCode = 1
})
