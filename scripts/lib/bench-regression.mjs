import { spawn, spawnSync } from 'node:child_process'
import {
  constants,
  closeSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { randomUUID } from 'node:crypto'
import { stripVTControlCharacters } from 'node:util'
import { pnpmCommand, pnpmSpawnArgs } from './run-pnpm.mjs'

const MAX_JSON = 1024 * 1024
const MAX_OUTPUT = 8 * 1024 * 1024
const MAX_SECONDS = 600
const fields = 'name hz min max mean p75 p99 p995 p999 rme samples'
const numeric = /^(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d+)?$/
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

export function thresholdFromArgs(args) {
  if (args.length === 0) return 0.2
  if (args.length !== 1 || !/^--threshold=0(?:\.\d+)?$/.test(args[0]))
    throw new Error('Invalid threshold arguments')
  const threshold = Number(args[0].slice('--threshold='.length))
  if (!Number.isFinite(threshold) || threshold > 0.2) throw new Error('Threshold cannot exceed 0.2')
  return threshold
}

function uniqueJson(text) {
  const value = JSON.parse(text)
  // Syntax is checked first. Tokenize strings/delimiters only to retain object
  // key occurrences that JSON.parse would otherwise silently overwrite.
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|[{}[\]:]/g) ?? []
  const scopes = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === '{') scopes.push(new Set())
    else if (token === '[') scopes.push(null)
    else if (token === '}' || token === ']') scopes.pop()
    else if (tokens[i + 1] === ':') {
      const key = JSON.parse(token)
      if (scopes.at(-1).has(key)) throw new Error('Duplicate JSON key')
      scopes.at(-1).add(key)
    }
  }
  return value
}

export function readJsonFile(path, missing = false) {
  let fd
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0))
    const stat = fstatSync(fd)
    if (!stat.isFile() || stat.size > MAX_JSON)
      throw new Error('JSON input must be a bounded regular file')
    const buffer = Buffer.alloc(MAX_JSON + 1)
    const size = readSync(fd, buffer, 0, buffer.length, 0)
    if (size > MAX_JSON || size !== stat.size)
      throw new Error('JSON input changed or exceeded its budget')
    return uniqueJson(new TextDecoder('utf8', { fatal: true }).decode(buffer.subarray(0, size)))
  } catch (error) {
    if (missing && error.code === 'ENOENT') return {}
    throw error
  } finally {
    if (fd !== undefined) closeSync(fd)
  }
}

export function baselineEntries(baseline) {
  if (!object(baseline) || typeof baseline._comment !== 'string')
    throw new Error('Invalid baseline metadata')
  const groups = ['form', 'resilience', 'scale']
  if (Object.keys(baseline).some((key) => key !== '_comment' && !groups.includes(key)))
    throw new Error('Unknown baseline group')
  const entries = new Map()
  for (const group of groups) {
    if (!object(baseline[group]) || Object.keys(baseline[group]).length === 0)
      throw new Error('Missing baseline group')
    for (const [name, ops] of Object.entries(baseline[group])) {
      if (
        !name ||
        name.trim() !== name ||
        /\s{2}|[\r\n\t]/.test(name) ||
        name.length > 512 ||
        entries.has(name)
      )
        throw new Error('Invalid or duplicate baseline case')
      if (typeof ops !== 'number' || !Number.isFinite(ops) || ops <= 0)
        throw new Error('Invalid baseline throughput')
      entries.set(name, { ops, file: `src/${group}.bench.ts` })
    }
  }
  return entries
}

export function validateHistory(history) {
  if (!object(history)) throw new Error('Invalid benchmark history')
  for (const [day, record] of Object.entries(history)) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !object(record) ||
      record.timestamp !== day ||
      !object(record.results) ||
      Object.keys(record).some((key) => !['timestamp', 'results'].includes(key))
    ) {
      throw new Error('Invalid benchmark history record')
    }
    for (const value of Object.values(record.results)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
        throw new Error('Invalid historical throughput')
    }
  }
  return history
}

function numericCell(text, positive = false) {
  const value = Number(text.replaceAll(',', ''))
  if (!numeric.test(text) || !Number.isFinite(value) || value < 0 || (positive && value === 0)) {
    throw new Error('Invalid benchmark numeric cell')
  }
  return value
}

