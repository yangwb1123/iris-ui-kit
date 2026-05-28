import type {
  Framework,
  IrisManifest,
  ManifestComponent,
  ManifestGroupSummary,
  RawDiscovery,
} from './schema'

const IMPORT_PATH: Record<Framework, string> = {
  react: '@iris-ui/react',
  vue: '@iris-ui/vue',
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
      for (const fw of frameworks) importFrom[fw] = IMPORT_PATH[fw]
      return { name: c.name, group: c.group, module: c.module, frameworks, importFrom }
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

  const both = components.filter((c) => c.frameworks.length === 2).length
  const reactOnly = components.filter(
    (c) => c.frameworks.length === 1 && c.frameworks[0] === 'react',
  ).length
  const vueOnly = components.filter(
    (c) => c.frameworks.length === 1 && c.frameworks[0] === 'vue',
  ).length

  return {
    schema: 'iris-ui/manifest@1',
    name: 'Iris UI',
    description: 'Token-driven, cross-framework (React 18 + Vue 3) UI component library.',
    frameworks: ['react', 'vue'],
    layerModel: LAYER_MODEL,
    groups,
    components,
    tokens: {
      ...raw.tokens,
      all: [...raw.tokens.color, ...raw.tokens.spacing, ...raw.tokens.radii],
    },
    stats: { total: components.length, both, reactOnly, vueOnly },
  }
}
