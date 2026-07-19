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
	SUPPORTS_DECLARATION,
	LAYER_NAME,
	PRELUDE_OPERATOR,
	PRELUDE_SELECTORLIST,
	FEATURE_RANGE,
	AT_RULE_PRELUDE,
} from './arena'

// ---------------------------------------------------------------------------
// Contains only properties that are present and meaningful on EVERY node type.
// CSSNode satisfies this interface structurally (it has all these properties
// plus more), so type predicates accepting CssNodeCommon also accept CSSNode.
// ---------------------------------------------------------------------------

export type CSSNode = {
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
	readonly first_child: CSSNode | null
	clone(options?: CloneOptions): PlainCSSNode
} & (
	| { readonly has_next: false; readonly next_sibling: null }
	| { readonly has_next: true; readonly next_sibling: CSSNode }
)

// ---------------------------------------------------------------------------
// Shared builders — every node type below is assembled from these instead of
// hand-rolling `CSSNode & { type, type_name, clone(): ToPlain<Self> }` each
// time. They compile away entirely (types only); their only cost is here,
// once, rather than repeated on every one of the ~40 node types below.
// ---------------------------------------------------------------------------

/**
 * A boolean discriminant paired with the value it gates, e.g. `has_prelude` /
 * `prelude`: `T` when the flag is true, `null` when it's false.
 */
type Toggle<HasKey extends string, ValueKey extends string, T> =
	| ({ readonly [K in HasKey]: true } & { readonly [K in ValueKey]: T })
	| ({ readonly [K in HasKey]: false } & { readonly [K in ValueKey]: null })

/** Adds a `clone()` whose return type is `ToPlain<T>` for this exact T. */
type WithClone<T extends CSSNode> = T & { clone(options?: CloneOptions): ToPlain<T> }

/** A node with no children: CSSNode + a literal type tag + any extra fields. */
type Leaf<Type extends CSSNodeType, Name extends TypeName, Extra = {}> = WithClone<
	CSSNode & Extra & { readonly type: Type; readonly type_name: Name }
>

/** Mixin for container node types (StyleSheet, Block, SelectorList, …). Leaf nodes never carry children, so they skip this. */
export interface WithChildren<T = AnyNode> {
	readonly has_children: boolean
	readonly child_count: number
	readonly children: T[]
	readonly first_child: T
	[Symbol.iterator](): Iterator<T>
}

/**
 * Maps a CssNodeCommon subtype to its clone() equivalent: `type` narrowed to
 * T's literal, subtype-specific fields with CssNodeCommon refs replaced by
 * PlainCSSNode, and traversal props (first_child, next_sibling, …) dropped
 * since clone() never serialises them.
 */
export type ToPlain<T extends CSSNode> = PlainCSSNode & { type: T['type'] } & {
	[K in Exclude<
		keyof T,
		| keyof CSSNode
		| symbol
		| 'attr_operator'
		| 'attr_flags'
		| 'has_children'
		| 'child_count'
		| 'children'
	> as T[K] extends (...args: any[]) => any ? never : K]: T[K] extends CSSNode | null | undefined
		? PlainCSSNode | Exclude<T[K], CSSNode>
		: T[K] extends CSSNode[]
			? PlainCSSNode[]
			: T[K]
}

// ---------------------------------------------------------------------------
// Structural nodes
// ---------------------------------------------------------------------------

export type StyleSheet = WithClone<
	CSSNode & WithChildren & { readonly type: typeof STYLESHEET; readonly type_name: 'StyleSheet' }
>

export type Rule = WithClone<
	CSSNode &
		/** SELECTOR_LIST (parse_selectors=true) or RAW (parse_selectors=false) */
		Toggle<'has_prelude', 'prelude', SelectorList | Raw> &
		Toggle<'has_block', 'block', Block> & {
			readonly type: typeof STYLE_RULE
			readonly type_name: 'Rule'
			readonly has_declarations: boolean
		}
>

export type Atrule = WithClone<
	CSSNode &
		/** AT_RULE_PRELUDE (parse_atrule_preludes=true) or RAW (parse_atrule_preludes=false) */
		Toggle<'has_prelude', 'prelude', AtrulePrelude | Raw> &
		Toggle<'has_block', 'block', Block> & {
			readonly type: typeof AT_RULE
			readonly type_name: 'Atrule'
			/** At-rule keyword, e.g. "media", "keyframes" */
			readonly name: string
			readonly has_declarations: boolean
		}
