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
	NODE_SELECTOR_NTH,
	NODE_SELECTOR_NTH_OF,
} from './arena'
import { parse_selector } from './parse-selector'

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
			// Content now stores just the attribute name
			expect(getNodeContent(arena, source, child)).toBe('type')
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
			// Content now stores just the attribute name
			expect(getNodeContent(arena, source, child)).toBe('data-test')
			// Full text still includes brackets
			expect(getNodeText(arena, source, child)).toBe('[   data-test="value"   ]')
		})

		it('should trim comments from attribute selectors', () => {
			const { arena, rootNode, source } = parseSelector('[/* comment */data-test="value"/* test */]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			// Content now stores just the attribute name
			expect(getNodeContent(arena, source, child)).toBe('data-test')
		})

		it('should trim whitespace and comments from attribute selectors', () => {
			const { arena, rootNode, source } = parseSelector('[/* comment */   data-test="value"   /* test */]')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const child = arena.get_first_child(selectorWrapper)
			expect(arena.get_type(child)).toBe(NODE_SELECTOR_ATTRIBUTE)
			// Content now stores just the attribute name
			expect(getNodeContent(arena, source, child)).toBe('data-test')
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
			const { arena, rootNode, source } = parseSelector('&.active')

			expect(rootNode).not.toBeNull()
			if (!rootNode) return

			const selectorWrapper = arena.get_first_child(rootNode)
			const children = getChildren(arena, source, selectorWrapper)
			expect(children).toHaveLength(2)
			expect(arena.get_type(children[0])).toBe(NODE_SELECTOR_NESTING)
			expect(arena.get_type(children[1])).toBe(NODE_SELECTOR_CLASS)
		})

		it('should parse nesting selector with descendant combinator as single selector', () => {
			const { arena, rootNode, source } = parseSelector('& span')

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
			const { arena, rootNode, source } = parseSelector('& > div')

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
	})
})