function parseRow(line) {
  const cells = line
    .replace(/^[·•-]\s+/, '')
    .replace(/\s+(?:fastest|slowest)$/, '')
    .split(/\s{2,}/)
  if (cells.length !== 11 || !cells[0] || cells[0].length > 512)
    throw new Error('Malformed benchmark row')
  const ops = numericCell(cells[1], true)
  for (const cell of cells.slice(2, 9)) numericCell(cell)
  if (!/^±\d+(?:\.\d+)?%$/.test(cells[9])) throw new Error('Invalid benchmark relative error')
  numericCell(cells[9].slice(1, -1))
  if (!/^[1-9]\d*$/.test(cells[10]) || !Number.isSafeInteger(Number(cells[10])))
    throw new Error('Invalid benchmark sample count')
  return { name: cells[0], ops }
}

function requireCompleteRunner(runner) {
  if (runner && !runner.complete) throw new Error('Incomplete benchmark runner')
}

function requireActiveRunner(runner) {
  if (!runner || runner.complete) throw new Error('Benchmark data outside an active runner')
}

export function parseBenchmarks(text, baseline, coreRoot) {
  if (Buffer.byteLength(text) > MAX_OUTPUT) throw new Error('Benchmark output exceeds budget')
  const rows = new Map()
  const runners = new Map()
  const core = coreRoot.replaceAll('\\', '/')
  let table = false
  let tableRows = 0
  let runner
  let file
  for (const raw of text.split(/\r?\n/)) {
    const line = stripVTControlCharacters(raw).trim()
    if (table && tableRows === 0 && !/^[·•-]\s+/.test(line))
      throw new Error('Empty benchmark table')
    const run = line.match(/^RUN\s+v\S+\s+(.+)$/)
    if (/^RUN(?:\s|$)/.test(line)) {
      if (!run) throw new Error('Malformed benchmark runner banner')
      requireCompleteRunner(runner)
      const owner = run[1].replaceAll('\\', '/')
      if (runners.has(owner)) throw new Error('Repeated benchmark runner')
      runner = { owner, complete: false, rows: 0 }
      runners.set(owner, runner)
      file = undefined
      table = false
      continue
    }
    const suite = line.match(/^[✓✔]\s+(src\/[^\s]+\.bench\.[cm]?[jt]sx?)(?:\s|$)/)
    if (suite) {
      requireActiveRunner(runner)
      file = suite[1]
      table = false
      continue
    }
    if (line.replace(/\s+/g, ' ') === fields) {
      requireActiveRunner(runner)
      if (!file) throw new Error('Benchmark table without a source file')
      table = true
      tableRows = 0
      continue
    }
    if (/^BENCH\s+Summary$/.test(line)) {
      requireActiveRunner(runner)
      if (runner.rows === 0) throw new Error('Empty benchmark runner')
      runner.complete = true
      table = false
      continue
    }
    if (!line) {
      table = false
      continue
    }
    if (!table) {
      if (runner && /^[·•-]\s+/.test(line)) throw new Error('Benchmark row without table header')
      continue
    }
    tableRows++
    if (!/^[·•-]\s+/.test(line)) throw new Error('Unrecognized benchmark table row')
    const row = parseRow(line)
    const expected = baseline.get(row.name)
    if (expected && (runner.owner !== core || file !== expected.file))
      throw new Error('Wrong owner for required benchmark')
    if (rows.has(row.name)) throw new Error(`Duplicate benchmark case: ${row.name}`)
    rows.set(row.name, row.ops)
    runner.rows++
  }
  if (table && tableRows === 0) throw new Error('Empty benchmark table')
  requireCompleteRunner(runner)
  if (!runners.get(core)?.complete || rows.size === 0)
    throw new Error('Missing complete benchmark summary')
  for (const name of baseline.keys())
    if (!rows.has(name)) throw new Error(`Missing required benchmark: ${name}`)
  return rows
}

function stopOwned(child) {
  if (!child?.pid) return
  if (process.platform === 'win32') {
    // Windows lacks POSIX process groups. taskkill is scoped to the owned tree;
    // no name-based/process-wide cleanup. Windows acceptance remains separate.
    if (child.exitCode !== null || child.signalCode !== null) return
    const result = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
      timeout: 1000,
      maxBuffer: 16384,
      windowsHide: true,
    })
    if (result.error || result.status !== 0) {
      child.kill('SIGKILL')
      throw new Error('Owned Windows process-tree cleanup unconfirmed')
    }
  } else {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  }
}

