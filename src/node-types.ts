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

/**
 * A child of a WithChildren<T> parent: T intersected with a narrowed
 * has_next / next_sibling discriminated union so that next_sibling is typed as
 * S instead of the generic CSSNode.
 *
 * Uses plain intersection rather than Omit to keep instantiation shallow:
 * Omit forces TypeScript to enumerate every key of U (triggering recursive
 * expansion through the whole node graph), while a bare intersection is stored
 * lazily and never causes TS2589.  The conditional is distributive in U so
 * each union member keeps its own type discriminant.
 */
type _ChildOf<U, S> = U extends unknown
	? U & (
			| { readonly has_next: false; readonly next_sibling: null }
			| { readonly has_next: true; readonly next_sibling: S }
	  )
	: never

/** A child of a WithChildren<T> parent, with next_sibling narrowed to T. */
type ChildOf<T extends CSSNode> = _ChildOf<T, T>

/**
 * Mixin for node types that have child nodes.
 *
 * Only a subset of node types expose children — structural and container nodes
 * like StyleSheet, Block, SelectorList, Value, Function, etc. Leaf nodes
 * (Identifier, Number, Dimension, …) do not extend WithChildren, reflecting
 * that they never carry child nodes in a well-formed tree.
 *
 * Children are typed as ChildOf<T> so that next_sibling on any child is
 * narrowed to T (the same union as the other children of this parent) rather
 * than the generic CSSNode.
 */
export interface WithChildren<T extends CSSNode = AnyNode> {
	readonly has_children: boolean
	readonly child_count: number
	readonly children: ChildOf<T>[]
	readonly first_child: ChildOf<T>
	[Symbol.iterator](): Iterator<ChildOf<T>>
}

/**
 * Maps a CssNodeCommon subtype interface to its plain-object equivalent,
 * as returned by clone().
 *
 * The result is always a subtype of PlainCSSNode (the intersection starts
 * with PlainCSSNode), with two additions:
 *  - `type` is narrowed to T's specific literal (enables discriminated unions)
 *  - subtype-specific properties (those not on CssNodeCommon) are added with
 *    CssNodeCommon references replaced by PlainCSSNode
 *
 * Traversal properties (first_child, next_sibling, etc.) are excluded since
 * they live on CssNodeCommon and are never serialised by clone().
 *
 *   const rule = root.first_child as Rule
 *   rule.clone().prelude   // PlainCSSNode | null  — not PlainCSSNode | undefined
 *   rule.clone().block     // PlainCSSNode | null
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

export type StyleSheet = CSSNode &
	WithChildren & {
		readonly type: typeof STYLESHEET
		clone(options?: CloneOptions): ToPlain<StyleSheet>
	}

export type Rule = CSSNode & {
	readonly type: typeof STYLE_RULE
	readonly name: string
	readonly has_declarations: boolean
	clone(options?: CloneOptions): ToPlain<Rule>
} &
	/** SELECTOR_LIST (parse_selectors=true) or RAW (parse_selectors=false) */
	(
		| { readonly has_prelude: true; readonly prelude: SelectorList | Raw }
		| { readonly has_prelude: false; readonly prelude: null }
	) &
	(
		| { readonly has_block: true; readonly block: Block }
		| { readonly has_block: false; readonly block: null }
	)

export type Atrule = CSSNode & {
	readonly type: typeof AT_RULE
	/** At-rule keyword, e.g. "media", "keyframes" */
	readonly name: string
	readonly has_declarations: boolean
	clone(options?: CloneOptions): ToPlain<Atrule>
} &
	/** AT_RULE_PRELUDE (parse_atrule_preludes=true) or RAW (parse_atrule_preludes=false) */
	(
		| { readonly has_prelude: true; readonly prelude: AtrulePrelude | Raw }
		| { readonly has_prelude: false; readonly prelude: null }
	) &
	(
		| { readonly has_block: true; readonly block: Block }
		| { readonly has_block: false; readonly block: null }
	)

export type Declaration = CSSNode & {
	readonly type: typeof DECLARATION
	/** Property name, e.g. "color" */
	readonly property: string
	/** VALUE node (parse_values=true), RAW node (parse_values=false), or null */
	readonly value: Value | Raw | null
	readonly is_important: boolean
	readonly is_browserhack: boolean
	clone(options?: CloneOptions): ToPlain<Declaration>
}

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

export type Selector = CSSNode &
	WithChildren<SelectorNode> & {
		readonly type: typeof SELECTOR
		clone(options?: CloneOptions): ToPlain<Selector>
	}

export type SelectorList = CSSNode &
	WithChildren<Selector> & {
		readonly type: typeof SELECTOR_LIST
		clone(options?: CloneOptions): ToPlain<SelectorList>
	}

export type Block = CSSNode &
	WithChildren<Raw | Declaration | Atrule | Rule> & {
		readonly type: typeof BLOCK
		readonly is_empty: boolean
		clone(options?: CloneOptions): ToPlain<Block>
	}

