import { describe, test, expect } from 'vitest'
import { NODE_AT_RULE, NODE_STYLE_RULE, NODE_STYLESHEET } from '../../dist/index.js'

describe('Package exports', () => {
	test('should export Parser and CSSNode and walk from main entry', async () => {
		let { Parser, CSSNode, walk } = await import('../../dist/index.js')

		expect(typeof Parser).toBe('function')
		expect(typeof CSSNode).toBe('function')

		// Test that Parser works
		let parser = new Parser('body { color: red; }')
		let ast = parser.parse()
		expect(ast.type).toBe(NODE_STYLESHEET)

		walk(ast, (_node, _depth) => {})
	})

	test('should export Lexer from lexer entry', async () => {
		let { Lexer } = await import('../../dist/lexer.js')

		expect(typeof Lexer).toBe('function')

		// Test that Lexer works
		let lexer = new Lexer('body { color: red; }')
		let token = lexer.next_token()
		expect(token).toBeDefined()
		expect(token).not.toBeNull()
		if (token) {
			expect(typeof token.type).toBe('number')
		}
	})

	test('should export Parser from parser entry', async () => {
		let { Parser } = await import('../../dist/parser.js')

		expect(typeof Parser).toBe('function')

		// Test that Parser works
		let parser = new Parser('.test { margin: 0; }')
		let ast = parser.parse()
		expect(ast.type).toBe(NODE_STYLESHEET)
		expect(ast.has_children).toBe(true)
	})

	test('should have working CSSNode API', async () => {
		let { Parser } = await import('../../dist/index.js')

		let parser = new Parser('body { color: red; margin: 0; }')
		let ast = parser.parse()

		let rule = ast.first_child!
		expect(rule.type).toBe(NODE_STYLE_RULE)
		expect(rule.children.length).toBeGreaterThan(0)

		// Test iteration
		let child_count = 0
		for (let _child of rule) {
			child_count++
		}
		expect(child_count).toBeGreaterThan(0)
	})

	test('should parse modern CSS with nesting', async () => {
		let { Parser } = await import('../../dist/parser.js')

		let parser = new Parser('.parent { color: red; .child { color: blue; } }')
		let ast = parser.parse()

		let parent = ast.first_child!
		expect(parent.type).toBe(NODE_STYLE_RULE)
		expect(parent.children.length).toBeGreaterThan(1)
	})

	test('should parse at-rules', async () => {
		let { Parser } = await import('../../dist/parser.js')

		let parser = new Parser('@media (min-width: 768px) { body { margin: 0; } }')
		let ast = parser.parse()

		let media = ast.first_child!
		expect(media.type).toBe(NODE_AT_RULE)
		expect(media.name).toBe('media')
	})

	describe('Standalone function exports', () => {
		test('should export parse() from main entry', async () => {
			let { parse } = await import('../../dist/index.js')

			expect(typeof parse).toBe('function')

			// Test that parse works
			let ast = parse('body { color: red; }')
			expect(ast.type).toBe(NODE_STYLESHEET)
			expect(ast.has_children).toBe(true)
		})

		test('should export parse() from parse entry', async () => {
			let { parse } = await import('../../dist/parse.js')

			expect(typeof parse).toBe('function')

			// Test that parse works
			let ast = parse('.test { margin: 0; }')
			expect(ast.type).toBe(NODE_STYLESHEET)
			expect(ast.has_children).toBe(true)
		})

		test('should export parse_selector() from main entry', async () => {
			let { parse_selector } = await import('../../dist/index.js')

			expect(typeof parse_selector).toBe('function')

			// Test that parse_selector works
			let selector = parse_selector('div.class > p#id')
			expect(selector.type).toBe(5) // NODE_SELECTOR
			expect(selector.text).toBe('div.class > p#id')
			expect(selector.has_children).toBe(true)
		})

		test('should export parse_selector() from parse-selector entry', async () => {
			let { parse_selector } = await import('../../dist/parse-selector.js')

			expect(typeof parse_selector).toBe('function')

			// Test that parse_selector works
			let selector = parse_selector('ul > li')
			expect(selector.type).toBe(5) // NODE_SELECTOR
			expect(selector.text).toBe('ul > li')
			expect(selector.has_children).toBe(true)
		})

		test('should export parse_atrule_prelude() from main entry', async () => {
			let { parse_atrule_prelude } = await import('../../dist/index.js')

			expect(typeof parse_atrule_prelude).toBe('function')

			// Test that parse_atrule_prelude works
			let nodes = parse_atrule_prelude('media', '(min-width: 768px)')
			expect(Array.isArray(nodes)).toBe(true)
			expect(nodes.length).toBeGreaterThan(0)
			expect(nodes[0].text).toBe('(min-width: 768px)')
		})

		test('should export parse_atrule_prelude() from parse-atrule-prelude entry', async () => {
			let { parse_atrule_prelude } = await import('../../dist/parse-atrule-prelude.js')

			expect(typeof parse_atrule_prelude).toBe('function')

			// Test that parse_atrule_prelude works
			let nodes = parse_atrule_prelude('layer', 'utilities')
			expect(Array.isArray(nodes)).toBe(true)
			expect(nodes.length).toBe(1)
			expect(nodes[0].text).toBe('utilities')
		})

		test('parse() should accept options', async () => {
			let { parse } = await import('../../dist/parse.js')

			// Test with parseValues option
			let ast = parse('body { color: red; }', { parseValues: true })
			expect(ast.type).toBe(NODE_STYLESHEET)
			let rule = ast.first_child!
			let [_selector, decl] = rule.children
			expect(decl.has_children).toBe(true) // Should have value children
		})

		test('parse_selector() should handle empty selector', async () => {
			let { parse_selector } = await import('../../dist/parse-selector.js')

			let selector = parse_selector('')
			expect(selector.type).toBe(5) // NODE_SELECTOR
			expect(selector.text).toBe('')
		})

		test('parse_atrule_prelude() should handle unsupported at-rules', async () => {
			let { parse_atrule_prelude } = await import('../../dist/parse-atrule-prelude.js')

			// @import is now supported, expect 1 node (the URL node)
			let nodes = parse_atrule_prelude('import', 'url("styles.css")')
			expect(Array.isArray(nodes)).toBe(true)
			expect(nodes.length).toBe(1)

			// @namespace is not currently parsed
			let namespaceNodes = parse_atrule_prelude('namespace', 'url("http://example.com")')
			expect(Array.isArray(namespaceNodes)).toBe(true)
			expect(namespaceNodes.length).toBe(0)
		})

		test('standalone functions should be iterable', async () => {
			let { parse, parse_selector, parse_atrule_prelude } = await import('../../dist/index.js')

			// Test parse() iterability
			let ast = parse('body { } div { }')
			let count = 0
			for (let _child of ast) {
				count++
			}
			expect(count).toBe(2)

			// Test parse_selector() iterability
			let selector = parse_selector('div.class')
			count = 0
			for (let _child of selector) {
				count++
			}
			expect(count).toBeGreaterThan(0)

			// Test parse_atrule_prelude() iterability
			let nodes = parse_atrule_prelude('media', '(min-width: 768px)')
			count = 0
			for (let _node of nodes) {
				count++
			}
			expect(count).toBeGreaterThan(0)
		})
	})
})
