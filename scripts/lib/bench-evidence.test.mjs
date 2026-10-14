import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { load } from 'js-yaml'
import { collectCases, saveReport } from '../bench-evidence/reporter.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const query = '10k unique fetches (no cache hits)'
const expected = { query: ['src/resilience.bench.ts', query] }
function fixture() {
  return [
    {
      type: 'suite',
      filepath: join(root, 'src/resilience.bench.ts'),
      result: { state: 'pass' },
      tasks: [
        {
          type: 'test',
          name: query,
          mode: 'run',
          meta: { benchmark: true },
          result: {
            state: 'pass',
            benchmark: {
              hz: 1000,
              mean: 1,
              sampleCount: 10,
              samples: Array(10).fill(1),
              rme: 0,
            },
          },
        },
      ],
    },
  ]
}

test('retains native vectors; rejects empty, duplicate, failed or foreign cases', () => {
  const rows = collectCases(fixture(), expected, root)
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].samples_ms, Array(10).fill(1))
  for (const mutate of [
    (files) => {
      files[0].tasks = []
    },
    (files) => {
      files[0].result.state = 'fail'
    },
    (files) => {
      files[0].filepath = join(root, '../foreign.ts')
    },
    (files) => {
      files[0].tasks.push(files[0].tasks[0])
    },
    (files) => {
      files[0].tasks[0].result.benchmark.samples = []
    },
    (files) => {
      files[0].tasks[0].result.state = 'fail'
    },
  ]) {
    const files = fixture()
    mutate(files)
    assert.throws(() => collectCases(files, expected, root))
  }
})

test('report publication is create-only, bounded, and retains rejected partials', () => {
  const directory = mkdtempSync(join(tmpdir(), 'iris-bench-report-'))
  try {
    const output = join(directory, 'report.json')
    saveReport(output, { original: true })
    assert.throws(() => saveReport(output, { replacement: true }), /EEXIST/)
    assert.deepEqual(JSON.parse(readFileSync(output)), { original: true })
    assert.deepEqual(JSON.parse(readFileSync(output + '.partial')), { replacement: true })
    assert.throws(
      () => saveReport(join(directory, 'large.json'), { data: 'x'.repeat(8 * 1024 * 1024) }),
      /budget/,
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Python protocol, source/argument refusal and absolute-window contracts', () => {
  const result = spawnSync(
    'python3',
    ['-B', '-m', 'unittest', 'discover', '-s', 'scripts/bench-evidence', '-p', 'test_*.py', '-v'],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 2 * 1024 * 1024,
    },
  )
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stdout + result.stderr)
})