export type Comment = CSSNode & {
	readonly type: typeof COMMENT
	clone(options?: CloneOptions): ToPlain<Comment>
}

export type Raw = CSSNode & {
	readonly type: typeof RAW
	clone(options?: CloneOptions): ToPlain<Raw>
}

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

export type Identifier = CSSNode & {
	readonly type: typeof IDENTIFIER
	readonly name: string
	clone(options?: CloneOptions): ToPlain<Identifier>
}

export type Number = CSSNode & {
	readonly type: typeof NUMBER
	readonly value: number
	clone(options?: CloneOptions): ToPlain<Number>
}

export type Dimension = CSSNode & {
	readonly type: typeof DIMENSION
	readonly value: number
	/** Unit string, e.g. "px", "%" */
	readonly unit: string
	clone(options?: CloneOptions): ToPlain<Dimension>
}

export type String = CSSNode & {
	readonly type: typeof STRING
	clone(options?: CloneOptions): ToPlain<String>
}

export type Hash = CSSNode & {
	readonly type: typeof HASH
	clone(options?: CloneOptions): ToPlain<Hash>
}

export type Function = CSSNode &
	WithChildren<ValueLike> & {
		readonly type: typeof FUNCTION
		/** Function name, e.g. "rgb", "calc" */
		readonly name: string
		/** Function arguments as raw text, e.g. "255, 0, 0" for rgb(255, 0, 0) */
		readonly value: string | null
		clone(options?: CloneOptions): ToPlain<Function>
	}

export type Operator = CSSNode & {
	readonly type: typeof OPERATOR
	/** The operator character(s), e.g. ",", "+", "-" */
	readonly value: string
	clone(options?: CloneOptions): ToPlain<Operator>
}

export type Parenthesis = CSSNode &
	WithChildren & {
		readonly type: typeof PARENTHESIS
		clone(options?: CloneOptions): ToPlain<Parenthesis>
	}

export type Url = CSSNode & {
	readonly type: typeof URL
	/** URL content, e.g. '"image.png"' (with quotes) or 'mycursor.cur' (unquoted) */
	readonly value: string | null
	clone(options?: CloneOptions): ToPlain<Url>
}

export type UnicodeRange = CSSNode & {
	readonly type: typeof UNICODE_RANGE
	clone(options?: CloneOptions): ToPlain<UnicodeRange>
}

export type Value = CSSNode &
	WithChildren<ValueLike> & {
		readonly type: typeof VALUE
		clone(options?: CloneOptions): ToPlain<Value>
	}

// ---------------------------------------------------------------------------
// Selector nodes
// ---------------------------------------------------------------------------

export type TypeSelector = CSSNode & {
	readonly type: typeof TYPE_SELECTOR
	/** Element type, e.g. "div", "span" */
	readonly name: string
	clone(options?: CloneOptions): ToPlain<TypeSelector>
}

export type ClassSelector = CSSNode & {
	readonly type: typeof CLASS_SELECTOR
	/** Class name without dot, e.g. "foo" from ".foo" */
	readonly name: string
	clone(options?: CloneOptions): ToPlain<ClassSelector>
}

export type IdSelector = CSSNode & {
	readonly type: typeof ID_SELECTOR
	/** Id without hash, e.g. "bar" from "#bar" */
	readonly name: string
	clone(options?: CloneOptions): ToPlain<IdSelector>
}

export type AttributeSelector = CSSNode & {
	readonly type: typeof ATTRIBUTE_SELECTOR
	/** Attribute name, e.g. "href" from "[href]" */
	readonly name: string
	/** Operator string, e.g. "=", "~=", "|="; null if no operator ([attr] form) */
	readonly attr_operator: string | null
	/** Flag character, e.g. "i", "s"; null if no flag */
	readonly attr_flags: string | null
	/** Attribute value, e.g. "external" from [rel="external"] */
	readonly value: string | null
	clone(options?: CloneOptions): ToPlain<AttributeSelector>
}

export type PseudoClassSelector = CSSNode &
	WithChildren<Selector | NthOfSelector> & {
		readonly type: typeof PSEUDO_CLASS_SELECTOR
		/** Pseudo-class name without colon, e.g. "hover" */
		readonly name: string
		clone(options?: CloneOptions): ToPlain<PseudoClassSelector>
	}

export type PseudoElementSelector = CSSNode &
	WithChildren<SelectorList> & {
		readonly type: typeof PSEUDO_ELEMENT_SELECTOR
		/** Pseudo-element name without colons, e.g. "before" */
		readonly name: string
		clone(options?: CloneOptions): ToPlain<PseudoElementSelector>
	}

export type Combinator = CSSNode & {
	readonly type: typeof COMBINATOR
	/** Combinator character(s), e.g. " ", ">", "~", "+", "||", "/deep/" */
	readonly name: string
	clone(options?: CloneOptions): ToPlain<Combinator>
}

