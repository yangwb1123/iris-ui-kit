import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildManifest } from './build'
import { discover, findRepoRoot } from './discover'
import { renderLlmsText } from './llms'

/**
 * Discover the inventory and write `manifest.json` + `llms.txt` to two places:
 *  - the repo root — single source for the docs prebuild + AGENTS reference;
 *  - inside `@iris-ui/manifest` — the distributable copy, so npm consumers can
 *    read `node_modules/@iris-ui/manifest/{manifest.json,llms.txt}` (the
 *    AI-native contract). Both copies are byte-identical, written from the same
 *    in-memory manifest so they can never disagree.
 */
function main(): void {
  const repoRoot = findRepoRoot()
  const manifest = buildManifest(discover(repoRoot))
  const json = `${JSON.stringify(manifest, null, 2)}\n`
  const llms = renderLlmsText(manifest)
  const targets = [repoRoot, join(repoRoot, 'packages', 'manifest')]
  for (const dir of targets) {
    writeFileSync(join(dir, 'manifest.json'), json)
    writeFileSync(join(dir, 'llms.txt'), llms)
  }
  // eslint-disable-next-line no-console
  console.log(
    `manifest: ${manifest.stats.total} components ` +
      `(${manifest.stats.both} both / ${manifest.stats.reactOnly} react / ${manifest.stats.vueOnly} vue), ` +
      `${manifest.tokens.all.length} tokens → manifest.json, llms.txt (root + @iris-ui/manifest)`,
  )
}

main()
