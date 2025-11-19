import { describe, it, expect } from 'vitest'
import { SelectorParser } from './selector-parser'
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
} from './arena'

// Helper to create a selector parser and parse a selector
function parseSelector(selector: string) {
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
			const { arena, rootNode, source } = parseSelector('div')

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
			const { arena, rootNode, source } = parseSelector('.my-class')

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
			const { arena, rootNode, source } = parseSelector('#my-id')

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
			const { arena, rootNode, source } = parseSelector('*')

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
			const { arena, rootNode, source } = parseSelector('&')

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
			const { arena, rootNode, source } = parseSelector('div.container')

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
			const { arena, rootNode, source } = parseSelector('div#app')

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
			const { arena, rootNode, source } = parseSelector('div.foo.bar.baz')

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
			const { arena, rootNode, source } = parseSelector('div.container#app')

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
			const { arena, rootNode, source } = parseSelector('a:hover')

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
			const { arena, rootNode, source } = parseSelector('li:nth-child(2n+1)')

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
			const { arena, rootNode, source } = parseSelector('input:focus:valid')

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
			const { arena, rootNode, source } = parseSelector('a:is(.active)')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(getNodeContent(arena, source, children[1])).toBe('is')
		})

		it('should parse :not() pseudo-class', () => {
			const { arena, rootNode, source } = parseSelector('div:not(.disabled)')

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
			const { arena, rootNode, source } = parseSelector('p::before')

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
			const { arena, rootNode, source } = parseSelector('p:after')

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
			const { arena, rootNode, source } = parseSelector('p::first-line')

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
			const { arena, rootNode, source } = parseSelector('[disabled]')

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
			const { arena, rootNode, source } = parseSelector('[type="text"]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			const selectorWrapper = arena.get_first_child(rootNode)
			expect(arena.get_type(selectorWrapper)).toBe(NODE_SELECTOR)

			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			expect(getNodeText(arena, source, child)).toBe('[type="text"]')
			expect(getNodeContent(arena, source, child)).toBe('type="text"')
		})

		it('should parse attribute with operator', () => {
			const { arena, rootNode, source } = parseSelector('[class^="btn-"]')

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
			const { arena, rootNode, source } = parseSelector('input[type="checkbox"]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_TYPE)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_ATTRIBUTE)
		})

		it('should trim whitespace from attribute selectors', () => {
			const { arena, rootNode, source } = parseSelector('[   data-test="value"   ]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			expect(getNodeContent(arena, source, child)).toBe('data-test="value"')
		})

		it('should trim comments from attribute selectors', () => {
			const { arena, rootNode, source } = parseSelector('[/* comment */data-test="value"/* test */]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			expect(getNodeContent(arena, source, child)).toBe('data-test="value"')
		})

		it('should trim whitespace and comments from attribute selectors', () => {
			const { arena, rootNode, source } = parseSelector('[/* comment */   data-test="value"   /* test */]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			expect(getNodeContent(arena, source, child)).toBe('data-test="value"')
		})
	})

	describe('Combinators', () => {
		it('should parse descendant combinator (space)', () => {
			const { arena, rootNode, source } = parseSelector('div p')

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
			const { arena, rootNode, source } = parseSelector('div > p')

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
			const { arena, rootNode, source } = parseSelector('h1 + p')

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
			const { arena, rootNode, source } = parseSelector('h1 ~ p')

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
			const { arena, rootNode, source } = parseSelector('div, p')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			// List contains the two selectors
			const children = getChildren(arena, source, rootNode)
			expect(children).toHaveLength(2)
		})

		it('should parse selector list with three selectors', () => {
			const { arena, rootNode, source } = parseSelector('h1, h2, h3')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)

			// List contains the three selectors
			const children = getChildren(arena, source, rootNode)
			expect(children).toHaveLength(3)
		})

		it('should parse complex selector list', () => {
			const { arena, rootNode, source } = parseSelector('div.container, .wrapper > p, #app')

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
			const { arena, rootNode } = parseSelector('nav > ul > li > a')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Root is NODE_SELECTOR_LIST
			expect(arena.get_type(rootNode)).toBe(NODE_SELECTOR_LIST)
		})

		it('should parse form selector', () => {
			const { arena, rootNode } = parseSelector('form input[type="text"]:focus')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Should parse without errors
			expect(arena.get_type(rootNode)).toBeDefined()
		})

		it('should parse complex nesting selector', () => {
			const { arena, rootNode } = parseSelector('.parent .child:hover::before')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			expect(arena.get_type(rootNode)).toBeDefined()
		})

		it('should parse multiple combinators', () => {
			const { arena, rootNode, source } = parseSelector('div > .container + p ~ span')

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
			const { arena, rootNode, source } = parseSelector(':where(article, section)')

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

		it('should parse :has() pseudo-class', () => {
			const { arena, rootNode, source } = parseSelector('div:has(> p)')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(getNodeContent(arena, source, children[1])).toBe('has')
		})

		it('should parse nesting with ampersand', () => {
			const { arena, rootNode, source } = parseSelector('&.active')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_NESTING)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_CLASS)
		})
	})

	describe('Edge cases', () => {
		it('should parse selector with multiple spaces', () => {
			const { arena, rootNode, source } = parseSelector('div    p')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Should collapse multiple spaces into single combinator
			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children.length).toBeGreaterThan(0)
		})

		it('should parse selector with tabs and newlines', () => {
			const { arena, rootNode, source } = parseSelector('div\t\n\tp')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const children = getChildren(arena, source, rootNode)
			expect(children.length).toBeGreaterThan(0)
		})

		it('should handle empty selector gracefully', () => {
			const { rootNode } = parseSelector('')

			// Empty selector returns null
			expect(rootNode).toBeNull()
		})

		it('should parse class with dashes and numbers', () => {
			const { arena, rootNode, source } = parseSelector('.my-class-123')

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
			const { arena, rootNode, source } = parseSelector('custom-element')

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
			const { arena, rootNode, source } = parseSelector('.block__element--modifier')

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
			const { arena, rootNode, source } = parseSelector('.btn.btn-primary.btn-lg')

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
			const { arena, rootNode } = parseSelector('table tbody tr:nth-child(odd) td')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			// Should parse without errors
			expect(arena.get_type(rootNode)).toBeDefined()
		})

		it('should parse nth-of-type selector', () => {
			const { arena, rootNode, source } = parseSelector('p:nth-of-type(3)')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_PSEUDO_CLASS)
			expect(getNodeContent(arena, source, children[1])).toBe('nth-of-type')
		})
	})
})
