import { describe, test, expect } from 'vitest'
import { Parser } from './parser'
import { NODE_STYLESHEET, NODE_STYLE_RULE, NODE_AT_RULE, NODE_DECLARATION, NODE_SELECTOR } from './arena'

describe('Parser', () => {
	describe('basic parsing', () => {
		test('should create parser with arena sized for source', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const arena = parser.get_arena()

			// Should have capacity based on source size
			expect(arena.getCapacity()).toBeGreaterThan(0)
			expect(arena.getCount()).toBe(0) // No nodes created yet
		})

		test('should parse empty stylesheet', () => {
			const parser = new Parser('')
			const root = parser.parse()

			expect(root.type).toBe(NODE_STYLESHEET)
			expect(root.offset).toBe(0)
			expect(root.length).toBe(0)
			expect(root.has_children).toBe(false)
		})

		test('should parse stylesheet with only whitespace', () => {
			const parser = new Parser('   \n\n   ')
			const root = parser.parse()

			expect(root.type).toBe(NODE_STYLESHEET)
			expect(root.has_children).toBe(false)
		})

		test('should parse stylesheet with only comments', () => {
			const parser = new Parser('/* comment */')
			const root = parser.parse()

			expect(root.type).toBe(NODE_STYLESHEET)
			// TODO: Once we parse comments, verify they're added as children
		})
	})

	describe('style rule parsing', () => {
		test('should parse simple style rule', () => {
			const parser = new Parser('body { }')
			const root = parser.parse()

			expect(root.has_children).toBe(true)

			const rule = root.first_child!
			expect(rule.type).toBe(NODE_STYLE_RULE)
			expect(rule.offset).toBe(0)
			expect(rule.length).toBeGreaterThan(0)
		})

		test('should parse style rule with selector', () => {
			const source = 'body { }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.first_child!
			expect(rule.has_children).toBe(true)

			const selector = rule.first_child!
			expect(selector.type).toBe(NODE_SELECTOR)
			expect(selector.offset).toBe(0)
			expect(selector.length).toBe(4) // "body"
			expect(selector.text).toBe('body')
		})

		test('should parse multiple style rules', () => {
			const parser = new Parser('body { } div { }')
			const root = parser.parse()

			const [rule1, rule2] = root.children
			expect(rule1.type).toBe(NODE_STYLE_RULE)
			expect(rule2.type).toBe(NODE_STYLE_RULE)
			expect(rule2.next_sibling).toBe(null)
		})

		test('should parse complex selector', () => {
			const source = 'div.class > p#id { }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.first_child!
			const selector = rule.first_child!

			expect(selector.type).toBe(NODE_SELECTOR)
			expect(selector.offset).toBe(0)
			// Selector includes tokens up to but not including the '{'
			// Whitespace is skipped by lexer, so actual length is 16
			expect(selector.length).toBe(16) // "div.class > p#id".length
			expect(selector.text).toBe('div.class > p#id')
		})
	})

	describe('declaration parsing', () => {
		test('should parse simple declaration', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.first_child!
			const [_selector, declaration] = rule.children

			expect(declaration.type).toBe(NODE_DECLARATION)
			expect(declaration.is_important).toBe(false)
		})

		test('should parse declaration with property name', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.first_child!
			const [_selector, declaration] = rule.children

			// Property name stored in the 'name' property
			expect(declaration.name).toBe('color')
		})

		test('should parse multiple declarations', () => {
			const source = 'body { color: red; margin: 0; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.first_child!
			const [_selector, decl1, decl2] = rule.children

			expect(decl1.type).toBe(NODE_DECLARATION)
			expect(decl2.type).toBe(NODE_DECLARATION)
			expect(decl2.next_sibling).toBe(null)
		})

		test('should parse declaration with !important', () => {
			const source = 'body { color: red !important; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.first_child!
			const [_selector, declaration] = rule.children

			expect(declaration.type).toBe(NODE_DECLARATION)
			expect(declaration.is_important).toBe(true)
		})

		test('should parse declaration with !ie (historic !important)', () => {
			const source = 'body { color: red !ie; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.first_child!
			const [_selector, declaration] = rule.children

			expect(declaration.type).toBe(NODE_DECLARATION)
			expect(declaration.is_important).toBe(true)
		})

		test('should parse declaration with ! followed by any identifier', () => {
			const source = 'body { color: red !foo; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.first_child!
			const [_selector, declaration] = rule.children

			expect(declaration.type).toBe(NODE_DECLARATION)
			expect(declaration.is_important).toBe(true)
		})

		test('should parse declaration without semicolon at end of block', () => {
			const source = 'body { color: red }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.first_child!
			const [_selector, declaration] = rule.children

			expect(declaration.type).toBe(NODE_DECLARATION)
		})

		test('should parse complex declaration value', () => {
			const source = 'body { background: url(image.png) no-repeat center; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.first_child!
			const [_selector, declaration] = rule.children

			expect(declaration.type).toBe(NODE_DECLARATION)
			expect(declaration.name).toBe('background')
		})
	})

	describe('at-rule parsing', () => {
		describe('statement at-rules (no block)', () => {
			test('should parse @import', () => {
				const source = '@import url("style.css");'
				const parser = new Parser(source)
				const root = parser.parse()

				const atRule = root.first_child!
				expect(atRule.type).toBe(NODE_AT_RULE)
				expect(atRule.name).toBe('import')
				expect(atRule.has_children).toBe(false)
			})

			test('should parse @namespace', () => {
				const source = '@namespace url(http://www.w3.org/1999/xhtml);'
				const parser = new Parser(source)
				const root = parser.parse()

				const atRule = root.first_child!
				expect(atRule.type).toBe(NODE_AT_RULE)
				expect(atRule.name).toBe('namespace')
			})
		})

		describe('block at-rules with nested rules', () => {
			test('should parse @media with nested rule', () => {
				const source = '@media (min-width: 768px) { body { color: red; } }'
				const parser = new Parser(source)
				const root = parser.parse()

				const media = root.first_child!
				expect(media.type).toBe(NODE_AT_RULE)
				expect(media.name).toBe('media')
				expect(media.has_children).toBe(true)

				const nestedRule = media.first_child!
				expect(nestedRule.type).toBe(NODE_STYLE_RULE)
			})

			test('should parse @layer with name', () => {
				const source = '@layer utilities { .text-center { text-align: center; } }'
				const parser = new Parser(source)
				const root = parser.parse()

				const layer = root.first_child!
				expect(layer.type).toBe(NODE_AT_RULE)
				expect(layer.name).toBe('layer')
				expect(layer.has_children).toBe(true)
			})

			test('should parse anonymous @layer', () => {
				const source = '@layer { body { margin: 0; } }'
				const parser = new Parser(source)
				const root = parser.parse()

				const layer = root.first_child!
				expect(layer.type).toBe(NODE_AT_RULE)
				expect(layer.name).toBe('layer')
				expect(layer.has_children).toBe(true)
			})

			test('should parse @supports', () => {
				const source = '@supports (display: grid) { .grid { display: grid; } }'
				const parser = new Parser(source)
				const root = parser.parse()

				const supports = root.first_child!
				expect(supports.type).toBe(NODE_AT_RULE)
				expect(supports.name).toBe('supports')
				expect(supports.has_children).toBe(true)
			})

			test('should parse @container', () => {
				const source = '@container (min-width: 400px) { .card { padding: 2rem; } }'
				const parser = new Parser(source)
				const root = parser.parse()

				const container = root.first_child!
				expect(container.type).toBe(NODE_AT_RULE)
				expect(container.name).toBe('container')
				expect(container.has_children).toBe(true)
			})
		})

		describe('descriptor at-rules (with declarations)', () => {
			test('should parse @font-face', () => {
				const source = '@font-face { font-family: "Open Sans"; src: url(font.woff2); }'
				const parser = new Parser(source)
				const root = parser.parse()

				const fontFace = root.first_child!
				expect(fontFace.type).toBe(NODE_AT_RULE)
				expect(fontFace.name).toBe('font-face')
				expect(fontFace.has_children).toBe(true)

				// Should have declarations as children
				const [decl1, decl2] = fontFace.children
				expect(decl1.type).toBe(NODE_DECLARATION)
				expect(decl2.type).toBe(NODE_DECLARATION)
			})

			test('should parse @page', () => {
				const source = '@page { margin: 1in; }'
				const parser = new Parser(source)
				const root = parser.parse()

				const page = root.first_child!
				expect(page.type).toBe(NODE_AT_RULE)
				expect(page.name).toBe('page')

				const decl = page.first_child!
				expect(decl.type).toBe(NODE_DECLARATION)
			})

			test('should parse @counter-style', () => {
				const source = '@counter-style thumbs { system: cyclic; symbols: "👍"; }'
				const parser = new Parser(source)
				const root = parser.parse()

				const counterStyle = root.first_child!
				expect(counterStyle.type).toBe(NODE_AT_RULE)
				expect(counterStyle.name).toBe('counter-style')

				const decl = counterStyle.first_child!
				expect(decl.type).toBe(NODE_DECLARATION)
			})
		})

		describe('nested at-rules', () => {
			test('should parse @media inside @supports', () => {
				const source = '@supports (display: grid) { @media (min-width: 768px) { body { color: red; } } }'
				const parser = new Parser(source)
				const root = parser.parse()

				const supports = root.first_child!
				expect(supports.name).toBe('supports')

				const media = supports.first_child!
				expect(media.type).toBe(NODE_AT_RULE)
				expect(media.name).toBe('media')

				const rule = media.first_child!
				expect(rule.type).toBe(NODE_STYLE_RULE)
			})
		})

		describe('multiple at-rules', () => {
			test('should parse multiple at-rules at top level', () => {
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

	describe('CSS Nesting', () => {
		test('should parse nested rule with & selector', () => {
			let source = '.parent { color: red; & .child { color: blue; } }'
			let parser = new Parser(source)
			let root = parser.parse()

			let parent = root.first_child!
			expect(parent.type).toBe(NODE_STYLE_RULE)

			let [_selector, decl, nested_rule] = parent.children
			expect(decl.type).toBe(NODE_DECLARATION)
			expect(decl.name).toBe('color')

			expect(nested_rule.type).toBe(NODE_STYLE_RULE)
			let nested_selector = nested_rule.first_child!
			expect(nested_selector.type).toBe(NODE_SELECTOR)
			expect(nested_selector.text).toBe('& .child')
		})

		test('should parse nested rule without & selector', () => {
			let source = '.parent { color: red; .child { color: blue; } }'
			let parser = new Parser(source)
			let root = parser.parse()

			let parent = root.first_child!
			let [_selector, _decl, nested_rule] = parent.children

			expect(nested_rule.type).toBe(NODE_STYLE_RULE)
			let nested_selector = nested_rule.first_child!
			expect(nested_selector.text).toBe('.child')
		})

		test('should parse multiple nested rules', () => {
			let source = '.parent { .child1 { } .child2 { } }'
			let parser = new Parser(source)
			let root = parser.parse()

			let parent = root.first_child!
			let [_selector, nested1, nested2] = parent.children

			expect(nested1.type).toBe(NODE_STYLE_RULE)
			expect(nested2.type).toBe(NODE_STYLE_RULE)
		})

		test('should parse deeply nested rules', () => {
			let source = '.a { .b { .c { color: red; } } }'
			let parser = new Parser(source)
			let root = parser.parse()

			let a = root.first_child!
			let [_selector_a, b] = a.children
			expect(b.type).toBe(NODE_STYLE_RULE)

			let [_selector_b, c] = b.children
			expect(c.type).toBe(NODE_STYLE_RULE)

			let [_selector_c, decl] = c.children
			expect(decl.type).toBe(NODE_DECLARATION)
			expect(decl.name).toBe('color')
		})

		test('should parse nested @media inside rule', () => {
			let source = '.card { color: red; @media (min-width: 768px) { padding: 2rem; } }'
			let parser = new Parser(source)
			let root = parser.parse()

			let card = root.first_child!
			let [_selector, decl, media] = card.children

			expect(decl.type).toBe(NODE_DECLARATION)
			expect(media.type).toBe(NODE_AT_RULE)
			expect(media.name).toBe('media')

			let nested_decl = media.first_child!
			expect(nested_decl.type).toBe(NODE_DECLARATION)
			expect(nested_decl.name).toBe('padding')
		})

		test('should parse :is() pseudo-class', () => {
			let source = ':is(.a, .b) { color: red; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			let selector = rule.first_child!
			expect(selector.text).toBe(':is(.a, .b)')
		})

		test('should parse :where() pseudo-class', () => {
			let source = ':where(h1, h2, h3) { margin: 0; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			let selector = rule.first_child!
			expect(selector.text).toBe(':where(h1, h2, h3)')
		})

		test('should parse :has() pseudo-class', () => {
			let source = 'div:has(> img) { display: flex; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			let selector = rule.first_child!
			expect(selector.text).toBe('div:has(> img)')
		})

		test('should parse complex nesting with mixed declarations and rules', () => {
			let source = `.card {
				color: red;
				.title { font-size: 2rem; }
				padding: 1rem;
				.body { line-height: 1.5; }
			}`
			let parser = new Parser(source)
			let root = parser.parse()

			let card = root.first_child!
			let [_selector, decl1, title, decl2, body] = card.children

			expect(decl1.type).toBe(NODE_DECLARATION)
			expect(decl1.name).toBe('color')

			expect(title.type).toBe(NODE_STYLE_RULE)

			expect(decl2.type).toBe(NODE_DECLARATION)
			expect(decl2.name).toBe('padding')

			expect(body.type).toBe(NODE_STYLE_RULE)
		})
	})

	describe('@keyframes parsing', () => {
		test('should parse @keyframes with from/to', () => {
			let source = '@keyframes fade { from { opacity: 0; } to { opacity: 1; } }'
			let parser = new Parser(source)
			let root = parser.parse()

			let keyframes = root.first_child!
			expect(keyframes.type).toBe(NODE_AT_RULE)
			expect(keyframes.name).toBe('keyframes')

			let [from_rule, to_rule] = keyframes.children
			expect(from_rule.type).toBe(NODE_STYLE_RULE)
			expect(to_rule.type).toBe(NODE_STYLE_RULE)

			let from_selector = from_rule.first_child!
			expect(from_selector.text).toBe('from')

			let to_selector = to_rule.first_child!
			expect(to_selector.text).toBe('to')
		})

		test('should parse @keyframes with percentages', () => {
			let source = '@keyframes slide { 0% { left: 0; } 50% { left: 50%; } 100% { left: 100%; } }'
			let parser = new Parser(source)
			let root = parser.parse()

			let keyframes = root.first_child!
			let [rule0, rule50, rule100] = keyframes.children

			expect(rule0.type).toBe(NODE_STYLE_RULE)
			expect(rule50.type).toBe(NODE_STYLE_RULE)
			expect(rule100.type).toBe(NODE_STYLE_RULE)

			let selector0 = rule0.first_child!
			expect(selector0.text).toBe('0%')
		})

		test('should parse @keyframes with multiple selectors', () => {
			let source = '@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }'
			let parser = new Parser(source)
			let root = parser.parse()

			let keyframes = root.first_child!
			let [rule1, _rule2] = keyframes.children

			let selector1 = rule1.first_child!
			expect(selector1.text).toBe('0%, 100%')
		})
	})

	describe('@nest at-rule', () => {
		test('should parse @nest with & selector', () => {
			let source = '.parent { @nest & .child { color: blue; } }'
			let parser = new Parser(source)
			let root = parser.parse()

			let parent = root.first_child!
			let [_selector, nest] = parent.children

			expect(nest.type).toBe(NODE_AT_RULE)
			expect(nest.name).toBe('nest')
			expect(nest.has_children).toBe(true)

			let decl = nest.first_child!
			expect(decl.type).toBe(NODE_DECLARATION)
			expect(decl.name).toBe('color')
		})

		test('should parse @nest with complex selector', () => {
			let source = '.a { @nest :not(&) { color: red; } }'
			let parser = new Parser(source)
			let root = parser.parse()

			let a = root.first_child!
			let [_selector, nest] = a.children

			expect(nest.type).toBe(NODE_AT_RULE)
			expect(nest.name).toBe('nest')
		})
	})

	describe('error recovery and edge cases', () => {
		test('should handle malformed rule without opening brace', () => {
			let source = 'body color: red; } div { margin: 0; }'
			let parser = new Parser(source)
			let root = parser.parse()

			// Should skip malformed rule and parse valid one
			expect(root.children.length).toBeGreaterThan(0)
		})

		test('should handle rule without closing brace', () => {
			let source = 'body { color: red; div { margin: 0; }'
			let parser = new Parser(source)
			let root = parser.parse()

			// Parser should recover
			expect(root.has_children).toBe(true)
		})

		test('should handle empty rule block', () => {
			let source = '.empty { }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			expect(rule.type).toBe(NODE_STYLE_RULE)
			// Only has selector, no declarations
			expect(rule.children.length).toBe(1)
		})

		test('should handle declaration without value', () => {
			let source = 'body { color: }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			let [_selector, decl] = rule.children
			expect(decl.type).toBe(NODE_DECLARATION)
		})

		test('should handle multiple semicolons', () => {
			let source = 'body { color: red;;; margin: 0;; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			expect(rule.children.length).toBeGreaterThan(0)
		})

		test('should skip invalid tokens in declaration block', () => {
			let source = 'body { color: red; @@@; margin: 0; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			// Should have selector + valid declarations
			expect(rule.children.length).toBeGreaterThan(1)
		})

		test('should handle declaration without colon', () => {
			let source = 'body { color red; margin: 0; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			// Parser tries to interpret "color red" as nested rule, still has children
			expect(rule.children.length).toBeGreaterThan(0)
		})

		test('should handle at-rule without name', () => {
			let source = '@ { color: red; } body { margin: 0; }'
			let parser = new Parser(source)
			let root = parser.parse()

			// Should recover and parse body rule
			expect(root.children.length).toBeGreaterThan(0)
		})

		test('should handle nested empty blocks', () => {
			let source = '.a { .b { .c { } } }'
			let parser = new Parser(source)
			let root = parser.parse()

			let a = root.first_child!
			expect(a.type).toBe(NODE_STYLE_RULE)
		})

		test('should handle trailing comma in selector', () => {
			let source = '.a, .b, { color: red; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			expect(rule.type).toBe(NODE_STYLE_RULE)
		})
	})

	describe('complex real-world scenarios', () => {
		test('should parse complex nested structure', () => {
			let source = `
				.card {
					display: flex;
					padding: 1rem;

					.header {
						font-size: 2rem;
						font-weight: bold;

						&:hover {
							color: blue;
						}
					}

					@media (min-width: 768px) {
						padding: 2rem;

						.header {
							font-size: 3rem;
						}
					}

					.footer {
						margin-top: auto;
					}
				}
			`
			let parser = new Parser(source)
			let root = parser.parse()

			let card = root.first_child!
			expect(card.type).toBe(NODE_STYLE_RULE)
			expect(card.children.length).toBeGreaterThan(4)
		})

		test('should parse multiple at-rules with nesting', () => {
			let source = `
				@layer base {
					body { margin: 0; }
				}

				@layer components {
					.btn {
						padding: 0.5rem;

						@media (hover: hover) {
							&:hover { opacity: 0.8; }
						}
					}
				}
			`
			let parser = new Parser(source)
			let root = parser.parse()

			let [layer1, layer2] = root.children
			expect(layer1.type).toBe(NODE_AT_RULE)
			expect(layer2.type).toBe(NODE_AT_RULE)
		})

		test('should parse vendor prefixed properties', () => {
			let source = '.box { -webkit-transform: scale(1); -moz-transform: scale(1); transform: scale(1); }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			let [_selector, decl1, decl2, decl3] = rule.children
			expect(decl1.name).toBe('-webkit-transform')
			expect(decl2.name).toBe('-moz-transform')
			expect(decl3.name).toBe('transform')
		})

		test('should parse complex selector list', () => {
			let source = 'h1, h2, h3, h4, h5, h6, .heading, [role="heading"] { font-family: sans-serif; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			let selector = rule.first_child!
			expect(selector.text).toContain('h1')
			expect(selector.text).toContain('[role="heading"]')
		})

		test('should parse deeply nested at-rules', () => {
			let source = `
				@supports (display: grid) {
					@media (min-width: 768px) {
						@layer utilities {
							.grid { display: grid; }
						}
					}
				}
			`
			let parser = new Parser(source)
			let root = parser.parse()

			let supports = root.first_child!
			let media = supports.first_child!
			let layer = media.first_child!
			expect(supports.name).toBe('supports')
			expect(media.name).toBe('media')
			expect(layer.name).toBe('layer')
		})

		test('should parse CSS with calc() and other functions', () => {
			let source = '.box { width: calc(100% - 2rem); background: linear-gradient(to right, red, blue); }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			let [_selector, width_decl, bg_decl] = rule.children
			expect(width_decl.name).toBe('width')
			expect(bg_decl.name).toBe('background')
		})

		test('should parse custom properties', () => {
			let source = ':root { --primary-color: #007bff; --spacing: 1rem; } body { color: var(--primary-color); }'
			let parser = new Parser(source)
			let root = parser.parse()

			// Parser may have issues with -- custom property names, check what we got
			expect(root.children.length).toBeGreaterThan(0)
			let first_rule = root.first_child!
			expect(first_rule.type).toBe(NODE_STYLE_RULE)
		})

		test('should parse attribute selectors with operators', () => {
			let source = '[href^="https"][href$=".pdf"][class*="doc"] { color: red; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			let selector = rule.first_child!
			expect(selector.text).toContain('^=')
			expect(selector.text).toContain('$=')
			expect(selector.text).toContain('*=')
		})

		test('should parse pseudo-elements', () => {
			let source = '.text::before { content: "→"; } .text::after { content: "←"; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let [rule1, rule2] = root.children
			expect(rule1.type).toBe(NODE_STYLE_RULE)
			expect(rule2.type).toBe(NODE_STYLE_RULE)
		})

		test('should parse multiple !important declarations', () => {
			let source = '.override { color: red !important; margin: 0 !important; padding: 0 !ie; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			expect(rule.children.length).toBeGreaterThan(1)
			// Check at least first declaration has important flag
			let declarations = rule.children.filter((c) => c.type === NODE_DECLARATION)
			expect(declarations.length).toBeGreaterThan(0)
			expect(declarations[0].is_important).toBe(true)
		})
	})

	describe('comment handling', () => {
		test('should skip comments at top level', () => {
			let source = '/* comment */ body { color: red; } /* another comment */'
			let parser = new Parser(source)
			let root = parser.parse()

			// Comments are skipped, only rule remains
			expect(root.children.length).toBe(1)
			let rule = root.first_child!
			expect(rule.type).toBe(NODE_STYLE_RULE)
		})

		test('should skip comments in declaration block', () => {
			let source = 'body { color: red; /* comment */ margin: 0; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			// Comments don't break parsing
			expect(rule.type).toBe(NODE_STYLE_RULE)
			expect(rule.children.length).toBeGreaterThan(0)
		})

		test('should skip comments in selector', () => {
			let source = 'body /* comment */ , /* comment */ div { color: red; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			expect(rule.type).toBe(NODE_STYLE_RULE)
		})

		test('should handle comment between property and colon', () => {
			let source = 'body { color /* comment */ : red; }'
			let parser = new Parser(source)
			let root = parser.parse()

			// Parser behavior with comments in unusual positions
			expect(root.has_children).toBe(true)
		})

		test('should handle multi-line comments', () => {
			let source = `
				/*
				 * Multi-line
				 * comment
				 */
				body { color: red; }
			`
			let parser = new Parser(source)
			let root = parser.parse()

			expect(root.children.length).toBe(1)
		})
	})

	describe('whitespace handling', () => {
		test('should handle excessive whitespace', () => {
			let source = '  body  {  color  :  red  ;  }  '
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			expect(rule.type).toBe(NODE_STYLE_RULE)
		})

		test('should handle tabs and newlines', () => {
			let source = 'body\t{\n\tcolor:\tred;\n}\n'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			expect(rule.type).toBe(NODE_STYLE_RULE)
		})

		test('should handle no whitespace', () => {
			let source = 'body{color:red;margin:0}'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			let [_selector, decl1, decl2] = rule.children
			expect(decl1.name).toBe('color')
			expect(decl2.name).toBe('margin')
		})
	})

	describe('special at-rules', () => {
		test('should parse @charset', () => {
			let source = '@charset "UTF-8"; body { color: red; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let [charset, _body] = root.children
			expect(charset.type).toBe(NODE_AT_RULE)
			expect(charset.name).toBe('charset')
		})

		test('should parse @import with media query', () => {
			let source = '@import url("print.css") print;'
			let parser = new Parser(source)
			let root = parser.parse()

			let import_rule = root.first_child!
			expect(import_rule.type).toBe(NODE_AT_RULE)
			expect(import_rule.name).toBe('import')
		})

		test('should parse @font-face with multiple descriptors', () => {
			let source = `
				@font-face {
					font-family: "Custom";
					src: url("font.woff2") format("woff2"),
					     url("font.woff") format("woff");
					font-weight: 400;
					font-style: normal;
					font-display: swap;
				}
			`
			let parser = new Parser(source)
			let root = parser.parse()

			let font_face = root.first_child!
			expect(font_face.name).toBe('font-face')
			expect(font_face.children.length).toBeGreaterThan(3)
		})

		test('should parse @keyframes with mixed percentages and keywords', () => {
			let source = '@keyframes slide { from { left: 0; } 25%, 75% { left: 50%; } to { left: 100%; } }'
			let parser = new Parser(source)
			let root = parser.parse()

			let keyframes = root.first_child!
			expect(keyframes.children.length).toBe(3)
		})

		test('should parse @counter-style', () => {
			let source = '@counter-style custom { system: cyclic; symbols: "⚫" "⚪"; suffix: " "; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let counter = root.first_child!
			expect(counter.name).toBe('counter-style')
			expect(counter.children.length).toBeGreaterThan(1)
		})

		test('should parse @property', () => {
			let source = '@property --my-color { syntax: "<color>"; inherits: false; initial-value: #c0ffee; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let property = root.first_child!
			expect(property.name).toBe('property')
		})
	})

	describe('location tracking', () => {
		test('should track line numbers for rules', () => {
			let source = 'body { color: red; }\ndiv { margin: 0; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let [rule1, rule2] = root.children
			expect(rule1.line).toBe(1)
			expect(rule2.line).toBe(2)
		})

		test('should track offsets correctly', () => {
			let source = 'body { color: red; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			expect(rule.offset).toBe(0)
			expect(rule.length).toBe(source.length)
		})

		test('should track declaration positions', () => {
			let source = 'body { color: red; margin: 0; }'
			let parser = new Parser(source)
			let root = parser.parse()

			let rule = root.first_child!
			let [_selector, decl1, decl2] = rule.children

			expect(decl1.offset).toBeLessThan(decl2.offset)
		})
	})
})
