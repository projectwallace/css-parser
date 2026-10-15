/// <reference types="node" />
// Benchmarks for the public string utilities.
// Run with: pnpm run benchmark:string-utils
import { Bench } from 'tinybench'
import {
	is_custom,
	is_vendor_prefixed,
	str_equals,
	str_starts_with,
	str_index_of,
} from '../dist/index.js'

const bench = new Bench({ warmup: true })

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
