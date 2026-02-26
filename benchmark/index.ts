// oxlint-disable no-unused-vars
import { Bench } from 'tinybench'
import { parse, tokenize, walk } from '../dist/index.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
// @ts-expect-error
import * as csstree from 'css-tree'
import * as postcss from 'postcss'

// Sample CSS for benchmarking - realistic production-like CSS
const largeCSS = fs.readFileSync(path.resolve('benchmark/medium.css'), 'utf-8')
const bootstrapCSS = fs.readFileSync(path.resolve('node_modules/bootstrap/dist/css/bootstrap.css'), 'utf-8')
const tailwindCSS = fs.readFileSync(path.resolve('node_modules/tailwindcss/dist/tailwind.css'), 'utf-8')

const bench = new Bench({ time: 1000 })

// Tokenizer benchmarks
bench
	.add('Tokenizer - Large CSS', () => {
		for (const _token of tokenize(largeCSS)) {
			// Just iterate
		}
	})
	.add('Tokenizer - Bootstrap CSS', () => {
		for (const _token of tokenize(bootstrapCSS)) {
			// Just iterate
		}
	})
	.add('Tokenizer - Tailwind CSS', () => {
		for (const _token of tokenize(tailwindCSS)) {
			// Just iterate
		}
	})

// Parser benchmarks
bench
	.add('Parser - Large CSS', () => {
		parse(largeCSS)
	})
	.add('Parser - Bootstrap CSS', () => {
		parse(bootstrapCSS)
	})
	.add('Parser - Tailwind CSS', () => {
		parse(tailwindCSS)
	})

bench
	.add('Parse/walk - Wallace - Bootstrap CSS', () => {
		let ast = parse(bootstrapCSS)
		let count = 0
		walk(ast, (node, _depth) => {
			let type = node.type
			let line = node.line
			count++
		})
	})
	.add('Parse/walk - CSSTree - Bootstrap CSS', () => {
		let ast = csstree.parse(bootstrapCSS, { positions: true })
		let count = 0
		// @ts-expect-error
		csstree.walk(ast, (node) => {
			let type = node.type
			let line = node.loc?.start.line
			count++
		})
	})
	.add('Parse/walk - PostCSS - Bootstrap CSS', () => {
		let root = postcss.parse(bootstrapCSS)
		let count = 0
		root.walk((node) => {
			let type = node.type
			let line = node.source?.start?.line
			count++
		})
	})

bench
	.add('Parse/walk - Wallace - Tailwind CSS', () => {
		let ast = parse(tailwindCSS)
		let count = 0
		walk(ast, (node, _depth) => {
			let type = node.type
			let line = node.line
			count++
		})
	})
	.add('Parse/walk - CSSTree - Tailwind CSS', () => {
		let ast = csstree.parse(tailwindCSS, { positions: true })
		let count = 0
		// @ts-expect-error
		csstree.walk(ast, (node) => {
			let type = node.type
			let line = node.loc?.start.line
			count++
		})
	})
	.add('Parse/walk - PostCSS - Tailwind CSS', () => {
		let root = postcss.parse(tailwindCSS)
		let count = 0
		root.walk((node) => {
			let type = node.type
			let line = node.source?.start?.line
			count++
		})
	})

// Run benchmarks
await bench.warmup()
await bench.run()

// File sizes
const fileSizes = {
	large: largeCSS.length,
	bootstrap: bootstrapCSS.length,
	tailwind: tailwindCSS.length,
}

function getFileSize(taskName: string): string {
	const name = taskName.toLowerCase()
	if (name.includes('bootstrap')) {
		return `${(fileSizes.bootstrap / 1024).toFixed(2)} KB`
	} else if (name.includes('large')) {
		return `${(fileSizes.large / 1024).toFixed(2)} KB`
	} else if (name.includes('tailwind')) {
		return `${(fileSizes.tailwind / 1024).toFixed(2)} KB`
	}
	return 'N/A'
}

// Display results
console.table(
	bench.tasks.map(({ name, result }) => ({
		'Task Name': name,
		'File Size': getFileSize(name),
		'ops/sec': result?.hz?.toFixed(0) ?? 'N/A',
		'Average Time (ms)': result?.mean ? (result.mean * 1000).toFixed(4) : 'N/A',
		Margin: result?.rme ? `±${result.rme.toFixed(2)}%` : 'N/A',
	})),
)
