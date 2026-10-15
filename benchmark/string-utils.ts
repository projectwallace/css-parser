/// <reference types="node" />
// Benchmarks for the public string utilities.
// Run with: pnpm run benchmark:string-utils
import { Bench } from 'tinybench'
import { report } from './report.ts'
import {
	is_custom,
	is_vendor_prefixed,
	str_equals,
	str_starts_with,
	str_index_of,
} from '../dist/index.js'

const bench = new Bench({ warmup: true, retainSamples: true })

// ─── String utils ──────────────────────────────────────────────────────────

bench.add('is_custom', () => {
	is_custom('--my-property')
	is_custom('color')
})

bench.add('is_vendor_prefixed', () => {
	is_vendor_prefixed('-webkit-transition')
	is_vendor_prefixed('transition')
	is_vendor_prefixed('xx-webkit-transition', 2, 20)
})

bench.add('str_equals', () => {
	str_equals('DISPLAY', 'display')
	str_equals('display', 'color')
})

bench.add('str_starts_with', () => {
	str_starts_with('-webkit-transition', '-webkit-')
	str_starts_with('transition', '-webkit-')
})

bench.add('str_index_of', () => {
	str_index_of('translate(10px, 20px)', '(')
	str_index_of('color', '(')
})

await bench.run()

report(bench)
