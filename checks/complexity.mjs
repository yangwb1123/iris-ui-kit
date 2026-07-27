#!/usr/bin/env node

/**
 * checks/complexity.mjs — Function and export complexity gate.
 *
 * Checks:
 *   1. Function line count (heuristic, warn only)
 *   2. Export symbol count per file (God Object detection, warn only)
 *   3. `as any` usages (warn only)
 *
 * Thresholds from iris.yaml (complexity: section).
 * Migration from scripts/arch-check.mjs (complexity portion).
 */

import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { getConfig, ROOT } from './config.mjs'
import { collectSourceFiles } from './_helpers.mjs'

export async function run(opts = {}) {
  const cfg = getConfig()
  const { max_function_lines, max_export_symbols, ignore_patterns } = cfg.complexity

  const files = collectSourceFiles(resolve(ROOT, 'packages'), ignore_patterns)
  console.log('--- Complexity check ---')
  console.log(`Scanning ${files.length} files\n`)

  let warnings = []

  for (const file of files) {
    const rel = relative(ROOT, file)
    let content
    try {
      content = readFileSync(file, 'utf-8')
    } catch { continue }

    const lines = content.split('\n')

    // 1. Function size check (heuristic: track brace depth)
    let fnStart = -1
    let braceDepth = 0
    let currentFnName = ''
    const fnRegex = /^(?:\s*export\s+)?(?:async\s+)?function\s+\w+|^\s*\w+\s*(?:=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{)/
    // Simpler: look for function keyword followed by name
    const simpleFnRegex = /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const fnMatch = line.match(simpleFnRegex)

      if (fnMatch && braceDepth === 0) {
        fnStart = i
        currentFnName = fnMatch[1]
      }

      for (const ch of line) {
        if (ch === '{') braceDepth++
        if (ch === '}') {
          braceDepth--
          if (braceDepth === 0 && fnStart >= 0 && currentFnName) {
            const fnLines = i - fnStart + 1
            if (fnLines > max_function_lines) {
              warnings.push(`LONG FUNC ${fnLines}L ${rel}:${fnStart + 1} ${currentFnName} (max ${max_function_lines})`)
            }
            fnStart = -1
            currentFnName = ''
          }
        }
      }
    }

    // 2. Export symbol count
    if (!file.endsWith('.d.ts')) {
      const exportsCount = (content.match(/^export\s+(?:default\s+)?(?:function|const|class|interface|type|enum|abstract\s+class|let|var)\s+\w+/gm) || []).length
      if (exportsCount > max_export_symbols) {
        warnings.push(`GOD OBJ ${exportsCount} exports ${rel} (max ${max_export_symbols})`)
      }
    }

    // 3. `as any` usages
    const asAnyMatches = content.match(/\bas\s+any\b/g)
    if (asAnyMatches && asAnyMatches.length > 0) {
      warnings.push(`AS ANY ${asAnyMatches.length} ${rel}`)
    }
  }

  if (warnings.length === 0) {
    console.log('PASS: no complexity warnings')
    return 0
  }

  console.log(`⚠️  ${warnings.length} warning(s) (not blocking):\n`)
  for (const w of warnings.slice(0, 30)) {
    console.log(`  ${w}`)
  }
  if (warnings.length > 30) {
    console.log(`  ... and ${warnings.length - 30} more`)
  }
  console.log('\n(Complexity is advisory — does not block CI)')
  return 0
}