import { describe, it, expect, test } from 'vitest'
import { SelectorParser, parse_selector } from './parse-selector'
import { CSSDataArena } from './arena'
import {
	NODE_SELECTOR,
	NODE_SELECTOR_LIST,
	NODE_SELECTOR_TYPE,
	NODE_SELECTOR_CLASS,
	NODE_SELECTOR_ID,
	NODE_SELECTOR_ATTRIBUTE,
	NODE_SELECTOR_PSEUDO_CLASS,
	NODE_SELECTOR_PSEUDO_ELEMENT,
	NODE_SELECTOR_COMBINATOR,
	NODE_SELECTOR_UNIVERSAL,
	NODE_SELECTOR_NESTING,
	NODE_SELECTOR_NTH,
	NODE_SELECTOR_NTH_OF,
	NODE_SELECTOR_LANG,
	ATTR_FLAG_NONE,
	ATTR_FLAG_CASE_INSENSITIVE,
	ATTR_FLAG_CASE_SENSITIVE,
} from './arena'

// Tests using the exported parse_selector() function
describe('parse_selector() function', () => {
	it('should parse and return a CSSNode', () => {
		const node = parse_selector('div.container')
		expect(node).toBeDefined()
		expect(node.type).toBe(NODE_SELECTOR_LIST)
		expect(node.text).toBe('div.container')
	})

	it('should parse type selector', () => {
		const node = parse_selector('div')
		expect(node.type).toBe(NODE_SELECTOR_LIST)

		const firstSelector = node.first_child
		expect(firstSelector?.type).toBe(NODE_SELECTOR)

		const typeNode = firstSelector?.first_child
		expect(typeNode?.type).toBe(NODE_SELECTOR_TYPE)
		expect(typeNode?.text).toBe('div')
	})

	it('should parse class selector', () => {
		const node = parse_selector('.my-class')
		const firstSelector = node.first_child
		const classNode = firstSelector?.first_child

		expect(classNode?.type).toBe(NODE_SELECTOR_CLASS)
		expect(classNode?.name).toBe('my-class')
	})

	it('should parse ID selector', () => {
		const node = parse_selector('#my-id')
		const firstSelector = node.first_child
		const idNode = firstSelector?.first_child

		expect(idNode?.type).toBe(NODE_SELECTOR_ID)
		expect(idNode?.name).toBe('my-id')
	})

	it('should parse compound selector', () => {
		const node = parse_selector('div.container#app')
		const firstSelector = node.first_child
		const children = firstSelector?.children || []

		expect(children.length).toBe(3)
		expect(children[0].type).toBe(NODE_SELECTOR_TYPE)
		expect(children[1].type).toBe(NODE_SELECTOR_CLASS)
		expect(children[2].type).toBe(NODE_SELECTOR_ID)
	})

	it('should parse complex selector with descendant combinator', () => {
		const node = parse_selector('div .container')
		const firstSelector = node.first_child
		const children = firstSelector?.children || []

		expect(children.length).toBe(3) // div, combinator, .container
		expect(children[0].type).toBe(NODE_SELECTOR_TYPE)
		expect(children[1].type).toBe(NODE_SELECTOR_COMBINATOR)
		expect(children[2].type).toBe(NODE_SELECTOR_CLASS)
	})

	it('should parse selector list', () => {
		const node = parse_selector('div, span, p')
		const selectors = node.children

		expect(selectors.length).toBe(3)
		expect(selectors[0].first_child?.type).toBe(NODE_SELECTOR_TYPE)
		expect(selectors[1].first_child?.type).toBe(NODE_SELECTOR_TYPE)
		expect(selectors[2].first_child?.type).toBe(NODE_SELECTOR_TYPE)
	})
})

// Internal SelectorParser class tests (for implementation details)
// These tests use low-level arena API to test internal implementation

// Helper for low-level testing
function parseSelectorInternal(selector: string) {
	const arena = new CSSDataArena(256)
	const parser = new SelectorParser(arena, selector)
	const rootNode = parser.parse_selector(0, selector.length)
	return { arena, rootNode, source: selector }
}

// Helper to get node text
function getNodeText(arena: CSSDataArena, source: string, nodeIndex: number): string {
	const start = arena.get_start_offset(nodeIndex)
	const length = arena.get_length(nodeIndex)
	return source.substring(start, start + length)
}

// Helper to get node content (name)
function getNodeContent(arena: CSSDataArena, source: string, nodeIndex: number): string {
	const start = arena.get_content_start(nodeIndex)
	const length = arena.get_content_length(nodeIndex)
	return source.substring(start, start + length)
}

