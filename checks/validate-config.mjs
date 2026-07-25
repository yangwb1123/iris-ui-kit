#!/usr/bin/env node

/**
 * checks/validate-config.mjs — Validate iris.yaml configuration.
 *
 * Checks that all required keys are present and have valid types.
 * Reports any missing or invalid configuration.
 */

import { getConfig, resetCache, CONFIG_PATH } from './config.mjs'
import { existsSync } from 'node:fs'

export async function run() {
  let exitCode = 0
  const errors = []
  const warnings = []

  console.log('--- Validate iris.yaml ---\n')

  // Check file exists
  if (!existsSync(CONFIG_PATH)) {
    console.log(`✗ Config file not found: ${CONFIG_PATH}`)
    return 1
  }

  // Reload clean
  resetCache()
  let cfg
  try {
    cfg = getConfig()
    console.log(`✓ Parsed: ${CONFIG_PATH}`)
  } catch (err) {
    console.log(`✗ Failed to parse: ${err.message}`)
    return 1
  }

  // Validate sections
  const checks = [
    // project
    ['project.name', 'string'],
    ['project.language', 'string'],
    // filesize
    ['filesize.max_lines', 'number'],
    ['filesize.exemptions', 'array'],
    ['filesize.ignore_patterns', 'array'],
    // architecture
    ['architecture.forbidden_imports', 'array'],
    // complexity
    ['complexity.max_function_lines', 'number'],
    ['complexity.max_cyclomatic', 'number'],
    ['complexity.max_export_symbols', 'number'],
    // coverage
    ['coverage.targets', 'object'],
    ['coverage.exclude_patterns', 'array'],
    // size
    ['size.budgets', 'object'],
    // change_budget
    ['change_budget.target_files', 'number'],
    ['change_budget.hard_stop_files', 'number'],
    // framework_parity
    ['framework_parity.frameworks', 'object'],
    ['framework_parity.required_sub_paths', 'array'],
    // manifest
    ['manifest.manifest_path', 'string'],
    ['manifest.llms_path', 'string'],
    // rsc
    ['rsc.check_dir', 'string'],
    ['rsc.framework_name', 'string'],
    // pack_install
    ['pack_install.curated_packages', 'array'],
    // desktop_parity
    ['desktop_parity.shells', 'array'],
    ['desktop_parity.reference', 'string'],
  ]

  for (const [path, type] of checks) {
    let value = cfg
    const parts = path.split('.')
    for (const part of parts) {
      if (value === undefined || value === null || typeof value !== 'object') {
        value = undefined
        break
      }
      value = value[part]
    }
    if (value === undefined) {
      errors.push(`Missing: ${path}`)
    } else {
      const actualType = Array.isArray(value) ? 'array' : typeof value
      if (actualType !== type) {
        errors.push(`Type mismatch: ${path} expected ${type}, got ${actualType}`)
      }
    }
  }

  // Validate file exemptions exist on disk
  const missingExemptions = cfg.filesize.exemptions.filter(ex => !existsSync(ex))
  if (missingExemptions.length > 0) {
    warnings.push(`${missingExemptions.length} filesize exemption(s) not found on disk (may have been moved)`)
  }

  // Validate framework parity dirs exist
  for (const [fw, dir] of Object.entries(cfg.framework_parity.frameworks)) {
    if (!existsSync(dir)) {
      warnings.push(`Framework dir not found: ${fw} -> ${dir}`)
    }
  }

  // Validate manifest paths
  if (!existsSync(cfg.manifest.manifest_path)) {
    warnings.push(`Manifest not found: ${cfg.manifest.manifest_path} (run 'generate')`)
  }

  // Print results
  if (errors.length > 0) {
    console.log(`\n  ✗ Configuration errors:\n`)
    for (const err of errors) {
      console.log(`    • ${err}`)
    }
    exitCode = 1
  }

  if (warnings.length > 0) {
    console.log(`\n  ⚠️  Warnings:\n`)
    for (const w of warnings) {
      console.log(`    • ${w}`)
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('  ✓ All configuration valid.')
  }

  console.log()
  return exitCode
}