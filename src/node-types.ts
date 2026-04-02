// CSS Node subtypes — zero-cost TypeScript narrowing layer
//
// Design: every subtype extends CssNodeCommon (an internal interface with only
// universal properties) rather than CSSNode directly. This means only the
// properties that are meaningful for a given node type appear in autocomplete —
// irrelevant getters like `unit` on a Declaration are simply absent.
//
// CSSNode structurally satisfies CssNodeCommon, so all type predicates accept
// plain CSSNode instances at call sites without any cast needed:
//
//   const root: CSSNode = parse(css)
//   if (is_declaration(root.first_child)) {  // CSSNode passed, no cast needed
//     root.first_child.property  // string — not string | undefined
//   }
//
// All interfaces are erased at compile time — zero bytes in the JS output.
// Type predicates compile to a single integer comparison each.

import type { CSSNodeType, TypeName, CloneOptions, PlainCSSNode } from './css-node'
import {
	STYLESHEET,
	STYLE_RULE,
	AT_RULE,
	DECLARATION,
	SELECTOR,
	COMMENT,
	BLOCK,
	RAW,
	IDENTIFIER,
	NUMBER,
	DIMENSION,
	STRING,
	HASH,
	FUNCTION,
	OPERATOR,
	PARENTHESIS,
	URL,
	UNICODE_RANGE,
	VALUE,
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
	MEDIA_QUERY,
	MEDIA_FEATURE,
	MEDIA_TYPE,
	CONTAINER_QUERY,
	SUPPORTS_QUERY,
	LAYER_NAME,
	PRELUDE_OPERATOR,
	PRELUDE_SELECTORLIST,
	FEATURE_RANGE,
	AT_RULE_PRELUDE,
} from './arena'

// ---------------------------------------------------------------------------
// CssNodeCommon — internal base (not exported)
//
// Contains only properties that are present and meaningful on EVERY node type.
// CSSNode satisfies this interface structurally (it has all these properties
// plus more), so type predicates accepting CssNodeCommon also accept CSSNode.
// ---------------------------------------------------------------------------

export interface CssNodeCommon {
	readonly type: CSSNodeType
	readonly type_name: TypeName
	readonly text: string
	readonly has_error: boolean
	readonly is_vendor_prefixed: boolean
	readonly line: number
	readonly column: number
	readonly start: number
	readonly length: number
	readonly end: number
	readonly first_child: CssNodeCommon | null
	readonly next_sibling: CssNodeCommon | null
	readonly has_next: boolean
	readonly has_children: boolean
	readonly child_count: number
	readonly children: CssNodeCommon[]
	[Symbol.iterator](): Iterator<CssNodeCommon>
	clone(options?: CloneOptions): PlainCSSNode
}

// ---------------------------------------------------------------------------
// Structural nodes
// ---------------------------------------------------------------------------

export interface StyleSheet extends CssNodeCommon {
	readonly type: typeof STYLESHEET
}

export interface Rule extends CssNodeCommon {
	readonly type: typeof STYLE_RULE
	readonly name: string
	/** SELECTOR_LIST (parse_selectors=true) or SELECTOR, or null */
	readonly prelude: SelectorList | Selector | null
	readonly block: Block | null
	readonly has_prelude: boolean
	readonly has_block: boolean
	readonly has_declarations: boolean
}

export interface Atrule extends CssNodeCommon {
	readonly type: typeof AT_RULE
	/** At-rule keyword, e.g. "media", "keyframes" */
	readonly name: string
	/** AT_RULE_PRELUDE (parse_atrule_preludes=true) or RAW, or null */
	readonly prelude: AtrulePrelude | Raw | null
	readonly block: Block | null
	readonly has_prelude: boolean
	readonly has_block: boolean
	readonly has_declarations: boolean
}

export interface Declaration extends CssNodeCommon {
	readonly type: typeof DECLARATION
	/** Property name, e.g. "color" */
	readonly property: string
	/** VALUE node (parse_values=true), raw string, or null */
	readonly value: Value | string | null
	readonly is_important: boolean
	readonly is_browserhack: boolean
}

export interface Selector extends CssNodeCommon {
	readonly type: typeof SELECTOR
}

export interface SelectorList extends CssNodeCommon {
	readonly type: typeof SELECTOR_LIST
}

