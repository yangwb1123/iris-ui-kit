import type { Framework, IrisManifest, ManifestProp } from '@iris-ui-kit/manifest'
import { getFrameworkContract } from '@iris-ui-kit/manifest'
import { detectControlledPair, fillValue, otherRequiredProps, type ControlledPair } from './codegen'

/** The framework's testing-library import specifier. */
const TESTING_LIBRARY: Record<Framework, string> = {
  react: '@testing-library/react',
  vue: '@vue/test-utils',
  solid: '@solidjs/testing-library',
  svelte: '@testing-library/svelte',
}

/**
 * Whether the detected event/handler is click-like — i.e. firing a click on the
 * rendered root is a faithful way to drive it.
 */
function isClickLike(event: string | undefined): boolean {
  return !!event && /click|press|select|toggle/i.test(event)
}

/** Emit test body lines for a given framework template. */
function emitTestBody(
  lines: string[],
  name: string,
  importPath: string,
  framework: Framework,
  eventLocal: string | undefined,
  clickLike: boolean,
  props: string,
): void {
  const tl = TESTING_LIBRARY[framework]
  const useFireEvent = clickLike ? ', fireEvent' : ''
  const isVue = framework === 'vue'
  lines.push("import { describe, it, expect, vi } from 'vitest'")
  const libImport = isVue ? 'mount' : 'render'
  const extra = isVue ? '' : `${useFireEvent}`
  lines.push(`import { ${libImport}${extra} } from '${tl}'`)
  lines.push(`import { ${name} } from '${importPath}'`)
  lines.push('')
  lines.push(`describe('${name}', () => {`)
  const asyncMarker = isVue && clickLike ? 'async ' : ''
  lines.push(`  it('renders and wires its event', ${asyncMarker}() => {`)
  if (eventLocal) lines.push(`    const ${eventLocal} = vi.fn()`)
  const renderLine = isVue
    ? `    const wrapper = mount(${name}, { props: ${props} })`
    : framework === 'svelte'
      ? `    const { container } = render(${name}, { props: ${props} })`
      : framework === 'solid'
        ? `    const { container } = render(() => <${name}${props} />)`
        : `    const { container } = render(<${name}${props} />)`
  lines.push(renderLine)
  if (isVue) {
    lines.push('    expect(wrapper.exists()).toBe(true)')
  } else {
    lines.push('    expect(container.firstChild).toBeTruthy()')
  }
  if (eventLocal && clickLike) {
    if (isVue) {
      lines.push("    await wrapper.trigger('click')")
    } else {
      lines.push('    fireEvent.click(container.firstChild as Element)')
    }
    lines.push(`    expect(${eventLocal}).toHaveBeenCalled()`)
  } else if (eventLocal) {
    lines.push(`    expect(${eventLocal}).not.toHaveBeenCalled()`)
  }
  lines.push('  })')
  lines.push('})')
}

/**
 * Emit a minimal render + interaction test skeleton for `component` in
 * `framework`, derived from the manifest. Deterministic; returns null for an
 * unknown or unsupported component.
 */
export function generateTest(
  manifest: IrisManifest,
  name: string,
  framework: Framework,
): string | null {
  const component = manifest.components.find((c) => c.name === name) ?? null
  if (!component || !component.frameworks.includes(framework)) return null

  const importPath = component.importFrom[framework] ?? `@iris-ui-kit/${framework}`
  const contract = getFrameworkContract(component, framework)
  const pair = detectControlledPair(component, framework)
  const event = pair?.handler ?? contract.events[0]
  const required = otherRequiredProps(component, framework, pair)
  const clickLike = isClickLike(event)
  const propStyle = framework === 'react' || framework === 'solid' ? 'jsx' : 'object'
  const eventLocal =
    event && /^[A-Za-z_$][\w$]*$/.test(event) ? event : event ? 'eventSpy' : undefined
  const eventProp = event ? listenerProp(event, framework) : undefined
  const props = renderProps(pair, eventProp, eventLocal, required, propStyle)

  const lines: string[] = []
  emitTestBody(lines, name, importPath, framework, eventLocal, clickLike, props)
  return lines.join('\n')
}

/** Render the prop list for a test invocation, as JSX attrs or an object literal. */
function renderProps(
  pair: ControlledPair | null,
  eventProp: string | undefined,
  eventLocal: string | undefined,
  required: ManifestProp[],
  style: 'jsx' | 'object',
): string {
  const entries: Array<[string, string]> = []
  if (pair) entries.push([pair.value, pair.default])
  if (eventProp && eventLocal) entries.push([eventProp, eventLocal])
  for (const p of required) {
    const { literal } = fillValue(p)
    entries.push([p.name, literal.startsWith('/*') ? `undefined /* ${p.type} */` : literal])
  }
  if (entries.length === 0) return style === 'object' ? '{}' : ''
  if (style === 'jsx') return ' ' + entries.map(([k, v]) => `${k}={${v}}`).join(' ')
  const body = entries
    .map(([key, value]) => `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${key}'`}: ${value}`)
    .join(', ')
  return `{ ${body} }`
}

/** Listener prop spelling used by a framework's test mounting API. */
function listenerProp(event: string, framework: Framework): string {
  if (framework !== 'vue') return event
  if (event.startsWith('update:')) return `onUpdate:${event.slice('update:'.length)}`
  return `on${event[0]!.toUpperCase()}${event.slice(1)}`
}
