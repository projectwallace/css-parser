import { describe, test, expect } from 'vitest'
import { Parser } from './parse'
import { parse_selector } from './parse-selector'
import {
	NODE_DECLARATION,
	NODE_STYLE_RULE,
	NODE_AT_RULE,
	NODE_SELECTOR_NTH,
	NODE_SELECTOR_NTH_OF,
	NODE_SELECTOR_LIST,
	NODE_SELECTOR_PSEUDO_CLASS,
} from './arena'

describe('CSSNode', () => {
	describe('iteration', () => {
		test('should be iterable with for-of', () => {
			const source = 'body { color: red; margin: 0; padding: 10px; }'
			const parser = new Parser(source, { parse_selectors: false, parse_values: false })
			const root = parser.parse()

			const rule = root.first_child!
			const block = rule.block!
			const types: number[] = []

			for (const child of block) {
				types.push(child.type)
			}

			expect(types).toEqual([NODE_DECLARATION, NODE_DECLARATION, NODE_DECLARATION])
		})

		test('should work with spread operator', () => {
			const source = 'body { color: red; } div { margin: 0; }'
			const parser = new Parser(source, { parse_selectors: false, parse_values: false })
			const root = parser.parse()

			const rules = [...root]
			expect(rules).toHaveLength(2)
			expect(rules[0].type).toBe(NODE_STYLE_RULE)
			expect(rules[1].type).toBe(NODE_STYLE_RULE)
		})

		test('should work with Array.from', () => {
			const source = '@media print { body { color: black; } }'
			const parser = new Parser(source, { parse_selectors: false, parse_values: false, parse_atrule_preludes: false })
			const root = parser.parse()

			const media = root.first_child!
			const block = media.block!
			const children = Array.from(block)

			expect(children).toHaveLength(1)
			expect(children[0].type).toBe(NODE_STYLE_RULE)
		})

		test('should iterate over empty children', () => {
			const source = '@import url("style.css");'
			const parser = new Parser(source, {
				parse_selectors: false,
				parse_values: false,
				parse_atrule_preludes: false,
			})
			const root = parser.parse()

			const importRule = root.first_child!
			const children = [...importRule]

			expect(children).toHaveLength(0)
		})
	})

	describe('has_prelude', () => {
		test('should return true for @media with prelude', () => {
			const source = '@media (min-width: 768px) { body { color: red; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const media = root.first_child!

			expect(media.type).toBe(NODE_AT_RULE)
			expect(media.has_prelude).toBe(true)
			expect(media.prelude).toBe('(min-width: 768px)')
		})

		test('should return true for @supports with prelude', () => {
			const source = '@supports (display: grid) { .grid { display: grid; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const supports = root.first_child!

			expect(supports.type).toBe(NODE_AT_RULE)
			expect(supports.has_prelude).toBe(true)
			expect(supports.prelude).toBe('(display: grid)')
		})

		test('should return true for @layer with name', () => {
			const source = '@layer utilities { .btn { padding: 1rem; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const layer = root.first_child!

			expect(layer.type).toBe(NODE_AT_RULE)
			expect(layer.has_prelude).toBe(true)
			expect(layer.prelude).toBe('utilities')
		})

		test('should return false for @layer without name', () => {
			const source = '@layer { .btn { padding: 1rem; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const layer = root.first_child!

			expect(layer.type).toBe(NODE_AT_RULE)
			expect(layer.has_prelude).toBe(false)
			expect(layer.prelude).toBeNull()
		})

		test('should return true for @keyframes with name', () => {
			const source = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const keyframes = root.first_child!

			expect(keyframes.type).toBe(NODE_AT_RULE)
			expect(keyframes.has_prelude).toBe(true)
			expect(keyframes.prelude).toBe('fadeIn')
		})

		test('should return false for @font-face without prelude', () => {
			const source = '@font-face { font-family: "Custom"; src: url("font.woff2"); }'
			const parser = new Parser(source)
			const root = parser.parse()
			const fontFace = root.first_child!

			expect(fontFace.type).toBe(NODE_AT_RULE)
			expect(fontFace.has_prelude).toBe(false)
			expect(fontFace.prelude).toBeNull()
		})

		test('should return false for @page without prelude', () => {
			const source = '@page { margin: 1in; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const page = root.first_child!

			expect(page.type).toBe(NODE_AT_RULE)
			expect(page.has_prelude).toBe(false)
			expect(page.prelude).toBeNull()
		})

		test('should return true for @import with options', () => {
			const source = '@import url("styles.css") layer(base) supports(display: flex);'
			const parser = new Parser(source)
			const root = parser.parse()
			const importRule = root.first_child!

			expect(importRule.type).toBe(NODE_AT_RULE)
			expect(importRule.has_prelude).toBe(true)
			expect(importRule.prelude).not.toBeNull()
		})

		test('should work efficiently without creating strings', () => {
			const source = '@media (min-width: 768px) { body { color: red; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const media = root.first_child!

			// has_prelude should be faster than prelude !== null
			// because it doesn't allocate a string
			const hasPrelude = media.has_prelude
			expect(hasPrelude).toBe(true)
		})

		test('should work for other node types that use value field', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const selector = rule.first_child!
			const block = selector.next_sibling!
			const declaration = block.first_child!

			// Rules and selectors don't use value field
			expect(rule.has_prelude).toBe(false)
			expect(selector.has_prelude).toBe(false)

			// Declarations use value field for their value (same arena fields as prelude)
			// So has_prelude returns true for declarations with values
			expect(declaration.has_prelude).toBe(true)
			expect(declaration.value).toBe('red')
		})
	})

	describe('has_block', () => {
		test('should return true for style rules with blocks', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!

			expect(rule.type).toBe(NODE_STYLE_RULE)
			expect(rule.has_block).toBe(true)
		})

		test('should return true for empty style rule blocks', () => {
			const source = 'body { }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!

			expect(rule.type).toBe(NODE_STYLE_RULE)
			expect(rule.has_block).toBe(true)
		})

		test('should return true for @media with block', () => {
			const source = '@media (min-width: 768px) { body { color: red; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const media = root.first_child!

			expect(media.type).toBe(NODE_AT_RULE)
			expect(media.has_block).toBe(true)
		})

		test('should return true for @supports with block', () => {
			const source = '@supports (display: grid) { .grid { display: grid; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const supports = root.first_child!

			expect(supports.type).toBe(NODE_AT_RULE)
			expect(supports.has_block).toBe(true)
		})

		test('should return true for @layer with block', () => {
			const source = '@layer utilities { .btn { padding: 1rem; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const layer = root.first_child!

			expect(layer.type).toBe(NODE_AT_RULE)
			expect(layer.has_block).toBe(true)
		})

		test('should return true for anonymous @layer with block', () => {
			const source = '@layer { .btn { padding: 1rem; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const layer = root.first_child!

			expect(layer.type).toBe(NODE_AT_RULE)
			expect(layer.has_block).toBe(true)
		})

		test('should return true for @font-face with block', () => {
			const source = '@font-face { font-family: "Custom"; src: url("font.woff2"); }'
			const parser = new Parser(source)
			const root = parser.parse()
			const fontFace = root.first_child!

			expect(fontFace.type).toBe(NODE_AT_RULE)
			expect(fontFace.has_block).toBe(true)
		})

		test('should return true for @keyframes with block', () => {
			const source = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const keyframes = root.first_child!

			expect(keyframes.type).toBe(NODE_AT_RULE)
			expect(keyframes.has_block).toBe(true)
		})

		test('should return false for @import without block', () => {
			const source = '@import url("styles.css");'
			const parser = new Parser(source)
			const root = parser.parse()
			const importRule = root.first_child!

			expect(importRule.type).toBe(NODE_AT_RULE)
			expect(importRule.has_block).toBe(false)
		})

		test('should return false for @import with preludes but no block', () => {
			const source = '@import url("styles.css") layer(base) supports(display: flex);'
			const parser = new Parser(source)
			const root = parser.parse()
			const importRule = root.first_child!

			expect(importRule.type).toBe(NODE_AT_RULE)
			expect(importRule.has_block).toBe(false)
			expect(importRule.has_children).toBe(true) // Has prelude children
			expect(importRule.has_prelude).toBe(true)
		})

		test('should correctly distinguish @import with preludes from rules with blocks', () => {
			const source = `
				@import url("file.css") layer(base);
				@layer utilities { .btn { padding: 1rem; } }
			`
			const parser = new Parser(source)
			const root = parser.parse()
			const importRule = root.first_child!
			const layerRule = importRule.next_sibling!

			// @import has children (preludes) but no block
			expect(importRule.has_block).toBe(false)
			expect(importRule.has_children).toBe(true)

			// @layer has both children and a block
			expect(layerRule.has_block).toBe(true)
			expect(layerRule.has_children).toBe(true)
		})

		test('should return false for non-rule nodes', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const selector = rule.first_child!
			const declaration = selector.next_sibling!

			// Only rules have blocks
			expect(selector.has_block).toBe(false)
			expect(declaration.has_block).toBe(false)
		})

		test('should be accurate for all at-rule types', () => {
			const css = `
				@media screen { body { color: red; } }
				@import url("file.css");
				@supports (display: grid) { .grid { } }
				@layer { .btn { } }
				@font-face { font-family: "Custom"; }
				@keyframes fadeIn { from { opacity: 0; } }
			`
			const parser = new Parser(css)
			const root = parser.parse()

			const nodes = [...root]
			const [media, importRule, supports, layer, fontFace, keyframes] = nodes

			expect(media.has_block).toBe(true)
			expect(importRule.has_block).toBe(false) // NO block, only statement
			expect(supports.has_block).toBe(true)
			expect(layer.has_block).toBe(true)
			expect(fontFace.has_block).toBe(true)
			expect(keyframes.has_block).toBe(true)
		})
	})

	describe('has_declarations', () => {
		test('should return true for style rules with declarations', () => {
			const source = 'body { color: red; margin: 0; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!

			expect(rule.type).toBe(NODE_STYLE_RULE)
			expect(rule.has_declarations).toBe(true)
		})

		test('should return false for empty style rules', () => {
			const source = 'body { }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!

			expect(rule.type).toBe(NODE_STYLE_RULE)
			expect(rule.has_declarations).toBe(false)
		})

		test('should return false for style rules with only nested rules', () => {
			const source = 'body { .nested { color: red; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!

			expect(rule.type).toBe(NODE_STYLE_RULE)
			expect(rule.has_declarations).toBe(false)
		})

		test('should return true for style rules with both declarations and nested rules', () => {
			const source = 'body { color: blue; .nested { margin: 0; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!

			expect(rule.type).toBe(NODE_STYLE_RULE)
			expect(rule.has_declarations).toBe(true)
		})

		test('should return false for at-rules', () => {
			const source = '@media screen { body { color: red; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const media = root.first_child!

			expect(media.type).toBe(NODE_AT_RULE)
			expect(media.has_declarations).toBe(false)
		})
	})

	describe('type_name property', () => {
		test('should return stylesheet for root node', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()

			expect(root.type_name).toBe('stylesheet')
		})

		test('should return style_rule for style rules', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!

			expect(rule.type_name).toBe('rule')
		})

		test('should return declaration for declarations', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const block = rule.block!
			const decl = block.first_child!

			expect(decl.type_name).toBe('declaration')
		})

		test('should return at_rule for at-rules', () => {
			const source = '@media screen { body { color: red; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const media = root.first_child!

			expect(media.type_name).toBe('atrule')
		})

		test('should return selector_list for selector lists', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const selectorList = rule.first_child!

			expect(selectorList.type_name).toBe('selectorlist')
		})

		test('should return selector_type for type selectors', () => {
			const source = 'div { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const typeSelector = selector.first_child!

			expect(typeSelector.type_name).toBe('type-selector')
		})

		test('should return selector_class for class selectors', () => {
			const source = '.foo { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const classSelector = selector.first_child!

			expect(classSelector.type_name).toBe('class-selector')
		})

		test('should return selector_id for ID selectors', () => {
			const source = '#bar { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const idSelector = selector.first_child!

			expect(idSelector.type_name).toBe('id-selector')
		})

		test('should return selector_universal for universal selectors', () => {
			const source = '* { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const universalSelector = selector.first_child!

			expect(universalSelector.type_name).toBe('universal-selector')
		})

		test('should return selector_attribute for attribute selectors', () => {
			const source = '[href] { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const attrSelector = selector.first_child!

			expect(attrSelector.type_name).toBe('attribute-selector')
		})

		test('should return selector_pseudo_class for pseudo-class selectors', () => {
			const source = ':hover { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const pseudoClass = selector.first_child!

			expect(pseudoClass.type_name).toBe('pseudoclass-selector')
		})

		test('should return selector_pseudo_element for pseudo-element selectors', () => {
			const source = '::before { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const pseudoElement = selector.first_child!

			expect(pseudoElement.type_name).toBe('pseudoelement-selector')
		})

		test('should return selector_combinator for combinators', () => {
			const source = 'div > span { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const combinator = selector.first_child!.next_sibling!

			expect(combinator.type_name).toBe('selector-combinator')
		})

		test('should return value_keyword for keyword values', () => {
			const source = 'body { color: red; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const block = rule.block!
			const decl = block.first_child!
			const value = decl.first_child!

			expect(value.type_name).toBe('keyword')
		})

		test('should return value_number for numeric values', () => {
			const source = 'body { opacity: 0.5; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const block = rule.block!
			const decl = block.first_child!
			const value = decl.first_child!

			expect(value.type_name).toBe('number')
		})

		test('should return value_dimension for dimension values', () => {
			const source = 'body { width: 100px; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const block = rule.block!
			const decl = block.first_child!
			const value = decl.first_child!

			expect(value.type_name).toBe('dimension')
		})

		test('should return value_string for string values', () => {
			const source = 'body { content: "hello"; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const block = rule.block!
			const decl = block.first_child!
			const value = decl.first_child!

			expect(value.type_name).toBe('string')
		})

		test('should return value_color for color values', () => {
			const source = 'body { color: #ff0000; }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const block = rule.block!
			const decl = block.first_child!
			const value = decl.first_child!

			expect(value.type_name).toBe('color')
		})

		test('should return value_function for function values', () => {
			const source = 'body { width: calc(100% - 20px); }'
			const parser = new Parser(source)
			const root = parser.parse()
			const rule = root.first_child!
			const block = rule.block!
			const decl = block.first_child!
			const value = decl.first_child!

			expect(value.type_name).toBe('function')
		})

		test('should return prelude_media_query for media query preludes', () => {
			const source = '@media screen and (min-width: 768px) { body { color: red; } }'
			const parser = new Parser(source)
			const root = parser.parse()
			const media = root.first_child!
			const prelude = media.first_child!

			expect(prelude.type_name).toBe('media-query')
		})
	})

	describe('Pseudo-class convenience properties', () => {
		describe('nth_of helpers (NODE_SELECTOR_NTH_OF)', () => {
			test('nth property returns An+B formula node', () => {
				const result = parse_selector(':nth-child(2n+1 of .foo)')
				const selector = result.first_child
				const pseudo = selector?.first_child // Get pseudo-class
				const nthOf = pseudo?.first_child // NODE_SELECTOR_NTH_OF

				expect(nthOf?.nth).not.toBeNull()
				expect(nthOf?.nth?.type).toBe(NODE_SELECTOR_NTH)
				expect(nthOf?.nth?.nth_a).toBe('2n')
				expect(nthOf?.nth?.nth_b).toBe('+1')
			})

			test('selector property returns selector list', () => {
				const result = parse_selector(':nth-child(2n of .foo, #bar)')
				const selector = result.first_child
				const pseudo = selector?.first_child
				const nthOf = pseudo?.first_child

				expect(nthOf?.selector).not.toBeNull()
				expect(nthOf?.selector?.type).toBe(NODE_SELECTOR_LIST)
				expect(nthOf?.selector?.text).toBe('.foo, #bar')
			})

			test('returns null for wrong node types', () => {
				const result = parse_selector('.foo')
				const selector = result.first_child
				const classNode = selector?.first_child

				expect(classNode?.nth).toBeNull()
				expect(classNode?.selector).toBeNull()
			})

			test('works with :nth-last-child', () => {
				const result = parse_selector(':nth-last-child(odd of .item)')
				const selector = result.first_child
				const pseudo = selector?.first_child
				const nthOf = pseudo?.first_child

				expect(nthOf?.nth).not.toBeNull()
				expect(nthOf?.nth?.nth_a).toBe('odd')
				expect(nthOf?.selector).not.toBeNull()
				expect(nthOf?.selector?.text).toBe('.item')
			})

			test('works with :nth-of-type', () => {
				const result = parse_selector(':nth-of-type(3n of .special)')
				const selector = result.first_child
				const pseudo = selector?.first_child
				const nthOf = pseudo?.first_child

				expect(nthOf?.nth).not.toBeNull()
				expect(nthOf?.nth?.nth_a).toBe('3n')
				expect(nthOf?.selector?.text).toBe('.special')
			})

			test('works with :nth-last-of-type', () => {
				const result = parse_selector(':nth-last-of-type(even of div)')
				const selector = result.first_child
				const pseudo = selector?.first_child
				const nthOf = pseudo?.first_child

				expect(nthOf?.nth?.nth_a).toBe('even')
				expect(nthOf?.selector?.text).toBe('div')
			})
		})

		describe('selector_list helper (NODE_SELECTOR_PSEUDO_CLASS)', () => {
			test('returns selector list for :is()', () => {
				const result = parse_selector(':is(.foo, #bar)')
				const selector = result.first_child
				const pseudo = selector?.first_child

				expect(pseudo?.type).toBe(NODE_SELECTOR_PSEUDO_CLASS)
				expect(pseudo?.selector_list).not.toBeNull()
				expect(pseudo?.selector_list?.type).toBe(NODE_SELECTOR_LIST)
				expect(pseudo?.selector_list?.text).toBe('.foo, #bar')
			})

			test('returns selector list for :nth-child(of)', () => {
				const result = parse_selector(':nth-child(2n of .foo)')
				const selector = result.first_child
				const pseudo = selector?.first_child

				expect(pseudo?.selector_list).not.toBeNull()
				expect(pseudo?.selector_list?.text).toBe('.foo')
			})

			test('returns null for pseudo-classes without selectors', () => {
				const result = parse_selector(':hover')
				const selector = result.first_child
				const pseudo = selector?.first_child

				expect(pseudo?.selector_list).toBeNull()
			})

			test('returns null for :nth-child without "of"', () => {
				const result = parse_selector(':nth-child(2n)')
				const selector = result.first_child
				const pseudo = selector?.first_child

				expect(pseudo?.selector_list).toBeNull()
			})

			test('works with :not()', () => {
				const result = parse_selector(':not(.excluded)')
				const selector = result.first_child
				const pseudo = selector?.first_child

				expect(pseudo?.selector_list).not.toBeNull()
				expect(pseudo?.selector_list?.text).toBe('.excluded')
			})

			test('works with :has()', () => {
				const result = parse_selector(':has(> .child)')
				const selector = result.first_child
				const pseudo = selector?.first_child

				expect(pseudo?.selector_list).not.toBeNull()
				expect(pseudo?.selector_list?.text).toBe('> .child')
			})

			test('works with :where()', () => {
				const result = parse_selector(':where(article, section)')
				const selector = result.first_child
				const pseudo = selector?.first_child

				expect(pseudo?.selector_list).not.toBeNull()
				expect(pseudo?.selector_list?.text).toBe('article, section')
			})

			test('complex :nth-child with multiple selectors', () => {
				const result = parse_selector(':nth-child(3n+2 of .item, .element, #special)')
				const selector = result.first_child
				const pseudo = selector?.first_child

				expect(pseudo?.selector_list).not.toBeNull()
				expect(pseudo?.selector_list?.text).toBe('.item, .element, #special')
			})
		})
	})
})
