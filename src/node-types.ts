// CSS Node subtypes — zero-cost TypeScript narrowing layer
//
// Each interface extends CSSNode and overrides property types to reflect what
// a specific node type actually returns, removing spurious `undefined` from
// type-specific properties.
//
// Use the is_* type predicates to narrow a CSSNode to a specific subtype:
//
//   if (is_declaration(node)) {
//     node.property   // string  (not string | undefined)
//     node.is_important  // boolean (not boolean | undefined)
//   }
//
// Or use AnyCssNode with a switch for exhaustive narrowing:
//
//   function process(node: AnyCssNode) {
//     switch (node.type) {
//       case DECLARATION: node.property; break   // string
//       case DIMENSION:   node.unit; break        // string
//     }
//   }
//
// All interfaces are erased at compile time — zero bytes in the JS output.
// Type predicates compile to a single integer comparison each.

import type { CSSNode } from './css-node'
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
// Structural nodes
// ---------------------------------------------------------------------------

export interface StyleSheetNode extends CSSNode {
	readonly type: typeof STYLESHEET
}

export interface RuleNode extends CSSNode {
	readonly type: typeof STYLE_RULE
	/** SELECTOR_LIST or SELECTOR — never undefined for style rules */
	readonly prelude: CSSNode | null
	/** BLOCK node — never undefined for style rules */
	readonly block: CSSNode | null
}

export interface AtruleNode extends CSSNode {
	readonly type: typeof AT_RULE
	/** At-rule name, e.g. "media", "keyframes" — always a string */
	readonly name: string
	/** AT_RULE_PRELUDE or RAW — never undefined for at-rules */
	readonly prelude: CSSNode | null
	/** BLOCK node — never undefined for at-rules */
	readonly block: CSSNode | null
	/** At-rules never have a value */
	readonly value: undefined
}

export interface DeclarationNode extends CSSNode {
	readonly type: typeof DECLARATION
	/** Property name, e.g. "color" — always a string */
	readonly property: string
	/** `name` does not apply to declarations */
	readonly name: undefined
	/** VALUE node (parse_values=true), raw string, or null */
	readonly value: CSSNode | string | null
	/** Always a boolean for declarations */
	readonly is_important: boolean
	/** Always a boolean for declarations */
	readonly is_browserhack: boolean
	/** Declarations have no prelude */
	readonly prelude: undefined
	/** Declarations have no block */
	readonly block: null
}

export interface SelectorNode extends CSSNode {
	readonly type: typeof SELECTOR
}

export interface SelectorListNode extends CSSNode {
	readonly type: typeof SELECTOR_LIST
}

export interface BlockNode extends CSSNode {
	readonly type: typeof BLOCK
	/** Always a boolean for blocks */
	readonly is_empty: boolean
}

export interface CommentNode extends CSSNode {
	readonly type: typeof COMMENT
}

export interface RawNode extends CSSNode {
	readonly type: typeof RAW
}

// ---------------------------------------------------------------------------
// Value nodes
// ---------------------------------------------------------------------------

export interface IdentifierNode extends CSSNode {
	readonly type: typeof IDENTIFIER
	/** Identifier value — always a string */
	readonly name: string
}

export interface NumberNode extends CSSNode {
	readonly type: typeof NUMBER
	/** Always a number */
	readonly value: number
	/** Always a number, never null */
	readonly value_as_number: number
}

export interface DimensionNode extends CSSNode {
	readonly type: typeof DIMENSION
	/** Numeric part — always a number */
	readonly value: number
	/** Numeric part — always a number, never null */
	readonly value_as_number: number
	/** Unit string, e.g. "px", "%" — always present */
	readonly unit: string
}

export interface StringNode extends CSSNode {
	readonly type: typeof STRING
}

export interface HashNode extends CSSNode {
	readonly type: typeof HASH
}

export interface FunctionNode extends CSSNode {
	readonly type: typeof FUNCTION
	/** Function name, e.g. "rgb", "calc" — always a string */
	readonly name: string
}

export interface OperatorNode extends CSSNode {
	readonly type: typeof OPERATOR
}

export interface ParenthesisNode extends CSSNode {
	readonly type: typeof PARENTHESIS
}

export interface UrlNode extends CSSNode {
	readonly type: typeof URL
}

export interface UnicodeRangeNode extends CSSNode {
	readonly type: typeof UNICODE_RANGE
}

export interface ValueNode extends CSSNode {
	readonly type: typeof VALUE
}

// ---------------------------------------------------------------------------
// Selector nodes
// ---------------------------------------------------------------------------

