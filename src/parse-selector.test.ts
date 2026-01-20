import { describe, it, expect, test } from 'vitest'
import { SelectorParser, parse_selector } from './parse-selector'
import { ATTR_OPERATOR_EQUAL, CSSDataArena } from './arena'
import {
	SELECTOR,
	SELECTOR_LIST,
	TYPE_SELECTOR,
	CLASS_SELECTOR,
	ID_SELECTOR,
	ATTRIBUTE_SELECTOR,
	PSEUDO_CLASS_SELECTOR,
	PSEUDO_ELEMENT_SELECTOR,
	COMBINATOR,
	UNIVERSAL_SELECTOR,
	NESTING_SELECTOR,
	NTH_SELECTOR,
	NTH_OF_SELECTOR,
	LANG_SELECTOR,
	ATTR_FLAG_NONE,
	ATTR_FLAG_CASE_INSENSITIVE,
	ATTR_FLAG_CASE_SENSITIVE,
} from './arena'

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

describe('Selector Nodes', () => {
	describe('Locations', () => {
		describe('SELECTOR_LIST', () => {
			test('start and length for simple selector', () => {
				const node = parse_selector('div')
				expect(node.start).toBe(0)
				expect(node.length).toBe(3)
				expect(node.end).toBe(3)
			})

			test('start and length for selector list', () => {
				const node = parse_selector('h1, h2, h3')
				expect(node.start).toBe(0)
				expect(node.length).toBe(10)
				expect(node.end).toBe(10)
			})
		})

		describe('TYPE_SELECTOR', () => {
			test('start and length', () => {
				const node = parse_selector('div')
				const selector = node.first_child!
				const typeSelector = selector.first_child!
				expect(typeSelector.start).toBe(0)
				expect(typeSelector.length).toBe(3)
				expect(typeSelector.end).toBe(3)
			})
		})

		describe('CLASS_SELECTOR', () => {
			test('start and length', () => {
				const node = parse_selector('.my-class')
				const selector = node.first_child!
				const classSelector = selector.first_child!
				expect(classSelector.start).toBe(0)
				expect(classSelector.length).toBe(9)
				expect(classSelector.end).toBe(9)
			})
		})

		describe('ID_SELECTOR', () => {
			test('start and length', () => {
				const node = parse_selector('#my-id')
				const selector = node.first_child!
				const idSelector = selector.first_child!
				expect(idSelector.start).toBe(0)
				expect(idSelector.length).toBe(6)
				expect(idSelector.end).toBe(6)
			})
		})

		describe('ATTRIBUTE_SELECTOR', () => {
			test('start and length', () => {
				const node = parse_selector('[disabled]')
				const selector = node.first_child!
				const attrSelector = selector.first_child!
				expect(attrSelector.start).toBe(0)
				expect(attrSelector.length).toBe(10)
				expect(attrSelector.end).toBe(10)
			})

			test('start and length with value', () => {
				const node = parse_selector('[type="text"]')
				const selector = node.first_child!
				const attrSelector = selector.first_child!
				expect(attrSelector.start).toBe(0)
				expect(attrSelector.length).toBe(13)
				expect(attrSelector.end).toBe(13)
			})
		})

		describe('PSEUDO_CLASS_SELECTOR', () => {
			test('start and length for simple pseudo-class', () => {
				const node = parse_selector('a:hover')
				const selector = node.first_child!
				const [_type, pseudoClass] = selector.children
				expect(pseudoClass.start).toBe(1)
				expect(pseudoClass.length).toBe(6)
				expect(pseudoClass.end).toBe(7)
			})

			test('start and length for pseudo-class with function', () => {
				const node = parse_selector('li:nth-child(2n+1)')
				const selector = node.first_child!
				const [_type, pseudoClass] = selector.children
				expect(pseudoClass.start).toBe(2)
				expect(pseudoClass.length).toBe(16)
				expect(pseudoClass.end).toBe(18)
			})
		})

		describe('PSEUDO_ELEMENT_SELECTOR', () => {
			test('start and length', () => {
				const node = parse_selector('p::before')
				const selector = node.first_child!
				const [_type, pseudoElement] = selector.children
				expect(pseudoElement.start).toBe(1)
				expect(pseudoElement.length).toBe(8)
				expect(pseudoElement.end).toBe(9)
			})
		})

		describe('COMBINATOR', () => {
			test('start and length for child combinator', () => {
				const node = parse_selector('div > p')
				const selector = node.first_child!
				const [_div, combinator, _p] = selector.children
				expect(combinator.start).toBeGreaterThan(2)
				expect(combinator.length).toBeGreaterThan(0)
				expect(combinator.end).toBeGreaterThan(0)
			})

			test('line and column for child combinator', () => {
				const node = parse_selector('div > p')
				const selector = node.first_child!
				const [_div, combinator, _p] = selector.children
				expect(combinator.line).toBe(1)
				expect(combinator.column).toBe(5) // '>' is at position 4 (0-indexed), column 5 (1-indexed)
			})

			test('line and column for descendant combinator', () => {
				const node = parse_selector('div p')
				const selector = node.first_child!
				const [_div, combinator, _p] = selector.children
				expect(combinator.line).toBe(1)
				expect(combinator.column).toBe(4) // space starts at position 3 (0-indexed), column 4 (1-indexed)
				expect(combinator.start).toBe(3)
				expect(combinator.length).toBe(1)
			})

			test('line and column for multiline descendant combinator', () => {
				const node = parse_selector('div\n  p')
				const selector = node.first_child!
				const [_div, combinator, _p] = selector.children
				expect(combinator.line).toBe(1)
				expect(combinator.column).toBe(4) // newline starts at position 3 (0-indexed), column 4 (1-indexed)
				expect(combinator.start).toBe(3)
				expect(combinator.length).toBe(3) // '\n  ' is 3 characters
			})

			test('line and column for adjacent sibling combinator', () => {
				const node = parse_selector('h1 + p')
				const selector = node.first_child!
				const [_h1, combinator, _p] = selector.children
				expect(combinator.line).toBe(1)
				expect(combinator.column).toBe(4) // '+' is at position 3 (0-indexed), column 4 (1-indexed)
				expect(combinator.start).toBe(3)
			})

			test('line and column for general sibling combinator', () => {
				const node = parse_selector('h1 ~ p')
				const selector = node.first_child!
				const [_h1, combinator, _p] = selector.children
				expect(combinator.line).toBe(1)
				expect(combinator.column).toBe(4) // '~' is at position 3 (0-indexed), column 4 (1-indexed)
				expect(combinator.start).toBe(3)
			})

			test('line and column for combinator with leading whitespace', () => {
				const node = parse_selector('div  >  p')
				const selector = node.first_child!
				const [_div, combinator, _p] = selector.children
				expect(combinator.line).toBe(1)
				expect(combinator.column).toBe(6) // '>' is at position 5 (0-indexed), column 6 (1-indexed)
				expect(combinator.start).toBe(5)
				expect(combinator.text).toBe('>')
			})

			test('line and column for multiline combinator with newline before >', () => {
				const node = parse_selector('div\n>\np')
				const selector = node.first_child!
				const [_div, combinator, _p] = selector.children
				expect(combinator.line).toBe(2)
				expect(combinator.column).toBe(1) // '>' is at start of line 2
				expect(combinator.start).toBe(4)
				expect(combinator.text).toBe('>')
			})
		})

		describe('UNIVERSAL_SELECTOR', () => {
			test('start and length', () => {
				const node = parse_selector('*')
				const selector = node.first_child!
				const universalSelector = selector.first_child!
				expect(universalSelector.start).toBe(0)
				expect(universalSelector.length).toBe(1)
				expect(universalSelector.end).toBe(1)
			})
		})

		describe('NESTING_SELECTOR', () => {
			test('start and length', () => {
				const node = parse_selector('&')
				const selector = node.first_child!
				const nestingSelector = selector.first_child!
				expect(nestingSelector.start).toBe(0)
				expect(nestingSelector.length).toBe(1)
				expect(nestingSelector.end).toBe(1)
			})
		})

		describe('NTH_SELECTOR', () => {
			test('start and length in :nth-child()', () => {
				const node = parse_selector(':nth-child(2n+1)')
				const selector = node.first_child!
				const pseudoClass = selector.first_child!
				const nthNode = pseudoClass.first_child!
				expect(nthNode.type).toBe(NTH_SELECTOR)
				expect(nthNode.start).toBe(11)
				expect(nthNode.length).toBe(4)
				expect(nthNode.end).toBe(15)
			})
		})

		describe('NTH_OF_SELECTOR', () => {
			test('start and length in :nth-child() with "of" syntax', () => {
				const node = parse_selector(':nth-child(2n of .selector)')
				const selector = node.first_child!
				const pseudoClass = selector.first_child!
				const nthOfNode = pseudoClass.first_child!
				expect(nthOfNode.type).toBe(NTH_OF_SELECTOR)
				expect(nthOfNode.start).toBe(11)
				expect(nthOfNode.length).toBe(15)
				expect(nthOfNode.end).toBe(26)
			})
		})

		describe('LANG_SELECTOR', () => {
			test('start and length in :lang()', () => {
				const node = parse_selector(':lang(en)')
				const selector = node.first_child!
				const pseudoClass = selector.first_child!
				const langNode = pseudoClass.first_child!
				expect(langNode.type).toBe(LANG_SELECTOR)
				expect(langNode.length).toBeGreaterThan(0)
			})
		})
	})

	describe('Types', () => {
		test('SELECTOR_LIST type constant', () => {
			const node = parse_selector('div')
			expect(node.type).toBe(SELECTOR_LIST)
		})

		test('SELECTOR type constant', () => {
			const node = parse_selector('div')
			const selector = node.first_child!
			expect(selector.type).toBe(SELECTOR)
		})

		test('TYPE_SELECTOR type constant', () => {
			const node = parse_selector('div')
			const selector = node.first_child!
			const typeSelector = selector.first_child!
			expect(typeSelector.type).toBe(TYPE_SELECTOR)
		})

		test('CLASS_SELECTOR type constant', () => {
			const node = parse_selector('.my-class')
			const selector = node.first_child!
			const classSelector = selector.first_child!
			expect(classSelector.type).toBe(CLASS_SELECTOR)
		})

		test('ID_SELECTOR type constant', () => {
			const node = parse_selector('#my-id')
			const selector = node.first_child!
			const idSelector = selector.first_child!
			expect(idSelector.type).toBe(ID_SELECTOR)
		})

		test('ATTRIBUTE_SELECTOR type constant', () => {
			const node = parse_selector('[disabled]')
			const selector = node.first_child!
			const attrSelector = selector.first_child!
			expect(attrSelector.type).toBe(ATTRIBUTE_SELECTOR)
		})

		test('PSEUDO_CLASS_SELECTOR type constant', () => {
			const node = parse_selector('a:hover')
			const selector = node.first_child!
			const pseudoClass = selector.children[1]
			expect(pseudoClass.type).toBe(PSEUDO_CLASS_SELECTOR)
		})

		test('PSEUDO_ELEMENT_SELECTOR type constant', () => {
			const node = parse_selector('p::before')
			const selector = node.first_child!
			const pseudoElement = selector.children[1]
			expect(pseudoElement.type).toBe(PSEUDO_ELEMENT_SELECTOR)
		})

		test('COMBINATOR type constant', () => {
			const node = parse_selector('div > p')
			const selector = node.first_child!
			const combinator = selector.children[1]
			expect(combinator.type).toBe(COMBINATOR)
		})

		test('UNIVERSAL_SELECTOR type constant', () => {
			const node = parse_selector('*')
			const selector = node.first_child!
			const universalSelector = selector.first_child!
			expect(universalSelector.type).toBe(UNIVERSAL_SELECTOR)
		})

		test('NESTING_SELECTOR type constant', () => {
			const node = parse_selector('&')
			const selector = node.first_child!
			const nestingSelector = selector.first_child!
			expect(nestingSelector.type).toBe(NESTING_SELECTOR)
		})

		test('NTH_SELECTOR type constant', () => {
			const node = parse_selector(':nth-child(2n+1)')
			const selector = node.first_child!
			const pseudoClass = selector.first_child!
			const nthNode = pseudoClass.first_child!
			expect(nthNode.type).toBe(NTH_SELECTOR)
		})

		test('NTH_OF_SELECTOR type constant', () => {
			const node = parse_selector(':nth-child(2n of .selector)')
			const selector = node.first_child!
			const pseudoClass = selector.first_child!
			const nthOfNode = pseudoClass.first_child!
			expect(nthOfNode.type).toBe(NTH_OF_SELECTOR)
		})

		test('LANG_SELECTOR type constant', () => {
			const node = parse_selector(':lang(en)')
			const selector = node.first_child!
			const pseudoClass = selector.first_child!
			const langNode = pseudoClass.first_child!
			expect(langNode.type).toBe(LANG_SELECTOR)
		})
	})

	describe('Type Names', () => {
		test('SELECTOR_LIST type_name', () => {
			const node = parse_selector('div')
			expect(node.type_name).toBe('SelectorList')
		})

		test('SELECTOR type_name', () => {
			const node = parse_selector('div')
			const selector = node.first_child!
			expect(selector.type_name).toBe('Selector')
		})

		test('TYPE_SELECTOR type_name', () => {
			const node = parse_selector('div')
			const selector = node.first_child!
			const typeSelector = selector.first_child!
			expect(typeSelector.type_name).toBe('TypeSelector')
		})

		test('CLASS_SELECTOR type_name', () => {
			const node = parse_selector('.my-class')
			const selector = node.first_child!
			const classSelector = selector.first_child!
			expect(classSelector.type_name).toBe('ClassSelector')
		})

		test('ID_SELECTOR type_name', () => {
			const node = parse_selector('#my-id')
			const selector = node.first_child!
			const idSelector = selector.first_child!
			expect(idSelector.type_name).toBe('IdSelector')
		})

		test('ATTRIBUTE_SELECTOR type_name', () => {
			const node = parse_selector('[disabled]')
			const selector = node.first_child!
			const attrSelector = selector.first_child!
			expect(attrSelector.type_name).toBe('AttributeSelector')
		})

		test('PSEUDO_CLASS_SELECTOR type_name', () => {
			const node = parse_selector('a:hover')
			const selector = node.first_child!
			const pseudoClass = selector.children[1]
			expect(pseudoClass.type_name).toBe('PseudoClassSelector')
		})

		test('PSEUDO_ELEMENT_SELECTOR type_name', () => {
			const node = parse_selector('p::before')
			const selector = node.first_child!
			const pseudoElement = selector.children[1]
			expect(pseudoElement.type_name).toBe('PseudoElementSelector')
		})

		test('COMBINATOR type_name', () => {
			const node = parse_selector('div > p')
			const selector = node.first_child!
			const combinator = selector.children[1]
			expect(combinator.type_name).toBe('Combinator')
		})

		test('UNIVERSAL_SELECTOR type_name', () => {
			const node = parse_selector('*')
			const selector = node.first_child!
			const universalSelector = selector.first_child!
			expect(universalSelector.type_name).toBe('UniversalSelector')
		})

		test('NESTING_SELECTOR type_name', () => {
			const node = parse_selector('&')
			const selector = node.first_child!
			const nestingSelector = selector.first_child!
			expect(nestingSelector.type_name).toBe('NestingSelector')
		})

		test('NTH_SELECTOR type_name', () => {
			const node = parse_selector(':nth-child(2n+1)')
			const selector = node.first_child!
			const pseudoClass = selector.first_child!
			const nthNode = pseudoClass.first_child!
			expect(nthNode.type_name).toBe('Nth')
		})

		test('NTH_OF_SELECTOR type_name', () => {
			const node = parse_selector(':nth-child(2n of .selector)')
			const selector = node.first_child!
			const pseudoClass = selector.first_child!
			const nthOfNode = pseudoClass.first_child!
			expect(nthOfNode.type_name).toBe('NthOf')
		})

		test('LANG_SELECTOR type_name', () => {
			const node = parse_selector(':lang(en)')
			const selector = node.first_child!
			const pseudoClass = selector.first_child!
			const langNode = pseudoClass.first_child!
			expect(langNode.type_name).toBe('Lang')
		})
	})

	describe('Selector Properties', () => {
		describe('parse_selector() function', () => {
			it('should parse and return a CSSNode', () => {
				const node = parse_selector('div.container')
				expect(node).toBeDefined()
				expect(node.type).toBe(SELECTOR_LIST)
				expect(node.text).toBe('div.container')
			})

			it('should parse type selector', () => {
				const node = parse_selector('div')
				expect(node.type).toBe(SELECTOR_LIST)

				const firstSelector = node.first_child
				expect(firstSelector?.type).toBe(SELECTOR)

				const typeNode = firstSelector?.first_child
				expect(typeNode?.type).toBe(TYPE_SELECTOR)
				expect(typeNode?.text).toBe('div')
			})

			it('should parse class selector', () => {
				const node = parse_selector('.my-class')
				const firstSelector = node.first_child
				const classNode = firstSelector?.first_child

				expect(classNode?.type).toBe(CLASS_SELECTOR)
				expect(classNode?.name).toBe('.my-class')
			})

			it('should parse ID selector', () => {
				const node = parse_selector('#my-id')
				const firstSelector = node.first_child
				const idNode = firstSelector?.first_child

				expect(idNode?.type).toBe(ID_SELECTOR)
				expect(idNode?.name).toBe('#my-id')
			})

			it('should parse compound selector', () => {
				const node = parse_selector('div.container#app')
				const firstSelector = node.first_child
				const children = firstSelector?.children || []

				expect(children.length).toBe(3)
				expect(children[0].type).toBe(TYPE_SELECTOR)
				expect(children[1].type).toBe(CLASS_SELECTOR)
				expect(children[2].type).toBe(ID_SELECTOR)
			})

			it('should parse complex selector with descendant combinator', () => {
				const node = parse_selector('div .container')
				const firstSelector = node.first_child
				const children = firstSelector?.children || []

				expect(children.length).toBe(3) // div, combinator, .container
				expect(children[0].type).toBe(TYPE_SELECTOR)
				expect(children[1].type).toBe(COMBINATOR)
				expect(children[2].type).toBe(CLASS_SELECTOR)
			})

			it('should parse selector list', () => {
				const node = parse_selector('div, span, p')
				const selectors = node.children

				expect(selectors.length).toBe(3)
				expect(selectors[0].first_child?.type).toBe(TYPE_SELECTOR)
				expect(selectors[1].first_child?.type).toBe(TYPE_SELECTOR)
				expect(selectors[2].first_child?.type).toBe(TYPE_SELECTOR)
			})
		})

		describe('Simple selectors', () => {
			it('should parse type selector', () => {
				const { arena, rootNode, source } = parseSelectorInternal('div')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)
				expect(getNodeText(arena, source, rootNode)).toBe('div')

				// First child is NODE_SELECTOR wrapper
				const selectorWrapper = arena.get_first_child(rootNode)
				expect(arena.get_type(selectorWrapper)).toBe(SELECTOR)

				// First child of wrapper is the actual type
				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, child)).toBe('div')
			})

			it('should parse class selector', () => {
				const { arena, rootNode, source } = parseSelectorInternal('.my-class')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				const selectorWrapper = arena.get_first_child(rootNode)
				expect(arena.get_type(selectorWrapper)).toBe(SELECTOR)

				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(CLASS_SELECTOR)
				expect(getNodeText(arena, source, child)).toBe('.my-class')
				expect(getNodeContent(arena, source, child)).toBe('.my-class')
			})

			it('should parse ID selector', () => {
				const { arena, rootNode, source } = parseSelectorInternal('#my-id')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				const selectorWrapper = arena.get_first_child(rootNode)
				expect(arena.get_type(selectorWrapper)).toBe(SELECTOR)

				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(ID_SELECTOR)
				expect(getNodeText(arena, source, child)).toBe('#my-id')
				expect(getNodeContent(arena, source, child)).toBe('#my-id')
			})

			it('should parse universal selector', () => {
				const { arena, rootNode, source } = parseSelectorInternal('*')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				const selectorWrapper = arena.get_first_child(rootNode)
				expect(arena.get_type(selectorWrapper)).toBe(SELECTOR)

				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(UNIVERSAL_SELECTOR)
				expect(getNodeText(arena, source, child)).toBe('*')
			})

			it('should parse nesting selector', () => {
				const { arena, rootNode, source } = parseSelectorInternal('&')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				const selectorWrapper = arena.get_first_child(rootNode)
				expect(arena.get_type(selectorWrapper)).toBe(SELECTOR)

				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(NESTING_SELECTOR)
				expect(getNodeText(arena, source, child)).toBe('&')
			})
		})

		describe('Compound selectors', () => {
			it('should parse element with class', () => {
				const { arena, rootNode, source } = parseSelectorInternal('div.container')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				// Get the NODE_SELECTOR wrapper
				const selectorWrapper = arena.get_first_child(rootNode)
				expect(arena.get_type(selectorWrapper)).toBe(SELECTOR)

				// Compound selector has multiple children
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[0])).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, children[0])).toBe('div')
				expect(arena.get_type(children[1])).toBe(CLASS_SELECTOR)
				expect(getNodeContent(arena, source, children[1])).toBe('.container')
			})

			it('should parse element with ID', () => {
				const { arena, rootNode, source } = parseSelectorInternal('div#app')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				const selectorWrapper = arena.get_first_child(rootNode)
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[0])).toBe(TYPE_SELECTOR)
				expect(arena.get_type(children[1])).toBe(ID_SELECTOR)
				expect(getNodeContent(arena, source, children[1])).toBe('#app')
			})

			it('should parse element with multiple classes', () => {
				const { arena, rootNode, source } = parseSelectorInternal('div.foo.bar.baz')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(4)
				expect(arena.get_type(children[0])).toBe(TYPE_SELECTOR)
				expect(arena.get_type(children[1])).toBe(CLASS_SELECTOR)
				expect(getNodeContent(arena, source, children[1])).toBe('.foo')
				expect(arena.get_type(children[2])).toBe(CLASS_SELECTOR)
				expect(getNodeContent(arena, source, children[2])).toBe('.bar')
				expect(arena.get_type(children[3])).toBe(CLASS_SELECTOR)
				expect(getNodeContent(arena, source, children[3])).toBe('.baz')
			})

			it('should parse complex compound selector', () => {
				const { arena, rootNode, source } = parseSelectorInternal('div.container#app')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(3)
				expect(arena.get_type(children[0])).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, children[0])).toBe('div')
				expect(arena.get_type(children[1])).toBe(CLASS_SELECTOR)
				expect(getNodeContent(arena, source, children[1])).toBe('.container')
				expect(arena.get_type(children[2])).toBe(ID_SELECTOR)
				expect(getNodeContent(arena, source, children[2])).toBe('#app')
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
				expect(arena.get_type(children[0])).toBe(TYPE_SELECTOR)
				expect(arena.get_type(children[1])).toBe(PSEUDO_CLASS_SELECTOR)
				expect(getNodeContent(arena, source, children[1])).toBe('hover')
			})

			it('should parse pseudo-class with function', () => {
				const { arena, rootNode, source } = parseSelectorInternal('li:nth-child(2n+1)')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[0])).toBe(TYPE_SELECTOR)
				expect(arena.get_type(children[1])).toBe(PSEUDO_CLASS_SELECTOR)
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
				expect(arena.get_type(children[0])).toBe(TYPE_SELECTOR)
				expect(arena.get_type(children[1])).toBe(PSEUDO_CLASS_SELECTOR)
				expect(getNodeContent(arena, source, children[1])).toBe('focus')
				expect(arena.get_type(children[2])).toBe(PSEUDO_CLASS_SELECTOR)
				expect(getNodeContent(arena, source, children[2])).toBe('valid')
			})

			it('should parse :is() pseudo-class', () => {
				const { arena, rootNode, source } = parseSelectorInternal('a:is(.active)')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[1])).toBe(PSEUDO_CLASS_SELECTOR)
				expect(getNodeContent(arena, source, children[1])).toBe('is')
			})

			it('should parse trailing space in :is() pseudo-class', () => {
				const root = parse_selector(':is(a )')
				const selector = root.first_child
				const pseudo = selector?.first_child
				const [list] = pseudo!.children
				const [a] = list.children
				expect(a.text).toBe('a')
			})

			it('should parse trailing tab in :is() pseudo-class', () => {
				const root = parse_selector(':is(a	)')
				const selector = root.first_child!
				const pseudo = selector.first_child!
				const [list] = pseudo.children
				const [a] = list.children
				expect(a.text).toBe('a')
			})

			it('should parse :not() pseudo-class', () => {
				const { arena, rootNode, source } = parseSelectorInternal('div:not(.disabled)')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[1])).toBe(PSEUDO_CLASS_SELECTOR)
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
				expect(arena.get_type(children[0])).toBe(TYPE_SELECTOR)
				expect(arena.get_type(children[1])).toBe(PSEUDO_ELEMENT_SELECTOR)
				expect(getNodeContent(arena, source, children[1])).toBe('before')
			})

			it('should parse pseudo-element with single colon (legacy)', () => {
				const { arena, rootNode, source } = parseSelectorInternal('p:after')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[0])).toBe(TYPE_SELECTOR)
				expect(arena.get_type(children[1])).toBe(PSEUDO_CLASS_SELECTOR)
				expect(getNodeContent(arena, source, children[1])).toBe('after')
			})

			it('should parse ::first-line pseudo-element', () => {
				const { arena, rootNode, source } = parseSelectorInternal('p::first-line')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[1])).toBe(PSEUDO_ELEMENT_SELECTOR)
				expect(getNodeContent(arena, source, children[1])).toBe('first-line')
			})
		})

		describe('Pseudo-class function syntax detection (has_children)', () => {
			it('should indicate :lang() has function syntax even when empty', () => {
				const root = parse_selector(':lang()')
				const pseudoClass = root.first_child!.first_child!
				expect(pseudoClass.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(pseudoClass.name).toBe('lang')
				expect(pseudoClass.has_children).toBe(true) // Function syntax, even if empty
			})

			it('should indicate :lang(en) has function syntax with children', () => {
				const root = parse_selector(':lang(en)')
				const pseudoClass = root.first_child!.first_child!
				expect(pseudoClass.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(pseudoClass.name).toBe('lang')
				expect(pseudoClass.has_children).toBe(true) // Function syntax with content
			})

			it('should indicate :hover has no function syntax', () => {
				const root = parse_selector(':hover')
				const pseudoClass = root.first_child!.first_child!
				expect(pseudoClass.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(pseudoClass.name).toBe('hover')
				expect(pseudoClass.has_children).toBe(false) // Not a function
			})

			it('should indicate :is() has function syntax even when empty', () => {
				const root = parse_selector(':is()')
				const pseudoClass = root.first_child!.first_child!
				expect(pseudoClass.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(pseudoClass.name).toBe('is')
				expect(pseudoClass.has_children).toBe(true) // Function syntax, even if empty
			})

			it('should indicate :has() has function syntax even when empty', () => {
				const root = parse_selector(':has()')
				const pseudoClass = root.first_child!.first_child!
				expect(pseudoClass.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(pseudoClass.name).toBe('has')
				expect(pseudoClass.has_children).toBe(true) // Function syntax, even if empty
			})

			it('should indicate :nth-child() has function syntax even when empty', () => {
				const root = parse_selector(':nth-child()')
				const pseudoClass = root.first_child!.first_child!
				expect(pseudoClass.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(pseudoClass.name).toBe('nth-child')
				expect(pseudoClass.has_children).toBe(true) // Function syntax, even if empty
			})

			it('should indicate ::before has no function syntax', () => {
				const root = parse_selector('::before')
				const pseudoElement = root.first_child!.first_child!
				expect(pseudoElement.type).toBe(PSEUDO_ELEMENT_SELECTOR)
				expect(pseudoElement.name).toBe('before')
				expect(pseudoElement.has_children).toBe(false) // Not a function
			})

			it('should indicate ::slotted() has function syntax even when empty', () => {
				const root = parse_selector('::slotted()')
				const pseudoElement = root.first_child!.first_child!
				expect(pseudoElement.type).toBe(PSEUDO_ELEMENT_SELECTOR)
				expect(pseudoElement.name).toBe('slotted')
				expect(pseudoElement.has_children).toBe(true) // Function syntax, even if empty
			})
		})

		describe('Attribute selectors', () => {
			it('should parse simple attribute selector', () => {
				const { arena, rootNode, source } = parseSelectorInternal('[disabled]')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				const selectorWrapper = arena.get_first_child(rootNode)
				expect(arena.get_type(selectorWrapper)).toBe(SELECTOR)

				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(ATTRIBUTE_SELECTOR)
				expect(getNodeText(arena, source, child)).toBe('[disabled]')
				expect(getNodeContent(arena, source, child)).toBe('disabled')
			})

			it('should parse attribute with value', () => {
				const { arena, rootNode, source } = parseSelectorInternal('[type="text"]')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				const selectorWrapper = arena.get_first_child(rootNode)
				expect(arena.get_type(selectorWrapper)).toBe(SELECTOR)

				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(ATTRIBUTE_SELECTOR)
				expect(getNodeText(arena, source, child)).toBe('[type="text"]')
				// Content now stores just the attribute name
				expect(getNodeContent(arena, source, child)).toBe('type')
			})

			it('should parse attribute with operator', () => {
				const { arena, rootNode, source } = parseSelectorInternal('[class^="btn-"]')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				const selectorWrapper = arena.get_first_child(rootNode)
				expect(arena.get_type(selectorWrapper)).toBe(SELECTOR)

				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(ATTRIBUTE_SELECTOR)
				expect(getNodeText(arena, source, child)).toBe('[class^="btn-"]')
			})

			it('should parse element with attribute', () => {
				const { arena, rootNode, source } = parseSelectorInternal('input[type="checkbox"]')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[0])).toBe(TYPE_SELECTOR)
				expect(arena.get_type(children[1])).toBe(ATTRIBUTE_SELECTOR)
			})

			it('should trim whitespace from attribute selectors', () => {
				const { arena, rootNode, source } = parseSelectorInternal('[   data-test="value"   ]')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(ATTRIBUTE_SELECTOR)
				// Content now stores just the attribute name
				expect(getNodeContent(arena, source, child)).toBe('data-test')
				// Full text still includes brackets
				expect(getNodeText(arena, source, child)).toBe('[   data-test="value"   ]')
			})

			it('should trim comments from attribute selectors', () => {
				const root = parse_selector('[/* comment */data-test="value"/* test */]')
				expect(root.first_child?.type_name).toBe('Selector')
				const attr_selector = root.first_child?.first_child
				expect(attr_selector?.type_name).toBe('AttributeSelector')
				expect(attr_selector?.value).toBe('"value"')
				expect(attr_selector?.property).toBe('data-test')
				expect(attr_selector?.attr_operator).toBe(ATTR_OPERATOR_EQUAL)
				expect(attr_selector?.attr_flags).toBe(ATTR_FLAG_NONE)
			})

			it('should trim whitespace and comments from attribute selectors', () => {
				const input = '[/* comment */   data-test="value"   /* test */]'
				const root = parse_selector(input)
				expect(root.first_child?.type_name).toBe('Selector')
				const attr_selector = root.first_child?.first_child
				expect(attr_selector?.type_name).toBe('AttributeSelector')
				expect(attr_selector?.value).toBe('"value"')
				expect(attr_selector?.property).toBe('data-test')
				expect(attr_selector?.attr_operator).toBe(ATTR_OPERATOR_EQUAL)
				expect(attr_selector?.attr_flags).toBe(ATTR_FLAG_NONE)
				expect(attr_selector?.text).toBe(input)
			})

			it('should parse attribute with case-insensitive flag', () => {
				const { arena, rootNode, source } = parseSelectorInternal('[type="text" i]')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(ATTRIBUTE_SELECTOR)
				expect(getNodeText(arena, source, child)).toBe('[type="text" i]')
				expect(getNodeContent(arena, source, child)).toBe('type')
				expect(arena.get_attr_flags(child)).toBe(ATTR_FLAG_CASE_INSENSITIVE)
			})

			it('should parse attribute with case-insensitive flag using CSSNode API', () => {
				const root = parse_selector('[type="text" i]')

				expect(root).not.toBeNull()
				if (!root) return

				expect(root.type).toBe(SELECTOR_LIST)
				let selector = root.first_child!
				expect(selector.type).toBe(SELECTOR)
				let attr = selector.first_child!
				expect(attr.type).toBe(ATTRIBUTE_SELECTOR)
				expect(attr.attr_flags).toBe(ATTR_FLAG_CASE_INSENSITIVE)
				expect(attr.attr_operator).toBe(ATTR_OPERATOR_EQUAL)
			})

			it('should parse attribute with case-sensitive flag', () => {
				const { arena, rootNode, source } = parseSelectorInternal('[type="text" s]')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(ATTRIBUTE_SELECTOR)
				expect(getNodeText(arena, source, child)).toBe('[type="text" s]')
				expect(getNodeContent(arena, source, child)).toBe('type')
				expect(arena.get_attr_flags(child)).toBe(ATTR_FLAG_CASE_SENSITIVE)
			})

			it('should parse attribute with uppercase case-insensitive flag', () => {
				const { arena, rootNode } = parseSelectorInternal('[type="text" I]')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(ATTRIBUTE_SELECTOR)
				expect(arena.get_attr_flags(child)).toBe(ATTR_FLAG_CASE_INSENSITIVE)
			})

			it('should parse attribute with whitespace before flag', () => {
				const { arena, rootNode } = parseSelectorInternal('[type="text"   i]')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(ATTRIBUTE_SELECTOR)
				expect(arena.get_attr_flags(child)).toBe(ATTR_FLAG_CASE_INSENSITIVE)
			})

			it('should parse attribute without flag', () => {
				const { arena, rootNode } = parseSelectorInternal('[type="text"]')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(ATTRIBUTE_SELECTOR)
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
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				const selectorWrapper = arena.get_first_child(rootNode)
				const children = getChildren(arena, source, selectorWrapper)
				expect(children.length).toBeGreaterThanOrEqual(2)

				// Should have: compound(div), combinator(space), compound(p)
				const hasDescendantCombinator = children.some((child) => {
					const type = arena.get_type(child)
					return type === COMBINATOR
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
					if (type === COMBINATOR) {
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
					if (type === COMBINATOR) {
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
					if (type === COMBINATOR) {
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
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				// List contains the two selectors
				const children = getChildren(arena, source, rootNode)
				expect(children).toHaveLength(2)
			})

			it('should parse selector list with three selectors', () => {
				const { arena, rootNode, source } = parseSelectorInternal('h1, h2, h3')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				// List contains the three selectors
				const children = getChildren(arena, source, rootNode)
				expect(children).toHaveLength(3)
			})

			it('should parse complex selector list', () => {
				const { arena, rootNode, source } = parseSelectorInternal('div.container, .wrapper > p, #app')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				// List contains 3 NODE_SELECTOR wrappers: div.container, .wrapper > p, #app
				const children = getChildren(arena, source, rootNode)
				expect(children).toHaveLength(3)
			})

			it('should parse selector list with comments between selectors', () => {
				const selector_list = parse_selector('a, b, /* comment */ c, d')
				expect(selector_list.children).toHaveLength(4)
				expect(selector_list.children[0].type).toBe(SELECTOR)
				expect(selector_list.children[1].type).toBe(SELECTOR)
				expect(selector_list.children[2].type).toBe(SELECTOR)
				expect(selector_list.children[3].type).toBe(SELECTOR)
			})

			it('should parse selector list with comments after commas', () => {
				const selector_list = parse_selector('a,/* comment */b,/* another */c')
				expect(selector_list.children).toHaveLength(3)
				expect(selector_list.children[0].type).toBe(SELECTOR)
				expect(selector_list.children[1].type).toBe(SELECTOR)
				expect(selector_list.children[2].type).toBe(SELECTOR)
			})

			it('should parse selector with comments around descending combinator', () => {
				const selector_list = parse_selector('a /* comment */ /*comment */ b')
				expect(selector_list.children).toHaveLength(1)
				const selector = selector_list.children[0]
				expect(selector.type).toBe(SELECTOR)
				expect(selector.text).toBe('a /* comment */ /*comment */ b')
				expect(selector.children.map((child) => child.type)).toEqual([TYPE_SELECTOR, COMBINATOR, TYPE_SELECTOR])
			})

			it('should parse selector with comments around child combinator', () => {
				const selector_list = parse_selector('a /* comment */ > /*comment */ b')
				expect(selector_list.children).toHaveLength(1)
				const selector = selector_list.children[0]
				expect(selector.type).toBe(SELECTOR)
				expect(selector.text).toBe('a /* comment */ > /*comment */ b')
				expect(selector.children.map((child) => child.type)).toEqual([TYPE_SELECTOR, COMBINATOR, TYPE_SELECTOR])
			})

			it('should parse selector with comments around sibling combinator', () => {
				const selector_list = parse_selector('a /* comment */ + /*comment */ b')
				expect(selector_list.children).toHaveLength(1)
				const selector = selector_list.children[0]
				expect(selector.type).toBe(SELECTOR)
				expect(selector.text).toBe('a /* comment */ + /*comment */ b')
				expect(selector.children.map((child) => child.type)).toEqual([TYPE_SELECTOR, COMBINATOR, TYPE_SELECTOR])
			})

			it('should parse selector with comments around adjecent sibling combinator', () => {
				const selector_list = parse_selector('a /* comment */ ~ /*comment */ b')
				expect(selector_list.children).toHaveLength(1)
				const selector = selector_list.children[0]
				expect(selector.type).toBe(SELECTOR)
				expect(selector.text).toBe('a /* comment */ ~ /*comment */ b')
				expect(selector.children.map((child) => child.type)).toEqual([TYPE_SELECTOR, COMBINATOR, TYPE_SELECTOR])
			})
		})

		describe('Complex selectors', () => {
			it('should parse navigation selector', () => {
				const { arena, rootNode } = parseSelectorInternal('nav > ul > li > a')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)
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
					return arena.get_type(child) === COMBINATOR
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
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				const selectorWrapper = arena.get_first_child(rootNode)
				expect(arena.get_type(selectorWrapper)).toBe(SELECTOR)

				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(PSEUDO_CLASS_SELECTOR)
				expect(getNodeContent(arena, source, child)).toBe('where')
			})

			it('should parse :has(a) pseudo-class', () => {
				const root = parse_selector('div:has(a)')

				expect(root.first_child?.type).toBe(SELECTOR)
				expect(root.first_child!.children).toHaveLength(2)
				const [_, has] = root.first_child!.children

				expect(has.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(has.text).toBe(':has(a)')

				// Check children of :has() - should contain selector list with > combinator and p type selector
				expect(has.has_children).toBe(true)
				const selectorList = has.first_child!
				expect(selectorList.type).toBe(SELECTOR_LIST)

				// Selector list contains one selector
				const selector = selectorList.first_child!
				expect(selector.type).toBe(SELECTOR)

				const selectorParts = selector.children
				expect(selectorParts).toHaveLength(1)
				expect(selectorParts[0].type).toBe(TYPE_SELECTOR)
				expect(selectorParts[0].text).toBe('a')
			})

			it('should parse :has(> p) pseudo-class', () => {
				const root = parse_selector('div:has(> p)')

				expect(root.first_child?.type).toBe(SELECTOR)
				expect(root.first_child!.children).toHaveLength(2)
				const [div, has] = root.first_child!.children
				expect(div.type).toBe(TYPE_SELECTOR)
				expect(div.text).toBe('div')

				expect(has.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(has.text).toBe(':has(> p)')

				// Check children of :has() - should contain selector list with > combinator and p type selector
				expect(has.has_children).toBe(true)
				const selectorList = has.first_child!
				expect(selectorList.type).toBe(SELECTOR_LIST)

				// Selector list contains one selector
				const selector = selectorList.first_child!
				expect(selector.type).toBe(SELECTOR)

				const selectorParts = selector.children
				expect(selectorParts).toHaveLength(2)
				expect(selectorParts[0].type).toBe(COMBINATOR)
				expect(selectorParts[0].text).toBe('>')
				expect(selectorParts[1].type).toBe(TYPE_SELECTOR)
				expect(selectorParts[1].text).toBe('p')
			})

			it('should parse :has() with adjacent sibling combinator (+)', () => {
				const root = parse_selector('div:has(+ p)')
				const has = root.first_child!.children[1]
				const selectorList = has.first_child!
				const selector = selectorList.first_child!
				const parts = selector.children

				expect(parts).toHaveLength(2)
				expect(parts[0].type).toBe(COMBINATOR)
				expect(parts[0].text).toBe('+')
				expect(parts[1].type).toBe(TYPE_SELECTOR)
				expect(parts[1].text).toBe('p')
			})

			it('should parse :has() with general sibling combinator (~)', () => {
				const root = parse_selector('div:has(~ p)')
				const has = root.first_child!.children[1]
				const selectorList = has.first_child!
				const selector = selectorList.first_child!
				const parts = selector.children

				expect(parts).toHaveLength(2)
				expect(parts[0].type).toBe(COMBINATOR)
				expect(parts[0].text).toBe('~')
				expect(parts[1].type).toBe(TYPE_SELECTOR)
				expect(parts[1].text).toBe('p')
			})

			it('should parse :has() with descendant selector (no combinator)', () => {
				const root = parse_selector('div:has(p)')
				const has = root.first_child!.children[1]
				const selectorList = has.first_child!
				const selector = selectorList.first_child!

				expect(selector.children).toHaveLength(1)
				expect(selector.children[0].type).toBe(TYPE_SELECTOR)
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

				expect(has.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(has.text).toBe(':has()')
				expect(has.has_children).toBe(true) // Has function syntax (parentheses)
			})

			it('should parse nesting with ampersand', () => {
				const { arena, rootNode, source } = parseSelectorInternal('&.active')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[0])).toBe(NESTING_SELECTOR)
				expect(arena.get_type(children[1])).toBe(CLASS_SELECTOR)
			})

			it('should parse nesting selector with descendant combinator as single selector', () => {
				const { arena, rootNode, source } = parseSelectorInternal('& span')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				// Should have only ONE selector, not two
				const selectorWrappers = getChildren(arena, source, rootNode)
				expect(selectorWrappers).toHaveLength(1)

				// The single selector should have 3 children: &, combinator (space), span
				const selectorWrapper = selectorWrappers[0]
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(3)
				expect(arena.get_type(children[0])).toBe(NESTING_SELECTOR)
				expect(arena.get_type(children[1])).toBe(COMBINATOR)
				expect(arena.get_type(children[2])).toBe(TYPE_SELECTOR)
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
				expect(arena.get_type(children[0])).toBe(NESTING_SELECTOR)
				expect(arena.get_type(children[1])).toBe(COMBINATOR)
				expect(getNodeText(arena, source, children[1]).trim()).toBe('>')
				expect(arena.get_type(children[2])).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, children[2])).toBe('div')
			})
		})

		describe('Relaxed nesting (CSS Nesting Module Level 1)', () => {
			it('should parse selector starting with child combinator', () => {
				const { arena, rootNode, source } = parseSelectorInternal('> a')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Should have one selector
				const selectorWrappers = getChildren(arena, source, rootNode)
				expect(selectorWrappers).toHaveLength(1)

				// The selector should have 2 children: combinator (>) and type selector (a)
				const selectorWrapper = selectorWrappers[0]
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[0])).toBe(COMBINATOR)
				expect(getNodeText(arena, source, children[0]).trim()).toBe('>')
				expect(arena.get_type(children[1])).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, children[1])).toBe('a')
			})

			it('should parse selector starting with next-sibling combinator', () => {
				const { arena, rootNode, source } = parseSelectorInternal('+ div')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrappers = getChildren(arena, source, rootNode)
				expect(selectorWrappers).toHaveLength(1)

				const selectorWrapper = selectorWrappers[0]
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[0])).toBe(COMBINATOR)
				expect(getNodeText(arena, source, children[0]).trim()).toBe('+')
				expect(arena.get_type(children[1])).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, children[1])).toBe('div')
			})

			it('should parse selector starting with subsequent-sibling combinator', () => {
				const { arena, rootNode, source } = parseSelectorInternal('~ span')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrappers = getChildren(arena, source, rootNode)
				expect(selectorWrappers).toHaveLength(1)

				const selectorWrapper = selectorWrappers[0]
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[0])).toBe(COMBINATOR)
				expect(getNodeText(arena, source, children[0]).trim()).toBe('~')
				expect(arena.get_type(children[1])).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, children[1])).toBe('span')
			})

			it('should parse complex selector after leading combinator', () => {
				const { arena, rootNode, source } = parseSelectorInternal('> a.link#nav[href]:hover')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrappers = getChildren(arena, source, rootNode)
				expect(selectorWrappers).toHaveLength(1)

				const selectorWrapper = selectorWrappers[0]
				const children = getChildren(arena, source, selectorWrapper)

				// Should have: combinator (>), type (a), class (.link), id (#nav), attribute ([href]), pseudo-class (:hover)
				expect(children.length).toBeGreaterThanOrEqual(6)
				expect(arena.get_type(children[0])).toBe(COMBINATOR)
				expect(getNodeText(arena, source, children[0]).trim()).toBe('>')
				expect(arena.get_type(children[1])).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, children[1])).toBe('a')
				expect(arena.get_type(children[2])).toBe(CLASS_SELECTOR)
				expect(getNodeText(arena, source, children[2])).toBe('.link')
				expect(arena.get_type(children[3])).toBe(ID_SELECTOR)
				expect(getNodeText(arena, source, children[3])).toBe('#nav')
				expect(arena.get_type(children[4])).toBe(ATTRIBUTE_SELECTOR)
				expect(arena.get_type(children[5])).toBe(PSEUDO_CLASS_SELECTOR)
			})

			it('should parse multiple selectors with leading combinators', () => {
				const { arena, rootNode, source } = parseSelectorInternal('> a, ~ span, + div')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Should have three selectors
				const selectorWrappers = getChildren(arena, source, rootNode)
				expect(selectorWrappers).toHaveLength(3)

				// First selector: > a
				let children = getChildren(arena, source, selectorWrappers[0])
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[0])).toBe(COMBINATOR)
				expect(getNodeText(arena, source, children[0]).trim()).toBe('>')
				expect(arena.get_type(children[1])).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, children[1])).toBe('a')

				// Second selector: ~ span
				children = getChildren(arena, source, selectorWrappers[1])
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[0])).toBe(COMBINATOR)
				expect(getNodeText(arena, source, children[0]).trim()).toBe('~')
				expect(arena.get_type(children[1])).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, children[1])).toBe('span')

				// Third selector: + div
				children = getChildren(arena, source, selectorWrappers[2])
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[0])).toBe(COMBINATOR)
				expect(getNodeText(arena, source, children[0]).trim()).toBe('+')
				expect(arena.get_type(children[1])).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, children[1])).toBe('div')
			})

			it('should parse leading combinator with whitespace', () => {
				const { arena, rootNode, source } = parseSelectorInternal('>   a')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrappers = getChildren(arena, source, rootNode)
				expect(selectorWrappers).toHaveLength(1)

				const selectorWrapper = selectorWrappers[0]
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(2)
				expect(arena.get_type(children[0])).toBe(COMBINATOR)
				expect(getNodeText(arena, source, children[0]).trim()).toBe('>')
				expect(arena.get_type(children[1])).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, children[1])).toBe('a')
			})

			it('should parse selector with both leading and middle combinators', () => {
				const { arena, rootNode, source } = parseSelectorInternal('> div span')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrappers = getChildren(arena, source, rootNode)
				expect(selectorWrappers).toHaveLength(1)

				const selectorWrapper = selectorWrappers[0]
				const children = getChildren(arena, source, selectorWrapper)

				// Should have: combinator (>), type (div), combinator (descendant), type (span)
				expect(children).toHaveLength(4)
				expect(arena.get_type(children[0])).toBe(COMBINATOR)
				expect(getNodeText(arena, source, children[0]).trim()).toBe('>')
				expect(arena.get_type(children[1])).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, children[1])).toBe('div')
				expect(arena.get_type(children[2])).toBe(COMBINATOR)
				expect(arena.get_type(children[3])).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, children[3])).toBe('span')
			})
		})

		describe('An+B Expressions (from :nth-child, :nth-of-type, etc.)', () => {
			describe('Simple integers (b only)', () => {
				test(':nth-child(3)', () => {
					const root = parse_selector(':nth-child(3)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.type).toBe(NTH_SELECTOR)
					expect(nthNode.nth_a).toBeUndefined()
					expect(nthNode.nth_b).toBe('3')
				})

				test(':nth-child(-5)', () => {
					const root = parse_selector(':nth-child(-5)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBeUndefined()
					expect(nthNode.nth_b).toBe('-5')
				})

				test(':nth-child(0)', () => {
					const root = parse_selector(':nth-child(0)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBeUndefined()
					expect(nthNode.nth_b).toBe('0')
				})
			})

			describe('Keywords', () => {
				test('odd keyword', () => {
					const root = parse_selector(':nth-child(odd)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('odd')
					expect(nthNode.nth_b).toBeUndefined()
				})

				test('even keyword', () => {
					const root = parse_selector(':nth-child(even)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('even')
					expect(nthNode.nth_b).toBeUndefined()
				})
			})

			describe('Just n (a only)', () => {
				test('n', () => {
					const root = parse_selector(':nth-child(n)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('n')
					expect(nthNode.nth_b).toBeUndefined()
				})

				test('+n', () => {
					const root = parse_selector(':nth-child(+n)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('+n')
					expect(nthNode.nth_b).toBeUndefined()
				})

				test('-n', () => {
					const root = parse_selector(':nth-child(-n)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('-n')
					expect(nthNode.nth_b).toBeUndefined()
				})
			})

			describe('Dimension tokens (An)', () => {
				test('2n', () => {
					const root = parse_selector(':nth-child(2n)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('2n')
					expect(nthNode.nth_b).toBeUndefined()
				})

				test('-3n', () => {
					const root = parse_selector(':nth-child(-3n)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('-3n')
					expect(nthNode.nth_b).toBeUndefined()
				})

				test('+5n', () => {
					const root = parse_selector(':nth-child(+5n)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('+5n')
					expect(nthNode.nth_b).toBeUndefined()
				})
			})

			describe('An+B expressions', () => {
				test('2n+1', () => {
					const root = parse_selector(':nth-child(2n+1)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('2n')
					expect(nthNode.nth_b).toBe('+1')
				})

				test('3n+5', () => {
					const root = parse_selector(':nth-child(3n+5)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('3n')
					expect(nthNode.nth_b).toBe('+5')
				})

				test('n+0', () => {
					const root = parse_selector(':nth-child(n+0)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('n')
					expect(nthNode.nth_b).toBe('+0')
				})
			})

			describe('An-B expressions', () => {
				test('2n-1', () => {
					const root = parse_selector(':nth-child(2n-1)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('2n')
					expect(nthNode.nth_b).toBe('-1')
				})

				test('3n-5', () => {
					const root = parse_selector(':nth-child(3n-5)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('3n')
					expect(nthNode.nth_b).toBe('-5')
				})

				test('-n-1', () => {
					const root = parse_selector(':nth-child(-n-1)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('-n')
					expect(nthNode.nth_b).toBe('-1')
				})
			})

			describe('Whitespace handling', () => {
				test('2n + 1 with spaces', () => {
					const root = parse_selector(':nth-child(2n + 1)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('2n')
					expect(nthNode.nth_b).toBe('+1')
				})

				test('2n - 1 with spaces', () => {
					const root = parse_selector(':nth-child(2n - 1)')
					const pseudoClass = root.first_child!.first_child!
					const nthNode = pseudoClass.first_child!
					expect(nthNode.nth_a).toBe('2n')
					expect(nthNode.nth_b).toBe('-1')
				})
			})

			describe(':nth-of-type() with "of" syntax', () => {
				test(':nth-child(2n of .selector)', () => {
					const root = parse_selector(':nth-child(2n of .selector)')
					const pseudoClass = root.first_child!.first_child!
					const nthOfNode = pseudoClass.first_child!
					expect(nthOfNode.type).toBe(NTH_OF_SELECTOR)
					expect(nthOfNode.text).toBe('2n of .selector')

					// NTH_OF has two children: An+B and selector list
					expect(nthOfNode.children).toHaveLength(2)
					const anplusb = nthOfNode.first_child!
					expect(anplusb.type).toBe(NTH_SELECTOR)
					expect(anplusb.nth_a).toBe('2n')
					expect(anplusb.nth_b).toBeUndefined()

					// Second child is the selector list
					const selectorList = nthOfNode.children[1]
					expect(selectorList.type).toBe(SELECTOR_LIST)
					const selector = selectorList.first_child!
					expect(selector.type).toBe(SELECTOR)
					expect(selector.first_child!.text).toBe('.selector')
				})

				test(':nth-child(1 of li)', () => {
					const root = parse_selector('ul:has(:nth-child(1 of li))')
					const nth = root.first_child!.children[1]
					expect(nth.type).toBe(PSEUDO_CLASS_SELECTOR)
					expect(nth.text).toBe(':has(:nth-child(1 of li))')
				})

				test(':nth-child(1 /* test */ of /* test */ li)', () => {
					const input = ':nth-child(1 /* test */ of /* test */ li)'
					const root = parse_selector(input)
					const nth = root.first_child!.first_child
					expect(nth?.type).toBe(PSEUDO_CLASS_SELECTOR)
					expect(nth?.text).toBe(input)
					expect(nth?.first_child?.type).toBe(NTH_OF_SELECTOR)
					const nth_of = nth?.first_child
					expect(nth_of?.text).toBe('1 /* test */ of /* test */ li')
					expect(nth_of?.children).toHaveLength(2)
					expect(nth_of?.children[0].type_name).toBe('Nth')
					expect(nth_of?.children[1].type_name).toBe('SelectorList')
				})

				test(':nth-child(3n OF .test)', () => {
					const input = ':nth-child(3n OF .test)'
					const root = parse_selector(input)
					const nth = root.first_child!.first_child
					expect(nth?.type).toBe(PSEUDO_CLASS_SELECTOR)
					expect(nth?.text).toBe(input)
					expect(nth?.first_child?.type).toBe(NTH_OF_SELECTOR)
					const nth_of = nth?.first_child
					expect(nth_of?.text).toBe('3n OF .test')
					expect(nth_of?.children).toHaveLength(2)
				})
			})
		})

		describe(':lang() pseudo-class', () => {
			test(':lang("nl", "de")', () => {
				const root = parse_selector(':lang("nl", "de")')

				// Root is selector list
				expect(root.type).toBe(SELECTOR_LIST)

				// First selector in the list
				const selector = root.first_child!
				expect(selector.type).toBe(SELECTOR)

				// Selector has :lang() pseudo-class
				const langPseudoClass = selector.first_child!
				expect(langPseudoClass.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(langPseudoClass.text).toBe(':lang("nl", "de")')

				// :lang() has 2 children - language identifiers
				expect(langPseudoClass.has_children).toBe(true)
				expect(langPseudoClass.children).toHaveLength(2)

				// First language identifier: "nl"
				const lang1 = langPseudoClass.children[0]
				expect(lang1.type).toBe(LANG_SELECTOR)
				expect(lang1.text).toBe('"nl"')

				// Second language identifier: "de"
				const lang2 = langPseudoClass.children[1]
				expect(lang2.type).toBe(LANG_SELECTOR)
				expect(lang2.text).toBe('"de"')
			})

			test(':lang(en, fr) with unquoted identifiers', () => {
				const root = parse_selector(':lang(en, fr)')

				const selector = root.first_child!
				const langPseudoClass = selector.first_child!

				expect(langPseudoClass.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(langPseudoClass.text).toBe(':lang(en, fr)')

				// :lang() has 2 children - language identifiers
				expect(langPseudoClass.children).toHaveLength(2)

				// First language identifier: en
				const lang1 = langPseudoClass.children[0]
				expect(lang1.type).toBe(LANG_SELECTOR)
				expect(lang1.text).toBe('en')

				// Second language identifier: fr
				const lang2 = langPseudoClass.children[1]
				expect(lang2.type).toBe(LANG_SELECTOR)
				expect(lang2.text).toBe('fr')
			})

			test(':lang(en-US) single language with hyphen', () => {
				const root = parse_selector(':lang(en-US)')

				const selector = root.first_child!
				const langPseudoClass = selector.first_child!

				expect(langPseudoClass.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(langPseudoClass.text).toBe(':lang(en-US)')

				// :lang() has 1 child - single language identifier
				expect(langPseudoClass.children).toHaveLength(1)

				const lang1 = langPseudoClass.children[0]
				expect(lang1.type).toBe(LANG_SELECTOR)
				expect(lang1.text).toBe('en-US')
			})

			test(':lang("*-Latn") wildcard pattern', () => {
				const root = parse_selector(':lang("*-Latn")')

				const selector = root.first_child!
				const langPseudoClass = selector.first_child!

				expect(langPseudoClass.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(langPseudoClass.text).toBe(':lang("*-Latn")')

				// :lang() has 1 child - wildcard language identifier
				expect(langPseudoClass.children).toHaveLength(1)

				const lang1 = langPseudoClass.children[0]
				expect(lang1.type).toBe(LANG_SELECTOR)
				expect(lang1.text).toBe('"*-Latn"')
			})
		})

		describe(':is() and :where() pseudo-classes', () => {
			test(':is(a, b)', () => {
				const root = parse_selector(':is(a, b)')

				// Root is selector list
				expect(root.type).toBe(SELECTOR_LIST)

				// First selector in the list
				const selector = root.first_child!
				expect(selector.type).toBe(SELECTOR)

				// Selector has :is() pseudo-class
				const isPseudoClass = selector.first_child!
				expect(isPseudoClass.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(isPseudoClass.text).toBe(':is(a, b)')

				// :is() has 1 child: a selector list
				expect(isPseudoClass.children).toHaveLength(1)
				const innerSelectorList = isPseudoClass.first_child!
				expect(innerSelectorList.type).toBe(SELECTOR_LIST)

				// The selector list has 2 children: selector for 'a' and selector for 'b'
				expect(innerSelectorList.children).toHaveLength(2)

				// First selector: 'a'
				const selectorA = innerSelectorList.children[0]
				expect(selectorA.type).toBe(SELECTOR)
				expect(selectorA.children).toHaveLength(1)
				expect(selectorA.children[0].type).toBe(TYPE_SELECTOR)
				expect(selectorA.children[0].text).toBe('a')

				// Second selector: 'b'
				const selectorB = innerSelectorList.children[1]
				expect(selectorB.type).toBe(SELECTOR)
				expect(selectorB.children).toHaveLength(1)
				expect(selectorB.children[0].type).toBe(TYPE_SELECTOR)
				expect(selectorB.children[0].text).toBe('b')
			})
		})

		describe('keyframes selectors', () => {
			test('simple percentage', () => {
				let root = parse_selector('50%')
				expect(root.type_name).toBe('SelectorList')
				expect(root.first_child?.type_name).toBe('Selector')
				expect(root.first_child?.text).toBe('50%')
				expect(root.first_child?.first_child?.type_name).toBe('Dimension')
			})
			test('fraction percentage', () => {
				let root = parse_selector('50.1%')
				expect(root.type_name).toBe('SelectorList')
				expect(root.first_child?.type_name).toBe('Selector')
				expect(root.first_child?.text).toBe('50.1%')
				expect(root.first_child?.first_child?.type_name).toBe('Dimension')
			})
			test('scientific percentage', () => {
				let root = parse_selector('50e1%')
				expect(root.type_name).toBe('SelectorList')
				expect(root.first_child?.type_name).toBe('Selector')
				expect(root.first_child?.text).toBe('50e1%')
				expect(root.first_child?.first_child?.type_name).toBe('Dimension')
			})
			test('from keyword', () => {
				let root = parse_selector('from')
				expect(root.type_name).toBe('SelectorList')
				expect(root.first_child?.type_name).toBe('Selector')
				expect(root.first_child?.text).toBe('from')
				expect(root.first_child?.first_child?.type_name).toBe('TypeSelector')
			})
			test('90%, to', () => {
				let root = parse_selector('90%, to')
				expect(root.type_name).toBe('SelectorList')
				expect(root.text).toBe('90%, to')

				let [percentage, to] = root.children
				expect(percentage.type_name).toBe('Selector')
				expect(percentage.text).toBe('90%')
				expect(percentage.first_child?.type_name).toBe('Dimension')

				expect(to.type_name).toBe('Selector')
				expect(to.text).toBe('to')
				expect(to.first_child?.type_name).toBe('TypeSelector')
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
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				const selectorWrapper = arena.get_first_child(rootNode)
				expect(arena.get_type(selectorWrapper)).toBe(SELECTOR)

				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(CLASS_SELECTOR)
				expect(getNodeContent(arena, source, child)).toBe('.my-class-123')
			})

			it('should parse hyphenated element names', () => {
				const { arena, rootNode, source } = parseSelectorInternal('custom-element')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				const selectorWrapper = arena.get_first_child(rootNode)
				expect(arena.get_type(selectorWrapper)).toBe(SELECTOR)

				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(TYPE_SELECTOR)
				expect(getNodeText(arena, source, child)).toBe('custom-element')
			})
		})

		describe('Real-world selectors', () => {
			it('should parse BEM selector', () => {
				const { arena, rootNode, source } = parseSelectorInternal('.block__element--modifier')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				// Root is NODE_SELECTOR_LIST
				expect(arena.get_type(rootNode)).toBe(SELECTOR_LIST)

				const selectorWrapper = arena.get_first_child(rootNode)
				expect(arena.get_type(selectorWrapper)).toBe(SELECTOR)

				const child = arena.get_first_child(selectorWrapper)
				expect(arena.get_type(child)).toBe(CLASS_SELECTOR)
				expect(getNodeContent(arena, source, child)).toBe('.block__element--modifier')
			})

			it('should parse Bootstrap-style selector', () => {
				const { arena, rootNode, source } = parseSelectorInternal('.btn.btn-primary.btn-lg')

				expect(rootNode).not.toBeNull()
				if (!rootNode) return

				const selectorWrapper = arena.get_first_child(rootNode)
				const children = getChildren(arena, source, selectorWrapper)
				expect(children).toHaveLength(3)
				expect(arena.get_type(children[0])).toBe(CLASS_SELECTOR)
				expect(arena.get_type(children[1])).toBe(CLASS_SELECTOR)
				expect(arena.get_type(children[2])).toBe(CLASS_SELECTOR)
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
				expect(arena.get_type(children[1])).toBe(PSEUDO_CLASS_SELECTOR)
				expect(getNodeContent(arena, source, children[1])).toBe('nth-of-type')
			})
		})

		describe('Namespace selectors', () => {
			test('should parse ns|* (namespace with universal selector)', () => {
				const result = parse_selector('ns|*')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('ns|*')

				const selector = result.first_child
				expect(selector?.type).toBe(SELECTOR)
				expect(selector?.text).toBe('ns|*')

				const universal = selector?.first_child
				expect(universal?.type).toBe(UNIVERSAL_SELECTOR)
				expect(universal?.text).toBe('ns|*')
				expect(universal?.name).toBe('ns')
			})

			test('should parse ns|div (namespace with type selector)', () => {
				const result = parse_selector('ns|div')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('ns|div')

				const selector = result.first_child
				expect(selector?.type).toBe(SELECTOR)

				const typeSelector = selector?.first_child
				expect(typeSelector?.type).toBe(TYPE_SELECTOR)
				expect(typeSelector?.text).toBe('ns|div')
				expect(typeSelector?.name).toBe('ns')
			})

			test('should parse *|* (any namespace with universal selector)', () => {
				const result = parse_selector('*|*')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('*|*')

				const selector = result.first_child
				const universal = selector?.first_child
				expect(universal?.type).toBe(UNIVERSAL_SELECTOR)
				expect(universal?.text).toBe('*|*')
				expect(universal?.name).toBe('*')
			})

			test('should parse *|div (any namespace with type selector)', () => {
				const result = parse_selector('*|div')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('*|div')

				const selector = result.first_child
				const typeSelector = selector?.first_child
				expect(typeSelector?.type).toBe(TYPE_SELECTOR)
				expect(typeSelector?.text).toBe('*|div')
				expect(typeSelector?.name).toBe('*')
			})

			test('should parse |* (empty namespace with universal selector)', () => {
				const result = parse_selector('|*')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('|*')

				const selector = result.first_child
				const universal = selector?.first_child
				expect(universal?.type).toBe(UNIVERSAL_SELECTOR)
				expect(universal?.text).toBe('|*')
				// Empty namespace should result in empty name
				expect(universal?.name).toBe('|')
			})

			test('should parse |div (empty namespace with type selector)', () => {
				const result = parse_selector('|div')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('|div')

				const selector = result.first_child
				const typeSelector = selector?.first_child
				expect(typeSelector?.type).toBe(TYPE_SELECTOR)
				expect(typeSelector?.text).toBe('|div')
				// Empty namespace should result in empty name
				expect(typeSelector?.name).toBe('|')
			})

			test('should parse namespace selector with class', () => {
				const result = parse_selector('ns|div.class')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('ns|div.class')

				const selector = result.first_child
				const children = selector?.children || []
				expect(children.length).toBe(2)
				expect(children[0].type).toBe(TYPE_SELECTOR)
				expect(children[0].text).toBe('ns|div')
				expect(children[0].name).toBe('ns')
				expect(children[1].type).toBe(CLASS_SELECTOR)
			})

			test('should parse namespace selector with ID', () => {
				const result = parse_selector('ns|*#id')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('ns|*#id')

				const selector = result.first_child
				const children = selector?.children || []
				expect(children.length).toBe(2)
				expect(children[0].type).toBe(UNIVERSAL_SELECTOR)
				expect(children[0].text).toBe('ns|*')
				expect(children[1].type).toBe(ID_SELECTOR)
			})

			test('should parse namespace selector in complex selector', () => {
				const result = parse_selector('ns|div > *|span')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('ns|div > *|span')

				const selector = result.first_child
				const children = selector?.children || []
				expect(children.length).toBe(3) // div, >, span
				expect(children[0].type).toBe(TYPE_SELECTOR)
				expect(children[0].text).toBe('ns|div')
				expect(children[1].type).toBe(COMBINATOR)
				expect(children[2].type).toBe(TYPE_SELECTOR)
				expect(children[2].text).toBe('*|span')
			})

			test('should parse namespace selector in selector list', () => {
				const result = parse_selector('ns|div, |span, *|p')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('ns|div, |span, *|p')

				const selectors = result.children
				expect(selectors.length).toBe(3)

				const firstType = selectors[0].first_child
				expect(firstType?.type).toBe(TYPE_SELECTOR)
				expect(firstType?.text).toBe('ns|div')
				expect(firstType?.name).toBe('ns')

				const secondType = selectors[1].first_child
				expect(secondType?.type).toBe(TYPE_SELECTOR)
				expect(secondType?.text).toBe('|span')
				expect(secondType?.name).toBe('|')

				const thirdType = selectors[2].first_child
				expect(thirdType?.type).toBe(TYPE_SELECTOR)
				expect(thirdType?.text).toBe('*|p')
				expect(thirdType?.name).toBe('*')
			})

			test('should parse namespace selector with attribute', () => {
				const result = parse_selector('ns|div[attr="value"]')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('ns|div[attr="value"]')

				const selector = result.first_child
				const children = selector?.children || []
				expect(children.length).toBe(2)
				expect(children[0].type).toBe(TYPE_SELECTOR)
				expect(children[0].name).toBe('ns')
				expect(children[1].type).toBe(ATTRIBUTE_SELECTOR)
			})

			test('should parse namespace selector with pseudo-class', () => {
				const result = parse_selector('ns|a:hover')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('ns|a:hover')

				const selector = result.first_child
				const children = selector?.children || []
				expect(children.length).toBe(2)
				expect(children[0].type).toBe(TYPE_SELECTOR)
				expect(children[0].name).toBe('ns')
				expect(children[1].type).toBe(PSEUDO_CLASS_SELECTOR)
			})

			test('should parse namespace with various identifiers', () => {
				const result = parse_selector('svg|rect')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('svg|rect')

				const selector = result.first_child
				const typeSelector = selector?.first_child
				expect(typeSelector?.type).toBe(TYPE_SELECTOR)
				expect(typeSelector?.text).toBe('svg|rect')
				expect(typeSelector?.name).toBe('svg')
			})

			test('should parse long namespace identifier', () => {
				const result = parse_selector('myNamespace|element')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('myNamespace|element')

				const selector = result.first_child
				const typeSelector = selector?.first_child
				expect(typeSelector?.type).toBe(TYPE_SELECTOR)
				expect(typeSelector?.name).toBe('myNamespace')
			})

			test('should handle namespace in nested pseudo-class', () => {
				const result = parse_selector(':is(ns|div, *|span)')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe(':is(ns|div, *|span)')

				const selector = result.first_child
				const pseudo = selector?.first_child
				expect(pseudo?.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(pseudo?.name).toBe('is')

				// The content should contain namespace selectors
				const nestedList = pseudo?.first_child
				expect(nestedList?.type).toBe(SELECTOR_LIST)

				const nestedSelectors = nestedList?.children || []
				expect(nestedSelectors.length).toBe(2)

				const firstNestedType = nestedSelectors[0].first_child
				expect(firstNestedType?.type).toBe(TYPE_SELECTOR)
				expect(firstNestedType?.text).toBe('ns|div')

				const secondNestedType = nestedSelectors[1].first_child
				expect(secondNestedType?.type).toBe(TYPE_SELECTOR)
				expect(secondNestedType?.text).toBe('*|span')
			})
		})

		describe('API methods', () => {
			test('should parse simple type selector', () => {
				const result = parse_selector('div')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('div')
				expect(result.has_children).toBe(true)
			})

			test('should parse class selector', () => {
				const result = parse_selector('.classname')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('.classname')
				expect(result.has_children).toBe(true)
			})

			test('should parse ID selector', () => {
				const result = parse_selector('#identifier')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('#identifier')
				expect(result.has_children).toBe(true)
			})

			test('should parse compound selector', () => {
				const result = parse_selector('div.class#id')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('div.class#id')
				expect(result.has_children).toBe(true)
			})

			test('should parse complex selector with combinator', () => {
				const result = parse_selector('div.class > p#id')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('div.class > p#id')
				expect(result.has_children).toBe(true)
			})

			test('should parse selector list', () => {
				const result = parse_selector('h1, h2, h3')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('h1, h2, h3')
				expect(result.has_children).toBe(true)
			})

			test('should parse pseudo-class selector', () => {
				const result = parse_selector('a:hover')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('a:hover')
				expect(result.has_children).toBe(true)
			})

			test('should parse pseudo-class with function', () => {
				const result = parse_selector(':nth-child(2n+1)')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe(':nth-child(2n+1)')
				expect(result.has_children).toBe(true)
			})

			test('should parse unknown pseudo-class without parens', () => {
				let root = parse_selector(':hello')
				let pseudo = root.first_child?.first_child
				expect(pseudo?.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(pseudo?.has_children).toBe(false)
			})

			test('should parse unknown pseudo-class with empty parens', () => {
				let root = parse_selector(':hello()')
				let pseudo = root.first_child?.first_child
				expect(pseudo?.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(pseudo?.has_children).toBe(true)
				expect(pseudo?.children.length).toBe(0)
			})

			test('should parse attribute selector', () => {
				const result = parse_selector('[href^="https"]')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('[href^="https"]')
				expect(result.has_children).toBe(true)
			})

			test('should parse universal selector', () => {
				const result = parse_selector('*')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('*')
				expect(result.has_children).toBe(true)
			})

			test('should parse nesting selector', () => {
				const result = parse_selector('& .child')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('& .child')
				expect(result.has_children).toBe(true)
			})

			test('should parse descendant combinator', () => {
				const result = parse_selector('div span')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('div span')
				expect(result.has_children).toBe(true)
			})

			test('should parse child combinator', () => {
				const result = parse_selector('ul > li')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('ul > li')
				expect(result.has_children).toBe(true)
			})

			test('should parse adjacent sibling combinator', () => {
				const result = parse_selector('h1 + p')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('h1 + p')
				expect(result.has_children).toBe(true)
			})

			test('should parse general sibling combinator', () => {
				const result = parse_selector('h1 ~ p')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('h1 ~ p')
				expect(result.has_children).toBe(true)
			})

			test('should parse modern pseudo-classes', () => {
				const result = parse_selector(':is(h1, h2, h3)')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe(':is(h1, h2, h3)')
				expect(result.has_children).toBe(true)
			})

			test('should parse :where() pseudo-class', () => {
				const result = parse_selector(':where(.a, .b)')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe(':where(.a, .b)')
				expect(result.has_children).toBe(true)
			})

			test('should parse :has() pseudo-class', () => {
				const result = parse_selector('div:has(> img)')

				expect(result.type).toBe(SELECTOR_LIST)
				expect(result.text).toBe('div:has(> img)')
				expect(result.has_children).toBe(true)
			})

			test('should parse empty selector', () => {
				const result = parse_selector('')

				expect(result.type).toBe(SELECTOR_LIST)
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
	})

	describe('Comment Handling in Selectors', () => {
		describe('Namespace selectors with comments', () => {
			it('should parse namespace selector with comment before pipe', () => {
				const root = parse_selector('ns /* comment */ |E')
				const selector = root.first_child
				const typeSelector = selector?.first_child
				expect(typeSelector?.type).toBe(TYPE_SELECTOR)
				expect(typeSelector?.text).toBe('ns /* comment */ |E')
			})

			it('should parse universal namespace selector with comment before pipe', () => {
				const root = parse_selector('* /* comment */ |E')
				const selector = root.first_child
				const typeSelector = selector?.first_child
				expect(typeSelector?.type).toBe(TYPE_SELECTOR)
				expect(typeSelector?.text).toBe('* /* comment */ |E')
			})

			it('should handle comment after namespace prefix where no pipe exists', () => {
				const root = parse_selector('div /* comment */ .class')
				const selector = root.first_child
				// Comment acts as whitespace, creating a descendant combinator
				expect(selector?.children.length).toBe(3)
				const [type, combinator, classSelector] = selector?.children || []
				expect(type?.type).toBe(TYPE_SELECTOR)
				expect(combinator?.type).toBe(COMBINATOR)
				expect(classSelector?.type).toBe(CLASS_SELECTOR)
			})
		})

		describe('Pseudo-element with comments', () => {
			it('should parse pseudo-element with comment before second colon', () => {
				const root = parse_selector('div: /* comment */ :before')
				const selector = root.first_child
				const pseudoElement = selector?.children[1]
				expect(pseudoElement?.type).toBe(PSEUDO_ELEMENT_SELECTOR)
				expect(pseudoElement?.name).toBe('before')
			})

			it('should parse pseudo-class when comment after first colon', () => {
				const root = parse_selector('div:/* comment */hover')
				const selector = root.first_child
				expect(selector?.children.length).toBe(2)
				const [type, pseudoClass] = selector?.children || []
				expect(type?.type).toBe(TYPE_SELECTOR)
				expect(pseudoClass?.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(pseudoClass?.name).toBe('hover')
			})
		})

		describe('nth-child with comments', () => {
			it('should parse nth-child with comments in An+B expression', () => {
				const root = parse_selector(':nth-child(2n /* comment */ + /* comment */ 1)')
				const selector = root.first_child
				const nthChild = selector?.first_child
				expect(nthChild?.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(nthChild?.name).toBe('nth-child')
			})

			it('should parse nth-child with comment before "of" keyword', () => {
				const root = parse_selector(':nth-child(2n+1 /* comment */ of .class)')
				const selector = root.first_child
				const nthChild = selector?.first_child
				expect(nthChild?.type).toBe(PSEUDO_CLASS_SELECTOR)
				const nthOfSelector = nthChild?.first_child
				expect(nthOfSelector?.type).toBe(NTH_OF_SELECTOR)
			})

			it('should parse nth-child with comment after "of" keyword', () => {
				const root = parse_selector(':nth-child(2n+1 of /* comment */ .class)')
				const selector = root.first_child
				const nthChild = selector?.first_child
				expect(nthChild?.type).toBe(PSEUDO_CLASS_SELECTOR)
				const nthOfSelector = nthChild?.first_child
				expect(nthOfSelector?.type).toBe(NTH_OF_SELECTOR)
			})

			it('should not match "of" inside comments', () => {
				const root = parse_selector(':nth-child(2n /* of */ + 1)')
				const selector = root.first_child
				const nthChild = selector?.first_child
				expect(nthChild?.type).toBe(PSEUDO_CLASS_SELECTOR)
				const nthSelector = nthChild?.first_child
				// Should be NTH_SELECTOR, not NTH_OF_SELECTOR
				expect(nthSelector?.type).toBe(NTH_SELECTOR)
			})

			it('should parse nth-last-child with comments', () => {
				const root = parse_selector(':nth-last-child( /* comment */ 2n /* comment */ )')
				const selector = root.first_child
				const nthChild = selector?.first_child
				expect(nthChild?.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(nthChild?.name).toBe('nth-last-child')
			})

			it('should parse nth-of-type with comments', () => {
				const root = parse_selector(':nth-of-type(/* comment */odd/* comment */)')
				const selector = root.first_child
				const nth = selector?.first_child
				expect(nth?.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(nth?.name).toBe('nth-of-type')
			})

			it('should match "of" keyword case-insensitively - "Of"', () => {
				const root = parse_selector(':nth-child(2n Of .class)')
				const selector = root.first_child
				const nthChild = selector?.first_child
				const nthOfSelector = nthChild?.first_child
				expect(nthOfSelector?.type).toBe(NTH_OF_SELECTOR)
			})

			it('should match "of" keyword case-insensitively - "OF"', () => {
				const root = parse_selector(':nth-child(2n OF .class)')
				const selector = root.first_child
				const nthChild = selector?.first_child
				const nthOfSelector = nthChild?.first_child
				expect(nthOfSelector?.type).toBe(NTH_OF_SELECTOR)
			})

			it('should match "of" keyword case-insensitively - "oF"', () => {
				const root = parse_selector(':nth-child(2n oF .class)')
				const selector = root.first_child
				const nthChild = selector?.first_child
				const nthOfSelector = nthChild?.first_child
				expect(nthOfSelector?.type).toBe(NTH_OF_SELECTOR)
			})
		})

		describe('Comments in compound selectors', () => {
			it('should parse comments already tested in combinator tests', () => {
				// These are already tested in the "should parse selector with comments around..." tests
				const root = parse_selector('a /* comment */ > /* comment */ b')
				expect(root.children.length).toBe(1)
			})
		})

		describe('Comments in attribute selectors', () => {
			it('should parse comments already tested in attribute tests', () => {
				// These are already tested in "should trim comments from attribute selectors"
				const root = parse_selector('[/* comment */data-test="value"/* test */]')
				const selector = root.first_child
				const attr = selector?.first_child
				expect(attr?.type).toBe(ATTRIBUTE_SELECTOR)
			})
		})

		describe('Comments in selector lists', () => {
			it('should parse comments already tested in selector list tests', () => {
				// These are already tested in "should parse selector list with comments..."
				const root = parse_selector('a, /* comment */ b, c')
				expect(root.children.length).toBe(3)
			})
		})

		describe('Multiline comments', () => {
			it('should handle multiline comments in selectors', () => {
				const root = parse_selector(`div
/* comment
with
newlines */
> p`)
				const selector = root.first_child
				expect(selector?.children.length).toBe(3)
				const [div, combinator, p] = selector?.children || []
				expect(div?.type).toBe(TYPE_SELECTOR)
				expect(combinator?.type).toBe(COMBINATOR)
				expect(p?.type).toBe(TYPE_SELECTOR)
			})

			it('should handle multiline comments in nth-child', () => {
				const root = parse_selector(`:nth-child(2n
/* comment
with
newlines */
+ 1)`)
				const selector = root.first_child
				const nthChild = selector?.first_child
				expect(nthChild?.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(nthChild?.name).toBe('nth-child')
			})
		})
	})
})
