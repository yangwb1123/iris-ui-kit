/**
 * Locate a *runnable* esbuild binary.
 *
 * Why this exists: `node_modules/.bin/esbuild` under pnpm is a `/bin/sh` shim
 * that re-execs the platform package. Spawning that path from Node does not
 * reliably work (on this machine it makes Node load the Mach-O binary as
 * JavaScript), so `check-size.mjs` silently got `null` back, printed
 * "unmeasurable (build first, or esbuild unavailable)" and failed the
 * *enforced* per-icon tree-shaking probe — a gate that reports an environment
 * problem as a size regression.
 *
 * Same discipline as `run-pnpm.mjs`: try candidates, verify each one actually
 * runs, and report precisely what was tried when none work. Never guess.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * esbuild's platform package name. `process.platform` is only `darwin`/`linux`
 * (arch lives in `process.arch`), and the Windows package is just `win32` for
 * both architectures — getting this wrong silently yields zero candidates,
 * which is exactly the "esbuild unavailable" confusion this module removes.
 */
export function esbuildPlatform(platform = process.platform, arch = process.arch) {
  if (platform === 'win32') return 'win32'
  if (platform === 'darwin' || platform === 'linux') return `${platform}-${arch}`
  return null
}

/** True when `bin` starts and answers `--version`. */
export function isRunnable(bin) {
  try {
    const out = execFileSync(bin, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return /^\d+\.\d+\.\d+/.test(out.trim())
  } catch {
    return false
  }
}

/**
 * Candidate paths, most specific first:
 *  1. the hoisted platform package (plain installs);
 *  2. the platform package inside the pnpm store (version-agnostic glob);
 *  3. the `node_modules/.bin` shim (last resort — it is what a human runs).
 *
 * @param {string} root repo root
 * @returns {string[]}
 */
export function esbuildCandidates(root) {
  const platform = esbuildPlatform()
  const candidates = []
  if (platform) {
    candidates.push(join(root, 'node_modules', '@esbuild', platform, 'bin', 'esbuild'))
    const pnpmDir = join(root, 'node_modules', '.pnpm')
    if (existsSync(pnpmDir)) {
      for (const entry of readdirSync(pnpmDir)) {
        if (!entry.startsWith(`@esbuild+${platform}@`)) continue
        candidates.push(
          join(pnpmDir, entry, 'node_modules', '@esbuild', platform, 'bin', 'esbuild'),
        )
      }
    }
  }
  candidates.push(join(root, 'node_modules', '.bin', 'esbuild'))
  return candidates
}

/**
 * @param {string} root repo root
 * @returns {{ bin: string } | { bin: null, tried: string[] }}
 *   `bin: null` means no candidate could even be executed — callers must treat
 *   that as an environment problem, never as a passing measurement.
 */
export function findEsbuild(root) {
  const tried = []
  for (const candidate of esbuildCandidates(root)) {
    if (!existsSync(candidate)) {
      tried.push(`${candidate} (missing)`)
      continue
    }
    tried.push(candidate)
    if (isRunnable(candidate)) return { bin: candidate }
    tried[tried.length - 1] = `${candidate} (not runnable)`
  }
  return { bin: null, tried }
}
