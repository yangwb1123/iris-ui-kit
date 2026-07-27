#!/usr/bin/env node

/**
 * checks/config.mjs — Declarative config loader.
 * Loads iris.yaml as the single source of truth for all check thresholds.
 * Uses js-yaml for robust YAML parsing.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(__dirname, '..')
export const CONFIG_PATH = resolve(ROOT, 'iris.yaml')

// ── Defaults (merged with parsed iris.yaml) ───────────────────────────────

const DEFAULTS = {
  project: { name: 'iris-ui', language: 'typescript', module: '@iris-ui' },
  filesize: { max_lines: 500, ignore_patterns: [], exemptions: [] },
  architecture: { forbidden_imports: [], plugin_rules: [] },
  complexity: { max_function_lines: 50, max_cyclomatic: 15, max_export_symbols: 30, ignore_patterns: [] },
  coverage: { targets: {}, exclude_patterns: [], high_complexity_min_test_lines: 100 },
  size: { budgets: {}, budget_baseline_path: 'scripts/size-baseline.json' },
  change_budget: { target_files: 5, target_core_lines: 300, hard_stop_files: 10 },
  framework_parity: { frameworks: {}, required_sub_paths: [] },
  manifest: { manifest_path: 'packages/manifest/manifest.json', llms_path: 'packages/manifest/llms.txt' },
  rsc: { check_dir: 'packages/react/dist', framework_name: 'react' },
  pack_install: { curated_packages: [], raw_import_check: [], exports_resolve_check: [] },
  tokens: { tokens_dir: 'packages/tokens/src', token_source_files: [] },
  desktop_parity: { reference: 'desktop-os', shells: [] },
}

function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key]) && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key] !== undefined ? result[key] : {}, source[key])
    } else {
      result[key] = source[key] !== undefined ? source[key] : result[key]
    }
  }
  return result
}

// ── Load YAML ─────────────────────────────────────────────────────────────

export function load(path = CONFIG_PATH) {
  if (!existsSync(path)) {
    console.error(`ERROR: config file not found: ${path}`)
    console.error('Run from project root or specify a path.')
    process.exit(1)
  }

  const text = readFileSync(path, 'utf-8')
  let raw

  try {
    raw = yaml.load(text)
  } catch (err) {
    console.error(`ERROR: failed to parse ${path}: ${err.message}`)
    process.exit(1)
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    console.error(`ERROR: ${path} did not parse to a mapping`)
    process.exit(1)
  }

  return deepMerge(structuredClone(DEFAULTS), raw)
}

let _cached = null

export function getConfig() {
  if (_cached === null) _cached = load()
  return _cached
}

export function resetCache() {
  _cached = null
}