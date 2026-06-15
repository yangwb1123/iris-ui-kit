#!/usr/bin/env node
// Generate the component reference page from the committed manifest.json — the
// same single source of truth the AI-native llms.txt is built from, so the docs
// can never drift from what the packages actually export. Run before dev/build.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { themeToCss } from '@iris-ui/theme'
import { lightTheme, darkTheme } from '@iris-ui/tokens'

// Curated live demos (Vue, mounted client-only via the <IrisDemo> wrapper).
// Keyed by component name; injected right after the component heading. Only
// SSR-safe, standalone-renderable components — every tag used here must be in
// the globally-registered set in .vitepress/theme/index.ts.
const DEMOS = {
  IrisButton: [
    '<IrisDemo>',
    '  <IrisButton variant="solid">Solid</IrisButton>',
    '  <IrisButton variant="outline">Outline</IrisButton>',
    '  <IrisButton variant="ghost">Ghost</IrisButton>',
    '  <IrisButton variant="link">Link</IrisButton>',
    '</IrisDemo>',
  ].join('\n'),
  IrisSwitch: [
    '<IrisDemo>',
    '  <IrisSwitch :model-value="true" />',
    '  <IrisSwitch :model-value="false" />',
    '</IrisDemo>',
  ].join('\n'),
  IrisSpinner: ['<IrisDemo>', '  <IrisSpinner />', '</IrisDemo>'].join('\n'),
  IrisAvatar: [
    '<IrisDemo>',
    '  <IrisAvatar name="Ada Lovelace" />',
    '  <IrisAvatar name="Grace Hopper" />',
    '</IrisDemo>',
  ].join('\n'),
  IrisBadge: [
    '<IrisDemo>',
    '  <IrisBadge>New</IrisBadge>',
    '  <IrisBadge tone="success">Active</IrisBadge>',
    '  <IrisBadge tone="danger">Error</IrisBadge>',
    '</IrisDemo>',
  ].join('\n'),
  IrisProgress: [
    '<IrisDemo>',
    '  <div style="flex:1"><IrisProgress :value="62" /></div>',
    '</IrisDemo>',
  ].join('\n'),
  IrisDivider: [
    '<IrisDemo>',
    '  <span>Above</span>',
    '  <IrisDivider />',
    '  <span>Below</span>',
    '</IrisDemo>',
  ].join('\n'),
  IrisKbd: ['<IrisDemo>', "  <IrisKbd :keys=\"['⌘', 'K']\" />", '</IrisDemo>'].join('\n'),
}

// Curated components surfaced in the interactive <IrisExplorer> (R17). Each gets a
// manifest-driven controls panel + live Vue preview + 4-framework code tabs. Order
// here is the order they render in the components reference. Must stay a subset of
// the live-preview-wired set in theme/explorer-preview.ts (preview is Vue-only;
// the code tabs prove the 4-framework parity). Components not in this list keep the
// existing static reference (table + optional <IrisDemo>).
const EXPLORER_COMPONENTS = [
  'IrisButton',
  'IrisBadge',
  'IrisChip',
  'IrisSwitch',
  'IrisCheckbox',
  'IrisInput',
  'IrisAlert',
  'IrisSpinner',
  'IrisProgress',
]

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..')
const manifestPath = join(repoRoot, 'manifest.json')
const outPath = join(here, '..', 'components.md')

