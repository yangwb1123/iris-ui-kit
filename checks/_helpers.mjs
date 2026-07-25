#!/usr/bin/env node

/**
 * checks/_helpers.mjs — Shared helpers for check modules.
 */

import { readdirSync } from 'node:fs'
import { resolve, extname } from 'node:path'

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.vue', '.svelte'])

/**
 * Recursively collect source files from a directory, respecting ignore patterns.
 */
export function collectSourceFiles(dir, ignorePatterns = []) {
  const results = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue
        if (ignorePatterns.some(p => full.includes(p.replace(/\*\*/g, '').replace(/\*/g, '')))) continue
        results.push(...collectSourceFiles(full, ignorePatterns))
      } else if (entry.isFile()) {
        const ext = extname(entry.name)
        if (!SOURCE_EXTS.has(ext)) continue
        if (entry.name.endsWith('.d.ts')) continue
        if (ignorePatterns.some(p => full.includes(p.replace(/\*\*/g, '').replace(/\*/g, '')))) continue
        results.push(full)
      }
    }
  } catch { /* skip */ }
  return results
}

/**
 * Check if a file path matches any of the given patterns.
 * Simple substring matching (not full glob).
 */
export function matchesAny(path, patterns) {
  return patterns.some(p => path.includes(p.replace(/\*\*/g, '').replace(/\*/g, '')))
}