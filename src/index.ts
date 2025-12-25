// Main entry point - exports all public APIs

// Function-based API (recommended)
export { parse } from './parse'
export { parse_selector } from './parse-selector'
export { parse_atrule_prelude } from './parse-atrule-prelude'
export { parse_declaration } from './parse-declaration'
export { parse_value } from './parse-value'
export { tokenize } from './tokenize'
export { walk, traverse, SKIP, BREAK } from './walk'
export { is_custom, is_vendor_prefixed, str_equals, str_starts_with, str_index_of } from './string-utils'

// Advanced/class-based API
export { type ParserOptions } from './parse'

// Types
export { CSSNode, type CSSNodeType, TYPE_NAMES, type CloneOptions, type PlainCSSNode } from './css-node'
export type { LexerPosition } from './tokenize'

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