>

export type Declaration = Leaf<
	typeof DECLARATION,
	'Declaration',
	{
		/** Property name, e.g. "color" */
		readonly property: string
		/** VALUE node (parse_values=true), RAW node (parse_values=false), or null */
		readonly value: Value | Raw | null
		readonly is_important: boolean
		readonly is_browserhack: boolean
	}
>

export type SelectorNode =
	| TypeSelector
	| IdSelector
	| ClassSelector
	| NthSelector
	| NthOfSelector
	| LangSelector
	| NestingSelector
	| AttributeSelector
	| UniversalSelector
	| PseudoClassSelector
	| PseudoElementSelector

export type Selector = WithClone<
	CSSNode &
		WithChildren<SelectorNode> & { readonly type: typeof SELECTOR; readonly type_name: 'Selector' }
>

export type SelectorList = WithClone<
	CSSNode &
		WithChildren<Selector> & {
			readonly type: typeof SELECTOR_LIST
			readonly type_name: 'SelectorList'
		}
>

/**
 * A direct child of a Block: `Raw | Declaration | Atrule | Rule` with
 * `next_sibling` narrowed to the same union instead of generic `CSSNode`.
 * Safe since none of the four use WithChildren, avoiding TS2589.
 */
export type BlockChild = (Raw | Declaration | Atrule | Rule) &
	Toggle<'has_next', 'next_sibling', Raw | Declaration | Atrule | Rule>

export type Block = WithClone<
	CSSNode &
		WithChildren<Raw | Declaration | Atrule | Rule> & {
			readonly type: typeof BLOCK
			readonly type_name: 'Block'
			readonly is_empty: boolean
			/** Block children with next_sibling narrowed to the Block child union. */
			readonly first_child: BlockChild
			readonly children: BlockChild[]
			[Symbol.iterator](): Iterator<BlockChild>
		}
>

export type Comment = Leaf<typeof COMMENT, 'Comment'>

export type Raw = Leaf<typeof RAW, 'Raw'>

// ---------------------------------------------------------------------------
// Value nodes
// ---------------------------------------------------------------------------

type ValueLike =
	| Function
	| Identifier
	| Operator
	| Parenthesis
	| Url
	| UnicodeRange
	| String
	| Hash
	| Dimension
	| Number
	// `@supports selector(...)`'s Function node holds its argument as a parsed SelectorList
	| SelectorList
	// `style(...)`'s Function node holds its argument as a parsed SupportsDeclaration
	| SupportsDeclaration

export type Identifier = Leaf<typeof IDENTIFIER, 'Identifier', { readonly name: string }>

export type Number = Leaf<typeof NUMBER, 'Number', { readonly value: number }>

export type Dimension = Leaf<
	typeof DIMENSION,
	'Dimension',
	{
		readonly value: number
		/** Unit string, e.g. "px", "%" */
		readonly unit: string
	}
>

export type String = Leaf<typeof STRING, 'String'>

export type Hash = Leaf<typeof HASH, 'Hash'>

export type Function = WithClone<
	CSSNode &
		WithChildren<ValueLike> & {
			readonly type: typeof FUNCTION
			readonly type_name: 'Function'
			/** Function name, e.g. "rgb", "calc" */
			readonly name: string
			/** Function arguments as raw text, e.g. "255, 0, 0" for rgb(255, 0, 0) */
			readonly value: string | null
		}
>

export type Operator = Leaf<
	typeof OPERATOR,
	'Operator',
	{
		/** The operator character(s), e.g. ",", "+", "-" */
		readonly value: string
	}
>

export type Parenthesis = WithClone<
	CSSNode & WithChildren & { readonly type: typeof PARENTHESIS; readonly type_name: 'Parentheses' }
>

export type Url = Leaf<
	typeof URL,
	'Url',
	{
		/** URL content, e.g. '"image.png"' (with quotes) or 'mycursor.cur' (unquoted) */
		readonly value: string | null
	}
>

export type UnicodeRange = Leaf<typeof UNICODE_RANGE, 'UnicodeRange'>

