// Test to understand V8 GC behavior with different patterns
import { parse, walk } from '../dist/index.js'
import * as postcss from 'postcss'
import * as fs from 'node:fs'

if (typeof global.gc !== 'function') {
	console.error('Run with: node --expose-gc benchmark/gc-test.ts')
	process.exit(1)
}

const css = fs.readFileSync('node_modules/bootstrap/dist/css/bootstrap.css', 'utf-8')

function forceGC() {
	for (let i = 0; i < 5; i++) {
		global.gc!()
	}
}

function getHeap() {
	return (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
}

console.log('\n=== Testing Pattern 1: Function call + Walk (Wallace with parse()) ===')
forceGC()
const baseline1 = getHeap()
console.log('Baseline:', baseline1, 'MB')

let ast1 = parse(css) // Function call, similar to PostCSS
console.log('After parse:', getHeap(), 'MB')

let count1 = 0
walk(ast1, (node) => {
	const type = node.type
	const line = node.line
	count1++
})
console.log('After walk (' + count1 + ' nodes):', getHeap(), 'MB')

ast1 = null as any
forceGC()
const retained1 = getHeap()
console.log('After cleanup:', retained1, 'MB')
console.log('>>> Retained:', (parseFloat(retained1) - parseFloat(baseline1)).toFixed(2), 'MB')

console.log('\n=== Testing Pattern 2: Function call + Walk (alternative test) ===')
forceGC()
const baseline2 = getHeap()
console.log('Baseline:', baseline2, 'MB')

let ast2 = parse(css)
console.log('After parse:', getHeap(), 'MB')

let count2 = 0
walk(ast2, (node) => {
	const type = node.type
	const line = node.line
	count2++
})
console.log('After walk (' + count2 + ' nodes):', getHeap(), 'MB')

ast2 = null as any
forceGC()
const retained2 = getHeap()
console.log('After cleanup:', retained2, 'MB')
console.log('>>> Retained:', (parseFloat(retained2) - parseFloat(baseline2)).toFixed(2), 'MB')

console.log('\n=== Testing Pattern 3: PostCSS function + Walk ===')
forceGC()
const baseline3 = getHeap()
console.log('Baseline:', baseline3, 'MB')

let ast3 = postcss.parse(css) // Function call, parser created internally
console.log('After parse:', getHeap(), 'MB')

let count3 = 0
ast3.walk((node: any) => {
	const type = node.type
	const line = node.source?.start?.line
	count3++
})
console.log('After walk (' + count3 + ' nodes):', getHeap(), 'MB')

ast3 = null as any
forceGC()
const retained3 = getHeap()
console.log('After cleanup:', retained3, 'MB')
console.log('>>> Retained:', (parseFloat(retained3) - parseFloat(baseline3)).toFixed(2), 'MB')

console.log('\n=== Summary (Single Iteration) ===')
console.log('Pattern 1 retained:', (parseFloat(retained1) - parseFloat(baseline1)).toFixed(2), 'MB')
console.log('Pattern 2 retained:', (parseFloat(retained2) - parseFloat(baseline2)).toFixed(2), 'MB')
console.log('Pattern 3 retained:', (parseFloat(retained3) - parseFloat(baseline3)).toFixed(2), 'MB')

console.log('\n=== Testing Multiple Iterations (like benchmark) ===')

function runIterations(name: string, fn: () => void, iterations = 3) {
	const results: number[] = []

	for (let i = 0; i < iterations; i++) {
		forceGC()
		const before = parseFloat(getHeap())
		fn()
		forceGC()
		const after = parseFloat(getHeap())
		results.push(after - before)
	}

	const avg = results.reduce((a, b) => a + b, 0) / iterations
	console.log(`${name}: ${results.map(r => r.toFixed(2)).join(', ')} MB -> Avg: ${avg.toFixed(2)} MB`)
	return avg
}

const pattern1Avg = runIterations('Pattern 1 (Wallace parse())', () => {
	let ast = parse(css)
	let count = 0
	walk(ast, (node) => { count++ })
	ast = null as any
})

const pattern2Avg = runIterations('Pattern 2 (Wallace parse() repeat)', () => {
	let ast = parse(css)
	let count = 0
	walk(ast, (node) => { count++ })
	ast = null as any
})

const pattern3Avg = runIterations('Pattern 3 (PostCSS)', () => {
	let ast = postcss.parse(css)
	let count = 0
	ast.walk((node: any) => { count++ })
	ast = null as any
})

console.log('\nWallace vs PostCSS:', (pattern1Avg - pattern3Avg).toFixed(2), 'MB difference (negative = Wallace uses less)')
