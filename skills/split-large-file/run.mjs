#!/usr/bin/env node

/**
 * skills/split-large-file/run.mjs — Analyze a large file for splitting.
 *
 * Analyzes a source file that exceeds the filesize limit and suggests
 * how to split it by exported symbols.
 *
 * Usage: node cli.mjs skill split-large-file <path>
 *
 * Analogous to snaplink docs/skills/split-large-file/run.py
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getConfig, ROOT } from '../../checks/config.mjs'

export async function run(args = []) {
  if (args.length === 0) {
    console.error('Usage: node cli.mjs skill split-large-file <filepath>')
    return 1
  }

  const filePath = resolve(ROOT, args[0])
  if (!existsSync(filePath)) {
    console.error(`Error: ${filePath} not found`)
    return 1
  }

  const cfg = getConfig()
  const maxLines = cfg.filesize.max_lines

  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const totalLines = lines.length

  console.log(`=== Split Analysis: ${args[0]} (${totalLines} lines, max ${maxLines}) ===\n`)

  if (totalLines <= maxLines) {
    console.log('✓ Under the line limit — no split needed.')
    return 0
  }

  // Collect exported symbols with line numbers
  const exports = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match: export function/const/class/interface/type
    const exportMatch = line.match(/^export\s+(?:default\s+)?(?:function|const|class|interface|type|enum|abstract\s+class|let|var)\s+(\w+)/)
    if (exportMatch) {
      exports.push({ name: exportMatch[1], line: i + 1 })
    }
  }

  if (exports.length > 0) {
    console.log(`Exported symbols (${exports.length}):`)
    for (const exp of exports) {
      console.log(`  ${exp.name.padEnd(40)} line ${exp.line}`)
    }
  } else {
    console.log('(No exported symbols found — may be a barrel file)')
  }

  console.log(`\nOver budget by ${totalLines - maxLines} lines.`)
  console.log('\nSuggested split by concern:')
  console.log('  1. Group exports by domain concern')
  console.log(`  2. Target: each new file < ${maxLines} lines`)
  console.log('  3. Name by concern: e.g., <module>-<concern>.ts')
  console.log('  4. Update the barrel index.ts to re-export from new files\n')

  return 1
}