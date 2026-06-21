// Memory diagnostics: parse / walk / parse+walk across parsers and files
//
// Usage:
//   node --expose-gc benchmark/memory.ts
//   node --expose-gc benchmark/memory.ts --save-baseline
//
// Writes benchmark/memory-results.json every run.
// If benchmark/memory-baseline.json exists, prints a regression diff.
// Save a new baseline with --save-baseline (e.g. after merging to main).

/// <reference types="node" />
// @ts-expect-error: no type definitions for css-tree
import * as csstree from 'css-tree'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as postcss from 'postcss'
import { fileURLToPath } from 'node:url'
import { parse, walk } from '../dist/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Config ────────────────────────────────────────────────────────────────────

/** Measurement iterations per cell (median is taken) */
const ITERATIONS = 5
/** Flag a regression if memory grows more than this fraction vs baseline */
const REGRESSION_THRESHOLD = 0.08

const BYTES_PER_NODE = 32

// ── CSS files ─────────────────────────────────────────────────────────────────

function read(rel: string): string {
	return fs.readFileSync(path.join(__dirname, rel), 'utf-8')
}

const CSS_FILES: Record<string, string> = {
	Small: read('small.css'),
	Medium: read('medium.css'),
	Bootstrap: read('../node_modules/bootstrap/dist/css/bootstrap.css'),
	Tailwind: read('../node_modules/tailwindcss/dist/tailwind.css'),
}

// ── GC / snapshot ─────────────────────────────────────────────────────────────

// Module-level sink: assigning here prevents V8 from treating fn()'s return
// value as dead before force_gc() runs. A local `void result` is not enough
// because the JIT may determine it's a no-op and shorten the variable's lifetime.
let _measurement_sink: unknown = null

const _gc = (globalThis as { gc?: () => void }).gc

if (!_gc) {
	console.error('Run with --expose-gc: node --expose-gc benchmark/memory.ts')
	process.exit(1)
}

function force_gc(rounds = 5): void {
	for (let i = 0; i < rounds; i++) _gc!()
}

interface Mem {
	heap: number // JS heap only (objects, closures, strings)
	external: number // ArrayBuffers, native-backed memory
	total: number // heap + external
	rss: number // resident set size (whole process)
}

function snap(): Mem {
	const m = process.memoryUsage()
	return { heap: m.heapUsed, external: m.external, total: m.heapUsed + m.external, rss: m.rss }
}

function diff(before: Mem, after: Mem): Mem {
	return {
		heap: after.heap - before.heap,
		external: after.external - before.external,
		total: after.total - before.total,
		rss: after.rss - before.rss,
	}
}

/**
 * Run fn ITERATIONS times, return the median retained-memory delta.
 *
 * fn must return the primary result object (the parse tree / root node).
 * We store it in _measurement_sink (module scope) so V8 cannot shorten its
 * lifetime before the post-operation GC runs. That GC collects dead
 * temporaries (e.g. the pre-trim arena buffer) without collecting the live
 * result. We clear the sink before the next iteration so the next baseline
 * snapshot starts clean.
 */
function measure(fn: () => unknown): Mem {
	const deltas: Mem[] = []
	for (let i = 0; i < ITERATIONS; i++) {
		force_gc()
		const before = snap()
		_measurement_sink = fn()
		force_gc() // collect dead temporaries; _measurement_sink keeps result alive
		const after = snap()
		_measurement_sink = null // release before next iteration's baseline GC
		deltas.push(diff(before, after))
	}
	deltas.sort((a, b) => a.total - b.total)
	return deltas[Math.floor(deltas.length / 2)]
}

// ── Arena stats ───────────────────────────────────────────────────────────────

interface ArenaStats {
	node_count: number
	capacity: number
	growth_count: number
	used_kb: number
	total_kb: number
	waste_pct: number
}

