#!/usr/bin/env node
// Generate the component reference page from the committed manifest.json — the
// same single source of truth the AI-native llms.txt is built from, so the docs
// can never drift from what the packages actually export. Run before dev/build.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..')
const manifestPath = join(repoRoot, 'manifest.json')
const outPath = join(here, '..', 'components.md')

if (!existsSync(manifestPath)) {
  // eslint-disable-next-line no-console
  console.error(`[docs] manifest.json not found at ${manifestPath} — run \`pnpm gen:manifest\` first.`)
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

const lines = []
lines.push('---')
lines.push('title: Components')
lines.push('---')
lines.push('')
lines.push('# Components')
lines.push('')
const byFw = manifest.frameworks.map((f) => `${manifest.stats.byFramework[f]} ${f}`).join(', ')
lines.push(
  `> Generated from \`manifest.json\` (schema \`${manifest.schema}\`). ` +
    `${manifest.stats.total} components — ${manifest.stats.full} available in all ` +
    `${manifest.frameworks.length} frameworks (${byFw}).`,
)
lines.push('')
lines.push(
  `Import from ${manifest.frameworks.map((f) => `\`@iris-ui/${f}\``).join(', ')} ` +
    `(same names, same semantics).`,
)
lines.push('')

// Escape a TS type / text for a markdown table cell (pipes break the table).
const cell = (s) => String(s).replace(/\|/g, '\\|')

for (const group of manifest.groups) {
  lines.push(`## ${group.group} <Badge type="info" text="${group.count}" />`)
  lines.push('')
  for (const name of group.components) {
    const component = manifest.components.find((c) => c.name === name)
    if (!component) continue
    const fw = component.frameworks.join(' · ')
    const via = component.plugin ? ` — via \`${component.plugin}\` (IrisProvider plugins)` : ''
    lines.push(`### \`${name}\``)
    lines.push('')
    lines.push(`<small>${fw}${via}</small>`)
    lines.push('')
    const props = component.props ?? []
    if (props.length > 0) {
      lines.push('| Prop | Type | Required | Description |')
      lines.push('| --- | --- | --- | --- |')
      for (const p of props) {
        lines.push(
          `| \`${p.name}\` | \`${cell(p.type)}\` | ${p.optional ? '' : '✓'} | ${cell(p.description ?? '')} |`,
        )
      }
      lines.push('')
    }
  }
}

lines.push('## Design tokens')
lines.push('')
lines.push(`${manifest.tokens.all.length} tokens drive every component via CSS variables.`)
lines.push('')
lines.push('| Kind | Tokens |')
lines.push('| --- | --- |')
lines.push(`| colors | ${manifest.tokens.color.map((t) => `\`${t}\``).join(', ')} |`)
lines.push(`| spacing | ${manifest.tokens.spacing.map((t) => `\`${t}\``).join(', ')} |`)
lines.push(`| radii | ${manifest.tokens.radii.map((t) => `\`${t}\``).join(', ')} |`)
lines.push('')

writeFileSync(outPath, lines.join('\n'))
// eslint-disable-next-line no-console
console.log(`[docs] wrote components.md (${manifest.stats.total} components)`)