if (!existsSync(manifestPath)) {
  // eslint-disable-next-line no-console
  console.error(
    `[docs] manifest.json not found at ${manifestPath} — run \`pnpm gen:manifest\` first.`,
  )
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
    if (component.description) {
      lines.push(component.description)
      lines.push('')
    }
    if (component.subComponents && component.subComponents.length > 0) {
      lines.push(`Parts: ${component.subComponents.map((s) => `\`${s}\``).join(', ')}`)
      lines.push('')
    }
    // Interactive explorer (R17): manifest-derived controls + live Vue preview +
    // 4-framework code tabs. Supersedes the static <IrisDemo> for these curated
    // components; others keep the static demo below.
    if (EXPLORER_COMPONENTS.includes(name)) {
      lines.push(`<IrisExplorer name="${name}" />`)
      lines.push('')
    } else if (DEMOS[name]) {
      lines.push(DEMOS[name])
      lines.push('')
    }
    const props = component.props ?? []
    if (props.length > 0) {
      lines.push('| Prop | Type | Required | Description |')
      lines.push('| --- | --- | --- | --- |')
      for (const p of props) {
        const enumNote =
          p.enum && p.enum.length > 0
            ? `${p.description ? ' ' : ''}One of: ${p.enum.map((v) => `\`${v}\``).join(', ')}.`
            : ''
        const defaultNote = p.default !== undefined ? ` Default: \`${p.default}\`.` : ''
        lines.push(
          `| \`${p.name}\` | \`${cell(p.type)}\` | ${p.optional ? '' : '✓'} | ${cell((p.description ?? '') + enumNote + defaultNote)} |`,
        )
      }
      lines.push('')
    }

    const events = component.events ?? []
    if (events.length > 0) {
      lines.push('**Events**')
      lines.push('')
      lines.push(events.map((e) => `\`${e}\``).join(' · '))
      lines.push('')
    }

    const slots = component.slots ?? []
    if (slots.length > 0) {
      lines.push('**Slots**')
      lines.push('')
      lines.push(slots.map((s) => `\`${s}\``).join(' · '))
      lines.push('')
    }

    if (component.example) {
      lines.push('**Example**')
      lines.push('')
      lines.push('```tsx')
      lines.push(component.example.replace(/^\n+|\n+$/g, ''))
      lines.push('```')
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

// Static token stylesheet for the live demos — the real Iris light/dark CSS
// variables (via @iris-ui/theme themeToCss), so demos are themed without a
// runtime <ThemeProvider> (components fall back to these CSS vars). `.dark`
// matches VitePress's dark-mode class.
const tokensCss =
  themeToCss(lightTheme, { selector: ':root' }) +
  '\n' +
  themeToCss(darkTheme, { selector: '.dark' }) +
  '\n'
writeFileSync(join(here, 'theme', 'iris-tokens.css'), tokensCss)
// eslint-disable-next-line no-console
console.log('[docs] wrote theme/iris-tokens.css')

// Slim, browser-shippable manifest slice for the interactive <IrisExplorer> (R17).
// Only the curated explorer components — the full manifest.json is ~260KB; we ship
// just what the explorer needs (name/frameworks/importFrom/props/events/slots) so
// the controls panel, live preview, and code tabs are all driven by the SAME
// committed manifest the rest of the docs are generated from (no drift).
const explorerData = EXPLORER_COMPONENTS.map((name) => {
  const c = manifest.components.find((x) => x.name === name)
  if (!c) {
    // eslint-disable-next-line no-console
    console.error(`[docs] explorer component "${name}" not found in manifest.json`)
    process.exit(1)
  }
  return {
    name: c.name,
    frameworks: c.frameworks,
    importFrom: c.importFrom,
    plugin: c.plugin,
    props: c.props ?? [],
    events: c.events ?? [],
    slots: c.slots ?? [],
    description: c.description,
  }
})
const explorerDataTs =
  '// AUTO-GENERATED by .vitepress/generate-components.mjs — do not edit.\n' +
  '// Slim manifest slice consumed by theme/components/IrisExplorer.vue.\n' +
  "import type { ManifestComponent } from './explorer-codegen'\n\n" +
  `export const EXPLORER_MANIFEST: ManifestComponent[] = ${JSON.stringify(explorerData, null, 2)}\n`
writeFileSync(join(here, 'theme', 'explorer-data.ts'), explorerDataTs)
// eslint-disable-next-line no-console
console.log(`[docs] wrote theme/explorer-data.ts (${explorerData.length} components)`)
