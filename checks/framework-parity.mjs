#!/usr/bin/env node

/**
 * checks/framework-parity.mjs — Four-framework parity check.
 *
 * Verifies that all four framework adapters (react/vue/solid/svelte) export
 * the same set of component directories under primitives/ and have the same
 * sub-path exports.
 *
 * This is a UNIQUE Iris UI gate — no equivalent in snaplink. It codifies the
 * "四框架完全对齐" requirement from AGENTS.md.
 */

import { readdirSync, existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { getConfig, ROOT } from './config.mjs'

export async function run(opts = {}) {
  const cfg = getConfig()
  const frameworks = cfg.framework_parity.frameworks
  const requiredSubPaths = cfg.framework_parity.required_sub_paths

  console.log('--- Framework Parity Check ---\n')

  // 1. Compare primitive component directories
  const fwNames = Object.keys(frameworks)
  const fwDirs = {}
  for (const [name, dir] of Object.entries(frameworks)) {
    const fullPath = resolve(ROOT, dir)
    if (!existsSync(fullPath)) {
      console.log(`⚠️  ${name}: primitives dir not found at ${dir}`)
      fwDirs[name] = []
      continue
    }
    fwDirs[name] = readdirSync(fullPath, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort()
  }

  // Check: all frameworks have same primitives (with exemptions)
  const ref = fwNames[0]
  const refSet = new Set(fwDirs[ref] || [])
  const exemptions = cfg.framework_parity.directory_exemptions || {}
  let hasDrift = false
  let usedExemption = false

  if (Object.keys(exemptions).length > 0) {
    console.log(`  (${Object.keys(exemptions).length} directory exemption(s) configured)`)
  }

  for (const fw of fwNames.slice(1)) {
    const fwSet = new Set(fwDirs[fw] || [])

    // Filter out exempted directories
    const isExempted = (dir, fwName) => {
      return exemptions[dir] && exemptions[dir].includes(fwName)
    }

    const missing = [...refSet].filter(x => !fwSet.has(x) && !isExempted(x, fw))
    const extra = [...fwSet].filter(x => !refSet.has(x) && !isExempted(x, fw))

    if (missing.length > 0 || extra.length > 0) {
      hasDrift = true
      console.log(`❌ ${fw} vs ${ref} drift:`)
      if (missing.length > 0) console.log(`   Missing: ${missing.join(', ')}`)
      if (extra.length > 0) console.log(`   Extra:   ${extra.join(', ')}`)
    } else {
      console.log(`✓ ${fw}: primitives match ${ref} (${fwSet.size} components)`)
    }
  }

  // 2. Check sub-path exports (packages/{fw}/src/{subpath})
  for (const sub of requiredSubPaths) {
    const subPresent = {}
    for (const fw of fwNames) {
      const subPath = resolve(ROOT, `packages/${fw}/src${sub}`)
      subPresent[fw] = existsSync(subPath)
    }

    const allPresent = Object.values(subPresent).every(Boolean)
    if (!allPresent) {
      // Check if all missing frameworks are exempted for this exact path
      const missing = Object.entries(subPresent).filter(([, v]) => !v).map(([k]) => k)
      const exemptAll = missing.every(m => {
        // Sub-path exemption uses the dir name after the last /
        const dirName = sub.split('/').filter(Boolean).pop()
        return exemptions[dirName] && exemptions[dirName].includes(m)
      })
      if (!exemptAll) {
        hasDrift = true
        console.log(`❌ Sub-path "${sub}" missing in: ${missing.join(', ')}`)
      } else {
        console.log(`✓ Sub-path "${sub}" present (exempted frameworks: ${missing.join(', ')})`)
      }
    } else {
      console.log(`✓ Sub-path "${sub}" present in all frameworks`)
    }
  }

  if (hasDrift) {
    console.log('\nFAIL: Framework parity drift detected.')
    console.log('Ensure new components are ported to all four framework adapters.')
    return 1
  }

  console.log('\n✓ All four frameworks are in parity.')
  return 0
}