export interface TypeSelectorNode extends CSSNode {
	readonly type: typeof TYPE_SELECTOR
	/** Element name, e.g. "div", "span" — always a string */
	readonly name: string
}

export interface ClassSelectorNode extends CSSNode {
	readonly type: typeof CLASS_SELECTOR
	/** Class name without dot, e.g. "foo" from ".foo" — always a string */
	readonly name: string
}

export interface IdSelectorNode extends CSSNode {
	readonly type: typeof ID_SELECTOR
	/** Id without hash, e.g. "foo" from "#foo" — always a string */
	readonly name: string
}

export interface AttributeSelectorNode extends CSSNode {
	readonly type: typeof ATTRIBUTE_SELECTOR
	/** ATTR_OPERATOR_* constant — always present */
	readonly attr_operator: number
	/** ATTR_FLAG_* constant — always present */
	readonly attr_flags: number
}

export interface PseudoClassSelectorNode extends CSSNode {
	readonly type: typeof PSEUDO_CLASS_SELECTOR
	/** Pseudo-class name without colon, e.g. "hover" — always a string */
	readonly name: string
	/** Selector list for functional pseudo-classes like :is(), :not(), :has() */
	readonly selector_list: CSSNode | undefined
}

export interface PseudoElementSelectorNode extends CSSNode {
	readonly type: typeof PSEUDO_ELEMENT_SELECTOR
	/** Pseudo-element name without colons, e.g. "before" — always a string */
	readonly name: string
}

export interface CombinatorNode extends CSSNode {
	readonly type: typeof COMBINATOR
}

export interface UniversalSelectorNode extends CSSNode {
	readonly type: typeof UNIVERSAL_SELECTOR
}

export interface NestingSelectorNode extends CSSNode {
	readonly type: typeof NESTING_SELECTOR
}

export interface NthSelectorNode extends CSSNode {
	readonly type: typeof NTH_SELECTOR
	readonly nth_a: string | undefined
	readonly nth_b: string | undefined
}

export interface NthOfSelectorNode extends CSSNode {
	readonly type: typeof NTH_OF_SELECTOR
	readonly nth_a: string | undefined
	readonly nth_b: string | undefined
	readonly nth: CSSNode | undefined
	readonly selector: CSSNode | undefined
}

export interface LangSelectorNode extends CSSNode {
	readonly type: typeof LANG_SELECTOR
}

// ---------------------------------------------------------------------------
// At-rule prelude nodes
// ---------------------------------------------------------------------------

export interface MediaQueryNode extends CSSNode {
	readonly type: typeof MEDIA_QUERY
}

export interface MediaFeatureNode extends CSSNode {
	readonly type: typeof MEDIA_FEATURE
	/** Feature name, e.g. "min-width" — always a string */
	readonly property: string
	/** `name` does not apply to media features */
	readonly name: undefined
}

export interface MediaTypeNode extends CSSNode {
	readonly type: typeof MEDIA_TYPE
}

export interface ContainerQueryNode extends CSSNode {
	readonly type: typeof CONTAINER_QUERY
}

export interface SupportsQueryNode extends CSSNode {
	readonly type: typeof SUPPORTS_QUERY
}

export interface LayerNameNode extends CSSNode {
	readonly type: typeof LAYER_NAME
	/** Layer name — always a string */
	readonly name: string
}

export interface PreludeOperatorNode extends CSSNode {
	readonly type: typeof PRELUDE_OPERATOR
}

export interface FeatureRangeNode extends CSSNode {
	readonly type: typeof FEATURE_RANGE
}

export interface AtrulePreludeNode extends CSSNode {
	readonly type: typeof AT_RULE_PRELUDE
}

// ---------------------------------------------------------------------------
// AnyCssNode — discriminated union of all known subtypes
//
// Assign this to a walk callback parameter or use it in a function to get
// automatic switch/if narrowing without explicit type predicates:
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
	| MediaQueryNode
	| MediaFeatureNode
	| MediaTypeNode
	| ContainerQueryNode
	| SupportsQueryNode
	| LayerNameNode
	| PreludeOperatorNode
	| FeatureRangeNode
	| AtrulePreludeNode

// ---------------------------------------------------------------------------
// Type predicate functions
//
// Each compiles to a single integer comparison — zero heap allocation.
// All are individually tree-shakeable named exports.
// ---------------------------------------------------------------------------