function collector(spawnChild, limits, resolve, reject) {
  let child
  const buffers = { stdout: [], stderr: [] }
  let bytes = 0
  let failure
  let drain
  let stopping = false
  const stop = (error) => {
    if (stopping) return
    stopping = true
    failure ??= error
    try {
      stopOwned(child)
    } catch (killError) {
      failure = killError
    }
    drain ??= setTimeout(() => {
      child.stdout.destroy()
      child.stderr.destroy()
    }, 1000)
  }
  const signals = Object.fromEntries(
    ['SIGINT', 'SIGTERM'].map((signal) => [
      signal,
      () => stop(new Error(`Benchmark interrupted: ${signal}`)),
    ]),
  )
  for (const [signal, handler] of Object.entries(signals)) process.once(signal, handler)
  const timer = setTimeout(
    () => stop(new Error('Benchmark absolute deadline exceeded')),
    limits.timeoutMs,
  )
  const release = () => {
    clearTimeout(timer)
    clearTimeout(drain)
    for (const [name, handler] of Object.entries(signals)) process.removeListener(name, handler)
  }
  // Install cancellation handlers before spawning, not after acquiring a child.
  try {
    child = spawnChild()
  } catch (error) {
    release()
    reject(error)
    return
  }
  for (const stream of ['stdout', 'stderr']) {
    child[stream].on('error', stop)
    child[stream].on('data', (chunk) => {
      bytes += chunk.length
      if (bytes > limits.maxBytes) stop(new Error('Benchmark output budget exceeded'))
      else buffers[stream].push(chunk)
    })
  }
  child.once('error', (error) => {
    failure = error
  })
  child.once('exit', () => {
    // A child cannot keep the owned transport alive after its leader exits.
    try {
      stopOwned(child)
    } catch (error) {
      failure = error
    }
  })
  child.once('close', (status, signal) => {
    release()
    resolve({
      status,
      signal,
      error: failure,
      stdout: Buffer.concat(buffers.stdout),
      stderr: Buffer.concat(buffers.stderr),
    })
  })
}

export function runWorkspaceBench(cwd, limits = {}) {
  const timeoutMs = limits.timeoutMs ?? MAX_SECONDS * 1000
  const maxBytes = limits.maxBytes ?? MAX_OUTPUT
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > MAX_SECONDS * 1000 ||
    !Number.isInteger(maxBytes) ||
    maxBytes <= 0 ||
    maxBytes > MAX_OUTPUT
  )
    throw new Error('Invalid benchmark transport limits')
  const { command, args } = pnpmCommand()
  // Root task still runs every workspace bench owner and its dependencies.
  // Only presentation changes: no Vitest workload, sampling or worker overrides.
  const argv = pnpmSpawnArgs(args, [
    'bench',
    '--ui=stream',
    '--log-prefix=none',
    '--log-order=grouped',
    '--output-logs=full',
  ])
  const spawnChild = () =>
    spawn(command, argv, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      windowsHide: true,
    })
  return new Promise((resolve, reject) =>
    collector(spawnChild, { timeoutMs, maxBytes }, resolve, reject),
  )
}

function removeOwnedFile(path, identity) {
  try {
    const current = lstatSync(path)
    if (!current.isFile() || current.ino !== identity.ino || current.dev !== identity.dev)
      throw new Error('Artifact ownership changed')
    unlinkSync(path)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

export async function withHistoryLock(path, execute) {
  const lock = `${path}.lock`
  const fd = openSync(lock, 'wx', 0o600)
  const identity = fstatSync(fd)
  try {
    writeFileSync(
      fd,
      JSON.stringify({ pid: process.pid, started: new Date().toISOString() }) + '\n',
    )
    fsyncSync(fd)
    return await execute()
  } finally {
    closeSync(fd)
    removeOwnedFile(lock, identity)
  }
}

export function saveHistory(path, history, rows) {
  if (JSON.stringify(readJsonFile(path, true)) !== JSON.stringify(history))
    throw new Error('History changed during benchmark; refusing overwrite')
  const today = new Date().toISOString().slice(0, 10)
  const results = { ...(history[today]?.results ?? {}), ...Object.fromEntries(rows) }
  const next = { ...history, [today]: { timestamp: today, results } }
  const text = JSON.stringify(next, null, 2) + '\n'
  if (Buffer.byteLength(text) > MAX_JSON) throw new Error('History output exceeds budget')
  const temporary = `${path}.${randomUUID()}.tmp`
  const fd = openSync(temporary, 'wx', 0o600)
  const identity = fstatSync(fd)
  try {
    try {
      writeFileSync(fd, text)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameSync(temporary, path)
  } finally {
    removeOwnedFile(temporary, identity)
  }
}
