import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildManifest } from './build'
import { discover, findRepoRoot } from './discover'
import { renderLlmsText } from './llms'

/** Discover the inventory and write `manifest.json` + `llms.txt` to repo root. */
function main(): void {
  const repoRoot = findRepoRoot()
  const manifest = buildManifest(discover(repoRoot))
  writeFileSync(join(repoRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(join(repoRoot, 'llms.txt'), renderLlmsText(manifest))
  // eslint-disable-next-line no-console
  console.log(
    `manifest: ${manifest.stats.total} components ` +
      `(${manifest.stats.both} both / ${manifest.stats.reactOnly} react / ${manifest.stats.vueOnly} vue), ` +
      `${manifest.tokens.all.length} tokens → manifest.json, llms.txt`,
  )
}

main()
