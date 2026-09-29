import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Read the `filesize.exemptions` list out of `iris.yaml`.
 *
 * `iris.yaml` is this repo's single source of truth for thresholds, and the
 * 500-line rule is enforced by two gates (`cli.mjs check-filesize` and
 * `scripts/arch-check.mjs`). They used to read *different* exemption lists, so
 * a file could be "exempt" for one gate and "newly over the limit" for the
 * other — an apparent regression that was really a disagreement. One list, two
 * gates.
 *
 * Deliberately dependency-free (no yaml package) and tolerant: a missing or
 * restructured `iris.yaml` yields an empty set, which fails the gate rather
 * than silently exempting everything.
 */

/**
 * @param {string} yamlText
 * @returns {Set<string>} repo-relative file paths
 */
export function parseFilesizeExemptions(yamlText) {
  const exempt = new Set()
  let inFilesizeBlock = false
  let inList = false
  for (const raw of yamlText.split('\n')) {
    // Top-level key: only `filesize:` opens the block we care about. Anything
    // else (e.g. a `complexity:` section with its own `exemptions:`) closes it,
    // otherwise two lists would merge.
    const topLevel = raw.match(/^([a-z_]+):/)
    if (topLevel) {
      inFilesizeBlock = topLevel[1] === 'filesize'
      inList = false
      continue
    }
    if (!inFilesizeBlock) continue
    if (/^\s+exemptions:\s*$/.test(raw)) {
      inList = true
      continue
    }
    if (!inList) continue
    // Comments may sit inside the list (they carry the reason for each entry).
    if (/^\s*#/.test(raw)) continue
    if (/^\s*$/.test(raw)) continue
    const item = raw.match(/^\s+-\s+(\S+)\s*$/)
    if (item) exempt.add(item[1])
    else inList = false
  }
  return exempt
}

/**
 * @param {string} root repo root
 * @returns {Set<string>}
 */
export function loadFilesizeExemptions(root) {
  try {
    return parseFilesizeExemptions(readFileSync(resolve(root, 'iris.yaml'), 'utf-8'))
  } catch {
    return new Set()
  }
}
