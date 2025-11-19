import { describe, test, expect } from 'vitest'
import { parse_selector } from './parse-selector'
import { NODE_SELECTOR_LIST } from './arena'

describe('parse_selector()', () => {
	test('should parse simple type selector', () => {
		const result = parse_selector('div')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('div')
		expect(result.has_children).toBe(true)
	})

	test('should parse class selector', () => {
		const result = parse_selector('.classname')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('.classname')
		expect(result.has_children).toBe(true)
	})

	test('should parse ID selector', () => {
		const result = parse_selector('#identifier')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('#identifier')
		expect(result.has_children).toBe(true)
	})

	test('should parse compound selector', () => {
		const result = parse_selector('div.class#id')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('div.class#id')
		expect(result.has_children).toBe(true)
	})

	test('should parse complex selector with combinator', () => {
		const result = parse_selector('div.class > p#id')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('div.class > p#id')
		expect(result.has_children).toBe(true)
	})

	test('should parse selector list', () => {
		const result = parse_selector('h1, h2, h3')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('h1, h2, h3')
		expect(result.has_children).toBe(true)
	})

	test('should parse pseudo-class selector', () => {
		const result = parse_selector('a:hover')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('a:hover')
		expect(result.has_children).toBe(true)
	})

	test('should parse pseudo-class with function', () => {
		const result = parse_selector(':nth-child(2n+1)')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe(':nth-child(2n+1)')
		expect(result.has_children).toBe(true)
	})

	test('should parse attribute selector', () => {
		const result = parse_selector('[href^="https"]')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('[href^="https"]')
		expect(result.has_children).toBe(true)
	})

	test('should parse universal selector', () => {
		const result = parse_selector('*')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('*')
		expect(result.has_children).toBe(true)
	})

	test('should parse nesting selector', () => {
		const result = parse_selector('& .child')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('& .child')
		expect(result.has_children).toBe(true)
	})

	test('should parse descendant combinator', () => {
		const result = parse_selector('div span')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('div span')
		expect(result.has_children).toBe(true)
	})

	test('should parse child combinator', () => {
		const result = parse_selector('ul > li')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('ul > li')
		expect(result.has_children).toBe(true)
	})

	test('should parse adjacent sibling combinator', () => {
		const result = parse_selector('h1 + p')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('h1 + p')
		expect(result.has_children).toBe(true)
	})

	test('should parse general sibling combinator', () => {
		const result = parse_selector('h1 ~ p')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('h1 ~ p')
		expect(result.has_children).toBe(true)
	})

	test('should parse modern pseudo-classes', () => {
		const result = parse_selector(':is(h1, h2, h3)')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe(':is(h1, h2, h3)')
		expect(result.has_children).toBe(true)
	})

	test('should parse :where() pseudo-class', () => {
		const result = parse_selector(':where(.a, .b)')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe(':where(.a, .b)')
		expect(result.has_children).toBe(true)
	})

	test('should parse :has() pseudo-class', () => {
		const result = parse_selector('div:has(> img)')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('div:has(> img)')
		expect(result.has_children).toBe(true)
	})

	test('should parse empty selector', () => {
		const result = parse_selector('')

		expect(result.type).toBe(NODE_SELECTOR_LIST)
		expect(result.text).toBe('')
	})

	test('should be iterable', () => {
		const result = parse_selector('div.class')

		let childCount = 0
		for (const _child of result) {
			childCount++
		}

		expect(childCount).toBeGreaterThan(0)
	})

	test('should have working children property', () => {
		const result = parse_selector('div, span')

		expect(result.has_children).toBe(true)
		expect(result.children.length).toBeGreaterThan(0)
	})
})
