import { describe, it, expect } from 'vitest'
import { Parser } from './parser'
import {
	NODE_STYLESHEET,
	NODE_STYLE_RULE,
	NODE_SELECTOR,
	NODE_DECLARATION,
	NODE_AT_RULE,
	FLAG_IMPORTANT,
} from './arena'

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

		it('should parse declaration with !ie (historic !important)', () => {
			const source = 'body { color: red !ie; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const arena = parser.getArena()

			const rule = arena.getFirstChild(root)
			const selector = arena.getFirstChild(rule)
			const declaration = arena.getNextSibling(selector)

			expect(arena.getType(declaration)).toBe(NODE_DECLARATION)
			expect(arena.hasFlag(declaration, FLAG_IMPORTANT)).toBe(true)
		})

		it('should parse declaration with ! followed by any identifier', () => {
			const source = 'body { color: red !foo; }'
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

	describe('at-rule parsing', () => {
		// Helper to extract at-rule name from node
		const getAtRuleName = (parser: Parser, nodeIndex: number): string => {
			const arena = parser.getArena()
			const nameStart = arena.getContentStart(nodeIndex)
			const nameLength = arena.getContentLength(nodeIndex)
			return parser['source'].substring(nameStart, nameStart + nameLength)
		}

		describe('statement at-rules (no block)', () => {
			it('should parse @import', () => {
				const source = '@import url("style.css");'
				const parser = new Parser(source)
				const root = parser.parse()
				const arena = parser.getArena()

				const atRule = arena.getFirstChild(root)
				expect(arena.getType(atRule)).toBe(NODE_AT_RULE)
				expect(getAtRuleName(parser, atRule)).toBe('import')
				expect(arena.hasChildren(atRule)).toBe(false)
			})

			it('should parse @namespace', () => {
				const source = '@namespace url(http://www.w3.org/1999/xhtml);'
				const parser = new Parser(source)
				const root = parser.parse()
				const arena = parser.getArena()

				const atRule = arena.getFirstChild(root)
				expect(arena.getType(atRule)).toBe(NODE_AT_RULE)
				expect(getAtRuleName(parser, atRule)).toBe('namespace')
			})
		})

		describe('block at-rules with nested rules', () => {
			it('should parse @media with nested rule', () => {
				const source = '@media (min-width: 768px) { body { color: red; } }'
				const parser = new Parser(source)
				const root = parser.parse()
				const arena = parser.getArena()

				const media = arena.getFirstChild(root)
				expect(arena.getType(media)).toBe(NODE_AT_RULE)
				expect(getAtRuleName(parser, media)).toBe('media')
				expect(arena.hasChildren(media)).toBe(true)

				const nestedRule = arena.getFirstChild(media)
				expect(arena.getType(nestedRule)).toBe(NODE_STYLE_RULE)
			})

			it('should parse @layer with name', () => {
				const source = '@layer utilities { .text-center { text-align: center; } }'
				const parser = new Parser(source)
				const root = parser.parse()
				const arena = parser.getArena()

				const layer = arena.getFirstChild(root)
				expect(arena.getType(layer)).toBe(NODE_AT_RULE)
				expect(getAtRuleName(parser, layer)).toBe('layer')
				expect(arena.hasChildren(layer)).toBe(true)
			})

			it('should parse anonymous @layer', () => {
				const source = '@layer { body { margin: 0; } }'
				const parser = new Parser(source)
				const root = parser.parse()
				const arena = parser.getArena()

				const layer = arena.getFirstChild(root)
				expect(arena.getType(layer)).toBe(NODE_AT_RULE)
				expect(getAtRuleName(parser, layer)).toBe('layer')
				expect(arena.hasChildren(layer)).toBe(true)
			})

			it('should parse @supports', () => {
				const source = '@supports (display: grid) { .grid { display: grid; } }'
				const parser = new Parser(source)
				const root = parser.parse()
				const arena = parser.getArena()

				const supports = arena.getFirstChild(root)
				expect(arena.getType(supports)).toBe(NODE_AT_RULE)
				expect(getAtRuleName(parser, supports)).toBe('supports')
				expect(arena.hasChildren(supports)).toBe(true)
			})

			it('should parse @container', () => {
				const source = '@container (min-width: 400px) { .card { padding: 2rem; } }'
				const parser = new Parser(source)
				const root = parser.parse()
				const arena = parser.getArena()

				const container = arena.getFirstChild(root)
				expect(arena.getType(container)).toBe(NODE_AT_RULE)
				expect(getAtRuleName(parser, container)).toBe('container')
				expect(arena.hasChildren(container)).toBe(true)
			})
		})

		describe('descriptor at-rules (with declarations)', () => {
			it('should parse @font-face', () => {
				const source = '@font-face { font-family: "Open Sans"; src: url(font.woff2); }'
				const parser = new Parser(source)
				const root = parser.parse()
				const arena = parser.getArena()

				const fontFace = arena.getFirstChild(root)
				expect(arena.getType(fontFace)).toBe(NODE_AT_RULE)
				expect(getAtRuleName(parser, fontFace)).toBe('font-face')
				expect(arena.hasChildren(fontFace)).toBe(true)

				// Should have declarations as children
				const decl1 = arena.getFirstChild(fontFace)
				expect(arena.getType(decl1)).toBe(NODE_DECLARATION)

				const decl2 = arena.getNextSibling(decl1)
				expect(arena.getType(decl2)).toBe(NODE_DECLARATION)
			})

			it('should parse @page', () => {
				const source = '@page { margin: 1in; }'
				const parser = new Parser(source)
				const root = parser.parse()
				const arena = parser.getArena()

				const page = arena.getFirstChild(root)
				expect(arena.getType(page)).toBe(NODE_AT_RULE)
				expect(getAtRuleName(parser, page)).toBe('page')

				const decl = arena.getFirstChild(page)
				expect(arena.getType(decl)).toBe(NODE_DECLARATION)
			})

			it('should parse @counter-style', () => {
				const source = '@counter-style thumbs { system: cyclic; symbols: "👍"; }'
				const parser = new Parser(source)
				const root = parser.parse()
				const arena = parser.getArena()

				const counterStyle = arena.getFirstChild(root)
				expect(arena.getType(counterStyle)).toBe(NODE_AT_RULE)
				expect(getAtRuleName(parser, counterStyle)).toBe('counter-style')

				const decl = arena.getFirstChild(counterStyle)
				expect(arena.getType(decl)).toBe(NODE_DECLARATION)
			})
		})

		describe('nested at-rules', () => {
			it('should parse @media inside @supports', () => {
				const source = '@supports (display: grid) { @media (min-width: 768px) { body { color: red; } } }'
				const parser = new Parser(source)
				const root = parser.parse()
				const arena = parser.getArena()

				const supports = arena.getFirstChild(root)
				expect(getAtRuleName(parser, supports)).toBe('supports')

				const media = arena.getFirstChild(supports)
				expect(arena.getType(media)).toBe(NODE_AT_RULE)
				expect(getAtRuleName(parser, media)).toBe('media')

				const rule = arena.getFirstChild(media)
				expect(arena.getType(rule)).toBe(NODE_STYLE_RULE)
			})
		})

		describe('multiple at-rules', () => {
			it('should parse multiple at-rules at top level', () => {
				const source = '@import url("a.css"); @layer base { body { margin: 0; } } @media print { body { color: black; } }'
				const parser = new Parser(source)
				const root = parser.parse()
				const arena = parser.getArena()

				const import1 = arena.getFirstChild(root)
				expect(getAtRuleName(parser, import1)).toBe('import')

				const layer = arena.getNextSibling(import1)
				expect(getAtRuleName(parser, layer)).toBe('layer')

				const media = arena.getNextSibling(layer)
				expect(getAtRuleName(parser, media)).toBe('media')
			})
		})
	})
})
