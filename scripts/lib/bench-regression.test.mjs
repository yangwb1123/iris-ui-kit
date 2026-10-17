import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { URL, fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { load } from 'js-yaml'

const root = fileURLToPath(new URL('../../', import.meta.url))
const baseline = JSON.parse(readFileSync(join(root, 'scripts/bench-baseline.json'), 'utf8'))
const entries = Object.entries(baseline)
  .filter(([key]) => key !== '_comment')
  .flatMap(([, values]) => Object.entries(values))
const header = 'name  hz  min  max  mean  p75  p99  p995  p999  rme  samples'
const row = (name, hz) => ` · ${name}  ${hz}  1  2  1.5  1.5  2  2  2  ±1.00%  10`
const rows = entries.map(([name, hz]) => row(name, hz))
const table = (lines = rows) => {
  const tables = lines.map((line) => {
    const group =
      Object.entries(baseline).find(
        ([key, values]) =>
          key !== '_comment' && Object.keys(values).some((name) => line.includes(`${name}  `)),
      )?.[0] ?? 'component-scale'
    return ` ✓ src/${group}.bench.ts > fixture\n${header}\n${line}\n`
  })
  return ` RUN v4.1.11 CORE_ROOT\n${tables.join('\n')}\n BENCH Summary\n`
}
const secondary = (name = 'secondary case', owner = '/another/workspace') =>
  ` RUN v4.1.11 ${owner}\n ✓ src/extra.bench.ts > fixture\n${header}\n${row(name, 100)}\n\n BENCH Summary\n`
const history = '{"2000-01-01":{"timestamp":"2000-01-01","results":{"old case":123}}}\n'

// Execute the real CLI in a private directory; only the child pnpm producer is
// deterministic. These fixtures supply no product timings or performance score.
function fixture(options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'iris-bench-gate-'))
  mkdirSync(join(dir, 'scripts/lib'), { recursive: true })
  for (const file of [
    'check-bench-regression.mjs',
    'lib/run-pnpm.mjs',
    'lib/bench-regression.mjs',
  ]) {
    if (existsSync(join(root, 'scripts', file)))
      copyFileSync(join(root, 'scripts', file), join(dir, 'scripts', file))
  }
  if (!options.missingBaseline)
    writeFileSync(
      join(dir, 'scripts/bench-baseline.json'),
      options.baseline ?? JSON.stringify(baseline),
    )
  writeFileSync(join(dir, 'scripts/bench-history.json'), options.history ?? history)
  writeFileSync(
    join(dir, 'output.txt'),
    (options.output ?? table()).replaceAll('CORE_ROOT', join(dir, 'packages/core')),
  )
  if (options.lock) writeFileSync(join(dir, 'scripts/bench-history.json.lock'), 'foreign lock\n')
  writeFileSync(
    join(dir, 'producer.mjs'),
    `import {appendFileSync,readFileSync,writeFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
appendFileSync('calls.jsonl',JSON.stringify(process.argv.slice(2))+'\\n');
process.stdout.write(readFileSync('output.txt'));
process.stderr.write('fixture diagnostic\\n');
${options.changeHistory ? "writeFileSync('scripts/bench-history.json', '{}\\n');" : ''}
${options.hang || options.orphan ? "const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});writeFileSync('pids.json',JSON.stringify([process.pid,child.pid]));" : ''}
${options.hang ? "setInterval(()=>process.stdout.write('still running\\n'),10);" : ''}
${options.orphan ? 'process.exit(0);' : ''}
${options.signal ? "process.kill(process.pid,'SIGTERM');" : `process.exitCode=${options.status ?? 0};`}`,
  )
  return dir
}

