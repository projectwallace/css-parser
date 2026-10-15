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
import { report } from './report.ts'
import * as fs from 'node:fs'
import * as path from 'node:path'

const files = {
	'Nerdy.dev': 'nerdy-dev.css',
	'CSS Tricks': 'css-tricks.css',
	Bootstrap: 'bootstrap.min.css',
	Tailwind: 'tailwind.min.css',
}

const bench = new Bench({ warmup: true, retainSamples: true })

// ─── Tokenizer & parser ────────────────────────────────────────────────────

for (const [name, file] of Object.entries(files)) {
	const css = fs.readFileSync(path.resolve('benchmark', file), 'utf-8')

	bench.add(`tokenize|${name}`, () => {
		for (const _token of tokenize(css)) {
			// iterate
		}
	})

	bench.add(`parse|${name}`, () => {
		parse(css)
	})

	bench.add(`parse (no sub-parsing)|${name}`, () => {
		parse(css, { parse_selectors: false, parse_values: false, parse_atrule_preludes: false })
	})
}

// ─── Sub-parsers ───────────────────────────────────────────────────────────

bench.add('parse_selector (simple)', () => {
	parse_selector('.link')
})

bench.add('parse_selector (complex)', () => {
	parse_selector('a.link:not(.disabled):hover > span[data-x="1"]::before')
})

bench.add('parse_selector_list (simple)', () => {
	parse_selector_list('h1, h2, .a, #b')
})

bench.add('parse_selector_list (complex)', () => {
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

for (const [name, file] of Object.entries(files)) {
	// Parse once up front so parse time doesn't pollute the walk timings
	const ast = parse(fs.readFileSync(path.resolve('benchmark', file), 'utf-8'))

	bench.add(`walk (node.type)|${name}`, () => {
		walk(ast, (node) => {
			void node.type
		})
	})

	bench.add(`walk (node.type_name)|${name}`, () => {
		walk(ast, (node) => {
			void node.type_name
		})
	})

	bench.add(`traverse|${name}`, () => {
		traverse(ast, {
			enter(node) {
				void node.type
			},
			leave(node) {
				void node.type
			},
		})
	})
}

await bench.run()

report(bench)