test('separate control witness process; never instrument a performance process', () => {
  const control = new URL('../bench-evidence/controls.mjs', import.meta.url).href
  const source = `
    import assert from 'node:assert/strict';
    const Original = globalThis.AbortController, controllers = [];
    globalThis.AbortController = class extends Original { constructor() { super(); controllers.push(this) } };
    try {
      process.env.IRIS_BENCH_VARIANT = 'native-control';
      const {createQueryCache} = await import(${JSON.stringify(control + '?native')});
      const cache = createQueryCache(), signals = [];
      for(let i=0;i<5;i++) assert.equal(await cache.fetch(String(i), s => {signals.push(s);return Promise.resolve(i)}), i);
      assert.equal(controllers.length,5); assert.equal(new Set(signals).size,5);
      assert.ok(signals.every(s=>s instanceof AbortSignal)); controllers[0].abort();
      assert.equal(signals[0].aborted,true); assert.ok(signals.slice(1).every(s=>!s.aborted));
      process.env.IRIS_BENCH_VARIANT = 'fetcher-control';
      const bare = await import(${JSON.stringify(control + '?bare')});
      await bare.createQueryCache().fetch('x', s => assert.equal(s,undefined));
      assert.equal(controllers.length,5);
    } finally { globalThis.AbortController = Original; }
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 65536,
  })
  assert.equal(result.status, 0, result.stderr)
})

test('workflow is diagnostic only, read-only and keeps all partial artifacts', () => {
  const workflow = load(
    readFileSync(join(root, '.github/workflows/performance-evidence.yml'), 'utf8'),
  )
  assert.deepEqual(workflow.permissions, { contents: 'read' })
  assert.equal(workflow.concurrency['cancel-in-progress'], false)
  const job = workflow.jobs.evidence
  assert.equal(job['runs-on'], 'ubuntu-latest')
  assert.equal(job['timeout-minutes'], 30)
  assert.equal(job.steps.filter((s) => s.uses?.startsWith('actions/checkout@')).length, 2)
  for (const step of job.steps.filter((s) => s.uses?.startsWith('actions/checkout@')))
    assert.equal(step.with['persist-credentials'], false)
  assert.ok(job.steps.some((s) => s.with?.ref === '8b694b9e242d6db033b5320e0b843fbebb391318'))
  assert.ok(job.steps.some((s) => s.run?.includes('--pairs 6 --seconds 1200')))
  assert.ok(job.steps.some((s) => s.run?.includes('GITHUB_RUN_ATTEMPT')))
  const upload = job.steps.find((s) => s.uses?.startsWith('actions/upload-artifact@'))
  assert.equal(upload.if, 'always()')
  assert.equal(upload.with['if-no-files-found'], 'error')
  const text = JSON.stringify(workflow)
  for (const forbidden of [
    'pull_request_target',
    'continue-on-error',
    'secrets.',
    'id-token',
    'npm publish',
    'git push',
    '--publish',
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden)
  }
})

// Native reporter integration, deliberately tiny synthetic workload. Not a benchmark score.
test(
  'real Vitest4 CLI retains samples through the custom reporter in a fresh process',
  { timeout: 35_000 },
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'iris-bench-cli-fixture-'))
    try {
      const output = join(directory, 'report.json')
      writeFileSync(
        join(directory, 'fixture.bench.ts'),
        `import {bench,describe} from 'vitest';
      describe('fixture only',()=>bench(${JSON.stringify(query)},()=>1+1,
      {time:0,iterations:10,warmupTime:0,warmupIterations:0}));`,
      )
      const vitest = resolve(root, 'node_modules/vitest/dist/index.js')
      const config = {
        root: directory,
        resolve: { alias: [{ find: 'vitest', replacement: vitest }] },
        test: {
          benchmark: {
            include: ['fixture.bench.ts'],
            includeSamples: true,
            reporters: ['default', join(root, 'scripts/bench-evidence/reporter.mjs')],
          },
        },
      }
      writeFileSync(
        join(directory, 'config.mjs'),
        'const config = ' +
          JSON.stringify(config) +
          '; config.resolve.alias[0].find = /^vitest$/; export default config;',
      )
      const result = spawnSync(
        process.execPath,
        [
          join(root, 'node_modules/vitest/vitest.mjs'),
          'bench',
          '--run',
          '--config',
          join(directory, 'config.mjs'),
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            IRIS_BENCH_REPORT: output,
            IRIS_BENCH_VARIANT: 'native-control',
            IRIS_BENCH_CASES: JSON.stringify({ query: ['fixture.bench.ts', query] }),
          },
          encoding: 'utf8',
          timeout: 30_000,
          maxBuffer: 2 * 1024 * 1024,
        },
      )
      assert.equal(result.error, undefined)
      assert.equal(result.status, 0, result.stdout + result.stderr)
      const value = JSON.parse(readFileSync(output))
      const partial = JSON.parse(readFileSync(output + '.query.completed.json'))
      assert.equal(partial.collection_complete, false)
      assert.deepEqual(partial.case, value.cases[0])
      assert.equal(value.completed, true)
      assert.equal(value.cases.length, 1)
      assert.equal(value.cases[0].sample_count, 10)
      assert.equal(value.cases[0].samples_ms.length, 10)
      assert.ok(value.cases[0].samples_ms.every((number) => number > 0 && Number.isFinite(number)))
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  },
)