export interface Block extends CssNodeCommon {
	readonly type: typeof BLOCK
	readonly is_empty: boolean
}

export interface Comment extends CssNodeCommon {
	readonly type: typeof COMMENT
}

export interface Raw extends CssNodeCommon {
	readonly type: typeof RAW
}

// ---------------------------------------------------------------------------
// Value nodes
// ---------------------------------------------------------------------------

export interface Identifier extends CssNodeCommon {
	readonly type: typeof IDENTIFIER
	readonly name: string
}

export interface Number extends CssNodeCommon {
	readonly type: typeof NUMBER
	readonly value: number
	readonly value_as_number: number
}

export interface Dimension extends CssNodeCommon {
	readonly type: typeof DIMENSION
	readonly value: number
	readonly value_as_number: number
	/** Unit string, e.g. "px", "%" */
	readonly unit: string
}

export interface String extends CssNodeCommon {
	readonly type: typeof STRING
}

export interface Hash extends CssNodeCommon {
	readonly type: typeof HASH
}

export interface Function extends CssNodeCommon {
	readonly type: typeof FUNCTION
	/** Function name, e.g. "rgb", "calc" */
	readonly name: string
	/** Function arguments as raw text, e.g. "255, 0, 0" for rgb(255, 0, 0) */
	readonly value: string | null
}

export interface Operator extends CssNodeCommon {
	readonly type: typeof OPERATOR
	/** The operator character(s), e.g. ",", "+", "-" */
	readonly value: string
}

export interface Parenthesis extends CssNodeCommon {
	readonly type: typeof PARENTHESIS
}

export interface Url extends CssNodeCommon {
	readonly type: typeof URL
	/** Always "url" */
	readonly name: string
	/** URL content, e.g. '"image.png"' (with quotes) or 'mycursor.cur' (unquoted) */
	readonly value: string | null
}

export interface UnicodeRange extends CssNodeCommon {
	readonly type: typeof UNICODE_RANGE
}

export interface Value extends CssNodeCommon {
	readonly type: typeof VALUE
}

// ---------------------------------------------------------------------------
// Selector nodes
// ---------------------------------------------------------------------------

export interface TypeSelector extends CssNodeCommon {
	readonly type: typeof TYPE_SELECTOR
	/** Element type, e.g. "div", "span" */
	readonly name: string
}

export interface ClassSelector extends CssNodeCommon {
	readonly type: typeof CLASS_SELECTOR
	/** Class name without dot, e.g. "foo" from ".foo" */
	readonly name: string
}

export interface IdSelector extends CssNodeCommon {
	readonly type: typeof ID_SELECTOR
	/** Id without hash, e.g. "bar" from "#bar" */
	readonly name: string
}

export interface AttributeSelector extends CssNodeCommon {
	readonly type: typeof ATTRIBUTE_SELECTOR
	/** Attribute name, e.g. "href" from "[href]" */
	readonly name: string
	/** One of the ATTR_OPERATOR_* constants */
	readonly attr_operator: number
	/** One of the ATTR_FLAG_* constants */
	readonly attr_flags: number
}

export interface PseudoClassSelector extends CssNodeCommon {
	readonly type: typeof PSEUDO_CLASS_SELECTOR
	/** Pseudo-class name without colon, e.g. "hover" */
	readonly name: string
	/** Selector list for functional pseudo-classes like :is(), :not(), :has() */
	readonly selector_list: SelectorList | undefined
}

export interface PseudoElementSelector extends CssNodeCommon {
	readonly type: typeof PSEUDO_ELEMENT_SELECTOR
	/** Pseudo-element name without colons, e.g. "before" */
	readonly name: string
}

export interface Combinator extends CssNodeCommon {
	readonly type: typeof COMBINATOR
	readonly name: string
}

export interface UniversalSelector extends CssNodeCommon {
	readonly type: typeof UNIVERSAL_SELECTOR
	/** Namespace qualifier (e.g. 'ns' in 'ns|*'), undefined if no namespace */
	readonly name: string | undefined
}

export interface NestingSelector extends CssNodeCommon {
	readonly type: typeof NESTING_SELECTOR
}

export interface NthSelector extends CssNodeCommon {
	readonly type: typeof NTH_SELECTOR
	readonly nth_a: string | undefined
	readonly nth_b: string | undefined
}

