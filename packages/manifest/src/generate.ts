import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildManifest } from './build'
import { discover, findRepoRoot } from './discover'
import { renderLlmsText } from './llms'

/**
 * Discover the inventory and write `manifest.json` + `llms.txt` inside
 * `@iris-ui/manifest` — the single distributable copy. npm consumers read
 * `node_modules/@iris-ui/manifest/{manifest.json,llms.txt}` (the AI-native
 * contract). Downstream tools (docs prebuild, MCP server, CLI) resolve from
 * this package, so there is no root-level duplicate.
 */
function main(): void {
  const repoRoot = findRepoRoot()
  const manifest = buildManifest(discover(repoRoot))
  const json = `${JSON.stringify(manifest, null, 2)}\n`
  const llms = renderLlmsText(manifest)
  const outDir = join(repoRoot, 'packages', 'manifest')
  writeFileSync(join(outDir, 'manifest.json'), json)
  writeFileSync(join(outDir, 'llms.txt'), llms)
  const byFw = manifest.frameworks.map((f) => `${f} ${manifest.stats.byFramework[f]}`).join(' / ')
  // eslint-disable-next-line no-console
  console.log(
    `manifest: ${manifest.stats.total} components ` +
      `(${byFw}; ${manifest.stats.full} in all ${manifest.frameworks.length}), ` +
      `${manifest.tokens.all.length} tokens → packages/manifest/{manifest.json,llms.txt}`,
  )
}

main()
