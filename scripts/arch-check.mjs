#!/usr/bin/env node

/**
 * arch-check.mjs — 自动架构检查（baseline 棘轮版）
 *
 * 检查内容：
 *   1. 源文件 / 测试文件行数（max 500 行）
 *   2. core 包不能依赖框架包（硬不变量，任何模式都 fail）
 *   3. 单文件导出符号数（max 30，God Object 检测，warn）
 *   4. 函数行数（max 50，启发式，warn）+ `as any` 计数（warn）
 *
 * 模式（行数检查的失败语义）：
 *   pnpm run arch-check            normal  — 全量扫描，仅 warn（exit 0），人工巡检用
 *   pnpm run arch-check --strict   strict  — 全量扫描，所有超限都 fail（忽略 baseline），全量审计用
 *   pnpm run arch-check --ratchet  ratchet — 全量扫描，仅「新增超限 / 存量文件变大」fail（CI 用）
 *   pnpm run arch-check --diff     diff    — 仅 git 改动文件，baseline 感知 fail（pre-commit 用）
 *   pnpm run arch-check --update-baseline   重写 scripts/arch-baseline.json（修好大文件后手动棘轮收紧）
 *
 * 棘轮原理：baseline 记录「当前已超限文件 → 当前行数」。已在 baseline 内且未变大的文件被豁免
 *   （grandfathered），不阻断；新增超限文件、或存量文件继续变大，才 fail。这样既保护
 *   Table 这类天然内聚的大文件，又禁止整体退化。修好/缩小某文件后运行 --update-baseline 收紧天花板。
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = new URL('..', import.meta.url).pathname
const BASELINE_PATH = resolve(ROOT, 'scripts', 'arch-baseline.json')
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.turbo', '.svelte-kit', '.next', 'coverage'])
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.vue', '.svelte'])

const MAX_SOURCE_LINES = 500
const MAX_TEST_LINES = 500
const MAX_EXPORTS = 30
const MAX_FUNCTION_LINES = 50

const isStrict = process.argv.includes('--strict')
const isRatchet = process.argv.includes('--ratchet')
const isDiff = process.argv.includes('--diff')
const isUpdateBaseline = process.argv.includes('--update-baseline')

let errors = []
let warnings = []
let notes = []
let exitCode = 0

function isSourceFile(filePath) {
  const ext = filePath.split('.').pop()
  return ALLOWED_EXTENSIONS.has('.' + ext) && !filePath.endsWith('.d.ts')
}

function isTestFile(filePath) {
  return filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx') || filePath.endsWith('.spec.ts')
}

function listFiles(dir) {
  const results = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          results.push(...listFiles(full))
        }
      } else if (entry.isFile() && isSourceFile(full)) {
        results.push(full)
      }
    }
  } catch {
    // skip
  }
  return results
}

function countExports(filePath) {
  try {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return -1
    const content = readFileSync(filePath, 'utf-8')
    const exportStatements = content.match(
      /^export\s+(?:default\s+)?(?:function|const|class|interface|type|enum|abstract\s+class|let|var)\s+\w+/gm
    )
    return exportStatements ? exportStatements.length : 0
  } catch {
    return -1
  }
}

function loadBaseline() {
  try {
    const parsed = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
    return parsed.files || {}
  } catch {
    return {}
  }
}

const baselineFiles = loadBaseline()

// Resolve files to check
let filesToCheck = []
if (isDiff) {
  try {
    const diffOutput = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim()
    const stagedOutput = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf-8' }).trim()
    const changedFiles = [...new Set([...diffOutput.split('\n'), ...stagedOutput.split('\n')])]
      .filter(Boolean)
      .map((f) => resolve(ROOT, f))
      .filter((f) => isSourceFile(f))
      // Scope to packages/ like every other mode (strict/ratchet/normal scan only
      // packages/, and the baseline contains no apps/ entries). The library is what
      // the size governance protects; demo/docs apps are intentionally exempt.
      .filter((f) => f.includes(`${ROOT.replace(/\/$/, '')}/packages/`) || f.includes('/packages/'))
    filesToCheck = changedFiles
  } catch {
    filesToCheck = listFiles(resolve(ROOT, 'packages'))
  }
} else {
  filesToCheck = listFiles(resolve(ROOT, 'packages'))
}

// 1. Line-count check (baseline-aware)
const currentOverLimit = {} // relPath -> lines, for --update-baseline
const seenBaselineKeys = new Set()

for (const file of filesToCheck) {
  const relPath = relative(ROOT, file)
  let content
  try {
    content = readFileSync(file, 'utf-8')
  } catch (e) {
    warnings.push(`读取失败 ${relPath}: ${e.message}`)
    continue
  }
  const lines = content.split('\n').length
  const isTest = isTestFile(file)
  const max = isTest ? MAX_TEST_LINES : MAX_SOURCE_LINES
  const label = isTest ? 'TEST' : '源文件'

  if (lines > max) {
    currentOverLimit[relPath] = lines
    const base = baselineFiles[relPath]
    seenBaselineKeys.add(relPath)

    // strict ignores baseline; ratchet/diff honor it
    const grandfathered = !isStrict && base !== undefined && lines <= base

    if (grandfathered) {
      if (lines < base) notes.push(`可收紧 ${lines}行 ${relPath} (baseline ${base} → 运行 arch-check:baseline)`)
      else notes.push(`已豁免 ${lines}行 ${relPath} (baseline ${base})`)
    } else {
      const reason = base === undefined ? '新增超限' : `超过 baseline(${base})`
      const msg = `${label} ${reason} ${lines}行 ${relPath} (max ${max})`
      errors.push(msg)
      if (isStrict || isRatchet || isDiff) exitCode = 1
    }
  } else if (lines > max * 0.8) {
    warnings.push(`接近阈值 ${lines}行 ${relPath} (${Math.round((lines / max) * 100)}%)`)
  }
}

// Note baseline files that are now fixed (full scans only)
if (!isDiff) {
  for (const key of Object.keys(baselineFiles)) {
    if (!seenBaselineKeys.has(key)) {
      notes.push(`已修复 ${key} 不再超限 — 运行 arch-check:baseline 移出 baseline`)
    }
  }
}

// --update-baseline: rewrite baseline from current reality, then exit
if (isUpdateBaseline) {
  const sorted = Object.fromEntries(Object.keys(currentOverLimit).sort().map((k) => [k, currentOverLimit[k]]))
  const out = {
    note: 'arch-check baseline (grandfathered oversized files). Regenerate with: pnpm arch-check:baseline. Forbids NEW oversized files and any GROWTH of these. See scripts/arch-check.mjs.',
    max: { source: MAX_SOURCE_LINES, test: MAX_TEST_LINES },
    files: sorted,
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2) + '\n')
  console.log(`\n📐 arch-baseline.json updated — ${Object.keys(sorted).length} grandfathered files.\n`)
  process.exit(0)
}

// 2. `as any` usages (warn, full scan only)
if (!isDiff) {
  for (const file of filesToCheck) {
    const relPath = relative(ROOT, file)
    try {
      const content = readFileSync(file, 'utf-8')
      const matches = content.match(/\bas\s+any\b/g)
      if (matches && matches.length > 0) warnings.push(`as any ${matches.length}处 ${relPath}`)
    } catch {}
  }
}

// 2b. Function size (warn, heuristic, full scan only)
if (!isDiff) {
  for (const file of filesToCheck) {
    const relPath = relative(ROOT, file)
    try {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      const fnRegex = /^(?:\s*export\s+)?(?:async\s+)?function\s+\w+|^\s+\w+\s*(?:=\s*async\s*)?\([^)]*\)\s*=>\s*\{/
      let fnStart = -1
      let braceDepth = 0
      let currentFnName = ''
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const fnMatch = line.match(fnRegex)
        if (fnMatch && braceDepth === 0) {
          fnStart = i
          currentFnName = fnMatch[0].replace(/export\s+/, '').replace(/\s*\(.*/, '').trim()
        }
        for (const ch of line) {
          if (ch === '{') braceDepth++
          if (ch === '}') {
            braceDepth--
            if (braceDepth === 0 && fnStart >= 0 && currentFnName) {
              const fnLines = i - fnStart + 1
              if (fnLines > MAX_FUNCTION_LINES) {
                warnings.push(`函数过长 ${fnLines}行 ${relPath}:${fnStart + 1} ${currentFnName} (max ${MAX_FUNCTION_LINES})`)
              }
              fnStart = -1
              currentFnName = ''
            }
          }
        }
      }
    } catch {}
  }
}

