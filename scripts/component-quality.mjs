#!/usr/bin/env node
/**
 * Component quality report — generates metadata about each component's
 * coverage: SSR support, ...rest forwarding, contract test coverage, etc.
 *
 * Usage:
 *   node scripts/component-quality.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Load manifest
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'packages/manifest/manifest.json'), 'utf8'))

const results = []
for (const component of manifest.components) {
  const name = component.name
  const group = component.group ?? 'unknown'
  const frameworks = component.frameworks ?? []
  const hasPlugin = !!component.plugin

  // Check ...rest forwarding (React)
  const reactFile = findComponentFile(name, 'react')
  const hasRest = reactFile ? checkRestForwarding(reactFile) : null

  // Check contract test coverage
  const hasContract = checkContractCoverage(name)

  // Check SSR support (has 'use client' in React dist)
  const hasSSR = checkSSR(name)

  results.push({
    name,
    group,
    frameworks: frameworks.join(','),
    plugin: hasPlugin ? component.plugin : '',
    rest: hasRest === true ? '✅' : hasRest === false ? '❌' : '—',
    contract: hasContract ? '✅' : '—',
    ssr: hasSSR ? '✅' : '—',
    props: (component.props ?? []).length,
  })
}

// Print report
console.log('\n=== Iris UI Component Quality Report ===\n')
console.log('Component'.padEnd(26), 'Group'.padEnd(18), 'Frameworks'.padEnd(16), 'Rest', 'Contract', 'SSR', 'Props')
console.log('─'.repeat(90))
for (const r of results) {
  console.log(
    r.name.padEnd(26),
    r.group.padEnd(18),
    r.frameworks.padEnd(16),
    r.rest.padEnd(5),
    r.contract.padEnd(8),
    r.ssr.padEnd(5),
    r.props,
  )
}

console.log(`\nTotal: ${results.length} components`)
console.log(`...rest: ${results.filter((r) => r.rest === '✅').length}/${results.filter((r) => r.rest !== '—').length}`)
console.log(`Contract tests: ${results.filter((r) => r.contract === '✅').length}/${results.length}`)
console.log('')

// ── Helpers ────────────────────────────────────────────────────────────────

function findComponentFile(name, framework) {
  const baseDir = resolve(ROOT, 'packages', framework, 'src/primitives')
  if (!existsSync(baseDir)) return null

  // Convert IrisCamelCase to kebab-case directory
  const dirName = name
    .replace(/^Iris/, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()

  const compDir = resolve(baseDir, dirName)
  if (!existsSync(compDir)) {
    // Try alternate: some components are named differently
    const allDirs = readdirSync(baseDir, { withFileTypes: true }).filter((d) => d.isDirectory())
    for (const d of allDirs) {
      const idxFile = resolve(baseDir, d.name, 'index.tsx')
      if (existsSync(idxFile) && readFileSync(idxFile, 'utf8').includes(name)) {
        return resolve(baseDir, d.name, idxFile)
      }
    }
    return null
  }

  const files = ['index.tsx', `${dirName}.tsx`, `${name}.tsx`, 'index.ts', `${dirName}.ts`]
  for (const f of files) {
    const fp = resolve(compDir, f)
    if (existsSync(fp)) return fp
  }
  return null
}

function checkRestForwarding(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8')
    return content.includes('...rest') || content.includes('...others') || content.includes('[key: string]: unknown')
  } catch {
    return null
  }
}

function checkContractCoverage(name) {
  try {
    const contractsDir = resolve(ROOT, 'packages/core/src/contracts/scenarios')
    if (!existsSync(contractsDir)) return false
    const files = readdirSync(contractsDir)
    return files.some((f) => {
      const content = readFileSync(resolve(contractsDir, f), 'utf8')
      return content.includes(name) || content.includes(name.replace('Iris', '').toLowerCase())
    })
  } catch {
    return false
  }
}

function checkSSR(name) {
  try {
    const reactDist = resolve(ROOT, 'packages/react/dist')
    if (!existsSync(reactDist)) return false
    const files = readdirSync(reactDist).filter((f) => f.endsWith('.js'))
    // Check if any dist file mentions this component AND has 'use client'
    for (const f of files) {
      const content = readFileSync(resolve(reactDist, f), 'utf8')
      if (content.includes(name) && content.includes('use client')) return true
    }
    return false
  } catch {
    return false
  }
}
