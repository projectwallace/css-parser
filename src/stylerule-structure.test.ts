import { describe, test, expect } from 'vitest'
import { Parser } from './parse'
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

		// Second child should be block containing declarations
		const block = firstChild.next_sibling!
		expect(block).not.toBeNull()

		// Declarations should be inside the block
		const secondChild = block.first_child!
		expect(secondChild.type).toBe(NODE_DECLARATION)

		// Second declaration
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
			'p { font-size: 16px; @media print { display: none; } }',
		]

		testCases.forEach((source) => {
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

		// Find the nested rule (inside the block)
		const block = outerRule.first_child!.next_sibling!
		const nestedRule = block.first_child!
		expect(nestedRule.type).toBe(NODE_STYLE_RULE)

		// Nested rule should also have selector list as first child
		expect(nestedRule.first_child!.type).toBe(NODE_SELECTOR_LIST)

		// Declaration comes after selector list in nested rule's block
		const nestedBlock = nestedRule.first_child!.next_sibling!
		expect(nestedBlock.first_child!.type).toBe(NODE_DECLARATION)
	})

	test('& span should be parsed as ONE selector with 3 components', () => {
		const parser = new Parser('.parent { & span { color: red; } }')
		const root = parser.parse()
		const outerRule = root.first_child!

		// Find the nested rule (& span)
		const block = outerRule.first_child!.next_sibling!
		const nestedRule = block.first_child!
		expect(nestedRule.type).toBe(NODE_STYLE_RULE)

		// Get selector list
		const selectorList = nestedRule.first_child!
		expect(selectorList.type).toBe(NODE_SELECTOR_LIST)

		// Count how many selectors in the list (should be 1, not 2)
		const selectors = []
		let selector = selectorList.first_child
		while (selector) {
			selectors.push(selector)
			selector = selector.next_sibling
		}

		// BUG: This should be 1 selector, but might be 2
		expect(selectors.length).toBe(1)

		// The single selector should have 3 children: &, combinator (space), span
		if (selectors.length === 1) {
			const components = []
			let component = selectors[0].first_child
			while (component) {
				components.push(component)
				component = component.next_sibling
			}
			expect(components.length).toBe(3)
		}
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

		// Rule should have selector list + empty block
		const block = rule.first_child!.next_sibling
		expect(block).not.toBeNull()
		expect(block!.is_empty).toBe(true)
	})

	test('block children should be correctly linked via next_sibling with declarations only', () => {
		const parser = new Parser('body { color: red; margin: 0; padding: 10px; }')
		const root = parser.parse()
		const rule = root.first_child!

		// Get the block
		const selectorList = rule.first_child!
		const block = selectorList.next_sibling!

		// Collect all children using next_sibling
		const children = []
		let child = block.first_child
		while (child) {
			children.push(child)
			child = child.next_sibling
		}

		// Should have 3 declarations
		expect(children.length).toBe(3)

		// Verify each child is a declaration
		for (let i = 0; i < children.length; i++) {
			expect(children[i].type).toBe(NODE_DECLARATION)
		}

		// Verify next_sibling chain
		for (let i = 0; i < children.length - 1; i++) {
			expect(children[i].next_sibling).not.toBeNull()
			expect(children[i].next_sibling!.get_index()).toBe(children[i + 1].get_index())
		}

		// Last child should have null next_sibling
		expect(children[children.length - 1].next_sibling).toBeNull()
	})

	test('block children should be correctly linked via next_sibling with mixed content', () => {
		const parser = new Parser(`
			.parent {
				color: red;
				.nested { margin: 0; }
				padding: 10px;
				@media print { display: none; }
				font-size: 16px;
			}
		`)
		const root = parser.parse()
		const rule = root.first_child!

		// Get the block
		const selectorList = rule.first_child!
		const block = selectorList.next_sibling!

		// Collect all children using next_sibling
		const children = []
		let child = block.first_child
		while (child) {
			children.push(child)
			child = child.next_sibling
		}

		// Should have 5 children: declaration, nested rule, declaration, at-rule, declaration
		expect(children.length).toBe(5)

		// Verify types in order
		expect(children[0].type).toBe(NODE_DECLARATION) // color: red
		expect(children[1].type).toBe(NODE_STYLE_RULE) // .nested { margin: 0; }
		expect(children[2].type).toBe(NODE_DECLARATION) // padding: 10px
		expect(children[3].type).toBe(NODE_AT_RULE) // @media print { display: none; }
		expect(children[4].type).toBe(NODE_DECLARATION) // font-size: 16px

		// Verify next_sibling chain
		for (let i = 0; i < children.length - 1; i++) {
			const nextSibling = children[i].next_sibling
			expect(nextSibling).not.toBeNull()
			expect(nextSibling!.get_index()).toBe(children[i + 1].get_index())
		}

		// Last child should have null next_sibling
		expect(children[children.length - 1].next_sibling).toBeNull()
	})

	test('block with only nested rules should have correct next_sibling chain', () => {
		const parser = new Parser(`
			.parent {
				.child1 { color: red; }
				.child2 { margin: 0; }
				.child3 { padding: 10px; }
			}
		`)
		const root = parser.parse()
		const rule = root.first_child!

		// Get the block
		const selectorList = rule.first_child!
		const block = selectorList.next_sibling!

		// Collect all children using next_sibling
		const children = []
		let child = block.first_child
		while (child) {
			children.push(child)
			child = child.next_sibling
		}

		// Should have 3 nested rules
		expect(children.length).toBe(3)

		// Verify each is a style rule
		for (const child of children) {
			expect(child.type).toBe(NODE_STYLE_RULE)
		}

		// Verify next_sibling chain
		for (let i = 0; i < children.length - 1; i++) {
			expect(children[i].next_sibling).not.toBeNull()
			expect(children[i].next_sibling!.get_index()).toBe(children[i + 1].get_index())
		}

		// Last child should have null next_sibling
		expect(children[children.length - 1].next_sibling).toBeNull()
	})

	test('block with only at-rules should have correct next_sibling chain', () => {
		const parser = new Parser(`
			.parent {
				@media screen { color: blue; }
				@media print { display: none; }
				@supports (display: flex) { display: flex; }
			}
		`)
		const root = parser.parse()
		const rule = root.first_child!

		// Get the block
		const selectorList = rule.first_child!
		const block = selectorList.next_sibling!

		// Collect all children using next_sibling
		const children = []
		let child = block.first_child
		while (child) {
			children.push(child)
			child = child.next_sibling
		}

		// Should have 3 at-rules
		expect(children.length).toBe(3)

		// Verify each is an at-rule
		for (const child of children) {
			expect(child.type).toBe(NODE_AT_RULE)
		}

		// Verify next_sibling chain
		for (let i = 0; i < children.length - 1; i++) {
			expect(children[i].next_sibling).not.toBeNull()
			expect(children[i].next_sibling!.get_index()).toBe(children[i + 1].get_index())
		}

		// Last child should have null next_sibling
		expect(children[children.length - 1].next_sibling).toBeNull()
	})
})
