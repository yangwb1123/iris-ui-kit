#!/usr/bin/env node

/**
 * skills/add-new-component/run.mjs — Scaffold a component across all 4 frameworks.
 *
 * Creates the necessary files for a new Iris UI component in all four framework
 * adapters (react/vue/solid/svelte) and updates the barrel exports.
 *
 * Usage: node cli.mjs skill add-new-component <name> [--framework react]
 *   --framework: Scaffold only a specific framework (default: all 4)
 *
 * Example: node cli.mjs skill add-new-component IrisCombobox
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs'
import { resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const ROOT = __dirname

const FRAMEWORKS = {
  react: {
    dir: 'packages/react/src/primitives',
    ext: '.tsx',
    prefix: '',
    subdir: (name) => name.replace(/^Iris/, '').toLowerCase(),
  },
  vue: {
    dir: 'packages/vue/src/primitives',
    ext: '.ts',
    prefix: '',
    subdir: (name) => name.replace(/^Iris/, '').toLowerCase(),
  },
  solid: {
    dir: 'packages/solid/src/primitives',
    ext: '.tsx',
    prefix: 'Iris',
    subdir: (name) => name.replace(/^Iris/, '').toLowerCase(),
  },
  svelte: {
    dir: 'packages/svelte/src/primitives',
    ext: '.svelte',
    prefix: 'Iris',
    subdir: (name) => name.replace(/^Iris/, '').toLowerCase(),
  },
}

const COMPONENT_TEMPLATE = {
  react: (name) => `import { type ComponentProps } from 'react'
import { create${name.replace('Iris', '')}Controller } from '@iris-ui-kit/core'

export interface ${name}Props extends ComponentProps<'div'> {
  /** Controlled value */
  value?: string
  /** Default value for uncontrolled mode */
  defaultValue?: string
  /** Callback when value changes */
  onChange?: (value: string) => void
}

export function ${name}({ value, defaultValue, onChange, ...props }: ${name}Props) {
  return (
    <div {...props}>
      {/* TODO: Implement ${name} */}
    </div>
  )
}
`,
  vue: (name) => `import { defineComponent, PropType, ref } from 'vue'

export const ${name} = defineComponent({
  name: '${name}',
  props: {
    value: String,
    defaultValue: String,
    onChange: Function as PropType<(value: string) => void>,
  },
  emits: ['update:value'],
  setup(props, { emit, slots }) {
    // TODO: Implement ${name}
    return () => (
      <div>{/* TODO: Implement ${name} */}</div>
    )
  },
})
`,
  solid: (name) => `import { type Component, type JSX } from 'solid-js'
import { create${name.replace('Iris', '')}Controller } from '@iris-ui-kit/core'

export interface ${name}Props {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  children?: JSX.Element
}

export const ${name}: Component<${name}Props> = (props) => {
  return (
    <div>
      {/* TODO: Implement ${name} */}
      {props.children}
    </div>
  )
}
`,
  svelte: (name) => `<script lang="ts">
  import { create${name.replace('Iris', '')}Controller } from '@iris-ui-kit/core'

  export let value: string | undefined = undefined
  export let defaultValue: string | undefined = undefined
  export let onChange: ((value: string) => void) | undefined = undefined

  // TODO: Implement ${name}
</script>

<div>
  <!-- TODO: Implement ${name} -->
  <slot />
</div>
`,
}

const TEST_TEMPLATE = {
  react: (name) => `import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ${name} } from './${name}'

describe('${name}', () => {
  it('renders without crashing', () => {
    render(<${name} />)
    expect(screen.getByRole('region')).toBeDefined()
  })
})
`,
  vue: (name) => `import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { ${name} } from './${name}'

describe('${name}', () => {
  it('renders without crashing', () => {
    const wrapper = mount(${name})
    expect(wrapper.exists()).toBe(true)
  })
})
`,
  solid: (name) => `import { describe, it, expect } from 'vitest'
import { render, screen } from '@solidjs/testing-library'
import { ${name} } from './${name}'

describe('${name}', () => {
  it('renders without crashing', () => {
    render(() => <${name} />)
    expect(screen.getByRole('region')).toBeDefined()
  })
})
`,
  svelte: (name) => `<script lang="ts">
  import { describe, it, expect } from 'vitest'
  import { render } from '@testing-library/svelte'
  import ${name} from './${name}.svelte'

  describe('${name}', () => {
    it('renders without crashing', () => {
      const { container } = render(${name})
      expect(container).toBeTruthy()
    })
  })
</script>
`,
}

export async function run(args = []) {
  if (args.length === 0) {
    console.error('Usage: node cli.mjs skill add-new-component <ComponentName> [--framework react|vue|solid|svelte]')
    return 1
  }

  const name = args[0]
  if (!name.startsWith('Iris')) {
    console.error(`Component name should start with "Iris" (e.g., IrisCombobox)`)
    return 1
  }

  const frameworkFilter = args.includes('--framework') ? args[args.indexOf('--framework') + 1] : null
  const frameworks = frameworkFilter ? [frameworkFilter] : Object.keys(FRAMEWORKS)

  console.log(`=== Scaffolding ${name} ===\n`)

  let created = 0

  for (const fw of frameworks) {
    const config = FRAMEWORKS[fw]
    const componentDir = resolve(ROOT, config.dir, config.subdir(name))
    const componentFile = resolve(componentDir, `${name}${config.ext}`)
    const testFile = resolve(componentDir, `${name}.test${config.ext}`)

    if (!existsSync(componentDir)) {
      mkdirSync(componentDir, { recursive: true })
    }

    // Write component file
    const tmpl = COMPONENT_TEMPLATE[fw](name)
    writeFileSync(componentFile, tmpl)
    console.log(`  ✓ ${fw}: ${componentFile}`)
    created++

    // Write test file
    const testTmpl = TEST_TEMPLATE[fw](name)
    writeFileSync(testFile, testTmpl)
    console.log(`  ✓ ${fw}: ${testFile}`)
    created++

    // Check barrel exports
    const barrelPath = resolve(ROOT, config.dir, 'index.ts')
    if (existsSync(barrelPath)) {
      const barrel = readFileSync(barrelPath, 'utf-8')
      const exportLine = `export { ${name} } from './${config.subdir(name)}/${name}'`
      if (!barrel.includes(exportLine) && !barrel.includes(config.subdir(name))) {
        // Add export to barrel
        const updated = barrel.trimEnd() + `\nexport { ${name} } from './${config.subdir(name)}/${name}'\n`
        writeFileSync(barrelPath, updated)
        console.log(`  ✓ ${fw}: updated barrel exports`)
        created++
      }
    }
  }

  console.log(`\n✅ Scaffolded ${name} across ${frameworks.length} framework(s) — ${created} files created.`)
  console.log('  Next: implement the component logic and export from core package.\n')

  return 0
}