export type UniversalSelector = CSSNode & {
	readonly type: typeof UNIVERSAL_SELECTOR
	/** Namespace qualifier (e.g. 'ns' in 'ns|*'), null if no namespace */
	readonly name: string | null
	clone(options?: CloneOptions): ToPlain<UniversalSelector>
}

export type NestingSelector = CSSNode & {
	readonly type: typeof NESTING_SELECTOR
	clone(options?: CloneOptions): ToPlain<NestingSelector>
}

export type NthSelector = CSSNode & {
	readonly type: typeof NTH_SELECTOR
	/** The `An` part of the An+B formula, including keywords `odd`/`even`. Null when only a B value is present (e.g. `:nth-child(3)`). */
	readonly nth_a: string | null
	/** The `+B` part of the An+B formula. Null when only an A value is present (e.g. `:nth-child(2n)` or `:nth-child(odd)`). */
	readonly nth_b: string | null
	clone(options?: CloneOptions): ToPlain<NthSelector>
}

export type NthOfSelector = CSSNode & {
	readonly type: typeof NTH_OF_SELECTOR
	/** The An+B formula node */
	readonly nth: NthSelector | null
	/** The selector list from :nth-child(An+B of <selector>) */
	readonly selector: SelectorList | null
	clone(options?: CloneOptions): ToPlain<NthOfSelector>
}

export type LangSelector = CSSNode & {
	readonly type: typeof LANG_SELECTOR
	/** `"nl"`, `en-US` */
	readonly name: string | null
	clone(options?: CloneOptions): ToPlain<LangSelector>
}

// ---------------------------------------------------------------------------
// At-rule prelude nodes
// ---------------------------------------------------------------------------

export type AtrulePrelude = CSSNode &
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
	> & {
		readonly type: typeof AT_RULE_PRELUDE
		clone(options?: CloneOptions): ToPlain<AtrulePrelude>
	}

export type MediaQuery = CSSNode &
	WithChildren<MediaFeature | PreludeOperator | MediaType | FeatureRange> & {
		readonly type: typeof MEDIA_QUERY
		clone(options?: CloneOptions): ToPlain<MediaQuery>
	}

export type MediaFeature = CSSNode &
	WithChildren & {
		readonly type: typeof MEDIA_FEATURE
		/** Feature name, e.g. "min-width" */
		readonly property: string
		clone(options?: CloneOptions): ToPlain<MediaFeature>
	}

export type MediaType = CSSNode & {
	readonly type: typeof MEDIA_TYPE
	/** Media type text, e.g. "screen", "print" */
	readonly value: string
	clone(options?: CloneOptions): ToPlain<MediaType>
}

export type ContainerQuery = CSSNode &
	WithChildren<Identifier | MediaFeature | Function> & {
		readonly type: typeof CONTAINER_QUERY
		clone(options?: CloneOptions): ToPlain<ContainerQuery>
	}

export type SupportsQuery = CSSNode & {
	readonly type: typeof SUPPORTS_QUERY
	/** The supports condition text, e.g. "display: flex" from "supports(display: flex)" */
	readonly value: string
	clone(options?: CloneOptions): ToPlain<SupportsQuery>
}

export type LayerName = CSSNode & {
	readonly type: typeof LAYER_NAME
	readonly name: string
	/** Alias for name — the layer name string, e.g. "base" from "layer(base)" */
	readonly value: string
	clone(options?: CloneOptions): ToPlain<LayerName>
}

/**
 * A parenthesised selector argument in an at-rule prelude.
 *
 * This node type exists because at-rule preludes that contain selectors (like
 * @scope) cannot reuse SELECTOR_LIST: that type already appears inside the
 * rule's block, and mixing the two would make traversal ambiguous. A distinct
 * type lets walkers and tooling distinguish "this is a selector used as a
 * scoping argument" from "this is a selector that matches elements".
 *
 * Currently produced only by @scope:
 *   @scope (.parent) to (.child) { }
 *          ^^^^^^^^^    ^^^^^^^^  — each parenthesised group is a PRELUDE_SELECTORLIST
 *
 * `value` is the raw selector text inside the parentheses, trimmed of
 * whitespace: ".parent" from "(.parent)".
 */
export type PreludeSelectorList = CSSNode & {
	readonly type: typeof PRELUDE_SELECTORLIST
	readonly value: string
	clone(options?: CloneOptions): ToPlain<PreludeSelectorList>
}

export type PreludeOperator = CSSNode & {
	readonly type: typeof PRELUDE_OPERATOR
	clone(options?: CloneOptions): ToPlain<PreludeOperator>
}

export type FeatureRange = CSSNode &
	WithChildren<Dimension | Operator> & {
		readonly type: typeof FEATURE_RANGE
		/** The feature name in a range comparison, e.g. "width" from "(width >= 400px)" */
		readonly name: string
		clone(options?: CloneOptions): ToPlain<FeatureRange>
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
