import { describe, it, expect } from 'vitest'
import { Parser } from './parser'
import {
	NODE_SELECTOR,
	NODE_SELECTOR_COMPOUND,
	NODE_DECLARATION,
	NODE_VALUE_KEYWORD,
} from './arena'

describe('Parser Options', () => {
	const css = 'body { color: red; }'

	describe('Default behavior (all parsing enabled)', () => {
		it('should parse values and selectors by default', () => {
			const parser = new Parser(css)
			const root = parser.parse()
			const rule = root.first_child

			// Check selector is parsed with detailed structure
			const selector = rule?.first_child
			expect(selector).not.toBeNull()
			expect(selector?.type).toBe(NODE_SELECTOR_COMPOUND)
			expect(selector?.has_children).toBe(true)

			// Check value is parsed with detailed structure
			const declaration = selector?.next_sibling
			expect(declaration).not.toBeNull()
			expect(declaration?.type).toBe(NODE_DECLARATION)
			expect(declaration?.has_children).toBe(true)
			expect(declaration?.first_child?.type).toBe(NODE_VALUE_KEYWORD)
		})

		it('should parse values and selectors with explicit options', () => {
			const parser = new Parser(css, { parseValues: true, parseSelectors: true })
			const root = parser.parse()
			const rule = root.first_child

			// Check selector is parsed
			const selector = rule?.first_child
			expect(selector?.type).toBe(NODE_SELECTOR_COMPOUND)
			expect(selector?.has_children).toBe(true)

			// Check value is parsed
			const declaration = selector?.next_sibling
			expect(declaration?.has_children).toBe(true)
			expect(declaration?.first_child?.type).toBe(NODE_VALUE_KEYWORD)
		})
	})

	describe('parseValues disabled', () => {
		it('should not parse value details when parseValues is false', () => {
			const parser = new Parser(css, { parseValues: false })
			const root = parser.parse()
			const rule = root.first_child

			// Selector should still be parsed
			const selector = rule?.first_child
			expect(selector).not.toBeNull()
			expect(selector?.type).toBe(NODE_SELECTOR_COMPOUND)
			expect(selector?.has_children).toBe(true)

			// Declaration should exist but have no value children
			const declaration = selector?.next_sibling
			expect(declaration).not.toBeNull()
			expect(declaration?.type).toBe(NODE_DECLARATION)
			expect(declaration?.property).toBe('color')
			expect(declaration?.value).toBe('red') // Raw value text still available
			expect(declaration?.has_children).toBe(false) // No detailed value nodes
		})

		it('should handle complex values without parsing', () => {
			const parser = new Parser('div { margin: 10px 20px; }', { parseValues: false })
			const root = parser.parse()
			const rule = root.first_child
			const selector = rule?.first_child
			const declaration = selector?.next_sibling

			expect(declaration?.property).toBe('margin')
			expect(declaration?.value).toBe('10px 20px')
			expect(declaration?.has_children).toBe(false)
		})

		it('should handle function values without parsing', () => {
			const parser = new Parser('div { color: rgb(255, 0, 0); }', { parseValues: false })
			const root = parser.parse()
			const rule = root.first_child
			const selector = rule?.first_child
			const declaration = selector?.next_sibling

			expect(declaration?.property).toBe('color')
			expect(declaration?.value).toBe('rgb(255, 0, 0)')
			expect(declaration?.has_children).toBe(false)
		})
	})

	describe('parseSelectors disabled', () => {
		it('should not parse selector details when parseSelectors is false', () => {
			const parser = new Parser(css, { parseSelectors: false })
			const root = parser.parse()
			const rule = root.first_child

			// Selector should exist but be simple (just NODE_SELECTOR, no detailed structure)
			const selector = rule?.first_child
			expect(selector).not.toBeNull()
			expect(selector?.type).toBe(NODE_SELECTOR)
			expect(selector?.text).toBe('body')
			expect(selector?.has_children).toBe(false) // No detailed selector nodes

			// Values should still be parsed
			const declaration = selector?.next_sibling
			expect(declaration?.has_children).toBe(true)
			expect(declaration?.first_child?.type).toBe(NODE_VALUE_KEYWORD)
		})

		it('should handle complex selectors without parsing', () => {
			const parser = new Parser('div.container#app { color: red; }', { parseSelectors: false })
			const root = parser.parse()
			const rule = root.first_child
			const selector = rule?.first_child

			expect(selector?.type).toBe(NODE_SELECTOR)
			expect(selector?.text).toBe('div.container#app')
			expect(selector?.has_children).toBe(false)
		})

		it('should handle selector lists without parsing', () => {
			const parser = new Parser('div, p, span { color: red; }', { parseSelectors: false })
			const root = parser.parse()
			const rule = root.first_child
			const selector = rule?.first_child

			expect(selector?.type).toBe(NODE_SELECTOR)
			expect(selector?.text).toBe('div, p, span')
			expect(selector?.has_children).toBe(false)
		})
	})

	describe('Both parseValues and parseSelectors disabled', () => {
		it('should not parse details for values or selectors', () => {
			const parser = new Parser(css, { parseValues: false, parseSelectors: false })
			const root = parser.parse()
			const rule = root.first_child

			// Selector should be simple
			const selector = rule?.first_child
			expect(selector?.type).toBe(NODE_SELECTOR)
			expect(selector?.text).toBe('body')
			expect(selector?.has_children).toBe(false)

			// Declaration should have no value children
			const declaration = selector?.next_sibling
			expect(declaration?.type).toBe(NODE_DECLARATION)
			expect(declaration?.property).toBe('color')
			expect(declaration?.value).toBe('red')
			expect(declaration?.has_children).toBe(false)
		})

		it('should handle complex CSS without detailed parsing', () => {
			const css = `
				div.container > p:hover {
					margin: 10px 20px;
					color: rgb(255, 0, 0);
				}
			`
			const parser = new Parser(css, { parseValues: false, parseSelectors: false })
			const root = parser.parse()
			const rule = root.first_child

			const selector = rule?.first_child
			expect(selector?.type).toBe(NODE_SELECTOR)
			expect(selector?.has_children).toBe(false)

			const decl1 = selector?.next_sibling
			expect(decl1?.property).toBe('margin')
			expect(decl1?.value).toBe('10px 20px')
			expect(decl1?.has_children).toBe(false)

			const decl2 = decl1?.next_sibling
			expect(decl2?.property).toBe('color')
			expect(decl2?.value).toBe('rgb(255, 0, 0)')
			expect(decl2?.has_children).toBe(false)
		})
	})

	describe('Backwards compatibility', () => {
		it('should support legacy boolean parameter for skip_comments', () => {
			const parser = new Parser('/* comment */ body { color: red; }', true)
			const root = parser.parse()
			const rule = root.first_child

			// Should parse normally with comments skipped
			expect(rule).not.toBeNull()
			const selector = rule?.first_child
			expect(selector?.text).toBe('body')
		})

		it('should support legacy boolean false parameter', () => {
			const parser = new Parser('/* comment */ body { color: red; }', false)
			const root = parser.parse()

			// First child should be comment
			const comment = root.first_child
			expect(comment).not.toBeNull()
		})

		it('should parse values and selectors with legacy parameter', () => {
			const parser = new Parser(css, true)
			const root = parser.parse()
			const rule = root.first_child
			const selector = rule?.first_child
			const declaration = selector?.next_sibling

			// Both should be parsed by default
			expect(selector?.type).toBe(NODE_SELECTOR_COMPOUND)
			expect(selector?.has_children).toBe(true)
			expect(declaration?.has_children).toBe(true)
		})
	})

	describe('Performance optimization use cases', () => {
		it('should skip value parsing for fast property name extraction', () => {
			const css = `
				div {
					color: red;
					background: url(image.png) no-repeat center;
					margin: 10px 20px 30px 40px;
				}
			`
			const parser = new Parser(css, { parseValues: false })
			const root = parser.parse()
			const rule = root.first_child
			const selector = rule?.first_child

			// Can quickly iterate through declarations without parsing complex values
			let decl = selector?.next_sibling
			const properties: string[] = []
			while (decl) {
				if (decl.property) {
					properties.push(decl.property)
				}
				decl = decl.next_sibling
			}

			expect(properties).toEqual(['color', 'background', 'margin'])
		})

		it('should skip selector parsing for fast rule counting', () => {
			const css = `
				div.complex > p:nth-child(2n+1)::before { color: red; }
				.another-complex[data-attr~="value"] { margin: 0; }
				#very-specific-id:not(.excluded) { padding: 10px; }
			`
			const parser = new Parser(css, { parseSelectors: false })
			const root = parser.parse()

			// Can quickly count rules without parsing complex selectors
			let count = 0
			let node = root.first_child
			while (node) {
				count++
				node = node.next_sibling
			}

			expect(count).toBe(3)
		})
	})

	describe('Options validation', () => {
		it('should accept empty options object', () => {
			const parser = new Parser(css, {})
			const root = parser.parse()
			const rule = root.first_child
			const selector = rule?.first_child
			const declaration = selector?.next_sibling

			// Should use defaults (both enabled)
			expect(selector?.type).toBe(NODE_SELECTOR_COMPOUND)
			expect(declaration?.has_children).toBe(true)
		})

		it('should accept partial options', () => {
			const parser = new Parser(css, { parseValues: false })
			const root = parser.parse()
			const rule = root.first_child
			const selector = rule?.first_child
			const declaration = selector?.next_sibling

			// Selector should still be parsed (default true)
			expect(selector?.type).toBe(NODE_SELECTOR_COMPOUND)
			// Values should not be parsed (explicitly false)
			expect(declaration?.has_children).toBe(false)
		})

		it('should accept skip_comments with parsing options', () => {
			const parser = new Parser('/* test */ body { color: red; }', {
				skip_comments: true,
				parseValues: false,
			})
			const root = parser.parse()
			const rule = root.first_child

			// Comment should be skipped
			expect(rule?.first_child?.text).toBe('body')
		})
	})
})
