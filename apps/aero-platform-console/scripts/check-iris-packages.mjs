import { realpathSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(readFileSync(`${appDir}/package.json`, 'utf8'))
const require = createRequire(import.meta.url)
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const runtimeSpecifiers = ['@iris-ui-kit/plugin-locale-zh/core', '@iris-ui-kit/react']

for (const [name, expectedVersion] of Object.entries(manifest.dependencies ?? {})) {
  if (!name.startsWith('@iris-ui-kit/')) continue
  if (!exactVersion.test(expectedVersion)) {
    throw new Error(`${name} must use an exact published npm version; received ${expectedVersion}`)
  }

  const packagePath = require.resolve(`${name}/package.json`)
  const installed = JSON.parse(readFileSync(packagePath, 'utf8'))
  if (installed.version !== expectedVersion) {
    throw new Error(`${name} resolved to ${installed.version}; expected ${expectedVersion}`)
  }
  for (const [dependency, specifier] of Object.entries(installed.dependencies ?? {})) {
    if (String(specifier).startsWith('workspace:')) {
      throw new Error(
        `${name}@${installed.version} has invalid registry dependency ${dependency}=${specifier}`,
      )
    }
  }

  const localPackageDir = `${sep}packages${sep}${name.slice('@iris-ui-kit/'.length)}${sep}`
  const resolvedPath = realpathSync(packagePath)
  if (resolvedPath.includes(localPackageDir)) {
    throw new Error(`${name} resolved to workspace source: ${relative(appDir, resolvedPath)}`)
  }
  console.log(`verified ${name}@${installed.version} from npm package metadata`)
}

for (const specifier of runtimeSpecifiers) {
  const loaded = await import(specifier)
  if (Object.keys(loaded).length === 0) throw new Error(`${specifier} has no runtime exports`)
  console.log(`loaded ${specifier} with its published dependency closure`)
}
