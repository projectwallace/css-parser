/// <reference types="node" />
// Benchmarks for the tokenizer, parsers and walkers (this package only).
// Run with: pnpm run benchmark:parsing
import { Bench } from 'tinybench'
import {
	parse,
	parse_selector,
	parse_selector_list,
	parse_atrule_prelude,
	parse_declaration,
	parse_value,
	parse_dimension,
	tokenize,
	walk,
	traverse,
} from '../dist/index.js'
import * as fs from 'node:fs'
import * as path from 'node:path'

const css = fs.readFileSync(path.resolve('benchmark/nerdy-dev.css'), 'utf-8')
const ast = parse(css)

const bench = new Bench({ warmup: true })

// ─── Tokenizer & parser ────────────────────────────────────────────────────

bench.add('tokenize', () => {
	for (const _token of tokenize(css)) {
		// iterate
	}
})

bench.add('parse', () => {
	parse(css)
})

bench.add('parse (no sub-parsing)', () => {
	parse(css, { parse_selectors: false, parse_values: false, parse_atrule_preludes: false })
})

// ─── Sub-parsers ───────────────────────────────────────────────────────────

bench.add('parse_selector', () => {
	parse_selector('a.link:not(.disabled):hover > span[data-x="1"]::before')
})

bench.add('parse_selector_list', () => {
	parse_selector_list('h1, h2.title, .a > .b ~ .c + .d, :is(ul, ol) li:nth-child(2n + 1)')
})

bench.add('parse_atrule_prelude (media)', () => {
	parse_atrule_prelude('media', '(min-width: 640px) and (max-width: 1024px)')
})

bench.add('parse_atrule_prelude (supports)', () => {
	parse_atrule_prelude('supports', '(display: grid) and (not (display: inline-grid))')
})

bench.add('parse_declaration', () => {
	parse_declaration('background: linear-gradient(to right, #fff 0%, rgb(0 0 0 / 50%) 100%)')
})

bench.add('parse_value', () => {
	parse_value('calc(100% - var(--gap, 1rem) * 2) 10px 1.5em')
})

bench.add('parse_dimension', () => {
	parse_dimension('-12.5px')
})

// ─── Walking ───────────────────────────────────────────────────────────────

bench.add('walk', () => {
	walk(ast, (node) => {
		void node.type
	})
})

bench.add('traverse', () => {
	traverse(ast, {
		enter(node) {
			void node.type
		},
		leave(node) {
			void node.type
		},
	})
})

await bench.run()

console.table(
	bench.tasks.map((task) => {
		const result = task.result
		const stats = result && 'latency' in result ? result : null
		return {
			Benchmark: task.name,
			'ops/sec': stats ? stats.throughput.mean.toFixed(0) : 'N/A',
			'avg (µs)': stats ? (stats.latency.mean * 1000).toFixed(3) : 'N/A',
		}
	}),
)