export type Value = WithClone<
	CSSNode & WithChildren<ValueLike> & { readonly type: typeof VALUE; readonly type_name: 'Value' }
>

// ---------------------------------------------------------------------------
// Selector nodes
// ---------------------------------------------------------------------------

export type TypeSelector = Leaf<
	typeof TYPE_SELECTOR,
	'TypeSelector',
	{
		/** Local element name, e.g. "div" in both "div" and "ns|div" */
		readonly name: string
		/** Namespace prefix: null if no qualifier, '' for |div, 'ns' for ns|div, '*' for *|div */
		readonly namespace: string | null
	}
>

export type ClassSelector = Leaf<
	typeof CLASS_SELECTOR,
	'ClassSelector',
	{
		/** Class name without dot, e.g. "foo" from ".foo" */
		readonly name: string
	}
>

export type IdSelector = Leaf<
	typeof ID_SELECTOR,
	'IdSelector',
	{
		/** Id without hash, e.g. "bar" from "#bar" */
		readonly name: string
	}
>

export type AttributeSelector = Leaf<
	typeof ATTRIBUTE_SELECTOR,
	'AttributeSelector',
	{
		/** Attribute name, e.g. "href" from "[href]" */
		readonly name: string
		/** Operator string, e.g. "=", "~=", "|="; null if no operator ([attr] form) */
		readonly attr_operator: string | null
		/** Flag character, e.g. "i", "s"; null if no flag */
		readonly attr_flags: string | null
		/** Attribute value, e.g. "external" from [rel="external"] */
		readonly value: string | null
	}
>

export type PseudoClassSelector = WithClone<
	CSSNode &
		WithChildren<Selector | NthOfSelector> & {
			readonly type: typeof PSEUDO_CLASS_SELECTOR
			readonly type_name: 'PseudoClassSelector'
			/** Pseudo-class name without colon, e.g. "hover" */
			readonly name: string
		}
>

export type PseudoElementSelector = WithClone<
	CSSNode &
		WithChildren<SelectorList> & {
			readonly type: typeof PSEUDO_ELEMENT_SELECTOR
			readonly type_name: 'PseudoElementSelector'
			/** Pseudo-element name without colons, e.g. "before" */
			readonly name: string
		}
>

export type Combinator = Leaf<
	typeof COMBINATOR,
	'Combinator',
	{
		/** Combinator character(s), e.g. " ", ">", "~", "+", "||", "/deep/" */
		readonly name: string
	}
>

export type UniversalSelector = Leaf<
	typeof UNIVERSAL_SELECTOR,
	'UniversalSelector',
	{
		/** Always null — universal selector has no element name */
		readonly name: null
		/** Namespace prefix: null if no qualifier, '' for |*, 'ns' for ns|*, '*' for *|* */
		readonly namespace: string | null
	}
>

export type NestingSelector = Leaf<typeof NESTING_SELECTOR, 'NestingSelector'>

export type NthSelector = Leaf<
	typeof NTH_SELECTOR,
	'Nth',
	{
		/** The `An` part of the An+B formula, including keywords `odd`/`even`. Null when only a B value is present (e.g. `:nth-child(3)`). */
		readonly nth_a: string | null
		/** The `+B` part of the An+B formula. Null when only an A value is present (e.g. `:nth-child(2n)` or `:nth-child(odd)`). */
		readonly nth_b: string | null
	}
>

export type NthOfSelector = Leaf<
	typeof NTH_OF_SELECTOR,
	'NthOf',
	{
		/** The An+B formula node */
		readonly nth: NthSelector | null
		/** The selector list from :nth-child(An+B of <selector>) */
		readonly selector: SelectorList | null
	}
>

export type LangSelector = Leaf<
	typeof LANG_SELECTOR,
	'Lang',
	{
		/** `"nl"`, `en-US` */
		readonly name: string | null
	}
>

// ---------------------------------------------------------------------------
// At-rule prelude nodes
// ---------------------------------------------------------------------------

