import { describe, test, expect } from 'vitest'
import { parse } from './parse'
import { NODE_STYLESHEET, NODE_STYLE_RULE, NODE_DECLARATION, NODE_AT_RULE } from './arena'

describe('parse()', () => {
	test('should parse CSS and return CSSNode', () => {
		const result = parse('body { color: red; }')

		expect(result.type).toBe(NODE_STYLESHEET)
		expect(result.has_children).toBe(true)
	})

	test('should parse empty CSS', () => {
		const result = parse('')

		expect(result.type).toBe(NODE_STYLESHEET)
		expect(result.has_children).toBe(false)
	})

	test('should parse CSS with style rules', () => {
		const result = parse('body { color: red; } div { margin: 0; }')

		expect(result.type).toBe(NODE_STYLESHEET)
		const [rule1, rule2] = result.children
		expect(rule1.type).toBe(NODE_STYLE_RULE)
		expect(rule2.type).toBe(NODE_STYLE_RULE)
	})

	test('should parse CSS with at-rules', () => {
		const result = parse('@media (min-width: 768px) { body { color: blue; } }')

		expect(result.type).toBe(NODE_STYLESHEET)
		const media = result.first_child!
		expect(media.type).toBe(NODE_AT_RULE)
		expect(media.name).toBe('media')
	})

	test('should parse CSS with declarations', () => {
		const result = parse('body { color: red; margin: 0; }')

		const rule = result.first_child!
		const [_selector, decl1, decl2] = rule.children
		expect(decl1.type).toBe(NODE_DECLARATION)
		expect(decl1.name).toBe('color')
		expect(decl2.type).toBe(NODE_DECLARATION)
		expect(decl2.name).toBe('margin')
	})

	test('should accept parser options', () => {
		const result = parse('body { color: red; }', { parse_selectors: false })

		expect(result.type).toBe(NODE_STYLESHEET)
		expect(result.has_children).toBe(true)
	})

	test('should parse with parse_values enabled', () => {
		const result = parse('body { color: red; }', { parse_values: true })

		const rule = result.first_child!
		const [_selector, decl] = rule.children
		expect(decl.name).toBe('color')
		expect(decl.value).toBe('red')
		// With parse_values, should have value children
		expect(decl.has_children).toBe(true)
	})

	test('should parse with parse_atrule_preludes enabled', () => {
		const result = parse('@media (min-width: 768px) { }', { parse_atrule_preludes: true })

		const media = result.first_child!
		expect(media.type).toBe(NODE_AT_RULE)
		expect(media.name).toBe('media')
		// With parse_atrule_preludes, should have prelude children
		expect(media.has_children).toBe(true)
	})

	test('should handle complex CSS', () => {
		const css = `
			.card {
				color: red;
				.title { font-size: 2rem; }
				@media (min-width: 768px) {
					padding: 2rem;
				}
			}
		`
		const result = parse(css)

		expect(result.type).toBe(NODE_STYLESHEET)
		expect(result.has_children).toBe(true)
		const card = result.first_child!
		expect(card.type).toBe(NODE_STYLE_RULE)
	})

	test('should preserve text property', () => {
		const css = 'body { color: red; }'
		const result = parse(css)

		expect(result.text).toBe(css)
	})

	test('should be iterable', () => {
		const result = parse('body { } div { }')

		const types: number[] = []
		for (const child of result) {
			types.push(child.type)
		}

		expect(types).toEqual([NODE_STYLE_RULE, NODE_STYLE_RULE])
	})
})
