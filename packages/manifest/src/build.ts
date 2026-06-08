import type {
  Framework,
  IrisManifest,
  ManifestComponent,
  ManifestGroupSummary,
  RawDiscovery,
} from './schema'
import { ALL_FRAMEWORKS } from './schema'

const IMPORT_PATH: Record<Framework, string> = {
  react: '@iris-ui/react',
  vue: '@iris-ui/vue',
  solid: '@iris-ui/solid',
  svelte: '@iris-ui/svelte',
}

const LAYER_MODEL: IrisManifest['layerModel'] = [
  {
    layer: 'Layer 0 — Theme System',
    description: 'Design tokens, applyTheme, theme store (CSS variables).',
  },
  { layer: 'Layer 1 — Meta Primitives', description: 'Low-level, single-purpose building blocks.' },
  { layer: 'Layer 2 — Composite Components', description: 'Higher-level interactive components.' },
  { layer: 'Layer 3 — Layouts', description: 'Structural layout components.' },
  { layer: 'Layer 4 — System Skeletons', description: 'Page / section skeleton scaffolds.' },
  {
    layer: 'Behaviors',
    description: 'Orthogonal interaction behaviors (hotkeys, click-outside, drag).',
  },
]

/**
 * Assemble the public manifest from raw discovery data. Pure and
 * deterministic: same input always yields byte-identical output (components
 * and groups are sorted), so the generated artifact is stable in version
 * control.
 */
export function buildManifest(raw: RawDiscovery): IrisManifest {
  const components: ManifestComponent[] = raw.components
    .map((c) => {
      const frameworks = [...c.frameworks].sort()
      const importFrom: ManifestComponent['importFrom'] = {}
      // Plugin components import from the plugin's per-framework sub-path
      // (`@iris-ui/plugin-x/react`); core components from the adapter package.
      for (const fw of frameworks) importFrom[fw] = c.plugin ? `${c.plugin}/${fw}` : IMPORT_PATH[fw]
      return {
        name: c.name,
        group: c.group,
        module: c.module,
        frameworks,
        importFrom,
        plugin: c.plugin,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const byGroup = new Map<string, string[]>()
  for (const c of components) {
    const list = byGroup.get(c.group) ?? []
    list.push(c.name)
    byGroup.set(c.group, list)
  }
  const groups: ManifestGroupSummary[] = [...byGroup.entries()]
    .map(([group, comps]) => ({
      group: group as ManifestComponent['group'],
      count: comps.length,
      components: comps,
    }))
    .sort((a, b) => a.group.localeCompare(b.group))

  const byFramework = Object.fromEntries(
    ALL_FRAMEWORKS.map((fw) => [fw, components.filter((c) => c.frameworks.includes(fw)).length]),
  ) as Record<Framework, number>
  const full = components.filter((c) => c.frameworks.length === ALL_FRAMEWORKS.length).length

  return {
    schema: 'iris-ui/manifest@1',
    name: 'Iris UI',
    description:
      'Token-driven, cross-framework (React, Vue, SolidJS, Svelte) UI component library.',
    frameworks: [...ALL_FRAMEWORKS],
    layerModel: LAYER_MODEL,
    groups,
    components,
    tokens: {
      ...raw.tokens,
      all: [...raw.tokens.color, ...raw.tokens.spacing, ...raw.tokens.radii],
    },
    stats: { total: components.length, full, byFramework },
  }
}