export function is_stylesheet(node: CSSNode): node is StyleSheetNode {
	return node.type === STYLESHEET
}
export function is_rule(node: CSSNode): node is RuleNode {
	return node.type === STYLE_RULE
}
export function is_atrule(node: CSSNode): node is AtruleNode {
	return node.type === AT_RULE
}
export function is_declaration(node: CSSNode): node is DeclarationNode {
	return node.type === DECLARATION
}
export function is_selector(node: CSSNode): node is SelectorNode {
	return node.type === SELECTOR
}
export function is_selector_list(node: CSSNode): node is SelectorListNode {
	return node.type === SELECTOR_LIST
}
export function is_block(node: CSSNode): node is BlockNode {
	return node.type === BLOCK
}
export function is_comment(node: CSSNode): node is CommentNode {
	return node.type === COMMENT
}
export function is_raw(node: CSSNode): node is RawNode {
	return node.type === RAW
}
export function is_identifier(node: CSSNode): node is IdentifierNode {
	return node.type === IDENTIFIER
}
export function is_number(node: CSSNode): node is NumberNode {
	return node.type === NUMBER
}
export function is_dimension(node: CSSNode): node is DimensionNode {
	return node.type === DIMENSION
}
export function is_string(node: CSSNode): node is StringNode {
	return node.type === STRING
}
export function is_hash(node: CSSNode): node is HashNode {
	return node.type === HASH
}
export function is_function(node: CSSNode): node is FunctionNode {
	return node.type === FUNCTION
}
export function is_operator(node: CSSNode): node is OperatorNode {
	return node.type === OPERATOR
}
export function is_parenthesis(node: CSSNode): node is ParenthesisNode {
	return node.type === PARENTHESIS
}
export function is_url(node: CSSNode): node is UrlNode {
	return node.type === URL
}
export function is_unicode_range(node: CSSNode): node is UnicodeRangeNode {
	return node.type === UNICODE_RANGE
}
export function is_value(node: CSSNode): node is ValueNode {
	return node.type === VALUE
}
export function is_type_selector(node: CSSNode): node is TypeSelectorNode {
	return node.type === TYPE_SELECTOR
}
export function is_class_selector(node: CSSNode): node is ClassSelectorNode {
	return node.type === CLASS_SELECTOR
}
export function is_id_selector(node: CSSNode): node is IdSelectorNode {
	return node.type === ID_SELECTOR
}
export function is_attribute_selector(node: CSSNode): node is AttributeSelectorNode {
	return node.type === ATTRIBUTE_SELECTOR
}
export function is_pseudo_class_selector(node: CSSNode): node is PseudoClassSelectorNode {
	return node.type === PSEUDO_CLASS_SELECTOR
}
export function is_pseudo_element_selector(node: CSSNode): node is PseudoElementSelectorNode {
	return node.type === PSEUDO_ELEMENT_SELECTOR
}
export function is_combinator(node: CSSNode): node is CombinatorNode {
	return node.type === COMBINATOR
}
export function is_universal_selector(node: CSSNode): node is UniversalSelectorNode {
	return node.type === UNIVERSAL_SELECTOR
}
export function is_nesting_selector(node: CSSNode): node is NestingSelectorNode {
	return node.type === NESTING_SELECTOR
}
export function is_nth_selector(node: CSSNode): node is NthSelectorNode {
	return node.type === NTH_SELECTOR
}
export function is_nth_of_selector(node: CSSNode): node is NthOfSelectorNode {
	return node.type === NTH_OF_SELECTOR
}
export function is_lang_selector(node: CSSNode): node is LangSelectorNode {
	return node.type === LANG_SELECTOR
}
export function is_media_query(node: CSSNode): node is MediaQueryNode {
	return node.type === MEDIA_QUERY
}
export function is_media_feature(node: CSSNode): node is MediaFeatureNode {
	return node.type === MEDIA_FEATURE
}
export function is_media_type(node: CSSNode): node is MediaTypeNode {
	return node.type === MEDIA_TYPE
}
export function is_container_query(node: CSSNode): node is ContainerQueryNode {
	return node.type === CONTAINER_QUERY
}
export function is_supports_query(node: CSSNode): node is SupportsQueryNode {
	return node.type === SUPPORTS_QUERY
}
export function is_layer_name(node: CSSNode): node is LayerNameNode {
	return node.type === LAYER_NAME
}
export function is_prelude_operator(node: CSSNode): node is PreludeOperatorNode {
	return node.type === PRELUDE_OPERATOR
}
export function is_feature_range(node: CSSNode): node is FeatureRangeNode {
	return node.type === FEATURE_RANGE
}
export function is_atrule_prelude(node: CSSNode): node is AtrulePreludeNode {
	return node.type === AT_RULE_PRELUDE
}