export interface NthOfSelector extends CssNodeCommon {
	readonly type: typeof NTH_OF_SELECTOR
	/** The An+B formula node */
	readonly nth: NthSelector | undefined
	/** The selector list from :nth-child(An+B of <selector>) */
	readonly selector: SelectorList | undefined
}

export interface LangSelector extends CssNodeCommon {
	readonly type: typeof LANG_SELECTOR
}

// ---------------------------------------------------------------------------
// At-rule prelude nodes
// ---------------------------------------------------------------------------

export interface AtrulePrelude extends CssNodeCommon {
	readonly type: typeof AT_RULE_PRELUDE
}

export interface MediaQuery extends CssNodeCommon {
	readonly type: typeof MEDIA_QUERY
}

export interface MediaFeature extends CssNodeCommon {
	readonly type: typeof MEDIA_FEATURE
	/** Feature name, e.g. "min-width" */
	readonly property: string
}

export interface MediaType extends CssNodeCommon {
	readonly type: typeof MEDIA_TYPE
	/** Media type text, e.g. "screen", "print" */
	readonly value: string
}

export interface ContainerQuery extends CssNodeCommon {
	readonly type: typeof CONTAINER_QUERY
}

export interface SupportsQuery extends CssNodeCommon {
	readonly type: typeof SUPPORTS_QUERY
	/** The supports condition text, e.g. "display: flex" from "supports(display: flex)" */
	readonly value: string
}

export interface LayerName extends CssNodeCommon {
	readonly type: typeof LAYER_NAME
	readonly name: string
	/** Alias for name — the layer name string, e.g. "base" from "layer(base)" */
	readonly value: string
}

export interface PreludeSelectorList extends CssNodeCommon {
	readonly type: typeof PRELUDE_SELECTORLIST
	/** The selector text inside the parentheses, e.g. ".parent" from "(.parent)" */
	readonly value: string
}

export interface PreludeOperator extends CssNodeCommon {
	readonly type: typeof PRELUDE_OPERATOR
}

export interface FeatureRange extends CssNodeCommon {
	readonly type: typeof FEATURE_RANGE
	/** The feature name in a range comparison, e.g. "width" from "(width >= 400px)" */
	readonly name: string
}

// ---------------------------------------------------------------------------
// AnyCss — discriminated union of all known subtypes
//
// Enables switch/if narrowing without explicit type predicates:
//
//   walk(root, (node: AnyCss) => {
//     if (node.type === DECLARATION) { node.property /* string */ }
//   })
// ---------------------------------------------------------------------------

export type AnyCss =
	| StyleSheet
	| Rule
	| Atrule
	| Declaration
	| Selector
	| SelectorList
	| Block
	| Comment
	| Raw
	| Identifier
	| Number
	| Dimension
	| String
	| Hash
	| Function
	| Operator
	| Parenthesis
	| Url
	| UnicodeRange
	| Value
	| TypeSelector
	| ClassSelector
	| IdSelector
	| AttributeSelector
	| PseudoClassSelector
	| PseudoElementSelector
	| Combinator
	| UniversalSelector
	| NestingSelector
	| NthSelector
	| NthOfSelector
	| LangSelector
	| AtrulePrelude
	| MediaQuery
	| MediaFeature
	| MediaType
	| ContainerQuery
	| SupportsQuery
	| LayerName
	| PreludeOperator
	| FeatureRange
	| PreludeSelectorList

// ---------------------------------------------------------------------------
// Type predicate functions
//
// Each compiles to a single integer comparison — zero heap allocation.
// Parameter type is CssNodeCommon; CSSNode satisfies CssNodeCommon
// structurally, so no cast is needed at call sites.
// ---------------------------------------------------------------------------

