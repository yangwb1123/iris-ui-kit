#!/usr/bin/env node

/**
 * change-budget.mjs — 机检 AUTONOMOUS 的「每迭代变更预算」
 *
 * AUTONOMOUS.md 规定：每个编码迭代 ≤5 文件、≤300 行 core 逻辑；>10 文件是硬停止。
 * 本脚本把这条从「agent 自觉」变成「可见信号」：
 *   - 软目标（5 文件 / 300 行 core）超了 → warn（不阻断）
 *   - 硬停止（>10 文件）→ 仅在 --enforce 时 fail（默认 advisory，exit 0）
 *
 * 故意 advisory：多框架 fan-out（React 参考 → vue/solid/svelte 镜像）是约定的合法例外，
 *   一次提交可能跨多个包文件。本脚本给信号而不挡路；要在某处当硬门，用 --enforce。
 *
 * 用法：
 *   pnpm change-budget            # 对比 HEAD（工作区+暂存）
 *   pnpm change-budget --staged   # 仅暂存区（pre-commit 用）
 *   pnpm change-budget --enforce  # >10 文件时 fail
 */

import { execSync } from 'node:child_process'

const TARGET_FILES = 5
const TARGET_CORE_LINES = 300
const HARD_STOP_FILES = 10 // AUTONOMOUS hard-stop

const isStaged = process.argv.includes('--staged')
const isEnforce = process.argv.includes('--enforce')

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

const GENERATED = [
  /(^|\/)dist\//,
  /\.d\.ts$/,
  /(^|\/)manifest\.json$/,
  /(^|\/)llms\.txt$/,
  /pnpm-lock\.yaml$/,
  /(^|\/)\.svelte-kit\//,
  /(^|\/)\.next\//,
  /(^|\/)arch-baseline\.json$/,
]
const isGenerated = (p) => GENERATED.some((r) => r.test(p))
const isTest = (p) => /\.(test|spec)\.[tj]sx?$/.test(p) || /\.test\.ts$/.test(p)
const isDoc = (p) => /\.(md|mdx)$/.test(p)

const cmd = isStaged ? 'git diff --cached --numstat' : 'git diff --numstat HEAD'
const numstat = sh(cmd)
const rows = numstat.split('\n').filter(Boolean)

const files = []
let coreAdded = 0
for (const row of rows) {
  const [add, , ...rest] = row.split('\t')
  const path = rest.join('\t')
  if (!path || isGenerated(path)) continue
  files.push(path)
  if (!isTest(path) && !isDoc(path) && add !== '-') coreAdded += Number(add) || 0
}

let exitCode = 0
console.log(`\n📦 change-budget (${isStaged ? 'staged' : 'vs HEAD'})`)
console.log(`   变更文件: ${files.length}  (目标 ≤${TARGET_FILES}, 硬停止 >${HARD_STOP_FILES})`)
console.log(`   新增 core 逻辑行: ${coreAdded}  (目标 ≤${TARGET_CORE_LINES})\n`)

const warns = []
if (files.length > TARGET_FILES) warns.push(`变更 ${files.length} 文件，超过软目标 ${TARGET_FILES}（多框架 fan-out 可豁免）`)
if (coreAdded > TARGET_CORE_LINES) warns.push(`新增 ${coreAdded} 行 core 逻辑，超过软目标 ${TARGET_CORE_LINES}`)

if (files.length > HARD_STOP_FILES) {
  const msg = `变更 ${files.length} 文件，超过硬停止 ${HARD_STOP_FILES}（AUTONOMOUS：拆成多个迭代）`
  if (isEnforce) {
    console.log(`❌ 硬停止: ${msg}\n`)
    exitCode = 1
  } else {
    warns.push(msg)
  }
}

if (warns.length > 0) {
  console.log('⚠️  预算提醒 (不阻断):')
  for (const w of warns) console.log(`   ${w}`)
  console.log()
} else if (exitCode === 0) {
  console.log('✅ 在预算内\n')
}

process.exit(exitCode)
