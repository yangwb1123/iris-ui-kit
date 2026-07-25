#!/usr/bin/env node

/**
 * skills/_shared/fs.mjs — Shared filesystem utilities for skills.
 *
 * Analogous to snaplink's docs/skills/shared/fs.py.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Count total lines in a file.
 */
export function countLines(filepath) {
  try {
    const content = readFileSync(filepath, 'utf-8')
    return content.split('\n').length
  } catch {
    return 0
  }
}

/**
 * Extract exported function/class names with their line numbers from a TS/TSX file.
 */
export function listExportedSymbols(filepath) {
  const content = readFileSync(filepath, 'utf-8')
  const lines = content.split('\n')
  const exports = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // export function name(...)
    const fnMatch = line.match(/^export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/)
    if (fnMatch) { exports.push({ name: fnMatch[1], line: i + 1, type: 'function' }); continue }

    // export const name = (...)
    const constMatch = line.match(/^export\s+(?:default\s+)?(?:const|let|var)\s+(\w+)/)
    if (constMatch) { exports.push({ name: constMatch[1], line: i + 1, type: 'variable' }); continue }

    // export class Name
    const classMatch = line.match(/^export\s+(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/)
    if (classMatch) { exports.push({ name: classMatch[1], line: i + 1, type: 'class' }); continue }

    // export interface Name
    const ifaceMatch = line.match(/^export\s+(?:default\s+)?interface\s+(\w+)/)
    if (ifaceMatch) { exports.push({ name: ifaceMatch[1], line: i + 1, type: 'interface' }); continue }

    // export type Name
    const typeMatch = line.match(/^export\s+type\s+(\w+)/)
    if (typeMatch) { exports.push({ name: typeMatch[1], line: i + 1, type: 'type' }); continue }
  }

  return exports
}

/**
 * Estimate cyclomatic complexity of a function body.
 * Counts: if/else, for, while, case, &&, ||, catch, ternary
 */
export function estimateComplexity(sourceCode) {
  const keywords = sourceCode.match(/\b(if|else\s+if|for|while|case|catch)\b/g) || []
  const operators = sourceCode.match(/[?]{1}/g) || []  // ternary
  const logicalAnd = sourceCode.match(/&&/g) || []
  const logicalOr = sourceCode.match(/\|\|/g) || []
  return keywords.length + operators.length + logicalAnd.length + logicalOr.length + 1
}

/**
 * Find source files recursively matching a pattern.
 */
export function findSourceFiles(dir, pattern = /\.(ts|tsx)$/) {
  const files = []
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.turbo') {
        files.push(...findSourceFiles(full, pattern))
      } else if (pattern.test(entry.name)) {
        files.push(full)
      }
    }
  } catch { /* skip */ }
  return files
}