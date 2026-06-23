// oxlint-disable no-console
/// <reference types="node" />
// Run: node test/build/bundle-sizes.ts
// Prints a markdown table of minified + gzip sizes for all package exports.
// Copy the output into the Bundle sizes table in README.md.
import { build } from 'esbuild'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

// Exports that don't follow the ./name → src/name.ts convention
const SOURCE_OVERRIDES: Record<string, string> = {
	'.': 'src/index.ts',
	'./tokenizer': 'src/tokenize.ts',
	'./walker': 'src/walk.ts',
	'./nodes': 'src/constants.ts',
}

const DESCRIPTIONS: Record<string, string> = {
	'.': 'Full parser (all subparsers)',
	'./tokenizer': 'Tokenizer',
	'./parse': 'CSS stylesheet parser',
	'./parse-selector': 'Selector parser',
	'./parse-atrule-prelude': 'At-rule prelude parser',
	'./parse-declaration': 'Declaration parser',
	'./parse-value': 'Value parser',
	'./parse-anplusb': 'An+B syntax parser',
	'./parse-dimension': 'Dimension parser',
	'./walker': 'AST walker',
	'./nodes': 'Node type constants',
}

const exports_to_measure = Object.keys(pkg.exports).filter((k: string) => k !== './package.json')

const results = await Promise.all(
	exports_to_measure.map(async (export_path: string) => {
		const entry = SOURCE_OVERRIDES[export_path] ?? `src/${export_path.slice(2)}.ts`

		const result = await build({
			entryPoints: [resolve(root, entry)],
			bundle: true,
			minify: true,
			write: false,
			format: 'esm',
			platform: 'neutral',
		})

		const code = result.outputFiles[0].contents
		return {
			export_path,
			minified: code.length,
			gzipped: gzipSync(code).length,
		}
	}),
)

function fmt(bytes: number): string {
	return `${(bytes / 1000).toFixed(1)} kB`
}

const pkg_name: string = pkg.name

console.log('| Import | Description | Minified | Gzip |')
console.log('| ------------------------------------------------- | ---------------------------- | -------- | ------- |')

for (const { export_path, minified, gzipped } of results) {
	const import_path = export_path === '.' ? pkg_name : `${pkg_name}${export_path.slice(1)}`
	const description = DESCRIPTIONS[export_path] ?? ''
	console.log(`| \`${import_path}\` | ${description} | ${fmt(minified)} | ${fmt(gzipped)} |`)
}
