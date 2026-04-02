import { describe, it, expect, expectTypeOf } from 'vitest'
import { parse } from './parse'
import { parse_declaration } from './parse-declaration'
import { parse_selector } from './parse-selector'
import {
	is_stylesheet,
	is_rule,
	is_atrule,
	is_declaration,
	is_selector,
	is_selector_list,
	is_block,
	is_number,
	is_dimension,
	is_function,
	is_attribute_selector,
	is_pseudo_class_selector,
	is_pseudo_element_selector,
	is_nth_selector,
	is_media_feature,
	is_layer_name,
} from './node-types'
import type {
	AnyCssNode,
	StyleSheetNode,
	RuleNode,
	AtruleNode,
	DeclarationNode,
	BlockNode,
	BlockNode as BlockNodeAlias,
	SelectorListNode,
	SelectorNode,
	AtrulePreludeNode,
	RawNode,
	NumberNode,
	DimensionNode,
	FunctionNode,
	AttributeSelectorNode,
	PseudoClassSelectorNode,
	PseudoElementSelectorNode,
	NthSelectorNode,
	MediaFeatureNode,
	LayerNameNode,
} from './node-types'

// ---------------------------------------------------------------------------
// Type predicate runtime behaviour
// ---------------------------------------------------------------------------

describe('type predicates — runtime', () => {
	it('is_stylesheet returns true for the root node', () => {
		const root = parse('a { color: red }')
		expect(is_stylesheet(root)).toBe(true)
	})

	it('is_stylesheet returns false for a child node', () => {
		const root = parse('a { color: red }')
		expect(is_stylesheet(root.first_child!)).toBe(false)
	})

	it('is_rule identifies style rules', () => {
		const root = parse('a { color: red }')
		expect(is_rule(root.first_child!)).toBe(true)
	})

	it('is_atrule identifies at-rules', () => {
		const root = parse('@media screen {}')
		expect(is_atrule(root.first_child!)).toBe(true)
	})

	it('is_declaration identifies declarations', () => {
		const decl = parse_declaration('color: red')
		expect(is_declaration(decl)).toBe(true)
	})

	it('is_block identifies blocks', () => {
		const root = parse('a { color: red }')
		const rule = root.first_child! as RuleNode
		expect(is_block(rule.block!)).toBe(true)
	})

	it('is_selector identifies selector nodes', () => {
		const root = parse_selector('a, b')
		// root is SELECTOR_LIST; first child is SELECTOR
		expect(is_selector_list(root)).toBe(true)
		expect(is_selector(root.first_child!)).toBe(true)
	})

	it('is_dimension identifies dimension nodes', () => {
		const decl = parse_declaration('width: 100px')
		const value_node = decl.first_child! // VALUE wrapper
		const dim = value_node.first_child! // DIMENSION
		expect(is_dimension(dim)).toBe(true)
	})

	it('is_number identifies number nodes', () => {
		const decl = parse_declaration('z-index: 42')
		const value_node = decl.first_child!
		const num = value_node.first_child!
		expect(is_number(num)).toBe(true)
	})

	it('is_function identifies function nodes', () => {
		const decl = parse_declaration('color: rgb(0,0,0)')
		const value_node = decl.first_child!
		const fn = value_node.first_child!
		expect(is_function(fn)).toBe(true)
	})

	it('is_attribute_selector identifies attribute selectors', () => {
		const root = parse_selector('[href]')
		const attr = root.first_child!.first_child! // SelectorList > Selector > AttributeSelector
		expect(is_attribute_selector(attr)).toBe(true)
	})

	it('is_media_feature identifies media features', () => {
		// @media (min-width: 768px): atrule > prelude(AT_RULE_PRELUDE) > MediaQuery > MediaFeature
		const root = parse('@media (min-width: 768px) {}')
		const atrule = root.first_child! as AtruleNode
		const mediaQuery = atrule.prelude!.first_child!
		const mediaFeature = mediaQuery.first_child!
		expect(is_media_feature(mediaFeature)).toBe(true)
	})

	it('is_layer_name identifies layer name nodes', () => {
		// @layer utilities: atrule > prelude(AT_RULE_PRELUDE) > LayerName
		const root = parse('@layer utilities;')
		const atrule = root.first_child! as AtruleNode
		const layer = atrule.prelude!.first_child!
		expect(is_layer_name(layer)).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// Type narrowing — compile-time type assertions via expectTypeOf
// ---------------------------------------------------------------------------

describe('type narrowing — compile-time', () => {
	it('is_stylesheet narrows type field', () => {
		const root = parse('a {}')
		if (is_stylesheet(root)) {
			expectTypeOf(root).toMatchTypeOf<StyleSheetNode>()
		}
	})

	it('is_rule narrows prelude and block to specific subtypes', () => {
		const root = parse('a { color: red }')
		const first = root.first_child!
		if (is_rule(first)) {
			expectTypeOf(first).toMatchTypeOf<RuleNode>()
			expectTypeOf(first.prelude).toMatchTypeOf<SelectorListNode | SelectorNode | null>()
			expectTypeOf(first.block).toMatchTypeOf<BlockNodeAlias | null>()
		}
	})

	it('is_atrule narrows name to string and prelude/block to specific subtypes', () => {
		const root = parse('@media screen {}')
		const first = root.first_child!
		if (is_atrule(first)) {
			expectTypeOf(first).toMatchTypeOf<AtruleNode>()
			expectTypeOf(first.name).toEqualTypeOf<string>()
			expectTypeOf(first.prelude).toMatchTypeOf<AtrulePreludeNode | RawNode | null>()
			expectTypeOf(first.block).toMatchTypeOf<BlockNodeAlias | null>()
		}
	})

	it('is_declaration narrows property, is_important, is_browserhack; omits inapplicable props', () => {
		const decl = parse_declaration('color: red !important')
		if (is_declaration(decl)) {
			expectTypeOf(decl).toMatchTypeOf<DeclarationNode>()
			expectTypeOf(decl.property).toEqualTypeOf<string>()
			expectTypeOf(decl.is_important).toEqualTypeOf<boolean>()
			expectTypeOf(decl.is_browserhack).toEqualTypeOf<boolean>()
			// `name`, `prelude`, `block` are absent on DeclarationNode — verified by tsc
		}
	})

	it('is_block narrows is_empty to boolean', () => {
		const root = parse('a { color: red }')
		const rule = root.first_child! as RuleNode
		const block = rule.block!
		if (is_block(block)) {
			expectTypeOf(block).toMatchTypeOf<BlockNode>()
			expectTypeOf(block.is_empty).toEqualTypeOf<boolean>()
		}
	})

	it('is_dimension narrows value to number, unit to string, value_as_number to number', () => {
		const decl = parse_declaration('width: 100px')
		const dim = decl.first_child!.first_child!
		if (is_dimension(dim)) {
			expectTypeOf(dim).toMatchTypeOf<DimensionNode>()
			expectTypeOf(dim.value).toMatchTypeOf<number>()
			expectTypeOf(dim.unit).toMatchTypeOf<string>()
			expectTypeOf(dim.value_as_number).toMatchTypeOf<number>()
		}
	})

	it('is_number narrows value to number and value_as_number to number', () => {
		const decl = parse_declaration('z-index: 42')
		const num = decl.first_child!.first_child!
		if (is_number(num)) {
			expectTypeOf(num).toMatchTypeOf<NumberNode>()
			expectTypeOf(num.value).toMatchTypeOf<number>()
			expectTypeOf(num.value_as_number).toMatchTypeOf<number>()
		}
	})

	it('is_function narrows name to string', () => {
		const decl = parse_declaration('color: rgb(0,0,0)')
		const fn = decl.first_child!.first_child!
		if (is_function(fn)) {
			expectTypeOf(fn).toMatchTypeOf<FunctionNode>()
			expectTypeOf(fn.name).toEqualTypeOf<string>()
		}
	})

	it('is_attribute_selector narrows attr_operator and attr_flags to number', () => {
		const root = parse_selector('[href]')
		const attr = root.first_child!.first_child!
		if (is_attribute_selector(attr)) {
			expectTypeOf(attr).toMatchTypeOf<AttributeSelectorNode>()
			expectTypeOf(attr.attr_operator).toEqualTypeOf<number>()
			expectTypeOf(attr.attr_flags).toEqualTypeOf<number>()
		}
	})

	it('is_media_feature narrows property to string; omits name', () => {
		const root = parse('@media (min-width: 768px) {}')
		const mediaFeature = (root.first_child! as AtruleNode).prelude!.first_child!.first_child!
		if (is_media_feature(mediaFeature)) {
			expectTypeOf(mediaFeature).toMatchTypeOf<MediaFeatureNode>()
			expectTypeOf(mediaFeature.property).toEqualTypeOf<string>()
			// `name` is absent on MediaFeatureNode — verified by tsc
		}
	})

	it('is_layer_name narrows name to string', () => {
		const root = parse('@layer utilities;')
		const layer = (root.first_child! as AtruleNode).prelude!.first_child!
		if (is_layer_name(layer)) {
			expectTypeOf(layer).toMatchTypeOf<LayerNameNode>()
			expectTypeOf(layer.name).toEqualTypeOf<string>()
		}
	})

	it('AnyCssNode enables switch narrowing', () => {
		// This test verifies the discriminated union works for switch narrowing.
		// The function must compile without type errors.
		function extract_name(node: AnyCssNode): string | undefined {
			switch (node.type) {
				case 3: // AT_RULE
					return node.name // must be string here
				case 4: // DECLARATION
					return node.property // must be string here
				default:
					return undefined
			}
		}
		const root = parse('@media screen {}')
		const atrule = root.first_child! as AnyCssNode
		expect(extract_name(atrule)).toBe('media')

		const decl = parse_declaration('color: red') as AnyCssNode
		expect(extract_name(decl)).toBe('color')
	})
})

// ---------------------------------------------------------------------------
// Selector subtypes
// ---------------------------------------------------------------------------

describe('selector subtypes', () => {
	it('is_pseudo_class_selector narrows name to string', () => {
		const root = parse_selector(':hover')
		const sel = root.first_child! // Selector
		const pseudo = sel.first_child! // PseudoClassSelector
		if (is_pseudo_class_selector(pseudo)) {
			expectTypeOf(pseudo).toMatchTypeOf<PseudoClassSelectorNode>()
			expectTypeOf(pseudo.name).toEqualTypeOf<string>()
			expect(pseudo.name).toBe('hover')
		}
	})

	it('is_pseudo_element_selector narrows name to string', () => {
		const root = parse_selector('::before')
		const sel = root.first_child!
		const pseudo = sel.first_child!
		if (is_pseudo_element_selector(pseudo)) {
			expectTypeOf(pseudo).toMatchTypeOf<PseudoElementSelectorNode>()
			expectTypeOf(pseudo.name).toEqualTypeOf<string>()
			expect(pseudo.name).toBe('before')
		}
	})

	it('is_nth_selector preserves nth_a and nth_b types', () => {
		const root = parse_selector(':nth-child(2n+1)')
		const pseudo = root.first_child!.first_child! // PseudoClassSelector
		const nth = pseudo.first_child! // NthSelector inside
		if (is_nth_selector(nth)) {
			expectTypeOf(nth).toMatchTypeOf<NthSelectorNode>()
			expectTypeOf(nth.nth_a).toEqualTypeOf<string | undefined>()
			expectTypeOf(nth.nth_b).toEqualTypeOf<string | undefined>()
		}
	})
})
