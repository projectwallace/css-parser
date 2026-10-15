import type { Bench } from 'tinybench'

// Most common latency (ms): the centre of the fullest histogram bin.
// Outliers above p99 are ignored so GC pauses don't stretch the bins.
function mode_latency(samples: ArrayLike<number>, p99: number, bins = 50): number {
	const min = samples[0]!
	const width = (p99 - min) / bins
	if (!(width > 0)) return min
	const counts = Array.from({ length: bins }, () => 0)
	for (let i = 0; i < samples.length; i++) {
		const s = samples[i]!
		if (s > p99) break // samples are sorted
		counts[Math.min(bins - 1, Math.floor((s - min) / width))]!++
	}
	return min + (counts.indexOf(Math.max(...counts)) + 0.5) * width
}

// `batch` is the number of real operations folded into each measured cycle
// (see benchmark/string-utils.ts) - divide out latency, multiply out throughput.
export function report(bench: Bench, batch = 1): void {
	console.table(
		bench.tasks.map((task) => {
			const result = task.result
			const stats = result && 'latency' in result ? result : null
			if (!stats?.latency.samples) {
				return {
					Benchmark: task.name,
					'mode (ops/sec)': 'N/A',
					'mode (µs)': 'N/A',
					'mean (ops/sec)': 'N/A',
				}
			}
			const mode = mode_latency(stats.latency.samples, stats.latency.p99) / batch
			return {
				Benchmark: task.name,
				'mode (ops/sec)': (1000 / mode).toFixed(0),
				'mode (µs)': (mode * 1000).toFixed(3),
				'mean (ops/sec)': (stats.throughput.mean * batch).toFixed(0),
			}
		}),
	)
}
