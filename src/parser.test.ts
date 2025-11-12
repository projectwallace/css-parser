import { describe, it, expect } from 'vitest'
import { Parser } from './parser'
import { NODE_STYLESHEET, NODE_STYLE_RULE, NODE_SELECTOR, NODE_DECLARATION, FLAG_IMPORTANT } from './arena'

describe('Parser', () => {
	describe('basic parsing', () => {
		it('should create parser with arena sized for source', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const arena = parser.getArena()

			// Should have capacity based on source size
			expect(arena.getCapacity()).toBeGreaterThan(0)
			expect(arena.getCount()).toBe(0) // No nodes created yet
		})

		it('should parse empty stylesheet', () => {
			const parser = new Parser('')
			const root = parser.parse()
			const arena = parser.getArena()

			expect(arena.getType(root)).toBe(NODE_STYLESHEET)
			expect(arena.getStartOffset(root)).toBe(0)
			expect(arena.getLength(root)).toBe(0)
			expect(arena.hasChildren(root)).toBe(false)
		})

		it('should parse stylesheet with only whitespace', () => {
			const parser = new Parser('   \n\n   ')
			const root = parser.parse()
			const arena = parser.getArena()

			expect(arena.getType(root)).toBe(NODE_STYLESHEET)
			expect(arena.hasChildren(root)).toBe(false)
		})

		it('should parse stylesheet with only comments', () => {
			const parser = new Parser('/* comment */')
			const root = parser.parse()
			const arena = parser.getArena()

			expect(arena.getType(root)).toBe(NODE_STYLESHEET)
			// TODO: Once we parse comments, verify they're added as children
		})
	})

	describe('style rule parsing', () => {
		it('should parse simple style rule', () => {
			const parser = new Parser('body { }')
			const root = parser.parse()
			const arena = parser.getArena()

			expect(arena.hasChildren(root)).toBe(true)

			const rule = arena.getFirstChild(root)
			expect(arena.getType(rule)).toBe(NODE_STYLE_RULE)
			expect(arena.getStartOffset(rule)).toBe(0)
			expect(arena.getLength(rule)).toBeGreaterThan(0)
		})

		it('should parse style rule with selector', () => {
			const source = 'body { }'
			const parser = new Parser(source)
			const root = parser.parse()
			const arena = parser.getArena()

			const rule = arena.getFirstChild(root)
			expect(arena.hasChildren(rule)).toBe(true)

			const selector = arena.getFirstChild(rule)
			expect(arena.getType(selector)).toBe(NODE_SELECTOR)
			expect(arena.getStartOffset(selector)).toBe(0)
			expect(arena.getLength(selector)).toBe(4) // "body"
		})

		it('should parse multiple style rules', () => {
			const parser = new Parser('body { } div { }')
			const root = parser.parse()
			const arena = parser.getArena()

			const rule1 = arena.getFirstChild(root)
			expect(arena.getType(rule1)).toBe(NODE_STYLE_RULE)

			const rule2 = arena.getNextSibling(rule1)
			expect(arena.getType(rule2)).toBe(NODE_STYLE_RULE)

			expect(arena.hasNextSibling(rule2)).toBe(false)
		})

		it('should parse complex selector', () => {
			const source = 'div.class > p#id { }'
			const parser = new Parser(source)
			const root = parser.parse()
			const arena = parser.getArena()

			const rule = arena.getFirstChild(root)
			const selector = arena.getFirstChild(rule)

			expect(arena.getType(selector)).toBe(NODE_SELECTOR)
			expect(arena.getStartOffset(selector)).toBe(0)
			// Selector includes tokens up to but not including the '{'
			// Whitespace is skipped by lexer, so actual length is 16
			expect(arena.getLength(selector)).toBe(16) // "div.class > p#id"
		})
	})

	describe('declaration parsing', () => {
		it('should parse simple declaration', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const arena = parser.getArena()

			const rule = arena.getFirstChild(root)
			const selector = arena.getFirstChild(rule)
			const declaration = arena.getNextSibling(selector)

			expect(arena.getType(declaration)).toBe(NODE_DECLARATION)
			expect(arena.hasFlag(declaration, FLAG_IMPORTANT)).toBe(false)
		})

		it('should parse declaration with property name', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const arena = parser.getArena()

			const rule = arena.getFirstChild(root)
			const selector = arena.getFirstChild(rule)
			const declaration = arena.getNextSibling(selector)

			// Property name stored in contentStart/contentLength
			const propStart = arena.getContentStart(declaration)
			const propLength = arena.getContentLength(declaration)
			const propName = source.substring(propStart, propStart + propLength)

			expect(propName).toBe('color')
		})

		it('should parse multiple declarations', () => {
			const source = 'body { color: red; margin: 0; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const arena = parser.getArena()

			const rule = arena.getFirstChild(root)
			const selector = arena.getFirstChild(rule)
			const decl1 = arena.getNextSibling(selector)
			const decl2 = arena.getNextSibling(decl1)

			expect(arena.getType(decl1)).toBe(NODE_DECLARATION)
			expect(arena.getType(decl2)).toBe(NODE_DECLARATION)
			expect(arena.hasNextSibling(decl2)).toBe(false)
		})

		it('should parse declaration with !important', () => {
			const source = 'body { color: red !important; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const arena = parser.getArena()

			const rule = arena.getFirstChild(root)
			const selector = arena.getFirstChild(rule)
			const declaration = arena.getNextSibling(selector)

			expect(arena.getType(declaration)).toBe(NODE_DECLARATION)
			expect(arena.hasFlag(declaration, FLAG_IMPORTANT)).toBe(true)
		})

		it('should parse declaration without semicolon at end of block', () => {
			const source = 'body { color: red }'
			const parser = new Parser(source)
			const root = parser.parse()
			const arena = parser.getArena()

			const rule = arena.getFirstChild(root)
			const selector = arena.getFirstChild(rule)
			const declaration = arena.getNextSibling(selector)

			expect(arena.getType(declaration)).toBe(NODE_DECLARATION)
		})

		it('should parse complex declaration value', () => {
			const source = 'body { background: url(image.png) no-repeat center; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const arena = parser.getArena()

			const rule = arena.getFirstChild(root)
			const selector = arena.getFirstChild(rule)
			const declaration = arena.getNextSibling(selector)

			expect(arena.getType(declaration)).toBe(NODE_DECLARATION)

			const propStart = arena.getContentStart(declaration)
			const propLength = arena.getContentLength(declaration)
			const propName = source.substring(propStart, propStart + propLength)

			expect(propName).toBe('background')
		})
	})
})
