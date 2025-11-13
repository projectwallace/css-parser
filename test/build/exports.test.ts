import { describe, test, expect } from 'vitest'

describe('Package exports', () => {
	test('should export Parser and CSSNode from main entry', async () => {
		let { Parser, CSSNode } = await import('../../dist/index.js')

		expect(typeof Parser).toBe('function')
		expect(typeof CSSNode).toBe('function')

		// Test that Parser works
		let parser = new Parser('body { color: red; }')
		let ast = parser.parse()
		expect(ast.type).toBe('stylesheet')
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
		expect(ast.type).toBe('stylesheet')
		expect(ast.has_children).toBe(true)
	})

	test('should have working CSSNode API', async () => {
		let { Parser } = await import('../../dist/index.js')

		let parser = new Parser('body { color: red; margin: 0; }')
		let ast = parser.parse()

		let rule = ast.first_child!
		expect(rule.type).toBe('rule')
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
		expect(parent.type).toBe('rule')
		expect(parent.children.length).toBeGreaterThan(1)
	})

	test('should parse at-rules', async () => {
		let { Parser } = await import('../../dist/parser.js')

		let parser = new Parser('@media (min-width: 768px) { body { margin: 0; } }')
		let ast = parser.parse()

		let media = ast.first_child!
		expect(media.type).toBe('atrule')
		expect(media.name).toBe('media')
	})
})
