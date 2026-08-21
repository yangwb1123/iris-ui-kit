import type {
  ComponentLayer,
  Framework,
  IrisManifest,
  ManifestComponent,
  ManifestGroupSummary,
  RawDiscovery,
} from './schema'
import { ALL_FRAMEWORKS } from './schema'

const IMPORT_PATH: Record<Framework, string> = {
  react: '@iris-ui-kit/react',
  vue: '@iris-ui-kit/vue',
  solid: '@iris-ui-kit/solid',
  svelte: '@iris-ui-kit/svelte',
}

const LAYER_MODEL: IrisManifest['layerModel'] = [
  {
    id: 'layer-0',
    layer: 'Layer 0 — Theme System',
    description: 'Design tokens, applyTheme, theme store (CSS variables).',
  },
  {
    id: 'layer-1',
    layer: 'Layer 1 — Meta Primitives',
    description: 'Low-level, single-purpose building blocks.',
  },
  {
    id: 'layer-2',
    layer: 'Layer 2 — Composite Components',
    description: 'Higher-level interactive components.',
  },
  { id: 'layer-3', layer: 'Layer 3 — Layouts', description: 'Structural layout components.' },
  {
    id: 'layer-4',
    layer: 'Layer 4 — System Skeletons',
    description: 'Page / section skeleton scaffolds.',
  },
  {
    id: 'behavior',
    layer: 'Behaviors',
    description: 'Orthogonal interaction behaviors (hotkeys, click-outside, drag).',
  },
  {
    id: 'plugin',
    layer: 'Plugins',
    description: 'Optional heavy capabilities activated through IrisProvider.',
  },
]

/** Composite primitive modules that belong to Layer 2 rather than Layer 1. */
const LAYER_2_MODULES = new Set([
  'accordion',
  'calendar',
  'carousel',
  'cascader',
  'color-picker',
  'combobox',
  'command-palette',
  'date-picker',
  'date-range-picker',
  'dialog',
  'drawer',
  'dropdown-menu',
  'file-upload',
  'list',
  'menu',
  'pagination',
  'popover',
  'select',
  'splitter',
  'stepper',
  'table',
  'tabs',
  'time-picker',
  'toast',
  'tour',
  'transfer',
  'tree',
  'tree-select',
  'virtual-scroll',
])

const PART_SUFFIXES = new Set([
  'Trigger',
  'Content',
  'Title',
  'Description',
  'Close',
  'Item',
  'Separator',
  'Sub',
  'List',
  'Menu',
  'Step',
  'Field',
  'Panel',
])

/** Central, deterministic component → architecture-layer mapping. */
export function componentLayer(
  group: ManifestComponent['group'],
  module: string | undefined,
  name: string,
): ComponentLayer {
  if (group === 'plugin') return 'plugin'
  if (group === 'theme') return 'layer-0'
  if (group === 'behaviors') return 'behavior'
  if (group === 'layouts') return 'layer-3'
  if (group === 'skeletons' || name.startsWith('IrisAdmin')) return 'layer-4'
  if (group === 'form' || (group === 'primitives' && module && LAYER_2_MODULES.has(module))) {
    return 'layer-2'
  }
  return 'layer-1'
}

function buildManifestComponents(raw: RawDiscovery): ManifestComponent[] {
  return raw.components
    .map((component) => {
      const frameworks = [...component.frameworks].sort()
      const importFrom: ManifestComponent['importFrom'] = {}
      for (const framework of frameworks) {
        importFrom[framework] = component.plugin
          ? `${component.plugin}/${framework}`
          : IMPORT_PATH[framework]
      }
      return {
        name: component.name,
        group: component.group,
        layer: componentLayer(component.group, component.module, component.name),
        module: component.module,
        frameworks,
        importFrom,
        plugin: component.plugin,
        ...(component.description ? { description: component.description } : {}),
        ...(component.example ? { example: component.example } : {}),
        props: component.props,
        ...(component.frameworkContracts
          ? { frameworkContracts: component.frameworkContracts }
          : {}),
        ...(component.events && component.events.length > 0 ? { events: component.events } : {}),
        ...(component.slots && component.slots.length > 0 ? { slots: component.slots } : {}),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function addManifestComponentMetadata(components: ManifestComponent[]): void {
  const names = components.map((component) => component.name)
  for (const component of components) {
    const subComponents = names.filter(
      (name) =>
        name.startsWith(component.name) && PART_SUFFIXES.has(name.slice(component.name.length)),
    )
    if (subComponents.length > 0) component.subComponents = subComponents
    component.quality = {
      propCount: component.props?.length ?? 0,
      eventCount: component.events?.length ?? 0,
    }
  }
}

function summarizeManifestGroups(components: ManifestComponent[]): ManifestGroupSummary[] {
  const byGroup = new Map<string, string[]>()
  for (const component of components) {
    const names = byGroup.get(component.group) ?? []
    names.push(component.name)
    byGroup.set(component.group, names)
  }
  return [...byGroup.entries()]
    .map(([group, names]) => ({
      group: group as ManifestComponent['group'],
      count: names.length,
      components: names,
    }))
    .sort((a, b) => a.group.localeCompare(b.group))
}

function manifestFrameworkStats(components: ManifestComponent[]): {
  full: number
  byFramework: Record<Framework, number>
} {
  const byFramework = Object.fromEntries(
    ALL_FRAMEWORKS.map((framework) => [
      framework,
      components.filter((component) => component.frameworks.includes(framework)).length,
    ]),
  ) as Record<Framework, number>
  return {
    full: components.filter((component) => component.frameworks.length === ALL_FRAMEWORKS.length)
      .length,
    byFramework,
  }
}

/**
 * Assemble the public manifest from raw discovery data. Pure and
 * deterministic: same input always yields byte-identical output (components
 * and groups are sorted), so the generated artifact is stable in version
 * control.
 */
export function buildManifest(raw: RawDiscovery): IrisManifest {
  const components = buildManifestComponents(raw)
  addManifestComponentMetadata(components)
  const groups = summarizeManifestGroups(components)
  const { full, byFramework } = manifestFrameworkStats(components)

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
      all: [
        ...raw.tokens.color,
        ...raw.tokens.spacing,
        ...raw.tokens.radii,
        ...raw.tokens.shadows,
        ...raw.tokens.zIndex,
        ...raw.tokens.transitions,
      ],
    },
    stats: { total: components.length, full, byFramework },
  }
}
