// oxlint-disable no-unused-vars
/// <reference types="node" />
import { Bench } from 'tinybench'
import { parse, tokenize, walk } from '../dist/index.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
// @ts-expect-error: no type definitions for css-tree
import * as csstree from 'css-tree'
import * as postcss from 'postcss'
import { ensureTailwindFixtures } from '../vitest.setup.ts'

await ensureTailwindFixtures()

const largeCSS = fs.readFileSync(path.resolve('benchmark/medium.css'), 'utf-8')
const bootstrapCSS = fs.readFileSync(
	path.resolve('node_modules/bootstrap/dist/css/bootstrap.css'),
	'utf-8',
)
const tailwindCSS = fs.readFileSync(
	path.resolve('node_modules/tailwindcss/dist/tailwind.css'),
	'utf-8',
)

type CSSFile = 'Large' | 'Bootstrap' | 'Tailwind'

const files: CSSFile[] = ['Large', 'Bootstrap', 'Tailwind']

const cssMap: Record<CSSFile, string> = {
	Large: largeCSS,
	Bootstrap: bootstrapCSS,
	Tailwind: tailwindCSS,
}

const fileSizes: Record<CSSFile, number> = {
	Large: largeCSS.length,
	Bootstrap: bootstrapCSS.length,
	Tailwind: tailwindCSS.length,
}

// Pre-parse once for walk-only benchmarks so parse time doesn't pollute walk timings
const parsedMap = {
	Large: parse(largeCSS),
	Bootstrap: parse(bootstrapCSS),
	Tailwind: parse(tailwindCSS),
}

const quick = process.argv.includes('--quick')

// ─── Speed benchmarks ─────────────────────────────────────────────────────

const bench = new Bench({ warmup: true })

for (const file of files) {
	const css = cssMap[file]
	const parsed = parsedMap[file]

	bench.add(`Tokenize|${file}`, () => {
		for (const _token of tokenize(css)) {
			// iterate
		}
	})

	bench.add(`Parse|${file}`, () => {
		parse(css)
	})

	bench.add(`Walk|${file}`, () => {
		walk(parsed, (node, _depth) => {
			void node.type
			void node.line
		})
	})

	bench.add(`Parse+Walk|${file}`, () => {
		let ast = parse(css)
		walk(ast, (node, _depth) => {
			void node.type
			void node.line
		})
	})

	if (!quick) {
		bench.add(`Fair-Wallace|${file}`, () => {
			let ast = parse(css, {
				parse_selectors: false,
				parse_values: false,
				parse_atrule_preludes: false,
			})
			walk(ast, (node, _depth) => {
				void node.type
				void node.line
			})
		})

		bench.add(`Fair-CSSTree|${file}`, () => {
			let ast = csstree.parse(css, {
				positions: true,
				parseValue: false,
				parseAtrulePrelude: false,
				parseRulePrelude: false,
			})
			// @ts-expect-error: no type definitions for css-tree
			csstree.walk(ast, (node) => {
				void node.type
				void node.loc?.start.line
			})
		})

		bench.add(`CSSTree-Parse|${file}`, () => {
			csstree.parse(css, { positions: true })
		})

		bench.add(`PostCSS-Parse|${file}`, () => {
			postcss.parse(css)
		})

		bench.add(`CSSTree|${file}`, () => {
			let ast = csstree.parse(css, { positions: true })
			// @ts-expect-error: no type definitions for css-tree
			csstree.walk(ast, (node) => {
				void node.type
				void node.loc?.start.line
			})
		})

		bench.add(`PostCSS|${file}`, () => {
			let root = postcss.parse(css)
			root.walk((node) => {
				void node.type
				void node.source?.start?.line
			})
		})
	}
}

await bench.run()

// ─── Helpers ───────────────────────────────────────────────────────────────

function ops(name: string): number {
	const result = bench.tasks.find((t) => t.name === name)?.result
	const stats = result && 'latency' in result ? result : null
	return stats?.throughput?.mean ?? 0
}

function fmtOps(n: number): string {
	return n > 0 ? n.toFixed(0) : 'N/A'
}

function fmtSize(file: CSSFile): string {
	return `${(fileSizes[file] / 1024).toFixed(0)} KB`
}

function fmtMB(mb: number): string {
	return `${mb.toFixed(1)} MB`
}

function forceGC(rounds = 5): void {
	for (let i = 0; i < rounds; i++) {
		;(globalThis as { gc?: () => void }).gc!()
	}
}

function measureMemoryMB(
	css: string,
	parser: 'wallace' | 'csstree' | 'postcss',
	iterations = 3,
): number {
	const deltas: number[] = []

	for (let i = 0; i < iterations; i++) {
		forceGC()
		const before = process.memoryUsage()

		if (parser === 'wallace') {
			let ast = parse(css)
			walk(ast, (node, _depth) => {
				void node.type
				void node.line
			})
		} else if (parser === 'csstree') {
			let ast = csstree.parse(css, { positions: true })
			// @ts-expect-error: no type definitions for css-tree
			csstree.walk(ast, (node) => {
				void node.type
				void node.loc?.start.line
			})
		} else {
			let root = postcss.parse(css)
			root.walk((node) => {
				void node.type
				void node.source?.start?.line
			})
		}

		const after = process.memoryUsage()
		deltas.push(after.heapUsed + after.external - (before.heapUsed + before.external))
	}

	const avg = deltas.reduce((a, b) => a + b, 0) / iterations
	return avg / 1024 / 1024
}

