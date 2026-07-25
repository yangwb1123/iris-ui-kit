#!/usr/bin/env node

/**
 * checks/exports.mjs — Symbol export count gate (God Object detection).
 *
 * Flags files that export too many symbols, indicating a God Object.
 * Threshold from iris.yaml (complexity.max_export_symbols).
 *
 * Migration from scripts/arch-check.mjs (export count portion).
 * Advisory only — does not block CI.
 */

import { readFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { getConfig, ROOT } from './config.mjs'
import { collectSourceFiles } from './_helpers.mjs'

export async function run(opts = {}) {
  const cfg = getConfig()
  const { max_export_symbols, ignore_patterns } = cfg.complexity

  const files = collectSourceFiles(resolve(ROOT, 'packages'), ignore_patterns)
  let warnings = []

  for (const file of files) {
    if (file.endsWith('.d.ts') || file.endsWith('.vue') || file.endsWith('.svelte')) continue

    const rel = relative(ROOT, file)
    let content
    try {
      content = readFileSync(file, 'utf-8')
    } catch { continue }

    const exportStatements = content.match(
      /^export\s+(?:default\s+)?(?:function|const|class|interface|type|enum|abstract\s+class|let|var)\s+\w+/gm,
    )
    const count = exportStatements ? exportStatements.length : 0

    if (count > max_export_symbols) {
      warnings.push(`${count} exports ${rel} (max ${max_export_symbols})`)
    }
  }

  if (warnings.length === 0) {
    console.log('PASS: no God Object detected')
    return 0
  }

  console.log(`⚠️  ${warnings.length} file(s) with excessive exports (advisory, not blocking):\n`)
  for (const w of warnings.slice(0, 20)) {
    console.log(`  ${w}`)
  }
  if (warnings.length > 20) {
    console.log(`  ... and ${warnings.length - 20} more`)
  }
  return 0  // advisory only
}