export function is_stylesheet(node: CssNodeCommon): node is StyleSheet {
	return node.type === STYLESHEET
}
export function is_rule(node: CssNodeCommon): node is Rule {
	return node.type === STYLE_RULE
}
export function is_atrule(node: CssNodeCommon): node is Atrule {
	return node.type === AT_RULE
}
export function is_declaration(node: CssNodeCommon): node is Declaration {
	return node.type === DECLARATION
}
export function is_selector(node: CssNodeCommon): node is Selector {
	return node.type === SELECTOR
}
export function is_selector_list(node: CssNodeCommon): node is SelectorList {
	return node.type === SELECTOR_LIST
}
export function is_block(node: CssNodeCommon): node is Block {
	return node.type === BLOCK
}
export function is_comment(node: CssNodeCommon): node is Comment {
	return node.type === COMMENT
}
export function is_raw(node: CssNodeCommon): node is Raw {
	return node.type === RAW
}
export function is_identifier(node: CssNodeCommon): node is Identifier {
	return node.type === IDENTIFIER
}
export function is_number(node: CssNodeCommon): node is Number {
	return node.type === NUMBER
}
export function is_dimension(node: CssNodeCommon): node is Dimension {
	return node.type === DIMENSION
}
export function is_string(node: CssNodeCommon): node is String {
	return node.type === STRING
}
export function is_hash(node: CssNodeCommon): node is Hash {
	return node.type === HASH
}
export function is_function(node: CssNodeCommon): node is Function {
	return node.type === FUNCTION
}
export function is_operator(node: CssNodeCommon): node is Operator {
	return node.type === OPERATOR
}
export function is_parenthesis(node: CssNodeCommon): node is Parenthesis {
	return node.type === PARENTHESIS
}
export function is_url(node: CssNodeCommon): node is Url {
	return node.type === URL
}
export function is_unicode_range(node: CssNodeCommon): node is UnicodeRange {
	return node.type === UNICODE_RANGE
}
export function is_value(node: CssNodeCommon): node is Value {
	return node.type === VALUE
}
export function is_type_selector(node: CssNodeCommon): node is TypeSelector {
	return node.type === TYPE_SELECTOR
}
export function is_class_selector(node: CssNodeCommon): node is ClassSelector {
	return node.type === CLASS_SELECTOR
}
export function is_id_selector(node: CssNodeCommon): node is IdSelector {
	return node.type === ID_SELECTOR
}
export function is_attribute_selector(node: CssNodeCommon): node is AttributeSelector {
	return node.type === ATTRIBUTE_SELECTOR
}
export function is_pseudo_class_selector(node: CssNodeCommon): node is PseudoClassSelector {
	return node.type === PSEUDO_CLASS_SELECTOR
}
export function is_pseudo_element_selector(node: CssNodeCommon): node is PseudoElementSelector {
	return node.type === PSEUDO_ELEMENT_SELECTOR
}
export function is_combinator(node: CssNodeCommon): node is Combinator {
	return node.type === COMBINATOR
}
export function is_universal_selector(node: CssNodeCommon): node is UniversalSelector {
	return node.type === UNIVERSAL_SELECTOR
}
export function is_nesting_selector(node: CssNodeCommon): node is NestingSelector {
	return node.type === NESTING_SELECTOR
}
export function is_nth_selector(node: CssNodeCommon): node is NthSelector {
	return node.type === NTH_SELECTOR
}
export function is_nth_of_selector(node: CssNodeCommon): node is NthOfSelector {
	return node.type === NTH_OF_SELECTOR
}
export function is_lang_selector(node: CssNodeCommon): node is LangSelector {
	return node.type === LANG_SELECTOR
}
export function is_atrule_prelude(node: CssNodeCommon): node is AtrulePrelude {
	return node.type === AT_RULE_PRELUDE
}
export function is_media_query(node: CssNodeCommon): node is MediaQuery {
	return node.type === MEDIA_QUERY
}
export function is_media_feature(node: CssNodeCommon): node is MediaFeature {
	return node.type === MEDIA_FEATURE
}
export function is_media_type(node: CssNodeCommon): node is MediaType {
	return node.type === MEDIA_TYPE
}
export function is_container_query(node: CssNodeCommon): node is ContainerQuery {
	return node.type === CONTAINER_QUERY
}
export function is_supports_query(node: CssNodeCommon): node is SupportsQuery {
	return node.type === SUPPORTS_QUERY
}
export function is_layer_name(node: CssNodeCommon): node is LayerName {
	return node.type === LAYER_NAME
}
export function is_prelude_operator(node: CssNodeCommon): node is PreludeOperator {
	return node.type === PRELUDE_OPERATOR
}
export function is_feature_range(node: CssNodeCommon): node is FeatureRange {
	return node.type === FEATURE_RANGE
}
export function is_prelude_selectorlist(node: CssNodeCommon): node is PreludeSelectorList {
	return node.type === PRELUDE_SELECTORLIST
}