// ─── Table 1: Wallace metrics ──────────────────────────────────────────────

console.log('\n── Table 1: Wallace CSS Parser ──────────────────────────────────────────\n')

console.table(
	files.map((file) => ({
		File: file,
		Size: fmtSize(file),
		'Tokenize (ops/sec)': fmtOps(ops(`Tokenize|${file}`)),
		'Parse (ops/sec)': fmtOps(ops(`Parse|${file}`)),
		'Walk (ops/sec)': fmtOps(ops(`Walk|${file}`)),
		'Parse+Walk (ops/sec)': fmtOps(ops(`Parse+Walk|${file}`)),
	})),
)

if (!quick) {
	// ─── Table 2: Parse speed comparison ────────────────────────────────────

	console.log('\n── Table 2: Parse Speed – Wallace (baseline) vs CSSTree vs PostCSS ───────\n')

	console.table(
		files.map((file) => {
			const w = ops(`Parse|${file}`)
			const c = ops(`CSSTree-Parse|${file}`)
			const p = ops(`PostCSS-Parse|${file}`)
			return {
				File: file,
				Size: fmtSize(file),
				'Wallace (ops/sec)': fmtOps(w),
				'CSSTree (ops/sec)': fmtOps(c),
				'PostCSS (ops/sec)': fmtOps(p),
				'vs CSSTree': c > 0 ? `${(w / c).toFixed(1)}x faster` : 'N/A',
				'vs PostCSS': p > 0 ? `${(w / p).toFixed(1)}x faster` : 'N/A',
			}
		}),
	)

	// ─── Table 3: Parse+Walk speed comparison ───────────────────────────────

	console.log('\n── Table 3: Parse+Walk Speed – Wallace (baseline) vs CSSTree vs PostCSS ──\n')

	console.table(
		files.map((file) => {
			const w = ops(`Parse+Walk|${file}`)
			const c = ops(`CSSTree|${file}`)
			const p = ops(`PostCSS|${file}`)
			return {
				File: file,
				Size: fmtSize(file),
				'Wallace (ops/sec)': fmtOps(w),
				'CSSTree (ops/sec)': fmtOps(c),
				'PostCSS (ops/sec)': fmtOps(p),
				'vs CSSTree': c > 0 ? `${(w / c).toFixed(1)}x faster` : 'N/A',
				'vs PostCSS': p > 0 ? `${(w / p).toFixed(1)}x faster` : 'N/A',
			}
		}),
	)

	// ─── Table 4: Fair Parse+Walk comparison (no sub-parsing) ───────────────

	console.log(
		'\n── Table 4: Parse+Walk Speed (fair) – Wallace no sub-parsing vs CSSTree no sub-parsing vs PostCSS ──\n',
	)

	console.table(
		files.map((file) => {
			const w = ops(`Fair-Wallace|${file}`)
			const c = ops(`Fair-CSSTree|${file}`)
			const p = ops(`PostCSS|${file}`)
			return {
				File: file,
				Size: fmtSize(file),
				'Wallace (ops/sec)': fmtOps(w),
				'CSSTree (ops/sec)': fmtOps(c),
				'PostCSS (ops/sec)': fmtOps(p),
				'vs CSSTree': c > 0 ? `${(w / c).toFixed(1)}x faster` : 'N/A',
				'vs PostCSS': p > 0 ? `${(w / p).toFixed(1)}x faster` : 'N/A',
			}
		}),
	)
}

// ─── Memory comparison ─────────────────────────────────────────────────────

const hasGC = typeof (globalThis as { gc?: () => void }).gc === 'function'
const memTableNum = quick ? 2 : 5

if (hasGC) {
	if (quick) {
		console.log('\n── Table 2: Parse+Walk Memory – Wallace ─────────────────────────────────\n')

		console.table(
			files.map((file) => {
				const w = measureMemoryMB(cssMap[file], 'wallace')
				return { File: file, Size: fmtSize(file), Wallace: fmtMB(w) }
			}),
		)
	} else {
		console.log('\n── Table 5: Parse+Walk Memory – Wallace (baseline) vs CSSTree vs PostCSS ─\n')

		console.table(
			files.map((file) => {
				const css = cssMap[file]
				const w = measureMemoryMB(css, 'wallace')
				const c = measureMemoryMB(css, 'csstree')
				const p = measureMemoryMB(css, 'postcss')
				return {
					File: file,
					Size: fmtSize(file),
					Wallace: fmtMB(w),
					CSSTree: fmtMB(c),
					PostCSS: fmtMB(p),
					'vs CSSTree': c > 0 ? `${(c / w).toFixed(1)}x less` : 'N/A',
					'vs PostCSS': p > 0 ? `${(p / w).toFixed(1)}x less` : 'N/A',
				}
			}),
		)
	}
} else {
	console.log(
		`\n── Table ${memTableNum}: Memory Usage – skipped (run with: node --expose-gc benchmark/index.js) ──\n`,
	)
}
