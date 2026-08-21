/** Registry command barrel. IO, resolution, planning, and command actions are
 * separated so the CLI entry point keeps a small, stable import surface. */
export { sha256 } from './registry/io.js'
export { runInit, runRegistryAdd, runUpdate } from './registry/commands.js'
export { runAdd, runDiff } from './registry/install.js'
export type { InitOptions, InstallOptions, RegistryAddOptions } from './registry/types.js'
