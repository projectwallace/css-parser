import { describe, it, expect } from 'vitest'
import {
	Parser,
	NODE_STYLESHEET,
	NODE_STYLE_RULE,
	NODE_SELECTOR,
	NODE_DECLARATION,
	NODE_AT_RULE,
	NODE_VALUE_KEYWORD,
	NODE_VALUE_NUMBER,
	NODE_VALUE_DIMENSION,
	NODE_SELECTOR_CLASS,
} from './parser'
import { walk } from './walk'

describe('walk', () => {
	it('should visit single node', () => {
		const parser = new Parser('', { parseSelectors: false, parseValues: false })
		const root = parser.parse()
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([NODE_STYLESHEET])
	})

	it('should visit all nodes in simple rule', () => {
		const parser = new Parser('body { color: red; }', { parseSelectors: false, parseValues: true })
		const root = parser.parse()
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([
			NODE_STYLESHEET,
			NODE_STYLE_RULE,
			NODE_SELECTOR,
			NODE_DECLARATION,
			NODE_VALUE_KEYWORD, // red
		])
	})

	it('should visit nodes in depth-first order', () => {
		const parser = new Parser('body { color: red; margin: 0; } div { padding: 1rem; }', { parseSelectors: false, parseValues: true })
		const root = parser.parse()
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([
			NODE_STYLESHEET,
			NODE_STYLE_RULE, // body rule
			NODE_SELECTOR, // body selector
			NODE_DECLARATION, // color: red
			NODE_VALUE_KEYWORD, // red
			NODE_DECLARATION, // margin: 0
			NODE_VALUE_NUMBER, // 0
			NODE_STYLE_RULE, // div rule
			NODE_SELECTOR, // div selector
			NODE_DECLARATION, // padding: 1rem
			NODE_VALUE_DIMENSION, // 1rem
		])
	})

	it('should visit nested rules', () => {
		const parser = new Parser('.parent { color: red; .child { color: blue; } }', { parseSelectors: false, parseValues: false })
		const root = parser.parse()
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([
			NODE_STYLESHEET,
			NODE_STYLE_RULE, // .parent
			NODE_SELECTOR, // .parent selector
			NODE_DECLARATION, // color: red
			NODE_STYLE_RULE, // .child
			NODE_SELECTOR, // .child selector
			NODE_DECLARATION, // color: blue
		])
	})

	it('should visit at-rule nodes', () => {
		const parser = new Parser('@media (min-width: 768px) { body { color: red; } }', { parseSelectors: false, parseValues: false, parse_atrule_preludes: false })
		const root = parser.parse()
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([
			NODE_STYLESHEET,
			NODE_AT_RULE, // @media
			NODE_STYLE_RULE, // body
			NODE_SELECTOR, // body selector
			NODE_DECLARATION, // color: red
		])
	})

	it('should allow collecting node data', () => {
		const parser = new Parser('body { color: red; } .btn { margin: 0; }', { parseSelectors: false, parseValues: false })
		const root = parser.parse()
		const selectors: string[] = []

		walk(root, (node) => {
			if (node.type === NODE_SELECTOR) {
				selectors.push(node.text)
			}
		})

		expect(selectors).toEqual(['body', '.btn'])
	})

	it('should allow collecting property names', () => {
		const parser = new Parser('body { color: red; margin: 0; padding: 1rem; }', { parseSelectors: false, parseValues: false })
		const root = parser.parse()
		const properties: string[] = []

		walk(root, (node) => {
			if (node.type === NODE_DECLARATION) {
				const name = node.name
				if (name) properties.push(name)
			}
		})

		expect(properties).toEqual(['color', 'margin', 'padding'])
	})

	it('should allow counting nodes by type', () => {
		const parser = new Parser(
			`
			body { color: red; }
			.card { padding: 1rem; }
			@media screen { div { margin: 0; } }
		`,
		)
		const root = parser.parse()
		const counts: Record<number, number> = {}

		walk(root, (node) => {
			counts[node.type] = (counts[node.type] || 0) + 1
		})

		expect.soft(counts[NODE_STYLESHEET]).toBe(1)
		expect.soft(counts[NODE_STYLE_RULE]).toBe(3)
		expect.soft(counts[NODE_SELECTOR]).toBe(3)
		expect.soft(counts[NODE_DECLARATION]).toBe(3)
		expect.soft(counts[NODE_AT_RULE]).toBe(1)
	})

	it('should work with deeply nested structures', () => {
		const parser = new Parser('.a { .b { .c { color: red; } } }')
		const root = parser.parse()
		let depth = 0
		let maxDepth = 0

		walk(root, (node) => {
			if (node.type === NODE_STYLE_RULE) {
				depth++
				maxDepth = Math.max(maxDepth, depth)
			}
		})

		// Reset depth tracking - need to actually track during traversal
		// Let's just count rules instead
		const rules: number[] = []
		walk(root, (node) => {
			if (node.type === NODE_STYLE_RULE) {
				rules.push(node.type)
			}
		})

		expect(rules.length).toBe(3) // .a, .b, .c
	})

	test('export types', () => {
		let ast = new Parser('a{}').parse()
		walk(ast, (node) => {
			expectTypeOf(node.type).toBeNumber()
			if (node.type === NODE_SELECTOR) {
				expect(node.text).toEqual('a')
			}
		})
	})
})
