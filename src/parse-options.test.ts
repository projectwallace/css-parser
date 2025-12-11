import { describe, it, expect } from 'vitest'
import { Parser } from './parse'
import { SELECTOR_LIST, DECLARATION, IDENTIFIER } from './arena'

describe('Parser Options', () => {
	const css = 'body { color: red; }'

	describe('Default behavior (all parsing enabled)', () => {
		it('should parse values and selectors by default', () => {
			const parser = new Parser(css)
			const root = parser.parse()
			const rule = root.first_child

			// Check selector is parsed with detailed structure
			// All selectors wrapped in NODE_SELECTOR_LIST
			const selector = rule?.first_child
			expect(selector).not.toBeNull()
			expect(selector?.type).toBe(SELECTOR_LIST)

			// Check value is parsed with detailed structure
			const block = selector?.next_sibling
			const declaration = block?.first_child
			expect(declaration).not.toBeNull()
			expect(declaration?.type).toBe(DECLARATION)
			expect(declaration?.has_children).toBe(true)
			expect(declaration?.first_child?.type).toBe(IDENTIFIER)
		})

		it('should parse values and selectors with explicit options', () => {
			const parser = new Parser(css, { parse_values: true, parse_selectors: true })
			const root = parser.parse()
			const rule = root.first_child

			// Check selector is parsed
			// Simple selector (just "body") returns NODE_SELECTOR_LIST directly
			const selector = rule?.first_child
			expect(selector?.type).toBe(SELECTOR_LIST)

			// Check value is parsed
			const block = selector?.next_sibling
			const declaration = block?.first_child
			expect(declaration?.has_children).toBe(true)
			expect(declaration?.first_child?.type).toBe(IDENTIFIER)
		})
	})

	describe('parse_values disabled', () => {
		it('should not parse value details when parse_values is false', () => {
			const parser = new Parser(css, { parse_values: false })
			const root = parser.parse()
			const rule = root.first_child

			// Selector should still be parsed
			// Simple selector (just "body") returns NODE_SELECTOR_LIST directly
			const selector = rule?.first_child
			expect(selector).not.toBeNull()
			expect(selector?.type).toBe(SELECTOR_LIST)

			// Declaration should exist but have no value children
			const block = selector?.next_sibling
			const declaration = block?.first_child
			expect(declaration).not.toBeNull()
			expect(declaration?.type).toBe(DECLARATION)
			expect(declaration?.property).toBe('color')
			expect(declaration?.value).toBe('red') // Raw value text still available
			expect(declaration?.has_children).toBe(false) // No detailed value nodes
		})

		it('should handle complex values without parsing', () => {
			const parser = new Parser('div { margin: 10px 20px; }', { parse_values: false })
			const root = parser.parse()
			const rule = root.first_child
			const selector = rule?.first_child
			const block = selector?.next_sibling
			const declaration = block?.first_child

			expect(declaration?.property).toBe('margin')
			expect(declaration?.value).toBe('10px 20px')
			expect(declaration?.has_children).toBe(false)
		})

		it('should handle function values without parsing', () => {
			const parser = new Parser('div { color: rgb(255, 0, 0); }', { parse_values: false })
			const root = parser.parse()
			const rule = root.first_child
			const selector = rule?.first_child
			const block = selector?.next_sibling
			const declaration = block?.first_child

			expect(declaration?.property).toBe('color')
			expect(declaration?.value).toBe('rgb(255, 0, 0)')
			expect(declaration?.has_children).toBe(false)
		})
	})

	describe('parseSelectors disabled', () => {
		it('should not parse selector details when parseSelectors is false', () => {
			const parser = new Parser(css, { parse_selectors: false })
			const root = parser.parse()
			const rule = root.first_child

			// Selector should exist but be simple (just NODE_SELECTOR_LIST, no detailed structure)
			const selector = rule?.first_child
			expect(selector).not.toBeNull()
			expect(selector?.type).toBe(SELECTOR_LIST)
			expect(selector?.text).toBe('body')
			expect(selector?.has_children).toBe(false) // No detailed selector nodes

			// Values should still be parsed
			const block = selector?.next_sibling
			const declaration = block?.first_child
			expect(declaration?.has_children).toBe(true)
			expect(declaration?.first_child?.type).toBe(IDENTIFIER)
		})

		it('should handle complex selectors without parsing', () => {
			const parser = new Parser('div.container#app { color: red; }', { parse_selectors: false })
			const root = parser.parse()
			const rule = root.first_child
			const selector = rule?.first_child

			expect(selector?.type).toBe(SELECTOR_LIST)
			expect(selector?.text).toBe('div.container#app')
			expect(selector?.has_children).toBe(false)
		})

		it('should handle selector lists without parsing', () => {
			const parser = new Parser('div, p, span { color: red; }', { parse_selectors: false })
			const root = parser.parse()
			const rule = root.first_child
			const selector = rule?.first_child

			expect(selector?.type).toBe(SELECTOR_LIST)
			expect(selector?.text).toBe('div, p, span')
			expect(selector?.has_children).toBe(false)
		})
	})

	describe('Both parse_values and parseSelectors disabled', () => {
		it('should not parse details for values or selectors', () => {
			const parser = new Parser(css, { parse_values: false, parse_selectors: false })
			const root = parser.parse()
			const rule = root.first_child

			// Selector should be simple
			const selector = rule?.first_child
			expect(selector?.type).toBe(SELECTOR_LIST)
			expect(selector?.text).toBe('body')
			expect(selector?.has_children).toBe(false)

			// Declaration should have no value children
			const block = selector?.next_sibling
			const declaration = block?.first_child
			expect(declaration?.type).toBe(DECLARATION)
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
			const parser = new Parser(css, { parse_values: false, parse_selectors: false })
			const root = parser.parse()
			const rule = root.first_child

			const selector = rule?.first_child
			expect(selector?.type).toBe(SELECTOR_LIST)
			expect(selector?.has_children).toBe(false)

			const block = selector?.next_sibling
			const decl1 = block?.first_child
			expect(decl1?.property).toBe('margin')
			expect(decl1?.value).toBe('10px 20px')
			expect(decl1?.has_children).toBe(false)

			const decl2 = decl1?.next_sibling
			expect(decl2?.property).toBe('color')
			expect(decl2?.value).toBe('rgb(255, 0, 0)')
			expect(decl2?.has_children).toBe(false)
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
			const parser = new Parser(css, { parse_values: false })
			const root = parser.parse()
			const rule = root.first_child
			const selector = rule?.first_child

			// Can quickly iterate through declarations without parsing complex values
			const block = selector?.next_sibling
			let decl = block?.first_child
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
			const parser = new Parser(css, { parse_selectors: false })
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
			const block = selector?.next_sibling
			const declaration = block?.first_child

			// Should use defaults (both enabled)
			expect(selector?.type).toBe(SELECTOR_LIST)
			expect(declaration?.has_children).toBe(true)
		})

		it('should accept partial options', () => {
			const parser = new Parser(css, { parse_values: false })
			const root = parser.parse()
			const rule = root.first_child
			const selector = rule?.first_child
			const block = selector?.next_sibling
			const declaration = block?.first_child

			// Selector should still be parsed (default true)
			expect(selector?.type).toBe(SELECTOR_LIST)
			// Values should not be parsed (explicitly false)
			expect(declaration?.has_children).toBe(false)
		})

		it('should accept skip_comments with parsing options', () => {
			const parser = new Parser('/* test */ body { color: red; }', {
				skip_comments: true,
				parse_values: false,
			})
			const root = parser.parse()
			const rule = root.first_child

			// Comment should be skipped
			expect(rule?.first_child?.text).toBe('body')
		})
	})
})
