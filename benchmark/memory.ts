// Memory benchmark for CSS parsers
// Run with: node --expose-gc benchmark/memory.js

import { parse, walk } from '../dist/index.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
// @ts-expect-error
import * as csstree from 'css-tree'
import * as postcss from 'postcss'

// Check if GC is available
if (typeof global.gc !== 'function') {
	console.error('Error: This benchmark requires --expose-gc flag')
	console.error('Run with: node --expose-gc benchmark/memory.js')
	process.exit(1)
}

// Load CSS files
const smallCSS = fs.readFileSync(path.resolve('benchmark/small.css'), 'utf-8')
const mediumCSS = fs.readFileSync(path.resolve('benchmark/medium.css'), 'utf-8')
const bootstrapCSS = fs.readFileSync(
	path.resolve('node_modules/bootstrap/dist/css/bootstrap.css'),
	'utf-8',
)
const tailwindCSS = fs.readFileSync(
	path.resolve('node_modules/tailwindcss/dist/tailwind.css'),
	'utf-8',
)

interface MemorySnapshot {
	heapUsed: number
	external: number
	total: number
}

interface MemoryResult {
	fileName: string
	fileSize: number
	baseline: MemorySnapshot
	afterParse: MemorySnapshot
	afterWalk: MemorySnapshot
	afterCleanup: MemorySnapshot
	parseDelta: number
	walkDelta: number
	totalDelta: number
	retainedDelta: number
}

