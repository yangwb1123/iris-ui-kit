// Vitest 4.1.11 reporter. Executes in the parent, never inside benchmark callbacks.
import { closeSync, fsyncSync, linkSync, openSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, relative } from 'node:path'
import { experimental_getRunnerTask } from 'vitest/node'

const LIMIT = 8 * 1024 * 1024
const SAMPLE_LIMIT = 250_000

function caseRow(task, file, expected) {
  const item = Object.entries(expected).find(([, spec]) => spec[1] === task.name)
  if (!item || task.result?.state !== 'pass') throw new Error('Unexpected or failed benchmark')
  const [id, spec] = item
  if (file !== spec[0]) throw new Error('Mismatched benchmark identity')
  const value = task.result.benchmark
  if (
    !value ||
    !Array.isArray(value.samples) ||
    value.samples.length !== value.sampleCount ||
    value.sampleCount > SAMPLE_LIMIT
  ) {
    throw new Error('Missing native samples or sample budget exceeded')
  }
  return {
    id,
    file,
    name: task.name,
    hz: value.hz,
    mean_ms: value.mean,
    sample_count: value.sampleCount,
    samples_ms: value.samples,
    rme: value.rme,
  }
}

export function collectCases(files, expected, root) {
  const rows = []
  let total = 0
  const seen = new Set()
  const visit = (task, file) => {
    if (task.type === 'suite') {
      for (const child of task.tasks) visit(child, file)
      return
    }
    if (!task.meta?.benchmark || task.mode === 'skip' || task.mode === 'todo') return
    const row = caseRow(task, file, expected)
    if (seen.has(row.id)) throw new Error('Duplicate benchmark identity')
    total += row.sample_count
    if (total > SAMPLE_LIMIT) throw new Error('Native sample budget exceeded')
    seen.add(row.id)
    rows.push(row)
  }
  for (const file of files) {
    if (file.result?.state !== 'pass') throw new Error('Benchmark module did not pass')
    const name = relative(root, file.filepath).replaceAll('\\', '/')
    visit(file, name)
  }
  if (rows.length !== Object.keys(expected).length) throw new Error('Incomplete benchmark corpus')
  return rows
}

export function saveReport(path, value) {
  const payload = JSON.stringify(value)
  if (Buffer.byteLength(payload) > LIMIT) throw new Error('Evidence byte budget exceeded')
  const partial = `${path}.partial`
  writeFileSync(partial, payload + '\n', { flag: 'wx', mode: 0o600 })
  const fd = openSync(partial, 'r')
  try {
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  linkSync(partial, path) // create-only atomic publication; never overwrite an old sample
  unlinkSync(partial)
  const directory = openSync(dirname(path), 'r')
  try {
    fsyncSync(directory)
  } finally {
    closeSync(directory)
  }
}

export default class EvidenceReporter {
  onInit(context) {
    this.root = context.config.root
    this.expected = JSON.parse(process.env.IRIS_BENCH_CASES)
    this.persisted = new Set()
    this.total = 0
    if (context.version !== '4.1.11') throw new Error('Unreviewed Vitest reporter version')
  }

  onTestCaseResult(testCase) {
    const task = experimental_getRunnerTask(testCase)
    if (!task.meta?.benchmark || task.mode === 'skip' || task.mode === 'todo') return
    try {
      const file = relative(this.root, task.file.filepath).replaceAll('\\', '/')
      const row = caseRow(task, file, this.expected)
      this.total += row.sample_count
      if (this.total > SAMPLE_LIMIT) throw new Error('Cohort sample budget exceeded')
      saveReport(`${process.env.IRIS_BENCH_REPORT}.${row.id}.completed.json`, {
        schema: 1,
        variant: process.env.IRIS_BENCH_VARIANT,
        collection_complete: false,
        case: row,
      })
      this.persisted.add(row.id)
    } catch (error) {
      this.persistenceFailed = true
      throw error
    }
  }

  onTestRunEnd(modules, errors) {
    if (errors.length || this.persistenceFailed) throw new Error('Benchmark or persistence errors')
    const cases = collectCases(modules.map(experimental_getRunnerTask), this.expected, this.root)
    if (this.persisted.size !== cases.length)
      throw new Error('Completed-case evidence hooks are missing')
    saveReport(process.env.IRIS_BENCH_REPORT, {
      schema: 1,
      variant: process.env.IRIS_BENCH_VARIANT,
      completed: true,
      cases,
    })
  }
}