function arena_stats(root: ReturnType<typeof parse>): ArenaStats {
	// __get_arena() is @internal but stable for diagnostics
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const arena = (root as any).__get_arena()
	const node_count: number = arena.get_count()
	const capacity: number = arena.get_capacity()
	const growth_count: number = arena.get_growth_count()
	const used_kb = (node_count * BYTES_PER_NODE) / 1024
	const total_kb = (capacity * BYTES_PER_NODE) / 1024
	const waste_pct = ((capacity - node_count) / capacity) * 100
	return { node_count, capacity, growth_count, used_kb, total_kb, waste_pct }
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt_kb(bytes: number): string {
	return `${(bytes / 1024).toFixed(1)} KB`
}

function fmt_mb(bytes: number): string {
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function fmt_pct(n: number): string {
	return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

// ── Results structures ────────────────────────────────────────────────────────

interface PhaseRow {
	heap: number
	external: number
	total: number
}

interface FileResult {
	size_bytes: number
	// per parser: parse-only, parse+walk
	wallace: { parse: PhaseRow; parse_walk: PhaseRow }
	csstree: { parse: PhaseRow; parse_walk: PhaseRow }
	postcss: { parse: PhaseRow; parse_walk: PhaseRow }
	arena: ArenaStats
}

// ── Main ──────────────────────────────────────────────────────────────────────

const results: Record<string, FileResult> = {}

for (const [name, css] of Object.entries(CSS_FILES)) {
	process.stdout.write(`Measuring ${name}...`)

	// Parse-only
	const w_parse = measure(() => parse(css))
	const c_parse = measure(() => csstree.parse(css, { positions: true }))
	const p_parse = measure(() => postcss.parse(css))

	// Parse+Walk — return the AST so the arena stays alive through the post-GC
	const w_parse_walk = measure(() => {
		const ast = parse(css)
		walk(ast, (node) => {
			void node.type
			void node.line
		})
		return ast
	})
	const c_parse_walk = measure(() => {
		const ast = csstree.parse(css, { positions: true })
		csstree.walk(ast, (node: { type: unknown; loc?: { start: { line: unknown } } }) => {
			void node.type
			void node.loc?.start.line
		})
		return ast
	})
	const p_parse_walk = measure(() => {
		const root = postcss.parse(css)
		root.walk((node) => {
			void node.type
			void node.source?.start?.line
		})
		return root
	})

	// Arena stats (single parse, outside measurement window)
	const ast = parse(css)
	const stats = arena_stats(ast)

	results[name] = {
		size_bytes: css.length,
		wallace: { parse: w_parse, parse_walk: w_parse_walk },
		csstree: { parse: c_parse, parse_walk: c_parse_walk },
		postcss: { parse: p_parse, parse_walk: p_parse_walk },
		arena: stats,
	}

	console.log(' done')
}

// ── Tables ────────────────────────────────────────────────────────────────────

console.log('\n── Parse-only memory: heap / external / total ───────────────────────────\n')
console.log('(heap = JS objects  |  external = ArrayBuffer / native  |  total = heap+external)\n')

console.table(
	Object.entries(results).map(([name, r]) => ({
		File: name,
		Size: fmt_kb(r.size_bytes),
		// Wallace splits cleanly: arena lives in external, JS objects in heap
		'W heap': fmt_kb(r.wallace.parse.heap),
		'W ext': fmt_kb(r.wallace.parse.external),
		'W total': fmt_mb(r.wallace.parse.total),
		// csstree: all in heap (plain JS objects)
		'C heap': fmt_kb(r.csstree.parse.heap),
		'C ext': fmt_kb(r.csstree.parse.external),
		'C total': fmt_mb(r.csstree.parse.total),
		// postcss: all in heap
		'P heap': fmt_kb(r.postcss.parse.heap),
		'P ext': fmt_kb(r.postcss.parse.external),
		'P total': fmt_mb(r.postcss.parse.total),
		'W vs C': r.csstree.parse.total > 0
			? `${(r.csstree.parse.total / r.wallace.parse.total).toFixed(2)}x`
			: 'N/A',
		'W vs P': r.postcss.parse.total > 0
			? `${(r.postcss.parse.total / r.wallace.parse.total).toFixed(2)}x`
			: 'N/A',
	})),
)

console.log('\n── Parse+Walk memory: heap / external / total ───────────────────────────\n')
console.log('(Walk creates new CSSNode wrappers per node — they show up in heap)\n')

console.table(
	Object.entries(results).map(([name, r]) => ({
		File: name,
		Size: fmt_kb(r.size_bytes),
		'W heap': fmt_kb(r.wallace.parse_walk.heap),
		'W ext': fmt_kb(r.wallace.parse_walk.external),
		'W total': fmt_mb(r.wallace.parse_walk.total),
		'C heap': fmt_kb(r.csstree.parse_walk.heap),
		'C ext': fmt_kb(r.csstree.parse_walk.external),
		'C total': fmt_mb(r.csstree.parse_walk.total),
		'P heap': fmt_kb(r.postcss.parse_walk.heap),
		'P ext': fmt_kb(r.postcss.parse_walk.external),
		'P total': fmt_mb(r.postcss.parse_walk.total),
		'W vs C': r.csstree.parse_walk.total > 0
			? `${(r.csstree.parse_walk.total / r.wallace.parse_walk.total).toFixed(2)}x`
			: 'N/A',
		'W vs P': r.postcss.parse_walk.total > 0
			? `${(r.postcss.parse_walk.total / r.wallace.parse_walk.total).toFixed(2)}x`
			: 'N/A',
	})),
)

console.log('\n── Arena stats (Wallace) ────────────────────────────────────────────────\n')
console.log('(waste% = (capacity - node_count) / capacity — unused pre-allocated slots)\n')

console.table(
	Object.entries(results).map(([name, r]) => {
		const a = r.arena
		return {
			File: name,
			'Nodes used': a.node_count.toLocaleString(),
			'Capacity': a.capacity.toLocaleString(),
			'Growths': a.growth_count,
			'Arena used': fmt_kb(a.used_kb * 1024),
			'Arena total': fmt_kb(a.total_kb * 1024),
			'Waste %': `${a.waste_pct.toFixed(1)}%`,
			// nodes/KB of source = accuracy of NODES_PER_KB heuristic
			'Nodes/KB src': (a.node_count / (r.size_bytes / 1024)).toFixed(0),
		}
	}),
)

// ── Save results ──────────────────────────────────────────────────────────────

const results_path = path.join(__dirname, 'memory-results.json')
const baseline_path = path.join(__dirname, 'memory-baseline.json')

const snapshot_data = {
	timestamp: new Date().toISOString(),
	node_version: process.version,
	results,
}

fs.writeFileSync(results_path, JSON.stringify(snapshot_data, null, 2))
console.log(`\nResults saved → ${results_path}`)

// ── Baseline comparison ───────────────────────────────────────────────────────

if (process.argv.includes('--save-baseline')) {
	fs.writeFileSync(baseline_path, JSON.stringify(snapshot_data, null, 2))
	console.log(`Baseline saved → ${baseline_path}`)
} else if (fs.existsSync(baseline_path)) {
	const baseline = JSON.parse(fs.readFileSync(baseline_path, 'utf-8'))

	console.log('\n── Regression vs baseline ───────────────────────────────────────────────\n')
	console.log(`Baseline: ${baseline.timestamp} (Node ${baseline.node_version})`)
	console.log(`Threshold: >${(REGRESSION_THRESHOLD * 100).toFixed(0)}% increase = REGRESSION\n`)

	const regressions: string[] = []
	const rows: Record<string, string>[] = []

	for (const [file, cur] of Object.entries(results) as [string, FileResult][]) {
		const base = baseline.results[file] as FileResult | undefined
		if (!base) continue

		type Parser = 'wallace' | 'csstree' | 'postcss'
		type Phase = 'parse' | 'parse_walk'

		for (const parser of ['wallace', 'csstree', 'postcss'] as Parser[]) {
			for (const phase of ['parse', 'parse_walk'] as Phase[]) {
				const cur_total = cur[parser][phase].total
				const base_total = base[parser][phase].total
				if (base_total === 0) continue

				const pct_change = (cur_total - base_total) / base_total
				const is_regression = pct_change > REGRESSION_THRESHOLD
				const label = `${file} / ${parser} / ${phase}`

				if (is_regression) regressions.push(label)

				rows.push({
					Label: label,
					Baseline: fmt_mb(base_total),
					Current: fmt_mb(cur_total),
					Delta: fmt_pct(pct_change * 100),
					Status: is_regression ? '❌ REGRESSION' : pct_change < -0.02 ? '✅ improvement' : '  ok',
				})
			}
		}
	}

	console.table(rows)

	if (regressions.length > 0) {
		console.log(`\n❌ ${regressions.length} regression(s) detected:`)
		for (const r of regressions) console.log(`   - ${r}`)
		process.exit(1)
	} else {
		console.log('✅ No regressions detected.')
	}
} else {
	console.log(`\nNo baseline found. Run with --save-baseline on your main branch to enable regression detection.`)
}
