/**
 * Resolve a working way to run pnpm from Node.
 *
 * Why this exists: pnpm's global launcher is deliberately *shebang-less* (it
 * hands off to ./bin/pnpm.mjs, or to the installed native binary). A shell
 * retries a shebang-less file — `execvp` falls back to running it with /bin/sh —
 * but Apple's libc does NOT, so a program that spawns the pnpm path directly
 * gets ENOEXEC. Concretely, on a machine where the first `pnpm` on PATH is that
 * shim, `spawnSync('pnpm', [...])` fails with status=null, and any caller that
 * treats a non-zero status as "the check failed" reports a *false* failure that
 * is indistinguishable from real drift.
 *
 * Two mitigations, in order of preference:
 *  1. `npm_execpath` — when this process is itself running under pnpm AND that
 *     entry point is a JavaScript file, exec the very same pnpm through the
 *     current Node binary. No shebang involved.
 *  2. A shell wrapper — reproduces what a human typing `pnpm …` gets, so the
 *     kernel's shebang-less retry (or a native binary) applies.
 *
 * The `.cjs/.mjs/.js` restriction in (1) is not cosmetic: a pnpm installed via
 * its standalone/native distribution sets `npm_execpath` to the *Mach-O/ELF
 * binary* `…/@pnpm/exe.<platform>/pnpm`, which has no extension. Handing that to
 * `node` fails with `SyntaxError: Invalid or unexpected token` and a non-zero
 * status — indistinguishable from a real gate failure, which is exactly the
 * class of false negative this module exists to eliminate.
 *
 * Callers must still distinguish "could not run the tool" (see `runPnpm`) from
 * "the tool ran and reported a problem", or a broken environment will keep
 * masquerading as a real gate failure.
 */
import { spawnSync } from 'node:child_process'

const isWindows = process.platform === 'win32'

/**
 * A pnpm entry point we can safely hand to `node`. The standalone/native
 * distribution reuses the bare name `pnpm` for a compiled binary, so the
 * extension — not the file name — is what distinguishes JS from native.
 */
const JS_ENTRYPOINT = /\.(?:c|m)?js$/i

/** Quote a single argument for the shell used by `runPnpm`. */
function quote(arg) {
  if (isWindows) return `"${String(arg).replace(/"/g, '""')}"`
  return `'${String(arg).replace(/'/g, `'\\''`)}'`
}

/**
 * @returns {{ command: string, args: string[] }}
 *   The command/args to spawn so that pnpm actually runs.
 */
export function pnpmCommand(env = process.env) {
  // 1. Running under pnpm already? Reuse that exact entry through Node — but
  //    only when it is a JS entry. A native pnpm binary must go to the shell.
  const execPath = env.npm_execpath
  if (execPath && JS_ENTRYPOINT.test(execPath)) {
    return { command: process.execPath, args: [execPath] }
  }

  // 2. Otherwise go through a shell so a shebang-less pnpm shim still works.
  const shell = isWindows ? process.env.ComSpec || 'cmd.exe' : '/bin/sh'
  const shellFlag = isWindows ? '/d /s /c' : '-c'
  return { command: shell, args: [shellFlag] }
}

/**
 * Run `pnpm <args...>` and report *how* it ended.
 *
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptions} [options]
 * @returns {{ ok: boolean, status: number|null, error?: Error }}
 *   `ok === false` with `error` means the tool could not be launched at all —
 *   that is an environment failure, NOT a check failure.
 */
export function runPnpm(args, options = {}) {
  const { command, args: prefix } = pnpmCommand()
  const finalArgs = isWindows
    ? [prefix, ['pnpm', ...args].join(' ')]
    : [...prefix, ['pnpm', ...args].map(quote).join(' ')]

  const result = spawnSync(command, finalArgs, { cwd: process.cwd(), ...options })

  if (result.error) {
    return { ok: false, status: null, error: result.error }
  }
  // status === null without an `error` also means the process never ran
  // (e.g. killed by a signal); treat it as an environment failure too.
  if (result.status === null) {
    return {
      ok: false,
      status: null,
      error: new Error(`pnpm ${args.join(' ')} did not exit (signal ${result.signal})`),
    }
  }
  return { ok: result.status === 0, status: result.status }
}

/**
 * Exit with a distinct code when pnpm could not be launched, so a broken
 * environment is never reported as a failed gate.
 *
 * @param {import('node:child_process').SpawnSyncOptions} [options]
 * @returns {import('node:child_process').SpawnSyncReturns<Buffer>}
 */
export function runPnpmOrExit(args, options = {}) {
  const { command, args: prefix } = pnpmCommand()
  const finalArgs = isWindows
    ? [prefix, ['pnpm', ...args].join(' ')]
    : [...prefix, ['pnpm', ...args].map(quote).join(' ')]

  const result = spawnSync(command, finalArgs, { cwd: process.cwd(), ...options })
  if (result.error) {
    process.stderr.write(
      `\nERROR: could not launch pnpm (${result.error.code ?? result.error.message}).\n` +
        `Tried: ${command} ${finalArgs.join(' ')}\n` +
        `This is an environment problem, not a check failure. Verify \`pnpm --version\` works\n` +
        `in a shell, then re-run.\n`,
    )
    process.exit(2)
  }
  return result
}
