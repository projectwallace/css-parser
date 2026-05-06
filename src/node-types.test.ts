import { describe, test, expect, expectTypeOf } from 'vitest'
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
	AnyNode,
	StyleSheet,
	Rule,
	Atrule,
	Declaration,
	Block,
	Block as BlockNodeAlias,
	BlockChild,
	SelectorList,
	AtrulePrelude,
	Raw,
	Number,
	Dimension,
	Function,
	AttributeSelector,
	PseudoClassSelector,
	PseudoElementSelector,
	NthSelector,
	MediaFeature,
	LayerName,
	Combinator,
	Identifier,
	Operator,
	PreludeOperator,
} from './node-types'

// ---------------------------------------------------------------------------
// Type predicate runtime behaviour
// ---------------------------------------------------------------------------

describe('type predicates — runtime', () => {
	test('is_stylesheet returns true for the root node', () => {
		const root = parse('a { color: red }')
		expect(is_stylesheet(root)).toBe(true)
	})

	test('is_stylesheet returns false for a child node', () => {
		const root = parse('a { color: red }')
		expect(is_stylesheet(root.first_child!)).toBe(false)
	})

	test('is_rule identifies style rules', () => {
		const root = parse('a { color: red }')
		expect(is_rule(root.first_child!)).toBe(true)
	})

	test('is_atrule identifies at-rules', () => {
		const root = parse('@media screen {}')
		expect(is_atrule(root.first_child!)).toBe(true)
	})

	test('is_declaration identifies declarations', () => {
		const decl = parse_declaration('color: red')
		expect(is_declaration(decl)).toBe(true)
	})

	test('is_block identifies blocks', () => {
		const root = parse('a { color: red }')
		const rule = root.first_child! as Rule
		expect(is_block(rule.block!)).toBe(true)
	})

	test('is_selector identifies selector nodes', () => {
		const root = parse_selector('a, b')
		// root is SELECTOR_LIST; first child is SELECTOR
		expect(is_selector_list(root)).toBe(true)
		expect(is_selector(root.first_child!)).toBe(true)
	})

	test('is_dimension identifies dimension nodes', () => {
		const decl = parse_declaration('width: 100px')
		const value_node = decl.first_child! // VALUE wrapper
		const dim = value_node.first_child! // DIMENSION
		expect(is_dimension(dim)).toBe(true)
	})

	test('is_number identifies number nodes', () => {
		const decl = parse_declaration('z-index: 42')
		const value_node = decl.first_child!
		const num = value_node.first_child!
		expect(is_number(num)).toBe(true)
	})

	test('is_function identifies function nodes', () => {
		const decl = parse_declaration('color: rgb(0,0,0)')
		const value_node = decl.first_child!
		const fn = value_node.first_child!
		expect(is_function(fn)).toBe(true)
	})

	test('is_attribute_selector identifies attribute selectors', () => {
		const root = parse_selector('[href]')
		const attr = root.first_child!.first_child! // SelectorList > Selector > AttributeSelector
		expect(is_attribute_selector(attr)).toBe(true)
	})

	test('is_media_feature identifies media features', () => {
		// @media (min-width: 768px): atrule > prelude(AT_RULE_PRELUDE) > MediaQuery > MediaFeature
		const root = parse('@media (min-width: 768px) {}')
		const atrule = root.first_child! as Atrule
		const mediaQuery = atrule.prelude!.first_child!
		const mediaFeature = mediaQuery.first_child!
		expect(is_media_feature(mediaFeature)).toBe(true)
	})

	test('is_layer_name identifies layer name nodes', () => {
		// @layer utilities: atrule > prelude(AT_RULE_PRELUDE) > LayerName
		const root = parse('@layer utilities;')
		const atrule = root.first_child! as Atrule
		const layer = atrule.prelude!.first_child!
		expect(is_layer_name(layer)).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// Type narrowing — compile-time type assertions via expectTypeOf
// ---------------------------------------------------------------------------

describe('type narrowing — compile-time', () => {
	test('is_stylesheet narrows type field', () => {
		const root = parse('a {}')
		if (is_stylesheet(root)) {
			expectTypeOf(root).toExtend<StyleSheet>()
		}
	})

	test('is_rule narrows prelude and block to specific subtypes', () => {
		const root = parse('a { color: red }')
		const first = root.first_child!
		if (is_rule(first)) {
			expectTypeOf(first).toExtend<Rule>()
			expectTypeOf(first.prelude).toExtend<SelectorList | Raw | null>()
			expectTypeOf(first.block).toExtend<BlockNodeAlias | null>()
		}
	})

	test('is_atrule narrows name to string and prelude/block to specific subtypes', () => {
		const root = parse('@media screen {}')
		const first = root.first_child!
		if (is_atrule(first)) {
			expectTypeOf(first).toExtend<Atrule>()
			expectTypeOf(first.name).toEqualTypeOf<string>()
			expectTypeOf(first.prelude).toExtend<AtrulePrelude | Raw | null>()
			expectTypeOf(first.block).toExtend<BlockNodeAlias | null>()
		}
	})

	test('is_declaration narrows property, is_important, is_browserhack; omits inapplicable props', () => {
		const decl = parse_declaration('color: red !important')
		if (is_declaration(decl)) {
			expectTypeOf(decl).toExtend<Declaration>()
			expectTypeOf(decl.property).toEqualTypeOf<string>()
			expectTypeOf(decl.is_important).toEqualTypeOf<boolean>()
			expectTypeOf(decl.is_browserhack).toEqualTypeOf<boolean>()
			// `name`, `prelude`, `block` are absent on Declaration — verified by tsc
		}
	})

	test('is_block narrows is_empty to boolean', () => {
		const root = parse('a { color: red }')
		const rule = root.first_child! as Rule
		const block = rule.block!
		if (is_block(block)) {
			expectTypeOf(block).toExtend<Block>()
			expectTypeOf(block.is_empty).toEqualTypeOf<boolean>()
		}
	})

	test('is_dimension narrows value to number and unit to string', () => {
		const decl = parse_declaration('width: 100px')
		const dim = decl.first_child!.first_child!
		if (is_dimension(dim)) {
			expectTypeOf(dim).toExtend<Dimension>()
			expectTypeOf(dim.value).toExtend<number>()
			expectTypeOf(dim.unit).toExtend<string>()
		}
	})

	test('is_number narrows value to number', () => {
		const decl = parse_declaration('z-index: 42')
		const num = decl.first_child!.first_child!
		if (is_number(num)) {
			expectTypeOf(num).toExtend<Number>()
			expectTypeOf(num.value).toExtend<number>()
		}
	})

	test('is_function narrows name to string', () => {
		const decl = parse_declaration('color: rgb(0,0,0)')
		const fn = decl.first_child!.first_child!
		if (is_function(fn)) {
			expectTypeOf(fn).toExtend<Function>()
			expectTypeOf(fn.name).toEqualTypeOf<string>()
		}
	})

	test('is_attribute_selector narrows attr_operator and attr_flags to string | null', () => {
		const root = parse_selector('[href]')
		const attr = root.first_child!.first_child!
		if (is_attribute_selector(attr)) {
			expectTypeOf(attr).toExtend<AttributeSelector>()
			expectTypeOf(attr.attr_operator).toEqualTypeOf<string | null>()
			expectTypeOf(attr.attr_flags).toEqualTypeOf<string | null>()
		}
	})

	test('is_media_feature narrows property to string; omits name', () => {
		const root = parse('@media (min-width: 768px) {}')
		const mediaFeature = (root.first_child! as Atrule).prelude!.first_child!.first_child!
		if (is_media_feature(mediaFeature)) {
			expectTypeOf(mediaFeature).toExtend<MediaFeature>()
			expectTypeOf(mediaFeature.property).toEqualTypeOf<string>()
			// `name` is absent on MediaFeature — verified by tsc
		}
	})

	test('is_layer_name narrows name to string', () => {
		const root = parse('@layer utilities;')
		const layer = (root.first_child! as Atrule).prelude!.first_child!
		if (is_layer_name(layer)) {
			expectTypeOf(layer).toExtend<LayerName>()
			expectTypeOf(layer.name).toEqualTypeOf<string>()
		}
	})

	test('Block.first_child is BlockChild with next_sibling narrowed to the Block child union', () => {
		const root = parse('a { color: red; font-size: 1em }')
		const rule = root.first_child! as Rule
		const block = rule.block!
		// first_child on Block returns BlockChild, not the generic CSSNode
		const child = block.first_child
		expectTypeOf(child).toExtend<BlockChild>()
		// next_sibling is narrowed to Raw | Declaration | Atrule | Rule, not CSSNode
		if (child.has_next) {
			expectTypeOf(child.next_sibling).toExtend<Raw | Declaration | Atrule | Rule>()
		}
		// children[] and for-of also yield BlockChild
		expectTypeOf(block.children[0]).toExtend<BlockChild>()
		for (const c of block) {
			expectTypeOf(c).toExtend<BlockChild>()
		}
	})

	test('type_name "Combinator" narrows to Combinator', () => {
		// SelectorList > Selector > TypeSelector > Combinator (next sibling)
		const combinator = parse_selector('a > b').first_child.first_child!.next_sibling! as AnyNode
		if (combinator.type_name === 'Combinator') {
			expectTypeOf(combinator).toExtend<Combinator>()
			expectTypeOf(combinator.name).toEqualTypeOf<string>()
		}
	})

	test('type_name "Identifier" narrows to Identifier', () => {
		// Declaration > Value > Identifier
		const ident = parse_declaration('display: block').first_child!.first_child! as AnyNode
		if (ident.type_name === 'Identifier') {
			expectTypeOf(ident).toExtend<Identifier>()
			expectTypeOf(ident.name).toEqualTypeOf<string>()
		}
	})

	test('type_name "Operator" narrows to Operator | PreludeOperator (shared type_name)', () => {
		// Declaration > Value > Operator (the comma between values)
		const op = parse_declaration('background: red, blue').first_child!.first_child!
			.next_sibling! as AnyNode
		if (op.type_name === 'Operator') {
			expectTypeOf(op).toExtend<Operator | PreludeOperator>()
		}
	})

	test('type_name "Declaration" narrows to Declaration', () => {
		const decl = parse_declaration('color: red') as AnyNode
		if (decl.type_name === 'Declaration') {
			expectTypeOf(decl).toExtend<Declaration>()
			expectTypeOf(decl.property).toEqualTypeOf<string>()
		}
	})

	test('type_name "Rule" narrows to Rule', () => {
		const first = parse('a { color: red }').first_child! as AnyNode
		if (first.type_name === 'Rule') {
			expectTypeOf(first).toExtend<Rule>()
		}
	})

	test('type_name "Atrule" narrows to Atrule', () => {
		const first = parse('@media screen {}').first_child! as AnyNode
		if (first.type_name === 'Atrule') {
			expectTypeOf(first).toExtend<Atrule>()
			expectTypeOf(first.name).toEqualTypeOf<string>()
		}
	})

	test('type_name "StyleSheet" narrows to StyleSheet', () => {
		const root = parse('a {}') as AnyNode
		if (root.type_name === 'StyleSheet') {
			expectTypeOf(root).toExtend<StyleSheet>()
		}
	})

	test('type_name "MediaFeatureRange" narrows to FeatureRange', () => {
		const atrule = parse('@media (width >= 400px) {}').first_child! as Atrule
		// AtrulePrelude > MediaQuery > FeatureRange
		const range = atrule.prelude!.first_child!.first_child! as AnyNode
		if (range.type_name === 'MediaFeatureRange') {
			expectTypeOf(range.name).toEqualTypeOf<string>()
		}
	})

	test('AnyCss enables switch narrowing', () => {
		// This test verifies the discriminated union works for switch narrowing.
		// The function must compile without type errors.
		function extract_name(node: AnyNode): string | undefined {
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
		const atrule = root.first_child! as AnyNode
		expect(extract_name(atrule)).toBe('media')

		const decl = parse_declaration('color: red') as AnyNode
		expect(extract_name(decl)).toBe('color')
	})
})

// ---------------------------------------------------------------------------
// Selector subtypes
// ---------------------------------------------------------------------------

describe('selector subtypes', () => {
	test('is_pseudo_class_selector narrows name to string', () => {
		const root = parse_selector(':hover')
		const sel = root.first_child // Selector
		const pseudo = sel.first_child // PseudoClassSelector
		if (is_pseudo_class_selector(pseudo)) {
			expectTypeOf(pseudo).toExtend<PseudoClassSelector>()
			expectTypeOf(pseudo.name).toEqualTypeOf<string>()
			expect(pseudo.name).toBe('hover')
		}
	})

	test('is_pseudo_element_selector narrows name to string', () => {
		const root = parse_selector('::before')
		const sel = root.first_child!
		const pseudo = sel.first_child!
		if (is_pseudo_element_selector(pseudo)) {
			expectTypeOf(pseudo).toExtend<PseudoElementSelector>()
			expectTypeOf(pseudo.name).toEqualTypeOf<string>()
			expect(pseudo.name).toBe('before')
		}
	})

	test('is_nth_selector preserves nth_a and nth_b types', () => {
		const root = parse_selector(':nth-child(2n+1)')
		const pseudo = root.first_child!.first_child! // PseudoClassSelector
		const nth = pseudo.first_child! // NthSelector inside
		if (is_nth_selector(nth)) {
			expectTypeOf(nth).toExtend<NthSelector>()
			expectTypeOf(nth.nth_a).toEqualTypeOf<string | null>()
			expectTypeOf(nth.nth_b).toEqualTypeOf<string | null>()
		}
	})
})