// 3. core package dependency direction (HARD error in every mode)
if (!isDiff || filesToCheck.some((f) => f.includes('packages/core'))) {
  const corePackageJson = resolve(ROOT, 'packages', 'core', 'package.json')
  try {
    const corePkg = JSON.parse(readFileSync(corePackageJson, 'utf-8'))
    const deps = { ...(corePkg.dependencies || {}), ...(corePkg.devDependencies || {}) }
    const frameworkDeps = Object.keys(deps).filter(
      (d) =>
        d.startsWith('@iris-ui-kit/react') ||
        d.startsWith('@iris-ui-kit/vue') ||
        d.startsWith('@iris-ui-kit/solid') ||
        d.startsWith('@iris-ui-kit/svelte') ||
        d === 'react' ||
        d === 'vue' ||
        d === 'solid-js' ||
        d === 'svelte'
    )
    if (frameworkDeps.length > 0) {
      errors.push(`core 包不得依赖框架包: ${frameworkDeps.join(', ')}`)
      exitCode = 1
    }
  } catch {
    // skip
  }
}

// 4. God Object detection (warn, full scan only)
if (!isDiff) {
  for (const file of filesToCheck) {
    if (file.endsWith('.d.ts') || file.endsWith('.vue') || file.endsWith('.svelte')) continue
    const relPath = relative(ROOT, file)
    const exportCount = countExports(file)
    if (exportCount > MAX_EXPORTS) warnings.push(`导出过多 ${exportCount}个符号 ${relPath} (max ${MAX_EXPORTS})`)
  }
}

// Output
const modeLabel = isStrict ? 'strict' : isRatchet ? 'ratchet' : isDiff ? 'diff' : 'normal'
console.log(`\n📐 arch-check.mjs (mode: ${modeLabel})`)
console.log(`   检查文件: ${filesToCheck.length}`)
console.log(`   行数上限: ${MAX_SOURCE_LINES} (源) / ${MAX_TEST_LINES} (测试)`)
console.log(`   baseline 豁免: ${Object.keys(baselineFiles).length} 个文件\n`)

if (errors.length > 0) {
  console.log('❌ 违反 (阻断):')
  for (const e of errors) console.log(`   ${e}`)
  console.log()
}

if (warnings.length > 0) {
  console.log('⚠️  警告 (不阻断):')
  for (const w of warnings) console.log(`   ${w}`)
  console.log()
}

if (notes.length > 0 && modeLabel !== 'normal') {
  console.log('ℹ️  baseline 备注:')
  for (const n of notes) console.log(`   ${n}`)
  console.log()
}

if (errors.length === 0 && warnings.length === 0) console.log('✅ 全部通过')
else if (errors.length === 0) console.log('✅ 无阻断项（仅警告）')

process.exit(exitCode)
