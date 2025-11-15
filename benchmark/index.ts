// oxlint-disable no-unused-vars
import { Bench } from 'tinybench'
import { Lexer, Parser, walk } from '../dist/index.js'
import * as fs from 'node:fs'
import * as path from 'node:path'

// Sample CSS for benchmarking - realistic production-like CSS
const smallCSS = `
@media (min-width: 768px) {
  .container {
    max-width: 750px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
  }

  .nav-item {
    display: inline-block;
    margin: 0 1rem;
  }

  .nav-item a {
    color: #333;
    text-decoration: none;
    transition: color 0.3s ease;
  }

  .nav-item a:hover {
    color: #007bff;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  animation: fadeIn 0.3s ease-in-out;
}
`

const largeCSS = `
/* Reset and base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --success-color: #28a745;
  --danger-color: #dc3545;
  --warning-color: #ffc107;
  --info-color: #17a2b8;
  --light-color: #f8f9fa;
  --dark-color: #343a40;
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

body {
  font-family: var(--font-family);
  line-height: 1.6;
  color: var(--dark-color);
  background-color: var(--light-color);
}

@media (min-width: 576px) {
  .container {
    max-width: 540px;
  }
}

@media (min-width: 768px) {
  .container {
    max-width: 720px;
  }
}

@media (min-width: 992px) {
  .container {
    max-width: 960px;
  }
}

@media (min-width: 1200px) {
  .container {
    max-width: 1140px;
  }
}

.btn {
  display: inline-block;
  font-weight: 400;
  text-align: center;
  white-space: nowrap;
  vertical-align: middle;
  user-select: none;
  border: 1px solid transparent;
  padding: 0.375rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  border-radius: 0.25rem;
  transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.btn-primary {
  color: #fff;
  background-color: var(--primary-color);
  border-color: var(--primary-color);
}

.btn-primary:hover {
  background-color: #0056b3;
  border-color: #004085;
}

.btn-secondary {
  color: #fff;
  background-color: var(--secondary-color);
  border-color: var(--secondary-color);
}

.btn-secondary:hover {
  background-color: #545b62;
  border-color: #4e555b;
}

@supports (display: grid) {
  .grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }
}

@layer base, components, utilities;

@layer base {
  h1, h2, h3, h4, h5, h6 {
    margin-bottom: 0.5rem;
    font-weight: 500;
    line-height: 1.2;
  }

  h1 { font-size: 2.5rem; }
  h2 { font-size: 2rem; }
  h3 { font-size: 1.75rem; }
  h4 { font-size: 1.5rem; }
  h5 { font-size: 1.25rem; }
  h6 { font-size: 1rem; }
}

@layer components {
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    word-wrap: break-word;
    background-color: #fff;
    background-clip: border-box;
    border: 1px solid rgba(0, 0, 0, 0.125);
    border-radius: 0.25rem;
  }

  .card-body {
    flex: 1 1 auto;
    padding: 1.25rem;
  }
}

.alert {
  position: relative;
  padding: 0.75rem 1.25rem;
  margin-bottom: 1rem;
  border: 1px solid transparent;
  border-radius: 0.25rem;
}

.alert-success {
  color: #155724;
  background-color: #d4edda;
  border-color: #c3e6cb;
}

.alert-danger {
  color: #721c24;
  background-color: #f8d7da;
  border-color: #f5c6cb;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.spinner {
  animation: spin 1s linear infinite;
}

.pulsing {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
`

const bootstrapCSS = fs.readFileSync(path.resolve('node_modules/bootstrap/dist/css/bootstrap.css'), 'utf-8')
const tailwindCSS = fs.readFileSync(path.resolve('node_modules/tailwindcss/dist/tailwind.css'), 'utf-8')

const bench = new Bench({ time: 1000 })

// Lexer benchmarks
bench
	.add('Lexer - small CSS', () => {
		const lexer = new Lexer(smallCSS)
		let token = lexer.next_token()
		while (token && token.type !== 26 /* TOKEN_EOF */) {
			token = lexer.next_token()
		}
	})
	.add('Lexer - Large CSS', () => {
		const lexer = new Lexer(largeCSS)
		let token = lexer.next_token()
		while (token && token.type !== 26 /* TOKEN_EOF */) {
			token = lexer.next_token()
		}
	})
	.add('Lexer - Bootstrap CSS', () => {
		const lexer = new Lexer(bootstrapCSS)
		let token = lexer.next_token()
		while (token && token.type !== 26 /* TOKEN_EOF */) {
			token = lexer.next_token()
		}
	})
	.add('Lexer - Tailwind CSS', () => {
		const lexer = new Lexer(tailwindCSS)
		let token = lexer.next_token()
		while (token && token.type !== 26 /* TOKEN_EOF */) {
			token = lexer.next_token()
		}
	})

// Parser benchmarks
bench
	.add('Parser - Small CSS', () => {
		const parser = new Parser(smallCSS)
		parser.parse()
	})
	.add('Parser - Large CSS', () => {
		const parser = new Parser(largeCSS)
		parser.parse()
	})
	.add('Parser - Bootstrap CSS', () => {
		const parser = new Parser(bootstrapCSS)
		parser.parse()
	})
	.add('Parser - Tailwind CSS', () => {
		const parser = new Parser(tailwindCSS)
		parser.parse()
	})

// Walker benchmarks
const smallAST = new Parser(smallCSS).parse()
const largeAST = new Parser(largeCSS).parse()
const bootstrapAST = new Parser(bootstrapCSS).parse()
const tailwindAST = new Parser(tailwindCSS).parse()

bench
	.add('Walker - Small CSS', () => {
		let count = 0
		walk(smallAST, () => {
			count++
		})
	})
	.add('Walker - Large CSS', () => {
		let count = 0
		walk(largeAST, () => {
			count++
		})
	})
	.add('Walker - Bootstrap CSS', () => {
		let count = 0
		walk(bootstrapAST, () => {
			count++
		})
	})
	.add('Walker - Tailwind CSS', () => {
		let count = 0
		walk(tailwindAST, () => {
			count++
		})
	})

// Run benchmarks
await bench.warmup()
await bench.run()

// File sizes
const fileSizes = {
	small: smallCSS.length,
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
	} else if (name.includes('small')) {
		return `${(fileSizes.small / 1024).toFixed(2)} KB`
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
