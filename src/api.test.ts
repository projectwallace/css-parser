import { describe, test, expect } from 'vitest'
import { parse } from './parse'
import { parse_selector } from './parse-selector'
import {
	DECLARATION,
	STYLE_RULE,
	AT_RULE,
	NTH_SELECTOR,
	SELECTOR_LIST,
	PSEUDO_CLASS_SELECTOR,
	DIMENSION,
	NUMBER,
	FUNCTION,
	ATTRIBUTE_SELECTOR,
} from './arena'

describe('CSSNode', () => {
	describe('iteration', () => {
		test('should be iterable with for-of', () => {
			const source = 'body { color: red; margin: 0; padding: 10px; }'
			const root = parse(source, { parse_selectors: false, parse_values: false })

			const rule = root.first_child!
			const block = rule.block!
			const types: number[] = []

			for (const child of block) {
				types.push(child.type)
			}

			expect(types).toEqual([DECLARATION, DECLARATION, DECLARATION])
		})

		test('should work with spread operator', () => {
			const source = 'body { color: red; } div { margin: 0; }'
			const root = parse(source, { parse_selectors: false, parse_values: false })

			const rules = [...root]
			expect(rules).toHaveLength(2)
			expect(rules[0].type).toBe(STYLE_RULE)
			expect(rules[1].type).toBe(STYLE_RULE)
		})

		test('should work with Array.from', () => {
			const source = '@media print { body { color: black; } }'
			const root = parse(source, { parse_selectors: false, parse_values: false, parse_atrule_preludes: false })

			const media = root.first_child!
			const block = media.block!
			const children = Array.from(block)

			expect(children).toHaveLength(1)
			expect(children[0].type).toBe(STYLE_RULE)
		})

		test('should iterate over empty children', () => {
			const source = '@import url("style.css");'
			const root = parse(source, {
				parse_selectors: false,
				parse_values: false,
				parse_atrule_preludes: false,
			})

			const importRule = root.first_child!
			const children = [...importRule]

			expect(children).toHaveLength(0)
		})
	})

	describe('has_prelude', () => {
		test('should return true for @media with prelude', () => {
			const source = '@media (min-width: 768px) { body { color: red; } }'
			const root = parse(source)
			const media = root.first_child!

			expect(media.type).toBe(AT_RULE)
			expect(media.has_prelude).toBe(true)
			expect(media.prelude).toBe('(min-width: 768px)')
		})

		test('should return true for @supports with prelude', () => {
			const source = '@supports (display: grid) { .grid { display: grid; } }'
			const root = parse(source)
			const supports = root.first_child!

			expect(supports.type).toBe(AT_RULE)
			expect(supports.has_prelude).toBe(true)
			expect(supports.prelude).toBe('(display: grid)')
		})

		test('should return true for @layer with name', () => {
			const source = '@layer utilities { .btn { padding: 1rem; } }'
			const root = parse(source)
			const layer = root.first_child!

			expect(layer.type).toBe(AT_RULE)
			expect(layer.has_prelude).toBe(true)
			expect(layer.prelude).toBe('utilities')
		})

		test('should return false for @layer without name', () => {
			const source = '@layer { .btn { padding: 1rem; } }'
			const root = parse(source)
			const layer = root.first_child!

			expect(layer.type).toBe(AT_RULE)
			expect(layer.has_prelude).toBe(false)
			expect(layer.prelude).toBeNull()
		})

		test('should return true for @keyframes with name', () => {
			const source = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }'
			const root = parse(source)
			const keyframes = root.first_child!

			expect(keyframes.type).toBe(AT_RULE)
			expect(keyframes.has_prelude).toBe(true)
			expect(keyframes.prelude).toBe('fadeIn')
		})

		test('should return false for @font-face without prelude', () => {
			const source = '@font-face { font-family: "Custom"; src: url("font.woff2"); }'
			const root = parse(source)
			const fontFace = root.first_child!

			expect(fontFace.type).toBe(AT_RULE)
			expect(fontFace.has_prelude).toBe(false)
			expect(fontFace.prelude).toBeNull()
		})

		test('should return false for @page without prelude', () => {
			const source = '@page { margin: 1in; }'
			const root = parse(source)
			const page = root.first_child!

			expect(page.type).toBe(AT_RULE)
			expect(page.has_prelude).toBe(false)
			expect(page.prelude).toBeNull()
		})

		test('should return true for @import with options', () => {
			const source = '@import url("styles.css") layer(base) supports(display: flex);'
			const root = parse(source)
			const importRule = root.first_child!

			expect(importRule.type).toBe(AT_RULE)
			expect(importRule.has_prelude).toBe(true)
			expect(importRule.prelude).not.toBeNull()
		})

		test('should work efficiently without creating strings', () => {
			const source = '@media (min-width: 768px) { body { color: red; } }'
			const root = parse(source)
			const media = root.first_child!

			// has_prelude should be faster than prelude !== null
			// because it doesn't allocate a string
			const hasPrelude = media.has_prelude
			expect(hasPrelude).toBe(true)
		})

		test('should work for other node types that use value field', () => {
			const source = 'body { color: red; }'
			const root = parse(source)
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
			const root = parse(source)
			const rule = root.first_child!

			expect(rule.type).toBe(STYLE_RULE)
			expect(rule.has_block).toBe(true)
		})

		test('should return true for empty style rule blocks', () => {
			const source = 'body { }'
			const root = parse(source)
			const rule = root.first_child!

			expect(rule.type).toBe(STYLE_RULE)
			expect(rule.has_block).toBe(true)
		})

		test('should return true for @media with block', () => {
			const source = '@media (min-width: 768px) { body { color: red; } }'
			const root = parse(source)
			const media = root.first_child!

			expect(media.type).toBe(AT_RULE)
			expect(media.has_block).toBe(true)
		})

		test('should return true for @supports with block', () => {
			const source = '@supports (display: grid) { .grid { display: grid; } }'
			const root = parse(source)
			const supports = root.first_child!

			expect(supports.type).toBe(AT_RULE)
			expect(supports.has_block).toBe(true)
		})

		test('should return true for @layer with block', () => {
			const source = '@layer utilities { .btn { padding: 1rem; } }'
			const root = parse(source)
			const layer = root.first_child!

			expect(layer.type).toBe(AT_RULE)
			expect(layer.has_block).toBe(true)
		})

		test('should return true for anonymous @layer with block', () => {
			const source = '@layer { .btn { padding: 1rem; } }'
			const root = parse(source)
			const layer = root.first_child!

			expect(layer.type).toBe(AT_RULE)
			expect(layer.has_block).toBe(true)
		})

		test('should return true for @font-face with block', () => {
			const source = '@font-face { font-family: "Custom"; src: url("font.woff2"); }'
			const root = parse(source)
			const fontFace = root.first_child!

			expect(fontFace.type).toBe(AT_RULE)
			expect(fontFace.has_block).toBe(true)
		})

		test('should return true for @keyframes with block', () => {
			const source = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }'
			const root = parse(source)
			const keyframes = root.first_child!

			expect(keyframes.type).toBe(AT_RULE)
			expect(keyframes.has_block).toBe(true)
		})

		test('should return false for @import without block', () => {
			const source = '@import url("styles.css");'
			const root = parse(source)
			const importRule = root.first_child!

			expect(importRule.type).toBe(AT_RULE)
			expect(importRule.has_block).toBe(false)
		})

		test('should return false for @import with preludes but no block', () => {
			const source = '@import url("styles.css") layer(base) supports(display: flex);'
			const root = parse(source)
			const importRule = root.first_child!

			expect(importRule.type).toBe(AT_RULE)
			expect(importRule.has_block).toBe(false)
			expect(importRule.has_children).toBe(true) // Has prelude children
			expect(importRule.has_prelude).toBe(true)
		})

		test('should correctly distinguish @import with preludes from rules with blocks', () => {
			const source = `
				@import url("file.css") layer(base);
				@layer utilities { .btn { padding: 1rem; } }
			`
			const root = parse(source)
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
			const root = parse(source)
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
			const root = parse(css)

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
			const root = parse(source)
			const rule = root.first_child!

			expect(rule.type).toBe(STYLE_RULE)
			expect(rule.has_declarations).toBe(true)
		})

		test('should return false for empty style rules', () => {
			const source = 'body { }'
			const root = parse(source)
			const rule = root.first_child!

			expect(rule.type).toBe(STYLE_RULE)
			expect(rule.has_declarations).toBe(false)
		})

		test('should return false for style rules with only nested rules', () => {
			const source = 'body { .nested { color: red; } }'
			const root = parse(source)
			const rule = root.first_child!

			expect(rule.type).toBe(STYLE_RULE)
			expect(rule.has_declarations).toBe(false)
		})

		test('should return true for style rules with both declarations and nested rules', () => {
			const source = 'body { color: blue; .nested { margin: 0; } }'
			const root = parse(source)
			const rule = root.first_child!

			expect(rule.type).toBe(STYLE_RULE)
			expect(rule.has_declarations).toBe(true)
		})

		test('should return false for at-rules', () => {
			const source = '@media screen { body { color: red; } }'
			const root = parse(source)
			const media = root.first_child!

			expect(media.type).toBe(AT_RULE)
			expect(media.has_declarations).toBe(false)
		})
	})

	describe('type_name property', () => {
		test('should return stylesheet for root node', () => {
			const source = 'body { color: red; }'
			const root = parse(source)

			expect(root.type_name).toBe('StyleSheet')
		})

		test('should return style_rule for style rules', () => {
			const source = 'body { color: red; }'
			const root = parse(source)
			const rule = root.first_child!

			expect(rule.type_name).toBe('Rule')
		})

		test('should return declaration for declarations', () => {
			const source = 'body { color: red; }'
			const root = parse(source)
			const rule = root.first_child!
			const block = rule.block!
			const decl = block.first_child!

			expect(decl.type_name).toBe('Declaration')
		})

		test('should return at_rule for at-rules', () => {
			const source = '@media screen { body { color: red; } }'
			const root = parse(source)
			const media = root.first_child!

			expect(media.type_name).toBe('Atrule')
		})

		test('should return selector_list for selector lists', () => {
			const source = 'body { color: red; }'
			const root = parse(source)
			const rule = root.first_child!
			const selectorList = rule.first_child!

			expect(selectorList.type_name).toBe('SelectorList')
		})

		test('should return selector_type for type selectors', () => {
			const source = 'div { color: red; }'
			const root = parse(source)
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const typeSelector = selector.first_child!

			expect(typeSelector.type_name).toBe('TypeSelector')
		})

		test('should return selector_class for class selectors', () => {
			const source = '.foo { color: red; }'
			const root = parse(source)
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const classSelector = selector.first_child!

			expect(classSelector.type_name).toBe('ClassSelector')
		})

		test('should return selector_id for ID selectors', () => {
			const source = '#bar { color: red; }'
			const root = parse(source)
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const idSelector = selector.first_child!

			expect(idSelector.type_name).toBe('IdSelector')
		})

		test('should return selector_universal for universal selectors', () => {
			const source = '* { color: red; }'
			const root = parse(source)
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const universalSelector = selector.first_child!

			expect(universalSelector.type_name).toBe('UniversalSelector')
		})

		test('should return selector_attribute for attribute selectors', () => {
			const source = '[href] { color: red; }'
			const root = parse(source)
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const attrSelector = selector.first_child!

			expect(attrSelector.type_name).toBe('AttributeSelector')
		})

		test('should return selector_pseudo_class for pseudo-class selectors', () => {
			const source = ':hover { color: red; }'
			const root = parse(source)
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const pseudoClass = selector.first_child!

			expect(pseudoClass.type_name).toBe('PseudoClassSelector')
		})

		test('should return selector_pseudo_element for pseudo-element selectors', () => {
			const source = '::before { color: red; }'
			const root = parse(source)
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const pseudoElement = selector.first_child!

			expect(pseudoElement.type_name).toBe('PseudoElementSelector')
		})

		test('should return selector_combinator for combinators', () => {
			const source = 'div > span { color: red; }'
			const root = parse(source)
			const rule = root.first_child!
			const selectorList = rule.first_child!
			const selector = selectorList.first_child!
			const combinator = selector.first_child!.next_sibling!

			expect(combinator.type_name).toBe('Combinator')
		})

		test('should return value_keyword for keyword values', () => {
			const source = 'body { color: red; }'
			const root = parse(source)
			const rule = root.first_child!
			const block = rule.block!
			const decl = block.first_child!
			const value = decl.first_child!

			expect(value.type_name).toBe('Identifier')
		})

		test('should return value_number for numeric values', () => {
			const source = 'body { opacity: 0.5; }'
			const root = parse(source)
			const rule = root.first_child!
			const block = rule.block!
			const decl = block.first_child!
			const value = decl.first_child!

			expect(value.type_name).toBe('Number')
		})

		test('should return value_dimension for dimension values', () => {
			const source = 'body { width: 100px; }'
			const root = parse(source)
			const rule = root.first_child!
			const block = rule.block!
			const decl = block.first_child!
			const value = decl.first_child!

			expect(value.type_name).toBe('Dimension')
		})

		test('should return value_string for string values', () => {
			const source = 'body { content: "hello"; }'
			const root = parse(source)
			const rule = root.first_child!
			const block = rule.block!
			const decl = block.first_child!
			const value = decl.first_child!

			expect(value.type_name).toBe('String')
		})

		test('should return value_color for color values', () => {
			const source = 'body { color: #ff0000; }'
			const root = parse(source)
			const rule = root.first_child!
			const block = rule.block!
			const decl = block.first_child!
			const value = decl.first_child!

			expect(value.type_name).toBe('Hash')
		})

		test('should return value_function for function values', () => {
			const source = 'body { width: calc(100% - 20px); }'
			const root = parse(source)
			const rule = root.first_child!
			const block = rule.block!
			const decl = block.first_child!
			const value = decl.first_child!

			expect(value.type_name).toBe('Function')
		})

		test('should return prelude_media_query for media query preludes', () => {
			const source = '@media screen and (min-width: 768px) { body { color: red; } }'
			const root = parse(source)
			const media = root.first_child!
			const prelude = media.first_child!

			expect(prelude.type_name).toBe('MediaQuery')
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
				expect(nthOf?.nth?.type).toBe(NTH_SELECTOR)
				expect(nthOf?.nth?.nth_a).toBe('2n')
				expect(nthOf?.nth?.nth_b).toBe('+1')
			})

			test('selector property returns selector list', () => {
				const result = parse_selector(':nth-child(2n of .foo, #bar)')
				const selector = result.first_child
				const pseudo = selector?.first_child
				const nthOf = pseudo?.first_child

				expect(nthOf?.selector).not.toBeNull()
				expect(nthOf?.selector?.type).toBe(SELECTOR_LIST)
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

				expect(pseudo?.type).toBe(PSEUDO_CLASS_SELECTOR)
				expect(pseudo?.selector_list).not.toBeNull()
				expect(pseudo?.selector_list?.type).toBe(SELECTOR_LIST)
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

	describe('Compound selector helpers', () => {
		describe('compound_parts() iterator', () => {
			test('yields parts before first combinator', () => {
				const result = parse_selector('div.foo#bar > p')
				const selector = result.first_child!

				const parts = Array.from(selector.compound_parts())
				expect(parts.length).toBe(3)
				expect(parts[0].text).toBe('div')
				expect(parts[1].text).toBe('.foo')
				expect(parts[2].text).toBe('#bar')
			})

			test('zero allocations for iteration', () => {
				const result = parse_selector('div.foo > p')
				const selector = result.first_child!

				let count = 0
				for (const _part of selector.compound_parts()) {
					count++
				}
				expect(count).toBe(2)
			})

			test('returns empty for wrong type', () => {
				const result = parse_selector('div')
				const list = result // NODE_SELECTOR_LIST

				const parts = Array.from(list.compound_parts())
				expect(parts.length).toBe(0)
			})

			test('works with all parts when no combinator', () => {
				const result = parse_selector('div.foo#bar')
				const selector = result.first_child!

				const parts = Array.from(selector.compound_parts())
				expect(parts.length).toBe(3)
			})

			test('handles leading combinator (CSS Nesting)', () => {
				const result = parse_selector('> p')
				const selector = result.first_child!

				const parts = Array.from(selector.compound_parts())
				expect(parts.length).toBe(0) // No parts before combinator
			})

			test('works with pseudo-classes', () => {
				const result = parse_selector('a.link:hover > p')
				const selector = result.first_child!

				const parts = Array.from(selector.compound_parts())
				expect(parts.length).toBe(3)
				expect(parts[0].text).toBe('a')
				expect(parts[1].text).toBe('.link')
				expect(parts[2].text).toBe(':hover')
			})
		})

		describe('first_compound property', () => {
			test('returns array of parts before combinator', () => {
				const result = parse_selector('div.foo#bar > p')
				const selector = result.first_child!

				const compound = selector.first_compound
				expect(compound.length).toBe(3)
				expect(compound[0].text).toBe('div')
				expect(compound[1].text).toBe('.foo')
				expect(compound[2].text).toBe('#bar')
			})

			test('returns all parts when no combinators', () => {
				const result = parse_selector('div.foo#bar')
				const selector = result.first_child!

				const compound = selector.first_compound
				expect(compound.length).toBe(3)
			})

			test('returns empty array for wrong type', () => {
				const result = parse_selector('div')
				expect(result.first_compound).toEqual([])
			})

			test('handles attribute selectors', () => {
				const result = parse_selector('input[type="text"]:focus + label')
				const selector = result.first_child!

				const compound = selector.first_compound
				expect(compound.length).toBe(3)
				expect(compound[0].text).toBe('input')
				expect(compound[1].text).toBe('[type="text"]')
				expect(compound[2].text).toBe(':focus')
			})

			test('handles leading combinator', () => {
				const result = parse_selector('> div')
				const selector = result.first_child!

				const compound = selector.first_compound
				expect(compound.length).toBe(0)
			})
		})

		describe('all_compounds property', () => {
			test('splits by combinators', () => {
				const result = parse_selector('div.foo > p.bar + span')
				const selector = result.first_child!

				const compounds = selector.all_compounds
				expect(compounds.length).toBe(3)
				expect(compounds[0].length).toBe(2) // div, .foo
				expect(compounds[1].length).toBe(2) // p, .bar
				expect(compounds[2].length).toBe(1) // span
			})

			test('handles single compound (no combinators)', () => {
				const result = parse_selector('div.foo#bar')
				const selector = result.first_child!

				const compounds = selector.all_compounds
				expect(compounds.length).toBe(1)
				expect(compounds[0].length).toBe(3)
			})

			test('handles leading combinator', () => {
				const result = parse_selector('> p')
				const selector = result.first_child!

				const compounds = selector.all_compounds
				expect(compounds.length).toBe(1)
				expect(compounds[0].length).toBe(1)
				expect(compounds[0][0].text).toBe('p')
			})

			test('handles multiple combinators', () => {
				const result = parse_selector('a > b + c ~ d')
				const selector = result.first_child!

				const compounds = selector.all_compounds
				expect(compounds.length).toBe(4)
				expect(compounds[0][0].text).toBe('a')
				expect(compounds[1][0].text).toBe('b')
				expect(compounds[2][0].text).toBe('c')
				expect(compounds[3][0].text).toBe('d')
			})

			test('handles descendant combinator (space)', () => {
				const result = parse_selector('div p span')
				const selector = result.first_child!

				const compounds = selector.all_compounds
				expect(compounds.length).toBe(3)
			})

			test('returns empty array for wrong type', () => {
				const result = parse_selector('div')
				expect(result.all_compounds).toEqual([])
			})
		})

		describe('is_compound property', () => {
			test('true when no combinators', () => {
				const result = parse_selector('div.foo#bar')
				const selector = result.first_child!
				expect(selector.is_compound).toBe(true)
			})

			test('false when has combinators', () => {
				const result = parse_selector('div > p')
				const selector = result.first_child!
				expect(selector.is_compound).toBe(false)
			})

			test('false when has leading combinator', () => {
				const result = parse_selector('> div')
				const selector = result.first_child!
				expect(selector.is_compound).toBe(false)
			})

			test('false for wrong type', () => {
				const result = parse_selector('div')
				expect(result.is_compound).toBe(false) // NODE_SELECTOR_LIST
			})

			test('true for single type selector', () => {
				const result = parse_selector('div')
				const selector = result.first_child!
				expect(selector.is_compound).toBe(true)
			})
		})

		describe('first_compound_text property', () => {
			test('returns text before combinator', () => {
				const result = parse_selector('div.foo#bar > p')
				const selector = result.first_child!
				expect(selector.first_compound_text).toBe('div.foo#bar')
			})

			test('returns full text when no combinators', () => {
				const result = parse_selector('div.foo#bar')
				const selector = result.first_child!
				expect(selector.first_compound_text).toBe('div.foo#bar')
			})

			test('returns empty string for wrong type', () => {
				const result = parse_selector('div')
				expect(result.first_compound_text).toBe('')
			})

			test('returns empty string for leading combinator', () => {
				const result = parse_selector('> div')
				const selector = result.first_child!
				expect(selector.first_compound_text).toBe('')
			})

			test('handles complex selectors', () => {
				const result = parse_selector('input[type="text"]:focus::placeholder + label')
				const selector = result.first_child!
				expect(selector.first_compound_text).toBe('input[type="text"]:focus::placeholder')
			})
		})

		describe('edge cases', () => {
			test('handles :host(#foo.bar baz) nested selector', () => {
				const result = parse_selector(':host(#foo.bar baz)')
				const selector = result.first_child
				expect(selector).not.toBeNull()
				const pseudo = selector!.first_child
				const innerList = pseudo?.selector_list
				const innerSel = innerList?.first_child

				const compound = innerSel?.first_compound
				expect(compound?.length).toBe(2)
				expect(compound?.[0]?.text).toBe('#foo')
				expect(compound?.[1]?.text).toBe('.bar')
			})

			test('handles empty selector', () => {
				const result = parse_selector('')
				const selector = result.first_child
				if (selector) {
					expect(selector.first_compound).toEqual([])
					expect(selector.all_compounds).toEqual([])
				}
			})

			test('handles universal selector with combinator', () => {
				const result = parse_selector('* > div')
				const selector = result.first_child
				expect(selector).not.toBeNull()

				const compounds = selector!.all_compounds
				expect(compounds.length).toBe(2)
				expect(compounds[0][0].text).toBe('*')
				expect(compounds[1][0].text).toBe('div')
			})

			test('handles nesting selector with combinator', () => {
				const result = parse_selector('& > div')
				const selector = result.first_child!

				const compounds = selector.all_compounds
				expect(compounds.length).toBe(2)
				expect(compounds[0][0].text).toBe('&')
				expect(compounds[1][0].text).toBe('div')
			})
		})
	})

	describe('Node cloning', () => {
		describe('clone() method', () => {
			test('creates plain object with core properties', () => {
				const ast = parse('div { color: red; }', { parse_values: false, parse_selectors: false })
				const rule = ast.first_child!
				const block = rule.block!
				const decl = block.first_child!

				const clone = decl.clone({ deep: false })

				expect(clone.type).toBe(DECLARATION)
				expect(clone.type_name).toBe('Declaration')
				expect(clone.text).toBe('color: red;')
				expect(clone.name).toBe('color')
				expect(clone.property).toBe('color')
				expect(clone.value).toBe('red')
				expect(clone.children).toEqual([])
			})

			test('shallow clone has empty children array', () => {
				const ast = parse('div { margin: 10px 20px; }')
				const decl = ast.first_child!.block!.first_child!

				const shallow = decl.clone({ deep: false })

				expect(shallow.children).toEqual([])
				expect(shallow.type).toBe(DECLARATION)
			})

			test('deep clone includes children as array', () => {
				const ast = parse('div { margin: 10px 20px; }')
				const decl = ast.first_child!.block!.first_child!

				const deep = decl.clone()

				expect(deep.children.length).toBe(2)
				expect(deep.children[0].type).toBe(DIMENSION)
				expect(deep.children[0].value).toBe(10)
				expect(deep.children[0].unit).toBe('px')
				expect(deep.children[1].value).toBe(20)
				expect(deep.children[1].unit).toBe('px')
			})

			test('collects multiple children correctly', () => {
				const ast = parse('div { margin: 10px 20px 30px 40px; }')
				const decl = ast.first_child!.block!.first_child!

				const clone = decl.clone()

				expect(clone.children.length).toBe(4)
				expect(clone.children[0].value).toBe(10)
				expect(clone.children[1].value).toBe(20)
				expect(clone.children[2].value).toBe(30)
				expect(clone.children[3].value).toBe(40)
			})

			test('handles nested children', () => {
				const ast = parse('div { margin: calc(10px + 20px); }')
				const decl = ast.first_child!.block!.first_child!

				const clone = decl.clone()

				expect(clone.children.length).toBe(1)
				expect(clone.children[0].type).toBe(FUNCTION)
				expect(clone.children[0].name).toBe('calc')
				// Function should have nested children
				expect(clone.children[0].children.length).toBeGreaterThan(0)
			})
		})

		describe('Type-specific properties', () => {
			test('extracts declaration properties', () => {
				const ast = parse('div { color: red !important; }', { parse_values: false })
				const decl = ast.first_child!.block!.first_child!

				const clone = decl.clone({ deep: false })

				expect(clone.type).toBe(DECLARATION)
				expect(clone.type_name).toBe('Declaration')
				expect(clone.property).toBe('color')
				expect(clone.name).toBe('color')
				expect(clone.value).toBe('red')
				expect(clone.is_important).toBe(true)
			})

			test('extracts at-rule properties', () => {
				const ast = parse('@media screen { }', { parse_atrule_preludes: false })
				const atrule = ast.first_child!

				const clone = atrule.clone({ deep: false })

				expect(clone.type).toBe(AT_RULE)
				expect(clone.type_name).toBe('Atrule')
				expect(clone.name).toBe('media')
				expect(clone.prelude).toBe('screen')
			})

			test('extracts dimension value with unit', () => {
				const ast = parse('div { width: 100px; }')
				const decl = ast.first_child!.block!.first_child!
				const dimension = decl.first_child!

				const clone = dimension.clone({ deep: false })

				expect(clone.type).toBe(DIMENSION)
				expect(clone.type_name).toBe('Dimension')
				expect(clone.value).toBe(100)
				expect(clone.unit).toBe('px')
			})

			test('extracts number value', () => {
				const ast = parse('div { opacity: 0.5; }')
				const decl = ast.first_child!.block!.first_child!
				const number = decl.first_child!

				const clone = number.clone({ deep: false })

				expect(clone.type).toBe(NUMBER)
				expect(clone.value).toBe(0.5)
				expect(clone.unit).toBeUndefined()
			})

			test('extracts selector attribute properties', () => {
				const ast = parse_selector('[data-foo="bar"]')
				const selector = ast.first_child!
				const attribute = selector.first_child!

				const clone = attribute.clone({ deep: false })

				expect(clone.type).toBe(ATTRIBUTE_SELECTOR)
				expect(clone.type_name).toBe('AttributeSelector')
				expect(clone.attr_operator).toBeDefined()
				expect(clone.attr_flags).toBeDefined()
			})

			test('extracts nth selector properties', () => {
				const ast = parse_selector(':nth-child(2n+1)')
				const selector = ast.first_child!
				const pseudo = selector.first_child!
				const nth = pseudo.first_child!

				const clone = nth.clone({ deep: false })

				expect(clone.type).toBe(NTH_SELECTOR)
				expect(clone.nth_a).toBe('2n')
				expect(clone.nth_b).toBe('+1')
			})
		})

		describe('Flags', () => {
			test('includes is_important flag when true', () => {
				const ast = parse('div { color: red !important; }', { parse_values: false })
				const decl = ast.first_child!.block!.first_child!

				const clone = decl.clone()

				expect(clone.is_important).toBe(true)
			})

			test('is_important is false', () => {
				const ast = parse('div { color: red; }')
				const decl = ast.first_child!.block!.first_child!

				const clone = decl.clone()

				expect(clone.is_important).toBe(false)
			})

			test('omits is_important when not a declaration', () => {
				const ast = parse('div { color: red; }')
				const rule = ast.first_child!

				const clone = rule.clone()

				expect(clone.is_important).toBeUndefined()
			})

			test('includes is_vendor_prefixed flag', () => {
				const ast = parse('div { -webkit-transform: rotate(45deg); }', { parse_values: false })
				const decl = ast.first_child!.block!.first_child!

				const clone = decl.clone()

				expect(clone.is_vendor_prefixed).toBe(true)
			})
		})

		describe('Location information', () => {
			test('omits location by default', () => {
				const ast = parse('div { color: red; }', { parse_values: false })
				const decl = ast.first_child!.block!.first_child!

				const clone = decl.clone()

				expect(clone.line).toBeUndefined()
				expect(clone.column).toBeUndefined()
				expect(clone.offset).toBeUndefined()
				expect(clone.length).toBeUndefined()
			})

			test('includes location when requested', () => {
				const ast = parse('div { color: red; }', { parse_values: false })
				const decl = ast.first_child!.block!.first_child!

				const clone = decl.clone({ locations: true })

				expect(clone.line).toBeDefined()
				expect(clone.column).toBeDefined()
				expect(clone.offset).toBeDefined()
				expect(clone.length).toBeDefined()
			})

			test('includes location in deep cloned children', () => {
				const ast = parse('div { margin: 10px 20px; }')
				const decl = ast.first_child!.block!.first_child!

				const clone = decl.clone({ locations: true })

				expect(clone.children[0].line).toBeDefined()
				expect(clone.children[0].column).toBeDefined()
				expect(clone.children[1].line).toBeDefined()
				expect(clone.children[1].column).toBeDefined()
			})
		})
	})
})
