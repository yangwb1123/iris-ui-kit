import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'
import { minify } from 'terser'

function validateSourceMap(inputMap, filename) {
  const map = typeof inputMap === 'string' ? JSON.parse(inputMap) : inputMap
  const strings = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string')
  if (
    !map ||
    map.version !== 3 ||
    !strings(map.sources) ||
    !strings(map.names) ||
    typeof map.mappings !== 'string' ||
    (map.sourcesContent !== undefined &&
      (!Array.isArray(map.sourcesContent) ||
        map.sourcesContent.length !== map.sources.length ||
        !map.sourcesContent.every((item) => item === null || typeof item === 'string')))
  ) {
    throw new Error('Invalid or unsupported source map for ' + filename)
  }
}

/**
 * Compact after tsup's tree-shaking step, retaining consumer-facing purity
 * metadata. esbuild's whitespace minifier drops those annotations; on an icon
 * barrel that keeps unused SVG validators/registries in a single-icon import.
 * No identifier/property mangling or unsafe compression is enabled.
 */
export async function compactJavaScript(code, filename, inputMap) {
  if (inputMap !== undefined) validateSourceMap(inputMap, filename)
  return minify(
    { [filename]: code },
    {
      module: extname(filename) === '.js',
      mangle: false,
      keep_fnames: true,
      keep_classnames: true,
      // Nitro's automatic-import scanner misses later comma-separated bindings.
      // Keep declarations separate so an icon named `send` does not gain an H3 import.
      compress: {
        defaults: true,
        directives: false,
        join_vars: false,
        passes: 2,
        keep_fnames: true,
      },
      format: {
        preserve_annotations: true,
        comments: /[@#]__PURE__|@license|@preserve|^!/,
      },
      ...(inputMap !== undefined
        ? {
            sourceMap: { content: inputMap, filename, url: filename + '.map' },
          }
        : {}),
    },
  )
}

export async function compactPublishedJavaScript(directory) {
  const files = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:js|cjs)$/.test(entry.name))
    .map((entry) => resolve(directory, entry.name))
    .sort()
  if (!files.length) throw new Error('No built JavaScript found; refusing an empty compaction')

  // Validate the complete build before replacing any file. Maps are composed
  // with tsup's maps, rather than silently dropping original source locations.
  const results = []
  for (const file of files) {
    const inputMap = readFileSync(file + '.map', 'utf8')
    const result = await compactJavaScript(readFileSync(file, 'utf8'), basename(file), inputMap)
    if (!result.code || !result.map) throw new Error('Missing compacted code/map for ' + file)
    results.push({ file, ...result })
  }
  for (const { file, code, map } of results) {
    writeFileSync(file, code)
    writeFileSync(file + '.map', map)
  }
  return results.length
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw new Error('Usage: compact-published-js.mjs <dist-directory>')
  const count = await compactPublishedJavaScript(resolve(process.argv[2]))
  console.log(
    'Compacted ' + count + ' built JavaScript files with names and purity annotations intact',
  )
}
