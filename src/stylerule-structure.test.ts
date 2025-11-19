import { describe, test, expect } from 'vitest'
import { Parser } from './parser'
import { NODE_STYLE_RULE, NODE_SELECTOR_LIST, NODE_DECLARATION, NODE_AT_RULE } from './arena'

describe('StyleRule Structure', () => {
	test('should have selector list as first child, followed by declarations', () => {
		const parser = new Parser('body { color: red; margin: 0; }')
		const root = parser.parse()
		const rule = root.first_child!

		expect(rule.type).toBe(NODE_STYLE_RULE)

		// First child must be selector list
		const firstChild = rule.first_child!
		expect(firstChild.type).toBe(NODE_SELECTOR_LIST)

		// Second child should be declaration
		const secondChild = firstChild.next_sibling!
		expect(secondChild).not.toBeNull()
		expect(secondChild.type).toBe(NODE_DECLARATION)

		// Third child should be declaration
		const thirdChild = secondChild.next_sibling!
		expect(thirdChild).not.toBeNull()
		expect(thirdChild.type).toBe(NODE_DECLARATION)

		// No more children
		expect(thirdChild.next_sibling).toBeNull()
	})

	test('selector list children should be individual selector components with next_sibling links', () => {
		const parser = new Parser('h1, h2, h3 { color: red; }')
		const root = parser.parse()
		const rule = root.first_child!
		const selectorList = rule.first_child!

		expect(selectorList.type).toBe(NODE_SELECTOR_LIST)

		// Get all children of the selector list
		const children = []
		let child = selectorList.first_child
		while (child) {
			children.push(child)
			child = child.next_sibling
		}

		// Should have 3 selector components (h1, h2, h3)
		expect(children.length).toBe(3)

		// Each child except the last should have next_sibling
		for (let i = 0; i < children.length - 1; i++) {
			const nextSibling = children[i].next_sibling
			expect(nextSibling).not.toBeNull()
			// Compare by index since CSSNode creates new wrapper instances
			expect(nextSibling!.get_index()).toBe(children[i + 1].get_index())
		}

		// Last child should NOT have next_sibling
		expect(children[children.length - 1].next_sibling).toBeNull()
	})

	test('complex selectors should maintain component chains in selector list', () => {
		const parser = new Parser('div.class, span#id { margin: 0; }')
		const root = parser.parse()
		const rule = root.first_child!
		const selectorList = rule.first_child!

		expect(selectorList.type).toBe(NODE_SELECTOR_LIST)

		// Collect all NODE_SELECTOR wrappers (direct children of selector list)
		const selectors = []
		let selector = selectorList.first_child
		while (selector) {
			selectors.push(selector)
			selector = selector.next_sibling
		}

		// Should have 2 NODE_SELECTOR wrappers: div.class and span#id
		expect(selectors.length).toBe(2)

		// First selector (div.class) should have 2 components
		const components1 = []
		let comp = selectors[0].first_child
		while (comp) {
			components1.push(comp)
			comp = comp.next_sibling
		}
		expect(components1.length).toBe(2) // div, .class

		// Second selector (span#id) should have 2 components
		const components2 = []
		comp = selectors[1].first_child
		while (comp) {
			components2.push(comp)
			comp = comp.next_sibling
		}
		expect(components2.length).toBe(2) // span, #id
	})

	test('selector list should be first child, never in middle or end', () => {
		const testCases = [
			'body { color: red; }',
			'div { margin: 0; padding: 10px; }',
			'h1 { color: blue; .nested { margin: 0; } }',
			'p { font-size: 16px; @media print { display: none; } }'
		]

		testCases.forEach(source => {
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!

			// First child must be selector list
			expect(rule.first_child!.type).toBe(NODE_SELECTOR_LIST)

			// Walk through all children and verify no other selector lists
			let child = rule.first_child!.next_sibling
			while (child) {
				expect(child.type).not.toBe(NODE_SELECTOR_LIST)
				child = child.next_sibling
			}
		})
	})

	test('nested style rules should also have selector list as first child', () => {
		const parser = new Parser('div { .nested { color: red; } }')
		const root = parser.parse()
		const outerRule = root.first_child!

		// Outer rule structure
		expect(outerRule.type).toBe(NODE_STYLE_RULE)
		expect(outerRule.first_child!.type).toBe(NODE_SELECTOR_LIST)

		// Find the nested rule
		const nestedRule = outerRule.first_child!.next_sibling!
		expect(nestedRule.type).toBe(NODE_STYLE_RULE)

		// Nested rule should also have selector list as first child
		expect(nestedRule.first_child!.type).toBe(NODE_SELECTOR_LIST)

		// Declaration comes after selector list in nested rule
		expect(nestedRule.first_child!.next_sibling!.type).toBe(NODE_DECLARATION)
	})

	test('selector list with combinators should chain all components correctly', () => {
		const parser = new Parser('div > p, span + a { color: blue; }')
		const root = parser.parse()
		const rule = root.first_child!
		const selectorList = rule.first_child!

		// Collect all NODE_SELECTOR wrappers (direct children of selector list)
		const selectors = []
		let selector = selectorList.first_child
		while (selector) {
			selectors.push(selector)
			selector = selector.next_sibling
		}

		// Should have 2 NODE_SELECTOR wrappers: div > p and span + a
		expect(selectors.length).toBe(2)

		// First selector (div > p) should have 3 components: div, >, p
		const components1 = []
		let comp = selectors[0].first_child
		while (comp) {
			components1.push(comp)
			comp = comp.next_sibling
		}
		expect(components1.length).toBe(3)

		// Second selector (span + a) should have 3 components: span, +, a
		const components2 = []
		comp = selectors[1].first_child
		while (comp) {
			components2.push(comp)
			comp = comp.next_sibling
		}
		expect(components2.length).toBe(3)
	})

	test('empty rule should still have selector list as first child', () => {
		const parser = new Parser('body { }')
		const root = parser.parse()
		const rule = root.first_child!

		expect(rule.type).toBe(NODE_STYLE_RULE)
		expect(rule.first_child!.type).toBe(NODE_SELECTOR_LIST)

		// Selector list should be the only child
		expect(rule.first_child!.next_sibling).toBeNull()
	})
})
