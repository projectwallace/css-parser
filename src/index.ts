// Main entry point - exports all public APIs

// Function-based API (recommended)
export { parse } from './parse'
export { parse_selector } from './parse-selector'
export { parse_atrule_prelude } from './parse-atrule-prelude'
export { parse_declaration } from './parse-declaration'
export { parse_value } from './parse-value'
export { parse_dimension } from './parse-dimension'
export { tokenize } from './tokenize'
export { walk, traverse, SKIP, BREAK } from './walk'
export {
	is_custom,
	is_vendor_prefixed,
	str_equals,
	str_starts_with,
	str_index_of,
} from './string-utils'

// Advanced/class-based API
export { type ParserOptions } from './parse'

// Types
export {
	CSSNode,
	type CSSNodeType,
	TYPE_NAMES,
	type CloneOptions,
	type PlainCSSNode,
	ATTR_FLAG_NAMES,
	ATTR_OPERATOR_NAMES,
} from './css-node'
export type { LexerPosition, CommentInfo } from './tokenize'

export {
	ATTR_OPERATOR_NONE,
	ATTR_OPERATOR_EQUAL,
	ATTR_OPERATOR_TILDE_EQUAL,
	ATTR_OPERATOR_PIPE_EQUAL,
	ATTR_OPERATOR_CARET_EQUAL,
	ATTR_OPERATOR_DOLLAR_EQUAL,
	ATTR_OPERATOR_STAR_EQUAL,
	ATTR_FLAG_NONE,
	ATTR_FLAG_CASE_INSENSITIVE,
	ATTR_FLAG_CASE_SENSITIVE,
} from './arena'

// Constants - imported from dedicated constants file
// This improves tree-shaking by avoiding the parse module if only constants are needed
export * from './constants'
export * from './token-types'

// Namespace object exports for convenience
export { NODE_TYPES } from './constants'

// Node subtypes and type predicate functions
export {
	type CssNodeCommon,
	type AnyCss,
	type ToPlain,
	type StyleSheet,
	type Rule,
	type Atrule,
	type Declaration,
	type Selector,
	type SelectorList,
	type Block,
	type Comment,
	type Raw,
	type Identifier,
	type Number,
	type Dimension,
	type String,
	type Hash,
	type Function,
	type Operator,
	type Parenthesis,
	type Url,
	type UnicodeRange,
	type Value,
	type TypeSelector,
	type ClassSelector,
	type IdSelector,
	type AttributeSelector,
	type PseudoClassSelector,
	type PseudoElementSelector,
	type Combinator,
	type UniversalSelector,
	type NestingSelector,
	type NthSelector,
	type NthOfSelector,
	type LangSelector,
	type MediaQuery,
	type MediaFeature,
	type MediaType,
	type ContainerQuery,
	type SupportsQuery,
	type LayerName,
	type PreludeOperator,
	type FeatureRange,
	type AtrulePrelude,
	type PreludeSelectorList,
	is_stylesheet,
	is_rule,
	is_atrule,
	is_declaration,
	is_selector,
	is_selector_list,
	is_block,
	is_comment,
	is_raw,
	is_identifier,
	is_number,
	is_dimension,
	is_string,
	is_hash,
	is_function,
	is_operator,
	is_parenthesis,
	is_url,
	is_unicode_range,
	is_value,
	is_type_selector,
	is_class_selector,
	is_id_selector,
	is_attribute_selector,
	is_pseudo_class_selector,
	is_pseudo_element_selector,
	is_combinator,
	is_universal_selector,
	is_nesting_selector,
	is_nth_selector,
	is_nth_of_selector,
	is_lang_selector,
	is_media_query,
	is_media_feature,
	is_media_type,
	is_container_query,
	is_supports_query,
	is_layer_name,
	is_prelude_operator,
	is_feature_range,
	is_atrule_prelude,
	is_prelude_selectorlist,
} from './node-types'