function formatBytes(bytes: number): string {
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function getMemorySnapshot(): MemorySnapshot {
	const mem = process.memoryUsage()
	return {
		heapUsed: mem.heapUsed,
		external: mem.external,
		total: mem.heapUsed + mem.external,
	}
}

function forceGC(rounds = 5): void {
	for (let i = 0; i < rounds; i++) {
		global.gc!()
	}
}

function measureMemory(
	fileName: string,
	cssContent: string,
	parser: 'wallace' | 'csstree' | 'postcss',
): MemoryResult {
	// Force GC and get baseline
	forceGC()
	const baseline = getMemorySnapshot()

	let ast: any = null

	// Parse
	if (parser === 'wallace') {
		ast = parse(cssContent)
	} else if (parser === 'csstree') {
		ast = csstree.parse(cssContent, { positions: true })
	} else if (parser === 'postcss') {
		ast = postcss.parse(cssContent)
	}

	const afterParse = getMemorySnapshot()

	// Walk
	let count = 0
	if (parser === 'wallace') {
		walk(ast, (node) => {
			const type = node.type
			const line = node.line
			count++
		})
	} else if (parser === 'csstree') {
		csstree.walk(ast, (node: any) => {
			const type = node.type
			const line = node.loc?.start.line
			count++
		})
	} else if (parser === 'postcss') {
		ast.walk((node: any) => {
			const type = node.type
			const line = node.source?.start?.line
			count++
		})
	}

	const afterWalk = getMemorySnapshot()

	// Cleanup and measure retained memory
	ast = null
	forceGC()
	const afterCleanup = getMemorySnapshot()

	const parseDelta = afterParse.total - baseline.total
	const walkDelta = afterWalk.total - afterParse.total
	const totalDelta = afterWalk.total - baseline.total
	const retainedDelta = afterCleanup.total - baseline.total

	return {
		fileName,
		fileSize: cssContent.length,
		baseline,
		afterParse,
		afterWalk,
		afterCleanup,
		parseDelta,
		walkDelta,
		totalDelta,
		retainedDelta,
	}
}

function runBenchmark(
	name: string,
	css: string,
	parser: 'wallace' | 'csstree' | 'postcss',
	iterations = 3,
): MemoryResult {
	const results: MemoryResult[] = []

	for (let i = 0; i < iterations; i++) {
		results.push(measureMemory(name, css, parser))
	}

	// Average the results
	const avg: MemoryResult = {
		fileName: name,
		fileSize: results[0].fileSize,
		baseline: results[0].baseline,
		afterParse: results[0].afterParse,
		afterWalk: results[0].afterWalk,
		afterCleanup: results[0].afterCleanup,
		parseDelta: results.reduce((sum, r) => sum + r.parseDelta, 0) / iterations,
		walkDelta: results.reduce((sum, r) => sum + r.walkDelta, 0) / iterations,
		totalDelta: results.reduce((sum, r) => sum + r.totalDelta, 0) / iterations,
		retainedDelta: results.reduce((sum, r) => sum + r.retainedDelta, 0) / iterations,
	}

	return avg
}

console.log('Memory Benchmark for CSS Parsers')
console.log('=================================\n')

const testFiles = [
	{ name: 'small.css', content: smallCSS },
	{ name: 'medium.css', content: mediumCSS },
	{ name: 'bootstrap.css', content: bootstrapCSS },
	{ name: 'tailwind.css', content: tailwindCSS },
]

const parsers: Array<'wallace' | 'csstree' | 'postcss'> = ['wallace', 'csstree', 'postcss']

for (const parser of parsers) {
	console.log(`\n${parser.toUpperCase()} Parser`)
	console.log('-'.repeat(80))

	const results: MemoryResult[] = []

	for (const file of testFiles) {
		const result = runBenchmark(file.name, file.content, parser, 3)
		results.push(result)
	}

	console.table(
		results.map((r) => ({
			File: r.fileName,
			'Size (KB)': (r.fileSize / 1024).toFixed(2),
			'Parse (+MB)': formatBytes(r.parseDelta),
			'Walk (+MB)': formatBytes(r.walkDelta),
			'Total (+MB)': formatBytes(r.totalDelta),
			'Retained (+MB)': formatBytes(r.retainedDelta),
			'Memory Efficiency': `${((r.fileSize / r.totalDelta) * 100).toFixed(1)}%`,
		})),
	)
}

// Comparison table
console.log('\n\nCOMPARISON: Parse + Walk Memory Usage')
console.log('-'.repeat(80))

const comparisonResults: { [key: string]: { [parser: string]: number } } = {}

for (const file of testFiles) {
	comparisonResults[file.name] = {}
	for (const parser of parsers) {
		const result = runBenchmark(file.name, file.content, parser, 3)
		comparisonResults[file.name][parser] = result.totalDelta
	}
}

const comparisonTable = testFiles.map((file) => {
	const wallace = comparisonResults[file.name]['wallace']
	const tree = comparisonResults[file.name]['csstree']
	const post = comparisonResults[file.name]['postcss']

	return {
		File: file.name,
		'Size (KB)': (file.content.length / 1024).toFixed(2),
		'Wallace (MB)': formatBytes(wallace),
		'CSSTree (MB)': formatBytes(tree),
		'PostCSS (MB)': formatBytes(post),
		'Wallace vs CSSTree': `${((wallace / tree) * 100).toFixed(1)}%`,
		'Wallace vs PostCSS': `${((wallace / post) * 100).toFixed(1)}%`,
	}
})

console.table(comparisonTable)

console.log('\n\nUNDERSTANDING THE METRICS')
console.log('-'.repeat(80))
console.log('\n📊 Memory Measurements Explained:\n')

console.log('Parse (+MB):')
console.log('  Memory consumed during parsing (creating the AST)')
console.log('  Lower is better - indicates efficient AST representation\n')

console.log('Walk (+MB):')
console.log('  Additional memory used during AST traversal')
console.log('  Can be negative if GC runs during walking\n')

console.log('Total (+MB):')
console.log('  Peak memory usage = Parse + Walk')
console.log('  Total memory overhead for parse + walk operation\n')

console.log('Retained (+MB): ⚠️  IMPORTANT METRIC')
console.log('  Memory that remains allocated AFTER clearing references and forcing GC')
console.log('  This represents memory leaks or objects kept alive by closures/caches')
console.log('  ')
console.log('  What it means:')
console.log('    • Close to 0 MB:     Excellent - minimal retention, GC cleaned up everything')
console.log('    • Low (< 5% of Total): Good - some minor caching or retained references')
console.log('    • High (> 20% of Total): Concerning - potential memory leaks or large caches')
console.log('  ')
console.log('  Why it matters:')
console.log('    • In long-running processes (servers, build tools, linters), retained memory')
console.log('      accumulates over time if not properly released')
console.log('    • Low retained memory means the parser can be used repeatedly without')
console.log('      gradually consuming all available memory\n')

console.log('Memory Efficiency:')
console.log('  Ratio of input file size to memory consumed')
console.log('  Higher percentage = more efficient (closer to file size)\n')

console.log('Wallace vs X:')
console.log('  Percentage of memory used compared to competitor')
console.log('  Lower is better (e.g., 47.3% = Wallace uses less than half the memory)\n')

console.log('-'.repeat(80))
console.log('\n✅ Key Takeaways:')
console.log('  • Wallace\'s arena-based design minimizes allocations during parsing')
console.log('  • Lower "Total" memory means faster parsing (better cache locality)')
console.log('  • Lower "Retained" memory means safer for long-running applications')
console.log('  • All parsers can be garbage collected when done (references cleared)')
console.log('')