// Helper to get all children
function getChildren(arena: CSSDataArena, source: string, nodeIndex: number | null) {
	if (nodeIndex === null) return []
	const children: number[] = []
	let child = arena.get_first_child(nodeIndex)
	while (child !== 0) {
		children.push(child)
		child = arena.get_next_sibling(child)
	}
	return children
}

describe('SelectorParser', () => {
	describe('Simple selectors', () => {
		it('should parse type selector', () => {
			const { arena, rootNode, source } = parseSelectorInternal('div')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)
			expect(getNodeText(arena, source, rootNode)).toBe('div')

			// First child is NODE_SELECTOR wrapper
			const selectorWrapper = arena.get_first_child(rootNode)
			expect(arena.get_type(selectorWrapper)).toBe(NODE_SELECTOR)

			// First child of wrapper is the actual type
			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_TYPE)
			expect(getNodeText(arena, source, child)).toBe('div')
		})

		it('should parse class selector', () => {
			const { arena, rootNode, source } = parseSelectorInternal('.my-class')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			const selectorWrapper = arena.get_first_child(rootNode)
			expect(arena.get_type(selectorWrapper)).toBe(NODE_SELECTOR)

			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_CLASS)
			expect(getNodeText(arena, source, child)).toBe('.my-class')
			expect(getNodeContent(arena, source, child)).toBe('my-class')
		})

		it('should parse ID selector', () => {
			const { arena, rootNode, source } = parseSelectorInternal('#my-id')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			const selectorWrapper = arena.get_first_child(rootNode)
			expect(arena.get_type(selectorWrapper)).toBe(NODE_SELECTOR)

			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ID)
			expect(getNodeText(arena, source, child)).toBe('#my-id')
			expect(getNodeContent(arena, source, child)).toBe('my-id')
		})

		it('should parse universal selector', () => {
			const { arena, rootNode, source } = parseSelectorInternal('*')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			const selectorWrapper = arena.get_first_child(rootNode)
			expect(arena.get_type(selectorWrapper)).toBe(NODE_SELECTOR)

			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_UNIVERSAL)
			expect(getNodeText(arena, source, child)).toBe('*')
		})

		it('should parse nesting selector', () => {
			const { arena, rootNode, source } = parseSelectorInternal('&')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			const selectorWrapper = arena.get_first_child(rootNode)
			expect(arena.get_type(selectorWrapper)).toBe(NODE_SELECTOR)

			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_NESTING)
			expect(getNodeText(arena, source, child)).toBe('&')
		})
	})

	describe('Compound selectors', () => {
		it('should parse element with class', () => {
			const { arena, rootNode, source } = parseSelectorInternal('div.container')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			// Get the NODE_SELECTOR wrapper
			const selectorWrapper = arena.get_first_child(rootNode)
			expect(arena.get_type(selectorWrapper)).toBe(NODE_SELECTOR)

			// Compound selector has multiple children
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_TYPE)
			expect(getNodeText(arena, source, children[0])).toBe('div')
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_CLASS)
			expect(getNodeContent(arena, source, children[1])).toBe('container')
		})

		it('should parse element with ID', () => {
			const { arena, rootNode, source } = parseSelectorInternal('div#app')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_TYPE)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_ID)
			expect(getNodeContent(arena, source, children[1])).toBe('app')
		})

		it('should parse element with multiple classes', () => {
			const { arena, rootNode, source } = parseSelectorInternal('div.foo.bar.baz')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(4)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_TYPE)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_CLASS)
			expect(getNodeContent(arena, source, children[1])).toBe('foo')
			expect(arena.get_type(children[2])).toBe(NODE_SELECTOR_CLASS)
			expect(getNodeContent(arena, source, children[2])).toBe('bar')
			expect(arena.get_type(children[3])).toBe(NODE_SELECTOR_CLASS)
			expect(getNodeContent(arena, source, children[3])).toBe('baz')
		})

		it('should parse complex compound selector', () => {
			const { arena, rootNode, source } = parseSelectorInternal('div.container#app')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(3)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_TYPE)
			expect(getNodeText(arena, source, children[0])).toBe('div')
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_CLASS)
			expect(getNodeContent(arena, source, children[1])).toBe('container')
			expect(arena.get_type(children[2])).toBe(NODE_SELECTOR_ID)
			expect(getNodeContent(arena, source, children[2])).toBe('app')
		})
	})

	describe('Pseudo-classes', () => {
		it('should parse simple pseudo-class', () => {
			const { arena, rootNode, source } = parseSelectorInternal('a:hover')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_TYPE)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(getNodeContent(arena, source, children[1])).toBe('hover')
		})

		it('should parse pseudo-class with function', () => {
			const { arena, rootNode, source } = parseSelectorInternal('li:nth-child(2n+1)')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_TYPE)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(getNodeContent(arena, source, children[1])).toBe('nth-child')
			expect(getNodeText(arena, source, children[1])).toBe(':nth-child(2n+1)')
		})

		it('should parse multiple pseudo-classes', () => {
			const { arena, rootNode, source } = parseSelectorInternal('input:focus:valid')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(3)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_TYPE)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(getNodeContent(arena, source, children[1])).toBe('focus')
			expect(arena.get_type(children[2])).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(getNodeContent(arena, source, children[2])).toBe('valid')
		})

		it('should parse :is() pseudo-class', () => {
			const { arena, rootNode, source } = parseSelectorInternal('a:is(.active)')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(getNodeContent(arena, source, children[1])).toBe('is')
		})

		it('should parse :not() pseudo-class', () => {
			const { arena, rootNode, source } = parseSelectorInternal('div:not(.disabled)')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(getNodeContent(arena, source, children[1])).toBe('not')
		})
	})

	describe('Pseudo-elements', () => {
		it('should parse pseudo-element with double colon', () => {
			const { arena, rootNode, source } = parseSelectorInternal('p::before')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_TYPE)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_PSEUDO_ELEMENT)
			expect(getNodeContent(arena, source, children[1])).toBe('before')
		})

		it('should parse pseudo-element with single colon (legacy)', () => {
			const { arena, rootNode, source } = parseSelectorInternal('p:after')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_TYPE)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(getNodeContent(arena, source, children[1])).toBe('after')
		})

		it('should parse ::first-line pseudo-element', () => {
			const { arena, rootNode, source } = parseSelectorInternal('p::first-line')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_PSEUDO_ELEMENT)
			expect(getNodeContent(arena, source, children[1])).toBe('first-line')
		})
	})

	describe('Attribute selectors', () => {
		it('should parse simple attribute selector', () => {
			const { arena, rootNode, source } = parseSelectorInternal('[disabled]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			const selectorWrapper = arena.get_first_child(rootNode)
			expect(arena.get_type(selectorWrapper)).toBe(NODE_SELECTOR)

			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			expect(getNodeText(arena, source, child)).toBe('[disabled]')
			expect(getNodeContent(arena, source, child)).toBe('disabled')
		})

		it('should parse attribute with value', () => {
			const { arena, rootNode, source } = parseSelectorInternal('[type="text"]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			const selectorWrapper = arena.get_first_child(rootNode)
			expect(arena.get_type(selectorWrapper)).toBe(NODE_SELECTOR)

			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			expect(getNodeText(arena, source, child)).toBe('[type="text"]')
			// Content now stores just the attribute name
			expect(getNodeContent(arena, source, child)).toBe('type')
		})

		it('should parse attribute with operator', () => {
			const { arena, rootNode, source } = parseSelectorInternal('[class^="btn-"]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			const selectorWrapper = arena.get_first_child(rootNode)
			expect(arena.get_type(selectorWrapper)).toBe(NODE_SELECTOR)

			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			expect(getNodeText(arena, source, child)).toBe('[class^="btn-"]')
		})

		it('should parse element with attribute', () => {
			const { arena, rootNode, source } = parseSelectorInternal('input[type="checkbox"]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_TYPE)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_ATTRIBUTE)
		})

		it('should trim whitespace from attribute selectors', () => {
			const { arena, rootNode, source } = parseSelectorInternal('[   data-test="value"   ]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			// Content now stores just the attribute name
			expect(getNodeContent(arena, source, child)).toBe('data-test')
			// Full text still includes brackets
			expect(getNodeText(arena, source, child)).toBe('[   data-test="value"   ]')
		})

		it('should trim comments from attribute selectors', () => {
			const { arena, rootNode, source } = parseSelectorInternal('[/* comment */data-test="value"/* test */]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			// Content now stores just the attribute name
			expect(getNodeContent(arena, source, child)).toBe('data-test')
		})

		it('should trim whitespace and comments from attribute selectors', () => {
			const { arena, rootNode, source } = parseSelectorInternal('[/* comment */   data-test="value"   /* test */]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			// Content now stores just the attribute name
			expect(getNodeContent(arena, source, child)).toBe('data-test')
		})

		it('should parse attribute with case-insensitive flag', () => {
			const { arena, rootNode, source } = parseSelectorInternal('[type="text" i]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			expect(getNodeText(arena, source, child)).toBe('[type="text" i]')
			expect(getNodeContent(arena, source, child)).toBe('type')
			expect(arena.get_attr_flags(child)).toBe(ATTR_FLAG_CASE_INSENSITIVE)
		})

		it('should parse attribute with case-sensitive flag', () => {
			const { arena, rootNode, source } = parseSelectorInternal('[type="text" s]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			expect(getNodeText(arena, source, child)).toBe('[type="text" s]')
			expect(getNodeContent(arena, source, child)).toBe('type')
			expect(arena.get_attr_flags(child)).toBe(ATTR_FLAG_CASE_SENSITIVE)
		})

		it('should parse attribute with uppercase case-insensitive flag', () => {
			const { arena, rootNode, source } = parseSelectorInternal('[type="text" I]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			expect(arena.get_attr_flags(child)).toBe(ATTR_FLAG_CASE_INSENSITIVE)
		})

		it('should parse attribute with whitespace before flag', () => {
			const { arena, rootNode, source } = parseSelectorInternal('[type="text"   i]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			expect(arena.get_attr_flags(child)).toBe(ATTR_FLAG_CASE_INSENSITIVE)
		})

		it('should parse attribute without flag', () => {
			const { arena, rootNode, source } = parseSelectorInternal('[type="text"]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			expect(arena.get_attr_flags(child)).toBe(ATTR_FLAG_NONE)
		})

		it('should handle flag with various operators', () => {
			// Test with ^= operator
			const test1 = parseSelectorInternal('[class^="btn" i]')
			if (!test1.rootNode) throw new Error('Expected rootNode')
			const wrapper1 = test1.arena.get_first_child(test1.rootNode)
			if (!wrapper1) throw new Error('Expected wrapper1')
			const child1 = test1.arena.get_first_child(wrapper1)
			if (!child1) throw new Error('Expected child1')
			expect(test1.arena.get_attr_flags(child1)).toBe(ATTR_FLAG_CASE_INSENSITIVE)

			// Test with $= operator
			const test2 = parseSelectorInternal('[class$="btn" s]')
			if (!test2.rootNode) throw new Error('Expected rootNode')
			const wrapper2 = test2.arena.get_first_child(test2.rootNode)
			if (!wrapper2) throw new Error('Expected wrapper2')
			const child2 = test2.arena.get_first_child(wrapper2)
			if (!child2) throw new Error('Expected child2')
			expect(test2.arena.get_attr_flags(child2)).toBe(ATTR_FLAG_CASE_SENSITIVE)

			// Test with ~= operator
			const test3 = parseSelectorInternal('[class~="active" i]')
			if (!test3.rootNode) throw new Error('Expected rootNode')
			const wrapper3 = test3.arena.get_first_child(test3.rootNode)
			if (!wrapper3) throw new Error('Expected wrapper3')
			const child3 = test3.arena.get_first_child(wrapper3)
			if (!child3) throw new Error('Expected child3')
			expect(test3.arena.get_attr_flags(child3)).toBe(ATTR_FLAG_CASE_INSENSITIVE)
		})
	})

	describe('Combinators', () => {
		it('should parse descendant combinator (space)', () => {
			const { arena, rootNode, source } = parseSelectorInternal('div p')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children.length).toBeGreaterThanOrEqual(2)

			// Should have: compound(div), combinator(space), compound(p)
			const hasDescendantCombinator = children.some((child) => {
				const type = arena.get_type(child)
				return type === NODE_SELECTOR_COMBINATOR
			})
			expect(hasDescendantCombinator).toBe(true)
		})

		it('should parse child combinator (>)', () => {
			const { arena, rootNode, source } = parseSelectorInternal('div > p')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)

			const hasCombinator = children.some((child) => {
				const type = arena.get_type(child)
				if (type === NODE_SELECTOR_COMBINATOR) {
					return getNodeText(arena, source, child).includes('>')
				}
				return false
			})
			expect(hasCombinator).toBe(true)
		})

		it('should parse adjacent sibling combinator (+)', () => {
			const { arena, rootNode, source } = parseSelectorInternal('h1 + p')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)

			const hasCombinator = children.some((child) => {
				const type = arena.get_type(child)
				if (type === NODE_SELECTOR_COMBINATOR) {
					return getNodeText(arena, source, child).includes('+')
				}
				return false
			})
			expect(hasCombinator).toBe(true)
		})

		it('should parse general sibling combinator (~)', () => {
			const { arena, rootNode, source } = parseSelectorInternal('h1 ~ p')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)

			const hasCombinator = children.some((child) => {
				const type = arena.get_type(child)
				if (type === NODE_SELECTOR_COMBINATOR) {
					return getNodeText(arena, source, child).includes('~')
				}
				return false
			})
			expect(hasCombinator).toBe(true)
		})
	})

	describe('Selector lists (comma-separated)', () => {
		it('should parse selector list with two selectors', () => {
			const { arena, rootNode, source } = parseSelectorInternal('div, p')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			// List contains the two selectors
			const children = getChildren(arena, source, rootNode)
			expect(children).toHaveLength(2)
		})

		it('should parse selector list with three selectors', () => {
			const { arena, rootNode, source } = parseSelectorInternal('h1, h2, h3')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			// List contains the three selectors
			const children = getChildren(arena, source, rootNode)
			expect(children).toHaveLength(3)
		})

		it('should parse complex selector list', () => {
			const { arena, rootNode, source } = parseSelectorInternal('div.container, .wrapper > p, #app')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			// List contains 3 NODE_SELECTOR wrappers: div.container, .wrapper > p, #app
			const children = getChildren(arena, source, rootNode)
			expect(children).toHaveLength(3)
		})
	})

	describe('Complex selectors', () => {
		it('should parse navigation selector', () => {
			const { arena, rootNode } = parseSelectorInternal('nav > ul > li > a')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)
		})

		it('should parse form selector', () => {
			const { arena, rootNode } = parseSelectorInternal('form input[type="text"]:focus')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Should parse without errors
			expect(arena.get_type(rootNode)).toBeDefined()
		})

		it('should parse complex nesting selector', () => {
			const { arena, rootNode } = parseSelectorInternal('.parent .child:hover::before')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			expect(arena.get_type(rootNode)).toBeDefined()
		})

		it('should parse multiple combinators', () => {
			const { arena, rootNode, source } = parseSelectorInternal('div > .container + p ~ span')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)

			const combinators = children.filter((child) => {
				return arena.get_type(child) === NODE_SELECTOR_COMBINATOR
			})

			expect(combinators.length).toBeGreaterThan(0)
		})
	})

	describe('Modern CSS selectors', () => {
		it('should parse :where() pseudo-class', () => {
			const { arena, rootNode, source } = parseSelectorInternal(':where(article, section)')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			const selectorWrapper = arena.get_first_child(rootNode)
			expect(arena.get_type(selectorWrapper)).toBe(NODE_SELECTOR)

			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(getNodeContent(arena, source, child)).toBe('where')
		})

		it('should parse :has(a) pseudo-class', () => {
			const root = parse_selector('div:has(a)')

			expect(root.first_child?.type).toBe(NODE_SELECTOR)
			expect(root.first_child!.children).toHaveLength(2)
			const [_, has] = root.first_child!.children

			expect(has.type).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(has.text).toBe(':has(a)')

			// Check children of :has() - should contain selector list with > combinator and p type selector
			expect(has.has_children).toBe(true)
			const selectorList = has.first_child!
			expect(selectorList.type).toBe(NODE_SELECTOR_LIST)

			// Selector list contains one selector
			const selector = selectorList.first_child!
			expect(selector.type).toBe(NODE_SELECTOR)

			const selectorParts = selector.children
			expect(selectorParts).toHaveLength(1)
			expect(selectorParts[0].type).toBe(NODE_SELECTOR_TYPE)
			expect(selectorParts[0].text).toBe('a')
		})

		it('should parse :has(> p) pseudo-class', () => {
			const root = parse_selector('div:has(> p)')

			expect(root.first_child?.type).toBe(NODE_SELECTOR)
			expect(root.first_child!.children).toHaveLength(2)
			const [div, has] = root.first_child!.children
			expect(div.type).toBe(NODE_SELECTOR_TYPE)
			expect(div.text).toBe('div')

			expect(has.type).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(has.text).toBe(':has(> p)')

			// Check children of :has() - should contain selector list with > combinator and p type selector
			expect(has.has_children).toBe(true)
			const selectorList = has.first_child!
			expect(selectorList.type).toBe(NODE_SELECTOR_LIST)

			// Selector list contains one selector
			const selector = selectorList.first_child!
			expect(selector.type).toBe(NODE_SELECTOR)

			const selectorParts = selector.children
			expect(selectorParts).toHaveLength(2)
			expect(selectorParts[0].type).toBe(NODE_SELECTOR_COMBINATOR)
			expect(selectorParts[0].text).toBe('>')
			expect(selectorParts[1].type).toBe(NODE_SELECTOR_TYPE)
			expect(selectorParts[1].text).toBe('p')
		})

		it('should parse :has() with adjacent sibling combinator (+)', () => {
			const root = parse_selector('div:has(+ p)')
			const has = root.first_child!.children[1]
			const selectorList = has.first_child!
			const selector = selectorList.first_child!
			const parts = selector.children

			expect(parts).toHaveLength(2)
			expect(parts[0].type).toBe(NODE_SELECTOR_COMBINATOR)
			expect(parts[0].text).toBe('+')
			expect(parts[1].type).toBe(NODE_SELECTOR_TYPE)
			expect(parts[1].text).toBe('p')
		})

		it('should parse :has() with general sibling combinator (~)', () => {
			const root = parse_selector('div:has(~ p)')
			const has = root.first_child!.children[1]
			const selectorList = has.first_child!
			const selector = selectorList.first_child!
			const parts = selector.children

			expect(parts).toHaveLength(2)
			expect(parts[0].type).toBe(NODE_SELECTOR_COMBINATOR)
			expect(parts[0].text).toBe('~')
			expect(parts[1].type).toBe(NODE_SELECTOR_TYPE)
			expect(parts[1].text).toBe('p')
		})

		it('should parse :has() with descendant selector (no combinator)', () => {
			const root = parse_selector('div:has(p)')
			const has = root.first_child!.children[1]
			const selectorList = has.first_child!
			const selector = selectorList.first_child!

			expect(selector.children).toHaveLength(1)
			expect(selector.children[0].type).toBe(NODE_SELECTOR_TYPE)
			expect(selector.children[0].text).toBe('p')
		})

		it('should parse :has() with multiple selectors', () => {
			const root = parse_selector('div:has(> p, + span)')
			const has = root.first_child!.children[1]

			// Should have 2 selector children (selector list with 2 items)
			expect(has.children).toHaveLength(1) // Selector list
			const selectorList = has.first_child!
			expect(selectorList.children).toHaveLength(2) // Two selectors in the list

			// First selector: > p
			const firstSelector = selectorList.children[0]
			expect(firstSelector.children).toHaveLength(2)
			expect(firstSelector.children[0].text).toBe('>')
			expect(firstSelector.children[1].text).toBe('p')

			// Second selector: + span
			const secondSelector = selectorList.children[1]
			expect(secondSelector.children).toHaveLength(2)
			expect(secondSelector.children[0].text).toBe('+')
			expect(secondSelector.children[1].text).toBe('span')
		})

		it('should handle empty :has()', () => {
			const root = parse_selector('div:has()')
			const has = root.first_child!.children[1]

			expect(has.type).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(has.text).toBe(':has()')
			expect(has.has_children).toBe(false)
		})

		it('should parse nesting with ampersand', () => {
			const { arena, rootNode, source } = parseSelectorInternal('&.active')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_NESTING)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_CLASS)
		})

		it('should parse nesting selector with descendant combinator as single selector', () => {
			const { arena, rootNode, source } = parseSelectorInternal('& span')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			// Should have only ONE selector, not two
			const selectorWrappers = getChildren(arena, source, rootNode)
			expect(selectorWrappers).toHaveLength(1)

			// The single selector should have 3 children: &, combinator (space), span
			const selectorWrapper = selectorWrappers[0]
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(3)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_NESTING)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_COMBINATOR)
			expect(arena.get_type(children[2])).toBe(NODE_SELECTOR_TYPE)
			expect(getNodeText(arena, source, children[2])).toBe('span')
		})

		it('should parse nesting selector with child combinator as single selector', () => {
			const { arena, rootNode, source } = parseSelectorInternal('& > div')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Should have only ONE selector, not two
			const selectorWrappers = getChildren(arena, source, rootNode)
			expect(selectorWrappers).toHaveLength(1)

			// The single selector should have 3 children: &, combinator (>), div
			const selectorWrapper = selectorWrappers[0]
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(3)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_NESTING)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_COMBINATOR)
			expect(getNodeText(arena, source, children[1]).trim()).toBe('>')
			expect(arena.get_type(children[2])).toBe(NODE_SELECTOR_TYPE)
			expect(getNodeText(arena, source, children[2])).toBe('div')
		})
	})

	describe('Edge cases', () => {
		it('should parse selector with multiple spaces', () => {
			const { arena, rootNode, source } = parseSelectorInternal('div    p')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Should collapse multiple spaces into single combinator
			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children.length).toBeGreaterThan(0)
		})

		it('should parse selector with tabs and newlines', () => {
			const { arena, rootNode, source } = parseSelectorInternal('div\t\n\tp')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const children = getChildren(arena, source, rootNode)
			expect(children.length).toBeGreaterThan(0)
		})

		it('should handle empty selector gracefully', () => {
			const { rootNode } = parseSelectorInternal('')

			// Empty selector returns null
			expect(rootNode).toBeNull()
		})

		it('should parse class with dashes and numbers', () => {
			const { arena, rootNode, source } = parseSelectorInternal('.my-class-123')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			const selectorWrapper = arena.get_first_child(rootNode)
			expect(arena.get_type(selectorWrapper)).toBe(NODE_SELECTOR)

			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_CLASS)
			expect(getNodeContent(arena, source, child)).toBe('my-class-123')
		})

		it('should parse hyphenated element names', () => {
			const { arena, rootNode, source } = parseSelectorInternal('custom-element')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			const selectorWrapper = arena.get_first_child(rootNode)
			expect(arena.get_type(selectorWrapper)).toBe(NODE_SELECTOR)

			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_TYPE)
			expect(getNodeText(arena, source, child)).toBe('custom-element')
		})
	})

	describe('Real-world selectors', () => {
		it('should parse BEM selector', () => {
			const { arena, rootNode, source } = parseSelectorInternal('.block__element--modifier')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			const selectorWrapper = arena.get_first_child(rootNode)
			expect(arena.get_type(selectorWrapper)).toBe(NODE_SELECTOR)

			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_CLASS)
			expect(getNodeContent(arena, source, child)).toBe('block__element--modifier')
		})

		it('should parse Bootstrap-style selector', () => {
			const { arena, rootNode, source } = parseSelectorInternal('.btn.btn-primary.btn-lg')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(3)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_CLASS)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_CLASS)
			expect(arena.get_type(children[2])).toBe(NODE_SELECTOR_CLASS)
		})

		it('should parse table selector', () => {
			const { arena, rootNode } = parseSelectorInternal('table tbody tr:nth-child(odd) td')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Should parse without errors
			expect(arena.get_type(rootNode)).toBeDefined()
		})

		it('should parse nth-of-type selector', () => {
			const { arena, rootNode, source } = parseSelectorInternal('p:nth-of-type(3)')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(getNodeContent(arena, source, children[1])).toBe('nth-of-type')
		})

		it('should parse ul:has(:nth-child(1 of li))', () => {
			const root = parse_selector('ul:has(:nth-child(1 of li))')

			expect(root.first_child?.type).toBe(NODE_SELECTOR)
			expect(root.first_child!.children).toHaveLength(2)
			const [ul, has] = root.first_child!.children
			expect(ul.type).toBe(NODE_SELECTOR_TYPE)
			expect(ul.text).toBe('ul')

			expect(has.type).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(has.text).toBe(':has(:nth-child(1 of li))')
		})

		it('should parse :nth-child(1)', () => {
			const root = parse_selector(':nth-child(1)')

			expect(root.first_child?.type).toBe(NODE_SELECTOR)
			expect(root.first_child!.children).toHaveLength(1)
			const nth_child = root.first_child!.first_child!
			expect(nth_child.type).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(nth_child.text).toBe(':nth-child(1)')

			// Should have An+B child node
			expect(nth_child.children).toHaveLength(1)
			const anplusb = nth_child.first_child!
			expect(anplusb.type).toBe(NODE_SELECTOR_NTH)
			expect(anplusb.nth_a).toBe(null) // No 'a' coefficient, just 'b'
			expect(anplusb.nth_b).toBe('1')
		})

		it('should parse :nth-child(2n+1)', () => {
			const root = parse_selector(':nth-child(2n+1)')

			expect(root.first_child?.type).toBe(NODE_SELECTOR)
			expect(root.first_child!.children).toHaveLength(1)
			const nth_child = root.first_child!.first_child!
			expect(nth_child.type).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(nth_child.text).toBe(':nth-child(2n+1)')

			// Should have An+B child node
			expect(nth_child.children).toHaveLength(1)
			const anplusb = nth_child.first_child!
			expect(anplusb.type).toBe(NODE_SELECTOR_NTH)
			expect(anplusb.nth_a).toBe('2n')
			expect(anplusb.nth_b).toBe('1')
			expect(anplusb.text).toBe('2n+1')
		})

		it('should parse :nth-child(2n of .selector)', () => {
			const root = parse_selector(':nth-child(2n of .selector)')

			expect(root.first_child?.type).toBe(NODE_SELECTOR)
			expect(root.first_child!.children).toHaveLength(1)
			const nth_child = root.first_child!.first_child!
			expect(nth_child.type).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(nth_child.text).toBe(':nth-child(2n of .selector)')

			// Should have NTH_OF child node (An+B with selector)
			expect(nth_child.children).toHaveLength(1)
			const nth_of = nth_child.first_child!
			expect(nth_of.type).toBe(NODE_SELECTOR_NTH_OF)
			expect(nth_of.text).toBe('2n of .selector')

			// NTH_OF has two children: An+B and selector list
			expect(nth_of.children).toHaveLength(2)
			const anplusb = nth_of.first_child!
			expect(anplusb.type).toBe(NODE_SELECTOR_NTH)
			expect(anplusb.nth_a).toBe('2n')
			expect(anplusb.nth_b).toBe(null)

			// Second child is the selector list
			const selectorList = nth_of.children[1]
			expect(selectorList.type).toBe(NODE_SELECTOR_LIST)
			const selector = selectorList.first_child!
			expect(selector.type).toBe(NODE_SELECTOR)
			expect(selector.first_child!.text).toBe('.selector')
		})

		test(':is(a, b)', () => {
			const root = parse_selector(':is(a, b)')

			// Root is selector list
			expect(root.type).toBe(NODE_SELECTOR_LIST)

			// First selector in the list
			const selector = root.first_child!
			expect(selector.type).toBe(NODE_SELECTOR)

			// Selector has :is() pseudo-class
			const isPseudoClass = selector.first_child!
			expect(isPseudoClass.type).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(isPseudoClass.text).toBe(':is(a, b)')

			// :is() has 1 child: a selector list
			expect(isPseudoClass.children).toHaveLength(1)
			const innerSelectorList = isPseudoClass.first_child!
			expect(innerSelectorList.type).toBe(NODE_SELECTOR_LIST)

			// The selector list has 2 children: selector for 'a' and selector for 'b'
			expect(innerSelectorList.children).toHaveLength(2)

			// First selector: 'a'
			const selectorA = innerSelectorList.children[0]
			expect(selectorA.type).toBe(NODE_SELECTOR)
			expect(selectorA.children).toHaveLength(1)
			expect(selectorA.children[0].type).toBe(NODE_SELECTOR_TYPE)
			expect(selectorA.children[0].text).toBe('a')

			// Second selector: 'b'
			const selectorB = innerSelectorList.children[1]
			expect(selectorB.type).toBe(NODE_SELECTOR)
			expect(selectorB.children).toHaveLength(1)
			expect(selectorB.children[0].type).toBe(NODE_SELECTOR_TYPE)
			expect(selectorB.children[0].text).toBe('b')
		})

		test(':lang("nl", "de")', () => {
			const root = parse_selector(':lang("nl", "de")')

			// Root is selector list
			expect(root.type).toBe(NODE_SELECTOR_LIST)

			// First selector in the list
			const selector = root.first_child!
			expect(selector.type).toBe(NODE_SELECTOR)

			// Selector has :lang() pseudo-class
			const langPseudoClass = selector.first_child!
			expect(langPseudoClass.type).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(langPseudoClass.text).toBe(':lang("nl", "de")')

			// :lang() has 2 children - language identifiers
			expect(langPseudoClass.has_children).toBe(true)
			expect(langPseudoClass.children).toHaveLength(2)

			// First language identifier: "nl"
			const lang1 = langPseudoClass.children[0]
			expect(lang1.type).toBe(NODE_SELECTOR_LANG)
			expect(lang1.text).toBe('"nl"')

			// Second language identifier: "de"
			const lang2 = langPseudoClass.children[1]
			expect(lang2.type).toBe(NODE_SELECTOR_LANG)
			expect(lang2.text).toBe('"de"')
		})

		test(':lang(en, fr) with unquoted identifiers', () => {
			const root = parse_selector(':lang(en, fr)')

			const selector = root.first_child!
			const langPseudoClass = selector.first_child!

			expect(langPseudoClass.type).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(langPseudoClass.text).toBe(':lang(en, fr)')

			// :lang() has 2 children - language identifiers
			expect(langPseudoClass.children).toHaveLength(2)

			// First language identifier: en
			const lang1 = langPseudoClass.children[0]
			expect(lang1.type).toBe(NODE_SELECTOR_LANG)
			expect(lang1.text).toBe('en')

			// Second language identifier: fr
			const lang2 = langPseudoClass.children[1]
			expect(lang2.type).toBe(NODE_SELECTOR_LANG)
			expect(lang2.text).toBe('fr')
		})

		test(':lang(en-US) single language with hyphen', () => {
			const root = parse_selector(':lang(en-US)')

			const selector = root.first_child!
			const langPseudoClass = selector.first_child!

			expect(langPseudoClass.type).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(langPseudoClass.text).toBe(':lang(en-US)')

			// :lang() has 1 child - single language identifier
			expect(langPseudoClass.children).toHaveLength(1)

			const lang1 = langPseudoClass.children[0]
			expect(lang1.type).toBe(NODE_SELECTOR_LANG)
			expect(lang1.text).toBe('en-US')
		})

		test(':lang("*-Latn") wildcard pattern', () => {
			const root = parse_selector(':lang("*-Latn")')

			const selector = root.first_child!
			const langPseudoClass = selector.first_child!

			expect(langPseudoClass.type).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(langPseudoClass.text).toBe(':lang("*-Latn")')

			// :lang() has 1 child - wildcard language identifier
			expect(langPseudoClass.children).toHaveLength(1)

			const lang1 = langPseudoClass.children[0]
			expect(lang1.type).toBe(NODE_SELECTOR_LANG)
			expect(lang1.text).toBe('"*-Latn"')
		})
	})
})

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