export type AtrulePrelude = WithClone<
	CSSNode &
		WithChildren<
			| Raw
			| MediaQuery
			| MediaType
			| ContainerQuery
			| SupportsQuery
			| LayerName
			| PreludeOperator
			| PreludeSelectorList
			| Parenthesis
			| Url
			// `@supports style(...)` / `selector(...)` function conditions
			| Function
			// `@page`, `@keyframes`, `@property`, etc. (parse_identifier())
			| Identifier
			// `@charset` (parse_charset_prelude())
			| String
		> & { readonly type: typeof AT_RULE_PRELUDE; readonly type_name: 'AtrulePrelude' }
>

export type MediaQuery = WithClone<
	CSSNode &
		WithChildren<MediaFeature | PreludeOperator | MediaType | FeatureRange> & {
			readonly type: typeof MEDIA_QUERY
			readonly type_name: 'MediaQuery'
		}
>

export type MediaFeature = Leaf<
	typeof MEDIA_FEATURE,
	'Feature',
	{
		/** Feature name, e.g. "min-width" */
		readonly property: string
		/** Feature value node, or null for boolean features like (hover) */
		readonly value: CSSNode | null
	}
>

export type MediaType = Leaf<
	typeof MEDIA_TYPE,
	'MediaType',
	{
		/** Media type text, e.g. "screen", "print" */
		readonly value: string
	}
>

export type ContainerQuery = WithClone<
	CSSNode &
		WithChildren<Identifier | MediaFeature | Function | PreludeOperator> & {
			readonly type: typeof CONTAINER_QUERY
			readonly type_name: 'ContainerQuery'
		}
>

export type SupportsQuery = WithClone<
	CSSNode &
		WithChildren<SupportsDeclaration> & {
			readonly type: typeof SUPPORTS_QUERY
			readonly type_name: 'SupportsQuery'
			/** The supports condition text, e.g. "display: flex" from "supports(display: flex)" */
			readonly value: string
		}
>

export type SupportsDeclaration = WithClone<
	CSSNode &
		WithChildren<Declaration> & {
			readonly type: typeof SUPPORTS_DECLARATION
			readonly type_name: 'SupportsDeclaration'
			/** Property name, e.g. "display" from "(display: flex)" */
			readonly property: string
			/** VALUE node for the declaration's value, e.g. "flex" from "(display: flex)" */
			readonly value: Value | null
		}
>

export type LayerName = Leaf<
	typeof LAYER_NAME,
	'Layer',
	{
		readonly name: string
		/** Alias for name — the layer name string, e.g. "base" from "layer(base)" */
		readonly value: string
	}
>

/**
 * A parenthesised selector argument in an at-rule prelude, e.g. `(.parent)`
 * in `@scope (.parent) to (.child)`. Distinct from SELECTOR_LIST, which
 * already means "matches elements", so tooling can tell scoping arguments
 * apart from real selectors. `value` is the trimmed text inside the parens.
 */
export type PreludeSelectorList = Leaf<
	typeof PRELUDE_SELECTORLIST,
	'PreludeSelectorList',
	{ readonly value: string }
>

export type PreludeOperator = Leaf<typeof PRELUDE_OPERATOR, 'Operator'>

export type FeatureRange = WithClone<
	CSSNode &
		WithChildren<Dimension | PreludeOperator> & {
			readonly type: typeof FEATURE_RANGE
			readonly type_name: 'MediaFeatureRange'
			/** The feature name in a range comparison, e.g. "width" from "(width >= 400px)" */
			readonly name: string
		}
>

// ---------------------------------------------------------------------------
// AnyCss — discriminated union of all known subtypes
//
// Enables switch/if narrowing without explicit type predicates:
//
//   walk(root, (node: AnyCss) => {
//     if (node.type === DECLARATION) { node.property /* string */ }
//   })
// ---------------------------------------------------------------------------

export type AnyNode =
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
	| SupportsDeclaration
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

