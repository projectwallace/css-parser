import { describe, it, expect } from 'vitest'
import {
	Parser,
	NODE_STYLESHEET,
	NODE_STYLE_RULE,
	NODE_SELECTOR_LIST,
	NODE_DECLARATION,
	NODE_AT_RULE,
	NODE_BLOCK,
	NODE_VALUE_KEYWORD,
	NODE_VALUE_NUMBER,
	NODE_VALUE_DIMENSION,
} from './parse'
import { walk, traverse } from './walk'

describe('walk', () => {
	it('should visit single node', () => {
		const parser = new Parser('', { parse_selectors: false, parse_values: false })
		const root = parser.parse()
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([NODE_STYLESHEET])
	})

	it('should visit all nodes in simple rule', () => {
		const parser = new Parser('body { color: red; }', { parse_selectors: false, parse_values: true })
		const root = parser.parse()
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([
			NODE_STYLESHEET,
			NODE_STYLE_RULE,
			NODE_SELECTOR_LIST,
			NODE_BLOCK,
			NODE_DECLARATION,
			NODE_VALUE_KEYWORD, // red
		])
	})

	it('should visit nodes in depth-first order', () => {
		const parser = new Parser('body { color: red; margin: 0; } div { padding: 1rem; }', { parse_selectors: false, parse_values: true })
		const root = parser.parse()
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([
			NODE_STYLESHEET,
			NODE_STYLE_RULE, // body rule
			NODE_SELECTOR_LIST, // body selector
			NODE_BLOCK, // body block
			NODE_DECLARATION, // color: red
			NODE_VALUE_KEYWORD, // red
			NODE_DECLARATION, // margin: 0
			NODE_VALUE_NUMBER, // 0
			NODE_STYLE_RULE, // div rule
			NODE_SELECTOR_LIST, // div selector
			NODE_BLOCK, // div block
			NODE_DECLARATION, // padding: 1rem
			NODE_VALUE_DIMENSION, // 1rem
		])
	})

	it('should visit nested rules', () => {
		const parser = new Parser('.parent { color: red; .child { color: blue; } }', { parse_selectors: false, parse_values: false })
		const root = parser.parse()
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([
			NODE_STYLESHEET,
			NODE_STYLE_RULE, // .parent
			NODE_SELECTOR_LIST, // .parent selector
			NODE_BLOCK, // .parent block
			NODE_DECLARATION, // color: red
			NODE_STYLE_RULE, // .child (nested inside parent's block)
			NODE_SELECTOR_LIST, // .child selector
			NODE_BLOCK, // .child block
			NODE_DECLARATION, // color: blue
		])
	})

	it('should visit at-rule nodes', () => {
		const parser = new Parser('@media (min-width: 768px) { body { color: red; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const root = parser.parse()
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([
			NODE_STYLESHEET,
			NODE_AT_RULE, // @media
			NODE_BLOCK, // @media block
			NODE_STYLE_RULE, // body
			NODE_SELECTOR_LIST, // body selector
			NODE_BLOCK, // body block
			NODE_DECLARATION, // color: red
		])
	})

	it('should allow collecting node data', () => {
		const parser = new Parser('body { color: red; } .btn { margin: 0; }', { parse_selectors: false, parse_values: false })
		const root = parser.parse()
		const selectors: string[] = []

		walk(root, (node) => {
			if (node.type === NODE_SELECTOR_LIST) {
				selectors.push(node.text)
			}
		})

		expect(selectors).toEqual(['body', '.btn'])
	})

	it('should allow collecting property names', () => {
		const parser = new Parser('body { color: red; margin: 0; padding: 1rem; }', { parse_selectors: false, parse_values: false })
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
		expect.soft(counts[NODE_SELECTOR_LIST]).toBe(3)
		expect.soft(counts[NODE_DECLARATION]).toBe(3)
		expect.soft(counts[NODE_AT_RULE]).toBe(1)
	})

	it('should work with deeply nested structures', () => {
		const parser = new Parser('.a { .b { .c { color: red; } } }')
		const root = parser.parse()
		const rules: number[] = []

		walk(root, (node) => {
			if (node.type === NODE_STYLE_RULE) {
				rules.push(node.type)
			}
		})

		expect(rules.length).toBe(3) // .a, .b, .c
	})

	it('should track depth correctly', () => {
		const parser = new Parser('body { color: red; }', { parse_selectors: false, parse_values: true })
		const root = parser.parse()
		const depths: number[] = []

		walk(root, (_node, depth) => {
			depths.push(depth)
		})

		// NODE_STYLESHEET (0), NODE_STYLE_RULE (1), NODE_SELECTOR_LIST (2), NODE_BLOCK (2), NODE_DECLARATION (3), NODE_VALUE_KEYWORD (4)
		expect(depths).toEqual([0, 1, 2, 2, 3, 4])
	})

	it('should track depth in nested structures', () => {
		const parser = new Parser('.a { .b { .c { color: red; } } }', { parse_selectors: false, parse_values: true })
		const root = parser.parse()
		const ruleDepths: number[] = []

		walk(root, (node, depth) => {
			if (node.type === NODE_STYLE_RULE) {
				ruleDepths.push(depth)
			}
		})

		expect(ruleDepths).toEqual([1, 3, 5]) // .a at depth 1, .b at depth 3 (inside .a's block), .c at depth 5 (inside .b's block)
	})

	it('should track depth with at-rules', () => {
		const parser = new Parser('@media screen { body { color: red; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const root = parser.parse()
		const typeAndDepth: Array<{ type: number; depth: number }> = []

		walk(root, (node, depth) => {
			typeAndDepth.push({ type: node.type, depth })
		})

		expect(typeAndDepth).toEqual([
			{ type: NODE_STYLESHEET, depth: 0 },
			{ type: NODE_AT_RULE, depth: 1 }, // @media
			{ type: NODE_BLOCK, depth: 2 }, // @media block
			{ type: NODE_STYLE_RULE, depth: 3 }, // body
			{ type: NODE_SELECTOR_LIST, depth: 4 }, // body selector
			{ type: NODE_BLOCK, depth: 4 }, // body block
			{ type: NODE_DECLARATION, depth: 5 }, // color: red
		])
	})

	it('should track depth with consecutive at-rules', () => {
		const parser = new Parser('@media screen { body { color: red; } } @layer { a { color: red; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const root = parser.parse()
		const typeAndDepth: Array<{ type: number; depth: number }> = []

		walk(root, (node, depth) => {
			typeAndDepth.push({ type: node.type, depth })
		})

		expect(typeAndDepth).toEqual([
			{ type: NODE_STYLESHEET, depth: 0 },
			{ type: NODE_AT_RULE, depth: 1 }, // @media
			{ type: NODE_BLOCK, depth: 2 }, // @media block
			{ type: NODE_STYLE_RULE, depth: 3 }, // body
			{ type: NODE_SELECTOR_LIST, depth: 4 }, // body selector
			{ type: NODE_BLOCK, depth: 4 }, // body block
			{ type: NODE_DECLARATION, depth: 5 }, // color: red
			{ type: NODE_AT_RULE, depth: 1 }, // @layer
			{ type: NODE_BLOCK, depth: 2 }, // @layer block
			{ type: NODE_STYLE_RULE, depth: 3 },
			{ type: NODE_SELECTOR_LIST, depth: 4 },
			{ type: NODE_BLOCK, depth: 4 },
			{ type: NODE_DECLARATION, depth: 5 },
		])
	})

	test('export types', () => {
		let ast = new Parser('a{}').parse()
		walk(ast, (node, _depth) => {
			expectTypeOf(node.type).toBeNumber()
			if (node.type === NODE_SELECTOR_LIST) {
				expect(node.text).toEqual('a')
			}
		})
	})
})

describe('walk enter/leave', () => {
	const parser = new Parser('@media screen { body { color: red; } }', {
		parse_selectors: false,
		parse_values: false,
		parse_atrule_preludes: false,
	})
	const root = parser.parse()

	test('both enter + leave', () => {
		const enter: number[] = []
		const leave: number[] = []

		traverse(root, {
			enter(node) {
				enter.push(node.type)
			},
			leave(node) {
				leave.push(node.type)
			},
		})

		expect(enter).toEqual([NODE_STYLESHEET, NODE_AT_RULE, NODE_BLOCK, NODE_STYLE_RULE, NODE_SELECTOR_LIST, NODE_BLOCK, NODE_DECLARATION])
		expect(leave).toEqual([NODE_SELECTOR_LIST, NODE_DECLARATION, NODE_BLOCK, NODE_STYLE_RULE, NODE_BLOCK, NODE_AT_RULE, NODE_STYLESHEET])
	})

	test('only enter', () => {
		const enter: number[] = []

		traverse(root, {
			enter(node) {
				enter.push(node.type)
			},
		})

		expect(enter).toEqual([NODE_STYLESHEET, NODE_AT_RULE, NODE_BLOCK, NODE_STYLE_RULE, NODE_SELECTOR_LIST, NODE_BLOCK, NODE_DECLARATION])
	})

	test('only leave', () => {
		const leave: number[] = []

		traverse(root, {
			leave(node) {
				leave.push(node.type)
			},
		})

		expect(leave).toEqual([NODE_SELECTOR_LIST, NODE_DECLARATION, NODE_BLOCK, NODE_STYLE_RULE, NODE_BLOCK, NODE_AT_RULE, NODE_STYLESHEET])
	})

	test('neither', () => {
		expect(() => traverse(root)).not.toThrow()
	})
})