function invoke(options = {}) {
  const dir = fixture(options)
  try {
    const result = spawnSync(
      process.execPath,
      [join(dir, 'scripts/check-bench-regression.mjs'), ...(options.args ?? [])],
      {
        cwd: dir,
        encoding: 'utf8',
        timeout: 15_000,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          npm_execpath: join(dir, 'producer.mjs'),
          NODE_OPTIONS: '',
          CI: 'true',
        },
      },
    )
    assert.equal(result.error, undefined, result.stderr)
    const calls = existsSync(join(dir, 'calls.jsonl'))
      ? readFileSync(join(dir, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
      : []
    return {
      ...result,
      calls,
      history: readFileSync(join(dir, 'scripts/bench-history.json'), 'utf8'),
      lock: existsSync(join(dir, 'scripts/bench-history.json.lock'))
        ? readFileSync(join(dir, 'scripts/bench-history.json.lock'), 'utf8')
        : null,
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function refused(options) {
  const result = invoke(options)
  assert.equal(result.status, 2, result.stdout + result.stderr)
  assert.equal(
    result.history,
    options.history ?? history,
    'invalid evidence must not publish history',
  )
  assert.doesNotMatch(result.stdout, /\d+ ok, \d+ regressions out of/)
  return result
}

test('benchmark CLI requires baseline before launching any measurement', () => {
  assert.deepEqual(refused({ missingBaseline: true }).calls, [])
})

test('baseline schema is nonempty, numeric, positive and unambiguous', async (t) => {
  const bad = [
    null,
    [],
    {},
    { ...baseline, extra: {} },
    { ...baseline, form: {} },
    { ...baseline, form: { bad: 0 } },
    { ...baseline, form: { bad: -1 } },
    { ...baseline, form: { bad: '100' } },
    { ...baseline, scale: { [entries[0][0]]: 100 } },
  ]
  for (const value of bad)
    await t.test(JSON.stringify(value).slice(0, 70), () => {
      assert.deepEqual(refused({ baseline: JSON.stringify(value) }).calls, [])
    })
  assert.deepEqual(refused({ baseline: '{broken' }).calls, [])
  assert.deepEqual(
    refused({ baseline: JSON.stringify(baseline).replace('{', '{"form":{},') }).calls,
    [],
  )
  assert.deepEqual(
    refused({ baseline: JSON.stringify(baseline).replace(String(entries[0][1]), '1e309') }).calls,
    [],
  )
})

test('invalid, duplicate, unknown or loosened threshold arguments fail before measurement', async (t) => {
  for (const args of [
    ['--threshold=NaN'],
    ['--threshold=Infinity'],
    ['--threshold=-1'],
    ['--threshold=1'],
    ['--threshold=0.21'],
    ['--threshold=0.2junk'],
    ['--threshold='],
    ['--other'],
    ['--threshold=0.1', '--threshold=0.2'],
  ]) {
    await t.test(args.join(' '), () => assert.deepEqual(refused({ args }).calls, []))
  }
})

test('child nonzero status and signal cannot publish even complete passing-looking rows', async (t) => {
  await t.test('exit7', () => {
    const result = refused({ status: 7 })
    assert.equal(result.calls.length, 1)
    assert.match(result.stderr, /fixture diagnostic/)
  })
  await t.test('signal', () => refused({ signal: true }))
})

test('empty, partial, duplicate, malformed and unfinished tables fail closed', async (t) => {
  const cases = [
    '',
    'ordinary output without benchmarks',
    table(rows.slice(1)),
    table([...rows, rows[0]]),
    ...['0', '-1', 'NaN', 'Infinity', '1e309'].map((value) =>
      table([row(entries[0][0], value), ...rows.slice(1)]),
    ),
    `${header}\n${rows.join('\n')}\n`,
    table([rows[0].replace('±1.00%', 'NaN%'), ...rows.slice(1)]),
    table([rows[0].replace(/ {2}10$/, '  0'), ...rows.slice(1)]),
    table([...rows, ' · extra case  NaN  1  2  1.5  1.5  2  2  2  ±1.00%  10']),
    table([...rows, ' · extra case  1,23  1  2  1.5  1.5  2  2 2 ±1% 10']),
  ]
  for (let i = 0; i < cases.length; i++)
    await t.test(String(i), () => refused({ output: cases[i] }))
})

test('core execution and completion cannot be repeated or borrowed', () => {
  refused({
    output: ' RUN v4.1.11 CORE_ROOT\n BENCH Summary\n' + table().replace(' BENCH Summary\n', ''),
  })
  refused({ output: table() + ' BENCH Summary\n' })
  refused({ output: table() + header + '\n' + row('extra case', 100) })
  refused({ output: table().replace(' BENCH Summary', `${header}\n\n BENCH Summary`) })
})

test('every runner must complete: truncated later evidence never publishes history', async (t) => {
  const start = ' RUN v4.1.11 /another/workspace\n'
  const emptyTable = `${start} ✓ src/extra.bench.ts > fixture\n${header}`
  const unfinished = secondary().replace(' BENCH Summary\n', '')
  const cases = {
    'bare run at EOF': start,
    'header at EOF without newline': emptyTable,
    'header at EOF with newline': emptyTable + '\n',
    'row at EOF without summary or newline': unfinished.trimEnd(),
    'row at EOF without summary': unfinished,
    'empty runner with summary': start + ' BENCH Summary\n',
    'malformed run banner': ' RUN v4.1.11',
  }
  for (const [name, output] of Object.entries(cases))
    await t.test(name, () => refused({ output: table() + output }))
})

test('every runner must complete before the next runner, including before core', async (t) => {
  for (const [name, output] of Object.entries({
    'bare preceding run': ' RUN v4.1.11 /another/workspace\n',
    'unfinished preceding run': secondary().replace(' BENCH Summary\n', ''),
    'unfinished middle run':
      secondary('first case', '/first/workspace') + ' RUN v4.1.11 /unfinished\n',
  }))
    await t.test(name, () => refused({ output: output + table() }))
})

test('runner completion and table ownership are unambiguous throughout the stream', async (t) => {
  const cases = {
    'duplicate non-core summary': table() + secondary() + ' BENCH Summary\n',
    'table after non-core completion':
      table() + secondary() + `${header}\n${row('late case', 100)}`,
    'suite after non-core completion': table() + secondary() + ' ✓ src/late.bench.ts > fixture\n',
    'repeated non-core owner': table() + secondary() + secondary('another case'),
    'repeated normalized owner':
      table() + secondary('first case', 'C:\\extra') + secondary('second case', 'C:/extra'),
    'summary without a runner': ' BENCH Summary\n' + table(),
    'table without a runner':
      secondary()
        .replace(/^ RUN[^\n]+\n/, '')
        .replace(' BENCH Summary\n', '') + table(),
    'header without a suite':
      table() +
      ` RUN v4.1.11 /another/workspace\n${header}\n${row('extra case', 100)}\n BENCH Summary\n`,
  }
  for (const [name, output] of Object.entries(cases)) await t.test(name, () => refused({ output }))
})

test('complete non-core runners are retained before and after core without new obligations', () => {
  for (const output of [
    secondary() + table(),
    table() + secondary(),
    secondary('first case', '/first/workspace') + table() + secondary(),
  ]) {
    const result = invoke({ output })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.calls.length, 1)
    assert.equal(result.calls[0][0], 'bench')
    assert.match(result.stdout, /20 ok, 0 regressions out of 20/)
    assert.match(result.stdout, /secondary case: 100 ops\/sec \(no baseline; not acceptance\)/)
    const saved = JSON.parse(result.history)
    assert.equal(saved[new Date().toISOString().slice(0, 10)].results['secondary case'], 100)
    assert.deepEqual(saved['2000-01-01'], JSON.parse(history)['2000-01-01'])
  }
  const regressed = table([row(entries[0][0], entries[0][1] * 0.79), ...rows.slice(1)])
  const result = invoke({ output: secondary() + regressed })
  assert.equal(result.status, 1, result.stderr)
  assert.match(result.stdout, /19 ok, 1 regressions out of 20/)
  assert.notEqual(result.history, history, 'retain complete measured failures across runners')
})

test('history must be valid before spawning or publishing', () => {
  for (const value of ['{broken', '[]', 'null'])
    assert.deepEqual(refused({ history: value }).calls, [])
})

test('one workspace invocation retains all baseline obligations and old history', () => {
  const result = invoke({ args: ['--threshold=0.2'] })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.lock, null)
  assert.equal(result.calls.length, 1)
  assert.equal(result.calls[0][0], 'bench', 'must run all workspace bench owners, not only core')
  assert.ok(!result.calls[0].includes('--filter'))
  assert.match(result.stdout, /20 ok, 0 regressions out of 20/)
  assert.deepEqual(JSON.parse(result.history)['2000-01-01'], JSON.parse(history)['2000-01-01'])
})

test('20% boundary is retained, tighter tolerance works, genuine regressions exit1', () => {
  const [, base] = entries[0]
  const atBoundary = invoke({ output: table([row(entries[0][0], base * 0.8), ...rows.slice(1)]) })
  assert.equal(atBoundary.status, 0, atBoundary.stderr)
  const failed = invoke({ output: table([row(entries[0][0], base * 0.79), ...rows.slice(1)]) })
  assert.equal(failed.status, 1, failed.stderr)
  assert.match(failed.stdout, /19 ok, 1 regressions out of 20/)
  assert.notEqual(failed.history, history, 'retain complete measured failures, not only successes')
  assert.equal(
    invoke({
      args: ['--threshold=0.1'],
      output: table([row(entries[0][0], base * 0.85), ...rows.slice(1)]),
    }).status,
    1,
  )
})

test('numeric suffixes are names, ANSI and grouped digits are supported', () => {
  const output = table([
    ...rows,
    '\u001b[32m' + row('interleaved measure(10) + setScroll × 100', '2,904.40') + '\u001b[0m',
  ])
  const result = invoke({ output })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /interleaved measure\(10\) \+ setScroll × 100: 2904.4 ops\/sec/)
})

test('foreign workspace or wrong benchmark file cannot satisfy a core obligation', () => {
  refused({ output: table().replace('CORE_ROOT', '/another/workspace') })
  refused({ output: table().replace('src/form.bench.ts', 'src/component-scale.bench.ts') })
})

test('existing history lock prevents a second measurement and is not broken', () => {
  const result = refused({ lock: true })
  assert.deepEqual(result.calls, [])
  assert.equal(result.lock, 'foreign lock\n')
})

test('history written by another actor during execution is not overwritten', () => {
  const result = invoke({ changeHistory: true })
  assert.equal(result.status, 2, result.stderr)
  assert.equal(result.history, '{}\n')
  assert.equal(result.lock, null)
})

async function transport(t, options, limits) {
  const { runWorkspaceBench } = await import('./bench-regression.mjs')
  const dir = fixture(options)
  // A failed cleanup is reported as a hook failure, without masking assertions.
  t.after(() => {
    if (existsSync(join(dir, 'pids.json'))) {
      const [pid] = JSON.parse(readFileSync(join(dir, 'pids.json'), 'utf8'))
      try {
        process.kill(-pid, 'SIGKILL')
      } catch (error) {
        if (error.code !== 'ESRCH') throw error
      }
    }
    rmSync(dir, { recursive: true, force: true })
  })
  const previous = process.env.npm_execpath
  process.env.npm_execpath = join(dir, options.missingProducer ? 'missing.mjs' : 'producer.mjs')
  try {
    const result = await runWorkspaceBench(options.missingCwd ? join(dir, 'absent') : dir, limits)
    if (options.hang || options.orphan) {
      const pids = JSON.parse(readFileSync(join(dir, 'pids.json'), 'utf8'))
      for (const pid of pids) {
        const stat = `/proc/${pid}/stat`
        for (
          let i = 0;
          i < 100 && existsSync(stat) && !readFileSync(stat, 'utf8').includes(') Z ');
          i++
        ) {
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        assert.ok(
          !existsSync(stat) || readFileSync(stat, 'utf8').includes(') Z '),
          `owned fixture still running: ${pid}`,
        )
      }
    }
    return result
  } finally {
    if (previous === undefined) delete process.env.npm_execpath
    else process.env.npm_execpath = previous
  }
}

test('transport missing executable evidence is a failure, never empty success', async (t) => {
  const result = await transport(t, { missingProducer: true }, { timeoutMs: 2000 })
  assert.notEqual(result.status, 0)
})

test('transport spawn error is retained', async (t) => {
  const result = await transport(t, { missingCwd: true }, { timeoutMs: 2000 })
  assert.equal(result.error?.code, 'ENOENT')
  assert.notEqual(result.status, 0)
})

test('transport output budget refuses the child', async (t) => {
  const result = await transport(
    t,
    { output: 'x'.repeat(8192) },
    { maxBytes: 4096, timeoutMs: 2000 },
  )
  assert.match(result.error?.message ?? '', /output budget/)
  assert.ok(result.stdout.length + result.stderr.length <= 4096)
})

test(
  'transport absolute deadline stops an outputting owned process group',
  { skip: process.platform !== 'linux' },
  async (t) => {
    const started = Date.now()
    const result = await transport(t, { hang: true, output: '' }, { timeoutMs: 1000 })
    assert.match(result.error?.message ?? '', /absolute deadline/)
    assert.notEqual(result.status, 0)
    assert.ok(Date.now() - started < 4000, 'output must not extend the absolute deadline')
  },
)

test(
  'transport cleans up children after an owned leader exits',
  { skip: process.platform !== 'linux' },
  async (t) => {
    const result = await transport(t, { orphan: true, output: '' }, { timeoutMs: 2000 })
    assert.equal(result.error, undefined)
    assert.equal(result.status, 0)
  },
)

test('CI delegates benchmark execution once without changing the 30 minute limit', () => {
  const workflow = load(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8'))
  assert.equal(workflow.jobs.ci['timeout-minutes'], 30)
  const steps = workflow.jobs.ci.steps
  const step = steps.find((s) => s.name === 'Bench + regression check')
  assert.equal(step.run.trim(), 'node scripts/check-bench-regression.mjs')
  assert.equal(
    steps.filter((s) => /(?:pnpm bench|check-bench-regression)/.test(s.run ?? '')).length,
    1,
  )
})