export function is_stylesheet(node: CSSNode): node is StyleSheet {
	return node.type === STYLESHEET
}
export function is_rule(node: CSSNode): node is Rule {
	return node.type === STYLE_RULE
}
export function is_atrule(node: CSSNode): node is Atrule {
	return node.type === AT_RULE
}
export function is_declaration(node: CSSNode): node is Declaration {
	return node.type === DECLARATION
}
export function is_selector(node: CSSNode): node is Selector {
	return node.type === SELECTOR
}
export function is_selector_list(node: CSSNode): node is SelectorList {
	return node.type === SELECTOR_LIST
}
export function is_block(node: CSSNode): node is Block {
	return node.type === BLOCK
}
export function is_comment(node: CSSNode): node is Comment {
	return node.type === COMMENT
}
export function is_raw(node: CSSNode): node is Raw {
	return node.type === RAW
}
export function is_identifier(node: CSSNode): node is Identifier {
	return node.type === IDENTIFIER
}
export function is_number(node: CSSNode): node is Number {
	return node.type === NUMBER
}
export function is_dimension(node: CSSNode): node is Dimension {
	return node.type === DIMENSION
}
export function is_string(node: CSSNode): node is String {
	return node.type === STRING
}
export function is_hash(node: CSSNode): node is Hash {
	return node.type === HASH
}
export function is_function(node: CSSNode): node is Function {
	return node.type === FUNCTION
}
export function is_operator(node: CSSNode): node is Operator {
	return node.type === OPERATOR
}
export function is_parenthesis(node: CSSNode): node is Parenthesis {
	return node.type === PARENTHESIS
}
export function is_url(node: CSSNode): node is Url {
	return node.type === URL
}
export function is_unicode_range(node: CSSNode): node is UnicodeRange {
	return node.type === UNICODE_RANGE
}
export function is_value(node: CSSNode): node is Value {
	return node.type === VALUE
}
export function is_type_selector(node: CSSNode): node is TypeSelector {
	return node.type === TYPE_SELECTOR
}
export function is_class_selector(node: CSSNode): node is ClassSelector {
	return node.type === CLASS_SELECTOR
}
export function is_id_selector(node: CSSNode): node is IdSelector {
	return node.type === ID_SELECTOR
}
export function is_attribute_selector(node: CSSNode): node is AttributeSelector {
	return node.type === ATTRIBUTE_SELECTOR
}
export function is_pseudo_class_selector(node: CSSNode): node is PseudoClassSelector {
	return node.type === PSEUDO_CLASS_SELECTOR
}
export function is_pseudo_element_selector(node: CSSNode): node is PseudoElementSelector {
	return node.type === PSEUDO_ELEMENT_SELECTOR
}
export function is_combinator(node: CSSNode): node is Combinator {
	return node.type === COMBINATOR
}
export function is_universal_selector(node: CSSNode): node is UniversalSelector {
	return node.type === UNIVERSAL_SELECTOR
}
export function is_nesting_selector(node: CSSNode): node is NestingSelector {
	return node.type === NESTING_SELECTOR
}
export function is_nth_selector(node: CSSNode): node is NthSelector {
	return node.type === NTH_SELECTOR
}
export function is_nth_of_selector(node: CSSNode): node is NthOfSelector {
	return node.type === NTH_OF_SELECTOR
}
export function is_lang_selector(node: CSSNode): node is LangSelector {
	return node.type === LANG_SELECTOR
}
export function is_atrule_prelude(node: CSSNode): node is AtrulePrelude {
	return node.type === AT_RULE_PRELUDE
}
export function is_media_query(node: CSSNode): node is MediaQuery {
	return node.type === MEDIA_QUERY
}
export function is_media_feature(node: CSSNode): node is MediaFeature {
	return node.type === MEDIA_FEATURE
}
export function is_media_type(node: CSSNode): node is MediaType {
	return node.type === MEDIA_TYPE
}
export function is_container_query(node: CSSNode): node is ContainerQuery {
	return node.type === CONTAINER_QUERY
}
export function is_supports_query(node: CSSNode): node is SupportsQuery {
	return node.type === SUPPORTS_QUERY
}
export function is_supports_declaration(node: CSSNode): node is SupportsDeclaration {
	return node.type === SUPPORTS_DECLARATION
}
export function is_layer_name(node: CSSNode): node is LayerName {
	return node.type === LAYER_NAME
}
export function is_prelude_operator(node: CSSNode): node is PreludeOperator {
	return node.type === PRELUDE_OPERATOR
}
export function is_feature_range(node: CSSNode): node is FeatureRange {
	return node.type === FEATURE_RANGE
}
export function is_prelude_selectorlist(node: CSSNode): node is PreludeSelectorList {
	return node.type === PRELUDE_SELECTORLIST
}
