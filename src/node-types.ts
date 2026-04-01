// CSS Node subtypes — zero-cost TypeScript narrowing layer
//
// Design: every subtype extends CssNodeCommon (an internal interface with only
// universal properties) rather than CSSNode directly. This means only the
// properties that are meaningful for a given node type appear in autocomplete —
// irrelevant getters like `unit` on a DeclarationNode are simply absent.
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

interface CssNodeCommon {
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

export interface StyleSheetNode extends CssNodeCommon {
	readonly type: typeof STYLESHEET
}

export interface RuleNode extends CssNodeCommon {
	readonly type: typeof STYLE_RULE
	readonly name: string
	/** SELECTOR_LIST (parse_selectors=true) or SELECTOR, or null */
	readonly prelude: SelectorListNode | SelectorNode | null
	readonly block: BlockNode | null
	readonly has_prelude: boolean
	readonly has_block: boolean
	readonly has_declarations: boolean
}

export interface AtruleNode extends CssNodeCommon {
	readonly type: typeof AT_RULE
	/** At-rule keyword, e.g. "media", "keyframes" */
	readonly name: string
	/** AT_RULE_PRELUDE (parse_atrule_preludes=true) or RAW, or null */
	readonly prelude: AtrulePreludeNode | RawNode | null
	readonly block: BlockNode | null
	readonly has_prelude: boolean
	readonly has_block: boolean
	readonly has_declarations: boolean
}

export interface DeclarationNode extends CssNodeCommon {
	readonly type: typeof DECLARATION
	/** Property name, e.g. "color" */
	readonly property: string
	/** VALUE node (parse_values=true), raw string, or null */
	readonly value: ValueNode | string | null
	readonly is_important: boolean
	readonly is_browserhack: boolean
}

export interface SelectorNode extends CssNodeCommon {
	readonly type: typeof SELECTOR
}

export interface SelectorListNode extends CssNodeCommon {
	readonly type: typeof SELECTOR_LIST
}

export interface BlockNode extends CssNodeCommon {
	readonly type: typeof BLOCK
	readonly is_empty: boolean
}

export interface CommentNode extends CssNodeCommon {
	readonly type: typeof COMMENT
}

export interface RawNode extends CssNodeCommon {
	readonly type: typeof RAW
}

// ---------------------------------------------------------------------------
// Value nodes
// ---------------------------------------------------------------------------

export interface IdentifierNode extends CssNodeCommon {
	readonly type: typeof IDENTIFIER
	readonly name: string
}

export interface NumberNode extends CssNodeCommon {
	readonly type: typeof NUMBER
	readonly value: number
	readonly value_as_number: number
}

export interface DimensionNode extends CssNodeCommon {
	readonly type: typeof DIMENSION
	readonly value: number
	readonly value_as_number: number
	/** Unit string, e.g. "px", "%" */
	readonly unit: string
}

export interface StringNode extends CssNodeCommon {
	readonly type: typeof STRING
}

export interface HashNode extends CssNodeCommon {
	readonly type: typeof HASH
}

export interface FunctionNode extends CssNodeCommon {
	readonly type: typeof FUNCTION
	/** Function name, e.g. "rgb", "calc" */
	readonly name: string
}

export interface OperatorNode extends CssNodeCommon {
	readonly type: typeof OPERATOR
}

export interface ParenthesisNode extends CssNodeCommon {
	readonly type: typeof PARENTHESIS
}

export interface UrlNode extends CssNodeCommon {
	readonly type: typeof URL
}

export interface UnicodeRangeNode extends CssNodeCommon {
	readonly type: typeof UNICODE_RANGE
}

export interface ValueNode extends CssNodeCommon {
	readonly type: typeof VALUE
}

// ---------------------------------------------------------------------------
// Selector nodes
// ---------------------------------------------------------------------------

export interface TypeSelectorNode extends CssNodeCommon {
	readonly type: typeof TYPE_SELECTOR
	/** Element type, e.g. "div", "span" */
	readonly name: string
}

export interface ClassSelectorNode extends CssNodeCommon {
	readonly type: typeof CLASS_SELECTOR
	/** Class name without dot, e.g. "foo" from ".foo" */
	readonly name: string
}

export interface IdSelectorNode extends CssNodeCommon {
	readonly type: typeof ID_SELECTOR
	/** Id without hash, e.g. "bar" from "#bar" */
	readonly name: string
}

export interface AttributeSelectorNode extends CssNodeCommon {
	readonly type: typeof ATTRIBUTE_SELECTOR
	/** Attribute name, e.g. "href" from "[href]" */
	readonly name: string
	/** One of the ATTR_OPERATOR_* constants */
	readonly attr_operator: number
	/** One of the ATTR_FLAG_* constants */
	readonly attr_flags: number
}

export interface PseudoClassSelectorNode extends CssNodeCommon {
	readonly type: typeof PSEUDO_CLASS_SELECTOR
	/** Pseudo-class name without colon, e.g. "hover" */
	readonly name: string
	/** Selector list for functional pseudo-classes like :is(), :not(), :has() */
	readonly selector_list: SelectorListNode | undefined
}

export interface PseudoElementSelectorNode extends CssNodeCommon {
	readonly type: typeof PSEUDO_ELEMENT_SELECTOR
	/** Pseudo-element name without colons, e.g. "before" */
	readonly name: string
}

export interface CombinatorNode extends CssNodeCommon {
	readonly type: typeof COMBINATOR
	readonly name: string
}

export interface UniversalSelectorNode extends CssNodeCommon {
	readonly type: typeof UNIVERSAL_SELECTOR
}

export interface NestingSelectorNode extends CssNodeCommon {
	readonly type: typeof NESTING_SELECTOR
}

export interface NthSelectorNode extends CssNodeCommon {
	readonly type: typeof NTH_SELECTOR
	readonly nth_a: string | undefined
	readonly nth_b: string | undefined
}

export interface NthOfSelectorNode extends CssNodeCommon {
	readonly type: typeof NTH_OF_SELECTOR
	readonly nth_a: string | undefined
	readonly nth_b: string | undefined
	/** The An+B formula node */
	readonly nth: NthSelectorNode | undefined
	/** The selector list from :nth-child(An+B of <selector>) */
	readonly selector: SelectorListNode | undefined
}

export interface LangSelectorNode extends CssNodeCommon {
	readonly type: typeof LANG_SELECTOR
}

// ---------------------------------------------------------------------------
// At-rule prelude nodes
// ---------------------------------------------------------------------------

export interface AtrulePreludeNode extends CssNodeCommon {
	readonly type: typeof AT_RULE_PRELUDE
}

export interface MediaQueryNode extends CssNodeCommon {
	readonly type: typeof MEDIA_QUERY
}

export interface MediaFeatureNode extends CssNodeCommon {
	readonly type: typeof MEDIA_FEATURE
	/** Feature name, e.g. "min-width" */
	readonly property: string
}

export interface MediaTypeNode extends CssNodeCommon {
	readonly type: typeof MEDIA_TYPE
}

export interface ContainerQueryNode extends CssNodeCommon {
	readonly type: typeof CONTAINER_QUERY
}

export interface SupportsQueryNode extends CssNodeCommon {
	readonly type: typeof SUPPORTS_QUERY
}

export interface LayerNameNode extends CssNodeCommon {
	readonly type: typeof LAYER_NAME
	readonly name: string
}

export interface PreludeOperatorNode extends CssNodeCommon {
	readonly type: typeof PRELUDE_OPERATOR
}

export interface FeatureRangeNode extends CssNodeCommon {
	readonly type: typeof FEATURE_RANGE
}

// ---------------------------------------------------------------------------
// AnyCssNode — discriminated union of all known subtypes
//
// Enables switch/if narrowing without explicit type predicates:
//
//   walk(root, (node: AnyCssNode) => {
//     if (node.type === DECLARATION) { node.property /* string */ }
//   })
// ---------------------------------------------------------------------------

export type AnyCssNode =
	| StyleSheetNode
	| RuleNode
	| AtruleNode
	| DeclarationNode
	| SelectorNode
	| SelectorListNode
	| BlockNode
	| CommentNode
	| RawNode
	| IdentifierNode
	| NumberNode
	| DimensionNode
	| StringNode
	| HashNode
	| FunctionNode
	| OperatorNode
	| ParenthesisNode
	| UrlNode
	| UnicodeRangeNode
	| ValueNode
	| TypeSelectorNode
	| ClassSelectorNode
	| IdSelectorNode
	| AttributeSelectorNode
	| PseudoClassSelectorNode
	| PseudoElementSelectorNode
	| CombinatorNode
	| UniversalSelectorNode
	| NestingSelectorNode
	| NthSelectorNode
	| NthOfSelectorNode
	| LangSelectorNode
	| AtrulePreludeNode
	| MediaQueryNode
	| MediaFeatureNode
	| MediaTypeNode
	| ContainerQueryNode
	| SupportsQueryNode
	| LayerNameNode
	| PreludeOperatorNode
	| FeatureRangeNode

// ---------------------------------------------------------------------------
// Type predicate functions
//
// Each compiles to a single integer comparison — zero heap allocation.
// Parameter type is CssNodeCommon; CSSNode satisfies CssNodeCommon
// structurally, so no cast is needed at call sites.
// ---------------------------------------------------------------------------

export function is_stylesheet(node: CssNodeCommon): node is StyleSheetNode {
	return node.type === STYLESHEET
}
export function is_rule(node: CssNodeCommon): node is RuleNode {
	return node.type === STYLE_RULE
}
export function is_atrule(node: CssNodeCommon): node is AtruleNode {
	return node.type === AT_RULE
}
export function is_declaration(node: CssNodeCommon): node is DeclarationNode {
	return node.type === DECLARATION
}
export function is_selector(node: CssNodeCommon): node is SelectorNode {
	return node.type === SELECTOR
}
export function is_selector_list(node: CssNodeCommon): node is SelectorListNode {
	return node.type === SELECTOR_LIST
}
export function is_block(node: CssNodeCommon): node is BlockNode {
	return node.type === BLOCK
}
export function is_comment(node: CssNodeCommon): node is CommentNode {
	return node.type === COMMENT
}
export function is_raw(node: CssNodeCommon): node is RawNode {
	return node.type === RAW
}
export function is_identifier(node: CssNodeCommon): node is IdentifierNode {
	return node.type === IDENTIFIER
}
export function is_number(node: CssNodeCommon): node is NumberNode {
	return node.type === NUMBER
}
export function is_dimension(node: CssNodeCommon): node is DimensionNode {
	return node.type === DIMENSION
}
export function is_string(node: CssNodeCommon): node is StringNode {
	return node.type === STRING
}
export function is_hash(node: CssNodeCommon): node is HashNode {
	return node.type === HASH
}
export function is_function(node: CssNodeCommon): node is FunctionNode {
	return node.type === FUNCTION
}
export function is_operator(node: CssNodeCommon): node is OperatorNode {
	return node.type === OPERATOR
}
export function is_parenthesis(node: CssNodeCommon): node is ParenthesisNode {
	return node.type === PARENTHESIS
}
export function is_url(node: CssNodeCommon): node is UrlNode {
	return node.type === URL
}
export function is_unicode_range(node: CssNodeCommon): node is UnicodeRangeNode {
	return node.type === UNICODE_RANGE
}
export function is_value(node: CssNodeCommon): node is ValueNode {
	return node.type === VALUE
}
export function is_type_selector(node: CssNodeCommon): node is TypeSelectorNode {
	return node.type === TYPE_SELECTOR
}
export function is_class_selector(node: CssNodeCommon): node is ClassSelectorNode {
	return node.type === CLASS_SELECTOR
}
export function is_id_selector(node: CssNodeCommon): node is IdSelectorNode {
	return node.type === ID_SELECTOR
}
export function is_attribute_selector(node: CssNodeCommon): node is AttributeSelectorNode {
	return node.type === ATTRIBUTE_SELECTOR
}
export function is_pseudo_class_selector(node: CssNodeCommon): node is PseudoClassSelectorNode {
	return node.type === PSEUDO_CLASS_SELECTOR
}
export function is_pseudo_element_selector(node: CssNodeCommon): node is PseudoElementSelectorNode {
	return node.type === PSEUDO_ELEMENT_SELECTOR
}
export function is_combinator(node: CssNodeCommon): node is CombinatorNode {
	return node.type === COMBINATOR
}
export function is_universal_selector(node: CssNodeCommon): node is UniversalSelectorNode {
	return node.type === UNIVERSAL_SELECTOR
}
export function is_nesting_selector(node: CssNodeCommon): node is NestingSelectorNode {
	return node.type === NESTING_SELECTOR
}
export function is_nth_selector(node: CssNodeCommon): node is NthSelectorNode {
	return node.type === NTH_SELECTOR
}
export function is_nth_of_selector(node: CssNodeCommon): node is NthOfSelectorNode {
	return node.type === NTH_OF_SELECTOR
}
export function is_lang_selector(node: CssNodeCommon): node is LangSelectorNode {
	return node.type === LANG_SELECTOR
}
export function is_atrule_prelude(node: CssNodeCommon): node is AtrulePreludeNode {
	return node.type === AT_RULE_PRELUDE
}
export function is_media_query(node: CssNodeCommon): node is MediaQueryNode {
	return node.type === MEDIA_QUERY
}
export function is_media_feature(node: CssNodeCommon): node is MediaFeatureNode {
	return node.type === MEDIA_FEATURE
}
export function is_media_type(node: CssNodeCommon): node is MediaTypeNode {
	return node.type === MEDIA_TYPE
}
export function is_container_query(node: CssNodeCommon): node is ContainerQueryNode {
	return node.type === CONTAINER_QUERY
}
export function is_supports_query(node: CssNodeCommon): node is SupportsQueryNode {
	return node.type === SUPPORTS_QUERY
}
export function is_layer_name(node: CssNodeCommon): node is LayerNameNode {
	return node.type === LAYER_NAME
}
export function is_prelude_operator(node: CssNodeCommon): node is PreludeOperatorNode {
	return node.type === PRELUDE_OPERATOR
}
export function is_feature_range(node: CssNodeCommon): node is FeatureRangeNode {
	return node.type === FEATURE_RANGE
}
