#!/usr/bin/env node

/**
 * skills/refactor-high-complexity/run.mjs — Analyze and suggest refactoring for complex code.
 *
 * Wraps checks/complexity.mjs but provides per-function refactoring suggestions.
 * For each high-complexity function, suggests strategies like guard clauses,
 * strategy pattern, extraction, etc.
 *
 * Usage: node cli.mjs skill refactor-high-complexity <filepath> [--function name]
 *
 * Analogous to snaplink docs/skills/refactor-high-complexity/run.py
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getConfig, ROOT } from '../../checks/config.mjs'
import { countLines, estimateComplexity, listExportedSymbols } from '../_shared/fs.mjs'

export async function run(args = []) {
  if (args.length === 0 || args[0].startsWith('--')) {
    console.error('Usage: node cli.mjs skill refactor-high-complexity <filepath> [--function name]')
    return 1
  }

  const filePath = resolve(ROOT, args[0])
  if (!existsSync(filePath)) {
    console.error(`Error: ${filePath} not found`)
    return 1
  }

  const funcFilter = args.includes('--function') ? args[args.indexOf('--function') + 1] : null

  const cfg = getConfig()
  const cycloThreshold = cfg.complexity.max_cyclomatic || 15

  const content = readFileSync(filePath, 'utf-8')
  const totalLines = countLines(filePath)
  const relPath = relative(ROOT, filePath)

  console.log(`=== Complexity Analysis: ${relPath} (${totalLines} lines) ===\n`)

  // Split into function-sized chunks for analysis
  const lines = content.split('\n')
  const functions = []
  let current = null
  let braceDepth = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detect function start
    const fnStart = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)|(\w+)\s*(?:=|\():?\s*(?:async\s*)?\(/y)
    // Simplified: look for "function name(" or "name = function(" or "name: ("
    const fnDecl = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/) ||
                  line.match(/(?:const|let|var)\s+(\w+)\s*[=:]\s*(?:async\s*)?\(/) ||
                  line.match(/(\w+)\s*[=:]\s*(?:async\s*)?function\s*\(/)

    if (fnDecl) {
      if (current) {
        current.body = lines.slice(current.startLine, i).join('\n')
        current.cyclo = estimateComplexity(current.body)
        functions.push(current)
      }
      current = {
        name: fnDecl[1],
        startLine: i + 1,
        body: '',
        cyclo: 0,
      }
    }
  }

  // Push last function
  if (current) {
    current.body = lines.slice(current.startLine - 1).join('\n')
    current.cyclo = estimateComplexity(current.body)
    functions.push(current)
  }

  // Also find class methods
  for (let i = 0; i < lines.length; i++) {
    const methodDecl = lines[i].match(/(\w+)\s*\(\s*[^)]*\)\s*{/)
    if (methodDecl && !lines[i].includes('function') && !lines[i].includes('=>')) {
      // Check if inside a class
      let j = i
      let depth = 0
      let inClass = false
      while (j >= 0 && j > i - 30) {
        if (lines[j].includes('}')) depth++
        if (lines[j].includes('{')) depth--
        if (lines[j].match(/class\s+\w+/)) { inClass = true; break }
        j--
      }
      if (inClass && !functions.find(f => f.name === methodDecl[1])) {
        // Find method body
        let endLine = i + 1
        let braceCount = 1
        for (let k = i + 1; k < lines.length && braceCount > 0; k++) {
          braceCount += (lines[k].match(/{/g) || []).length
          braceCount -= (lines[k].match(/}/g) || []).length
          endLine = k
        }
        const body = lines.slice(i, endLine + 1).join('\n')
        functions.push({
          name: methodDecl[1],
          startLine: i + 1,
          body,
          cyclo: estimateComplexity(body),
        })
      }
    }
  }

  // Filter by cyclomatic complexity threshold
  const highComplexity = functions.filter(f => f.cyclo > cycloThreshold)

  if (funcFilter) {
    const filtered = highComplexity.filter(f => f.name === funcFilter)
    if (filtered.length === 0) {
      console.log(`  Function "${funcFilter}" not found or within limits.\n`)
      return 0
    }
    highComplexity.length = 0
    highComplexity.push(...filtered)
  }

  if (highComplexity.length === 0) {
    console.log('  All functions within complexity limits.\n')
    return 0
  }

  const STRATEGIES = [
    'Guard Clauses — Return early for edge cases instead of nested ifs',
    'Strategy Table — Replace switch/if chain with lookup table',
    'Extract Sub-Functions — Break into smaller, named operations',
    'Separation of Concerns — Split by responsibility into separate modules',
    'State Machine — Model complex states as explicit transitions',
  ]

  console.log(`  Found ${highComplexity.length} function(s) exceeding cyclo=${cycloThreshold}:\n`)

  for (const fn of highComplexity) {
    console.log(`  ✗ ${fn.name} (cyclo=${fn.cyclo}, line ${fn.startLine})`)
    console.log(`    Exceeds limit by ${fn.cyclo - cycloThreshold}`)

    // Suggest top strategies
    const suggestions = STRATEGIES.slice(0, 3)
    for (const s of suggestions) {
      console.log(`    → ${s}`)
    }
    console.log()
  }

  // Overall summary
  const totalFn = functions.length
  const pctHigh = ((highComplexity.length / totalFn) * 100).toFixed(0)
  console.log(`  Summary: ${highComplexity.length}/${totalFn} (${pctHigh}%) functions high-complexity`)
  console.log()

  return 1
}