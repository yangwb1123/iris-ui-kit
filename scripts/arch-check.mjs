#!/usr/bin/env node

/**
 * arch-check.mjs — 自动架构检查
 *
 * 检查内容：
 *   1. 源文件行数（max 500 行）
 *   2. 测试文件行数（max 500 行）
 *   3. core 包不能依赖框架包
 *   4. 单个文件导出符号数（max 30，God Object 检测）
 *
 * 使用方式：
 *   pnpm run arch-check            # 扫描全部文件（仅 warn，exit 0）
 *   pnpm run arch-check --strict   # 扫描全部文件（fail 模式，CI 使用）
 *   pnpm run arch-check --diff     # 只检查 git diff 中的文件（pre-commit 使用）
 *
 * 在 CI 中：pnpm run arch-check --strict
 * 在 pre-commit 中：pnpm run arch-check --diff
 */

import { readFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = new URL('..', import.meta.url).pathname
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.turbo', '.svelte-kit', '.next', 'coverage'])
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.vue', '.svelte'])

const MAX_SOURCE_LINES = 500
const MAX_TEST_LINES = 500
const MAX_EXPORTS = 30
const MAX_FUNCTION_LINES = 50
const MAX_COMPLEXITY = 10

const isStrict = process.argv.includes('--strict')
const isDiff = process.argv.includes('--diff')

let errors = []
let warnings = []
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
    const exportStatements = content.match(/^export\s+(?:default\s+)?(?:function|const|class|interface|type|enum|abstract\s+class|let|var)\s+\w+/gm)
    return exportStatements ? exportStatements.length : 0
  } catch {
    return -1
  }
}

// Resolve files to check
let filesToCheck = []
if (isDiff) {
  // Get files changed in the working tree vs HEAD
  try {
    const diffOutput = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf-8' }).trim()
    const stagedOutput = execSync('git diff --cached --name-only', { cwd: ROOT, encoding: 'utf-8' }).trim()
    const changedFiles = [...new Set([...diffOutput.split('\n'), ...stagedOutput.split('\n')])]
      .filter(Boolean)
      .map((f) => resolve(ROOT, f))
      .filter((f) => isSourceFile(f))
    filesToCheck = changedFiles
  } catch {
    // Not a git repo or no changes — fall back to full scan
    filesToCheck = listFiles(resolve(ROOT, 'packages'))
  }
} else {
  filesToCheck = listFiles(resolve(ROOT, 'packages'))
}

// 1. Check file line count
for (const file of filesToCheck) {
  const relPath = relative(ROOT, file)
  try {
    const content = readFileSync(file, 'utf-8')
    const lines = content.split('\n').length
    const isTest = isTestFile(file)

    if (isTest && lines > MAX_TEST_LINES) {
      const msg = `TEST 超限  ${lines}行  ${relPath} (max ${MAX_TEST_LINES})`
      errors.push(msg)
      if (isStrict || isDiff) exitCode = 1
      else warnings.push(msg)
    } else if (!isTest && lines > MAX_SOURCE_LINES) {
      const msg = `源文件超限 ${lines}行  ${relPath} (max ${MAX_SOURCE_LINES})`
      errors.push(msg)
      if (isStrict || isDiff) exitCode = 1
      else warnings.push(msg)
    } else if (lines > MAX_SOURCE_LINES * 0.8) {
      warnings.push(`接近阈值 ${lines}行  ${relPath} (${Math.round(lines/MAX_SOURCE_LINES*100)}%)`)
    }
  } catch (e) {
    warnings.push(`读取失败 ${relPath}: ${e.message}`)
  }
}

// 2. Check for `as any` usages (type safety)
if (!isDiff) {
  for (const file of filesToCheck) {
    const relPath = relative(ROOT, file)
    try {
      const content = readFileSync(file, 'utf-8')
      const matches = content.match(/\bas\s+any\b/g)
      if (matches && matches.length > 0) {
        warnings.push(`as any ${matches.length}处  ${relPath}`)
      }
    } catch {}
  }
}

// 2b. Check function size (max-allowed lines) — heuristic scan
if (!isDiff) {
  for (const file of filesToCheck) {
    const relPath = relative(ROOT, file)
    if (relPath.includes('node_modules') || relPath.includes('dist/')) continue
    try {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      // Match export function, function, or method declarations
      const fnRegex = /^(?:\s*export\s+)?(?:async\s+)?function\s+\w+|^\s+\w+\s*(?:=\s*async\s*)?\([^)]*\)\s*=>\s*\{/
      let fnStart = -1
      let braceDepth = 0
      let currentFnName = ''
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Track function starts
        const fnMatch = line.match(fnRegex)
        if (fnMatch && braceDepth === 0) {
          fnStart = i
          currentFnName = fnMatch[0].replace(/export\s+/, '').replace(/\s*\(.*/, '').trim()
        }
        // Track braces
        for (const ch of line) {
          if (ch === '{') braceDepth++
          if (ch === '}') {
            braceDepth--
            if (braceDepth === 0 && fnStart >= 0 && currentFnName) {
              const fnLines = i - fnStart + 1
              if (fnLines > MAX_FUNCTION_LINES) {
                warnings.push(`函数过长 ${fnLines}行  ${relPath}:${fnStart + 1} ${currentFnName} (max ${MAX_FUNCTION_LINES})`)
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

// 3. Check core package dependency direction
if (!isDiff || filesToCheck.some((f) => f.includes('packages/core'))) {
  const corePackageJson = resolve(ROOT, 'packages', 'core', 'package.json')
  try {
    const corePkg = JSON.parse(readFileSync(corePackageJson, 'utf-8'))
    const deps = { ...(corePkg.dependencies || {}), ...(corePkg.devDependencies || {}) }
    const frameworkDeps = Object.keys(deps).filter(
      (d) => d.startsWith('@iris-ui/react') || d.startsWith('@iris-ui/vue') ||
           d.startsWith('@iris-ui/solid') || d.startsWith('@iris-ui/svelte') ||
           d === 'react' || d === 'vue' || d === 'solid-js' || d === 'svelte'
    )
    if (frameworkDeps.length > 0) {
      const msg = `core 包不得依赖框架包: ${frameworkDeps.join(', ')}`
      errors.push(msg)
      exitCode = 1
    }
  } catch {
    // skip
  }
}

// 3. God Object detection (per-file exports) — only in full mode
if (!isDiff) {
  for (const file of filesToCheck) {
    if (file.endsWith('.d.ts') || file.endsWith('.vue') || file.endsWith('.svelte')) continue
    const relPath = relative(ROOT, file)
    const exportCount = countExports(file)
    if (exportCount > MAX_EXPORTS) {
      warnings.push(`导出过多 ${exportCount}个符号  ${relPath} (max ${MAX_EXPORTS})`)
    }
  }
}

// Output
const modeLabel = isStrict ? 'strict' : isDiff ? 'diff' : 'normal'
console.log(`\n📐 arch-check.mjs (mode: ${modeLabel})`)
console.log(`   检查文件: ${filesToCheck.length}`)
console.log(`   最大行数: ${MAX_SOURCE_LINES} (源文件) / ${MAX_TEST_LINES} (测试)\n`)

if (errors.length > 0) {
  console.log('❌ 违反:')
  for (const e of errors) {
    console.log(`   ${e}`)
  }
  console.log()
}

if (warnings.length > 0) {
  console.log('⚠️  警告:')
  for (const w of warnings) {
    console.log(`   ${w}`)
  }
  console.log()
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ 全部通过')
}

process.exit(exitCode)
