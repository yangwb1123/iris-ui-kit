#!/usr/bin/env node

/**
 * skills/project-reorganization/run.mjs — Analyze and suggest file reorganization.
 *
 * Scans the project structure for patterns that suggest reorganization:
 * - Files approaching the line limit
 * - Files with too many exports
 * - Barrel files with too many re-exports
 * - Deep nesting
 *
 * Usage: node cli.mjs skill project-reorganization [--dir packages/core/src]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, relative, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const ROOT = __dirname

function walkDir(dir, pattern = /\.ts$/) {
  const files = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...walkDir(full, pattern))
      } else if (pattern.test(entry.name)) {
        files.push(full)
      }
    }
  } catch { /* skip */ }
  return files
}

export async function run(args = []) {
  const targetDir = args[0] || 'packages/core/src'
  const targetPath = resolve(ROOT, targetDir)

  console.log('=== Project Reorganization Analysis ===\n')
  console.log(`  Analyzing: ${targetDir}/\n`)

  const files = walkDir(targetPath)
  const maxLines = 500
  const maxDeep = 4

  // 1. Find oversized files
  const oversized = []
  const barrelFiles = []
  const deepFiles = []
  const highExport = []

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    const lines = content.split('\n').length
    const relPath = relative(ROOT, file)

    // Oversized
    if (lines > maxLines) {
      oversized.push({ path: relPath, lines })
    }

    // Barrel files (index.ts)
    if (basename(file) === 'index.ts') {
      const exports = content.match(/^export .+ from/gm) || []
      const reExports = content.match(/^export \* from/gm) || []
      if (exports.length > 20 || reExports.length > 15) {
        barrelFiles.push({ path: relPath, exports: exports.length, reExports: reExports.length })
      }
    }

    // Deep nesting
    const depth = relPath.split('/').length
    if (depth > maxDeep) {
      deepFiles.push({ path: relPath, depth })
    }

    // High export count
    const exportCount = (content.match(/^export (function|const|class|interface|type|enum|default|async)/gm) || []).length
    if (exportCount > 10) {
      highExport.push({ path: relPath, exports: exportCount })
    }
  }

  let suggestions = 0

  if (oversized.length > 0) {
    console.log('  📦 Oversized files (> 500 lines):\n')
    for (const f of oversized.slice(0, 10)) {
      console.log(`    ${f.path} (${f.lines} lines)`)
      console.log(`    → Split into smaller files by concern`)
      suggestions++
    }
    if (oversized.length > 10) {
      console.log(`    ... and ${oversized.length - 10} more`)
    }
    console.log()
  }

  if (barrelFiles.length > 0) {
    console.log('  📋 Large barrel files:\n')
    for (const f of barrelFiles.slice(0, 5)) {
      console.log(`    ${f.path} (${f.exports} direct exports, ${f.reExports} re-exports)`)
      console.log(`    → Group exports by sub-module`)
      suggestions++
    }
    if (barrelFiles.length > 5) {
      console.log(`    ... and ${barrelFiles.length - 5} more`)
    }
    console.log()
  }

  if (deepFiles.length > 0) {
    console.log('  📁 Deeply nested files:\n')
    for (const f of deepFiles.slice(0, 10)) {
      console.log(`    ${f.path} (depth ${f.depth})`)
      suggestions++
    }
    if (deepFiles.length > 10) {
      console.log(`    ... and ${deepFiles.length - 10} more`)
    }
    console.log()
  }

  if (highExport.length > 0) {
    console.log('  🏛️  High-export files:\n')
    for (const f of highExport.slice(0, 10)) {
      console.log(`    ${f.path} (${f.exports} exports)`)
      console.log(`    → Consolidate or split by domain`)
      suggestions++
    }
    if (highExport.length > 10) {
      console.log(`    ... and ${highExport.length - 10} more`)
    }
    console.log()
  }

  if (suggestions === 0) {
    console.log('  ✅ No reorganization needed.\n')
  } else {
    console.log(`  ${suggestions} suggestion(s) for improvement.\n`)
  }

  return suggestions > 0 ? 1 : 0
}