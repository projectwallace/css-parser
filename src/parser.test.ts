import { describe, it, expect } from 'vitest'
import { Parser } from './parser'

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

			expect(root.type).toBe('stylesheet')
			expect(root.offset).toBe(0)
			expect(root.length).toBe(0)
			expect(root.hasChildren).toBe(false)
		})

		it('should parse stylesheet with only whitespace', () => {
			const parser = new Parser('   \n\n   ')
			const root = parser.parse()

			expect(root.type).toBe('stylesheet')
			expect(root.hasChildren).toBe(false)
		})

		it('should parse stylesheet with only comments', () => {
			const parser = new Parser('/* comment */')
			const root = parser.parse()

			expect(root.type).toBe('stylesheet')
			// TODO: Once we parse comments, verify they're added as children
		})
	})

	describe('style rule parsing', () => {
		it('should parse simple style rule', () => {
			const parser = new Parser('body { }')
			const root = parser.parse()

			expect(root.hasChildren).toBe(true)

			const rule = root.firstChild!
			expect(rule.type).toBe('rule')
			expect(rule.offset).toBe(0)
			expect(rule.length).toBeGreaterThan(0)
		})

		it('should parse style rule with selector', () => {
			const source = 'body { }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.firstChild!
			expect(rule.hasChildren).toBe(true)

			const selector = rule.firstChild!
			expect(selector.type).toBe('selector')
			expect(selector.offset).toBe(0)
			expect(selector.length).toBe(4) // "body"
			expect(selector.text).toBe('body')
		})

		it('should parse multiple style rules', () => {
			const parser = new Parser('body { } div { }')
			const root = parser.parse()

			const [rule1, rule2] = root.children
			expect(rule1.type).toBe('rule')
			expect(rule2.type).toBe('rule')
			expect(rule2.nextSibling).toBe(null)
		})

		it('should parse complex selector', () => {
			const source = 'div.class > p#id { }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.firstChild!
			const selector = rule.firstChild!

			expect(selector.type).toBe('selector')
			expect(selector.offset).toBe(0)
			// Selector includes tokens up to but not including the '{'
			// Whitespace is skipped by lexer, so actual length is 16
			expect(selector.length).toBe(16) // "div.class > p#id"
			expect(selector.text).toBe('div.class > p#id')
		})
	})

	describe('declaration parsing', () => {
		it('should parse simple declaration', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.firstChild!
			const [_selector, declaration] = rule.children

			expect(declaration.type).toBe('declaration')
			expect(declaration.isImportant).toBe(false)
		})

		it('should parse declaration with property name', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.firstChild!
			const [_selector, declaration] = rule.children

			// Property name stored in the 'name' property
			expect(declaration.name).toBe('color')
		})

		it('should parse multiple declarations', () => {
			const source = 'body { color: red; margin: 0; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.firstChild!
			const [_selector, decl1, decl2] = rule.children

			expect(decl1.type).toBe('declaration')
			expect(decl2.type).toBe('declaration')
			expect(decl2.nextSibling).toBe(null)
		})

		it('should parse declaration with !important', () => {
			const source = 'body { color: red !important; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.firstChild!
			const [_selector, declaration] = rule.children

			expect(declaration.type).toBe('declaration')
			expect(declaration.isImportant).toBe(true)
		})

		it('should parse declaration with !ie (historic !important)', () => {
			const source = 'body { color: red !ie; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.firstChild!
			const [_selector, declaration] = rule.children

			expect(declaration.type).toBe('declaration')
			expect(declaration.isImportant).toBe(true)
		})

		it('should parse declaration with ! followed by any identifier', () => {
			const source = 'body { color: red !foo; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.firstChild!
			const [_selector, declaration] = rule.children

			expect(declaration.type).toBe('declaration')
			expect(declaration.isImportant).toBe(true)
		})

		it('should parse declaration without semicolon at end of block', () => {
			const source = 'body { color: red }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.firstChild!
			const [_selector, declaration] = rule.children

			expect(declaration.type).toBe('declaration')
		})

		it('should parse complex declaration value', () => {
			const source = 'body { background: url(image.png) no-repeat center; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.firstChild!
			const [_selector, declaration] = rule.children

			expect(declaration.type).toBe('declaration')
			expect(declaration.name).toBe('background')
		})
	})

	describe('at-rule parsing', () => {
		describe('statement at-rules (no block)', () => {
			it('should parse @import', () => {
				const source = '@import url("style.css");'
				const parser = new Parser(source)
				const root = parser.parse()

				const atRule = root.firstChild!
				expect(atRule.type).toBe('atrule')
				expect(atRule.name).toBe('import')
				expect(atRule.hasChildren).toBe(false)
			})

			it('should parse @namespace', () => {
				const source = '@namespace url(http://www.w3.org/1999/xhtml);'
				const parser = new Parser(source)
				const root = parser.parse()

				const atRule = root.firstChild!
				expect(atRule.type).toBe('atrule')
				expect(atRule.name).toBe('namespace')
			})
		})

		describe('block at-rules with nested rules', () => {
			it('should parse @media with nested rule', () => {
				const source = '@media (min-width: 768px) { body { color: red; } }'
				const parser = new Parser(source)
				const root = parser.parse()

				const media = root.firstChild!
				expect(media.type).toBe('atrule')
				expect(media.name).toBe('media')
				expect(media.hasChildren).toBe(true)

				const nestedRule = media.firstChild!
				expect(nestedRule.type).toBe('rule')
			})

			it('should parse @layer with name', () => {
				const source = '@layer utilities { .text-center { text-align: center; } }'
				const parser = new Parser(source)
				const root = parser.parse()

				const layer = root.firstChild!
				expect(layer.type).toBe('atrule')
				expect(layer.name).toBe('layer')
				expect(layer.hasChildren).toBe(true)
			})

			it('should parse anonymous @layer', () => {
				const source = '@layer { body { margin: 0; } }'
				const parser = new Parser(source)
				const root = parser.parse()

				const layer = root.firstChild!
				expect(layer.type).toBe('atrule')
				expect(layer.name).toBe('layer')
				expect(layer.hasChildren).toBe(true)
			})

			it('should parse @supports', () => {
				const source = '@supports (display: grid) { .grid { display: grid; } }'
				const parser = new Parser(source)
				const root = parser.parse()

				const supports = root.firstChild!
				expect(supports.type).toBe('atrule')
				expect(supports.name).toBe('supports')
				expect(supports.hasChildren).toBe(true)
			})

			it('should parse @container', () => {
				const source = '@container (min-width: 400px) { .card { padding: 2rem; } }'
				const parser = new Parser(source)
				const root = parser.parse()

				const container = root.firstChild!
				expect(container.type).toBe('atrule')
				expect(container.name).toBe('container')
				expect(container.hasChildren).toBe(true)
			})
		})

		describe('descriptor at-rules (with declarations)', () => {
			it('should parse @font-face', () => {
				const source = '@font-face { font-family: "Open Sans"; src: url(font.woff2); }'
				const parser = new Parser(source)
				const root = parser.parse()

				const fontFace = root.firstChild!
				expect(fontFace.type).toBe('atrule')
				expect(fontFace.name).toBe('font-face')
				expect(fontFace.hasChildren).toBe(true)

				// Should have declarations as children
				const [decl1, decl2] = fontFace.children
				expect(decl1.type).toBe('declaration')
				expect(decl2.type).toBe('declaration')
			})

			it('should parse @page', () => {
				const source = '@page { margin: 1in; }'
				const parser = new Parser(source)
				const root = parser.parse()

				const page = root.firstChild!
				expect(page.type).toBe('atrule')
				expect(page.name).toBe('page')

				const decl = page.firstChild!
				expect(decl.type).toBe('declaration')
			})

			it('should parse @counter-style', () => {
				const source = '@counter-style thumbs { system: cyclic; symbols: "👍"; }'
				const parser = new Parser(source)
				const root = parser.parse()

				const counterStyle = root.firstChild!
				expect(counterStyle.type).toBe('atrule')
				expect(counterStyle.name).toBe('counter-style')

				const decl = counterStyle.firstChild!
				expect(decl.type).toBe('declaration')
			})
		})

		describe('nested at-rules', () => {
			it('should parse @media inside @supports', () => {
				const source = '@supports (display: grid) { @media (min-width: 768px) { body { color: red; } } }'
				const parser = new Parser(source)
				const root = parser.parse()

				const supports = root.firstChild!
				expect(supports.name).toBe('supports')

				const media = supports.firstChild!
				expect(media.type).toBe('atrule')
				expect(media.name).toBe('media')

				const rule = media.firstChild!
				expect(rule.type).toBe('rule')
			})
		})

		describe('multiple at-rules', () => {
			it('should parse multiple at-rules at top level', () => {
				const source = '@import url("a.css"); @layer base { body { margin: 0; } } @media print { body { color: black; } }'
				const parser = new Parser(source)
				const root = parser.parse()

				const [import1, layer, media] = root.children
				expect(import1.name).toBe('import')
				expect(layer.name).toBe('layer')
				expect(media.name).toBe('media')
			})
		})
	})
})
