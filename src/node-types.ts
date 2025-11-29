// Node type guards and helpers
import type { CSSNode } from './css-node-base'
import {
	NODE_STYLESHEET,
	NODE_STYLE_RULE,
	NODE_AT_RULE,
	NODE_DECLARATION,
	NODE_SELECTOR,
	NODE_COMMENT,
	NODE_BLOCK,
	NODE_VALUE_KEYWORD,
	NODE_VALUE_NUMBER,
	NODE_VALUE_DIMENSION,
	NODE_VALUE_STRING,
	NODE_VALUE_COLOR,
	NODE_VALUE_FUNCTION,
	NODE_VALUE_OPERATOR,
	NODE_SELECTOR_LIST,
	NODE_SELECTOR_TYPE,
	NODE_SELECTOR_CLASS,
	NODE_SELECTOR_ID,
	NODE_SELECTOR_ATTRIBUTE,
	NODE_SELECTOR_PSEUDO_CLASS,
	NODE_SELECTOR_PSEUDO_ELEMENT,
	NODE_SELECTOR_COMBINATOR,
	NODE_SELECTOR_UNIVERSAL,
	NODE_SELECTOR_NESTING,
	NODE_SELECTOR_NTH,
	NODE_SELECTOR_NTH_OF,
	NODE_SELECTOR_LANG,
	NODE_PRELUDE_MEDIA_QUERY,
	NODE_PRELUDE_MEDIA_FEATURE,
	NODE_PRELUDE_MEDIA_TYPE,
	NODE_PRELUDE_CONTAINER_QUERY,
	NODE_PRELUDE_SUPPORTS_QUERY,
	NODE_PRELUDE_LAYER_NAME,
	NODE_PRELUDE_IDENTIFIER,
	NODE_PRELUDE_OPERATOR,
	NODE_PRELUDE_IMPORT_URL,
	NODE_PRELUDE_IMPORT_LAYER,
	NODE_PRELUDE_IMPORT_SUPPORTS,
	ATTR_OPERATOR_NONE,
	ATTR_OPERATOR_EQUAL,
	ATTR_OPERATOR_TILDE_EQUAL,
	ATTR_OPERATOR_PIPE_EQUAL,
	ATTR_OPERATOR_CARET_EQUAL,
	ATTR_OPERATOR_DOLLAR_EQUAL,
	ATTR_OPERATOR_STAR_EQUAL,
} from './arena'

// Union type for all node types (will be expanded as type-specific classes are added)
export type AnyNode = CSSNode

// Attribute operator string mapping
export const ATTR_OPERATOR_STRINGS: Record<number, string> = {
	[ATTR_OPERATOR_NONE]: '',
	[ATTR_OPERATOR_EQUAL]: '=',
	[ATTR_OPERATOR_TILDE_EQUAL]: '~=',
	[ATTR_OPERATOR_PIPE_EQUAL]: '|=',
	[ATTR_OPERATOR_CARET_EQUAL]: '^=',
	[ATTR_OPERATOR_DOLLAR_EQUAL]: '$=',
	[ATTR_OPERATOR_STAR_EQUAL]: '*=',
}

// Type guards for all node types

// Core structure nodes
export function isStylesheet(node: CSSNode): node is CSSNode {
	return node.type === NODE_STYLESHEET
}

export function isStyleRule(node: CSSNode): node is CSSNode {
	return node.type === NODE_STYLE_RULE
}

export function isAtRule(node: CSSNode): node is CSSNode {
	return node.type === NODE_AT_RULE
}

export function isDeclaration(node: CSSNode): node is CSSNode {
	return node.type === NODE_DECLARATION
}

export function isSelector(node: CSSNode): node is CSSNode {
	return node.type === NODE_SELECTOR
}

export function isComment(node: CSSNode): node is CSSNode {
	return node.type === NODE_COMMENT
}

export function isBlock(node: CSSNode): node is CSSNode {
	return node.type === NODE_BLOCK
}

// Value nodes
export function isValueKeyword(node: CSSNode): node is CSSNode {
	return node.type === NODE_VALUE_KEYWORD
}

export function isValueNumber(node: CSSNode): node is CSSNode {
	return node.type === NODE_VALUE_NUMBER
}

export function isValueDimension(node: CSSNode): node is CSSNode {
	return node.type === NODE_VALUE_DIMENSION
}

export function isValueString(node: CSSNode): node is CSSNode {
	return node.type === NODE_VALUE_STRING
}

export function isValueColor(node: CSSNode): node is CSSNode {
	return node.type === NODE_VALUE_COLOR
}

export function isValueFunction(node: CSSNode): node is CSSNode {
	return node.type === NODE_VALUE_FUNCTION
}

export function isValueOperator(node: CSSNode): node is CSSNode {
	return node.type === NODE_VALUE_OPERATOR
}

// Selector nodes
export function isSelectorList(node: CSSNode): node is CSSNode {
	return node.type === NODE_SELECTOR_LIST
}

export function isSelectorType(node: CSSNode): node is CSSNode {
	return node.type === NODE_SELECTOR_TYPE
}

export function isSelectorClass(node: CSSNode): node is CSSNode {
	return node.type === NODE_SELECTOR_CLASS
}

export function isSelectorId(node: CSSNode): node is CSSNode {
	return node.type === NODE_SELECTOR_ID
}

export function isSelectorAttribute(node: CSSNode): node is CSSNode {
	return node.type === NODE_SELECTOR_ATTRIBUTE
}

export function isSelectorPseudoClass(node: CSSNode): node is CSSNode {
	return node.type === NODE_SELECTOR_PSEUDO_CLASS
}

export function isSelectorPseudoElement(node: CSSNode): node is CSSNode {
	return node.type === NODE_SELECTOR_PSEUDO_ELEMENT
}

export function isSelectorCombinator(node: CSSNode): node is CSSNode {
	return node.type === NODE_SELECTOR_COMBINATOR
}

export function isSelectorUniversal(node: CSSNode): node is CSSNode {
	return node.type === NODE_SELECTOR_UNIVERSAL
}

export function isSelectorNesting(node: CSSNode): node is CSSNode {
	return node.type === NODE_SELECTOR_NESTING
}

export function isSelectorNth(node: CSSNode): node is CSSNode {
	return node.type === NODE_SELECTOR_NTH
}

export function isSelectorNthOf(node: CSSNode): node is CSSNode {
	return node.type === NODE_SELECTOR_NTH_OF
}

export function isSelectorLang(node: CSSNode): node is CSSNode {
	return node.type === NODE_SELECTOR_LANG
}

// Prelude nodes
export function isPreludeMediaQuery(node: CSSNode): node is CSSNode {
	return node.type === NODE_PRELUDE_MEDIA_QUERY
}

export function isPreludeMediaFeature(node: CSSNode): node is CSSNode {
	return node.type === NODE_PRELUDE_MEDIA_FEATURE
}

export function isPreludeMediaType(node: CSSNode): node is CSSNode {
	return node.type === NODE_PRELUDE_MEDIA_TYPE
}

export function isPreludeContainerQuery(node: CSSNode): node is CSSNode {
	return node.type === NODE_PRELUDE_CONTAINER_QUERY
}

export function isPreludeSupportsQuery(node: CSSNode): node is CSSNode {
	return node.type === NODE_PRELUDE_SUPPORTS_QUERY
}

export function isPreludeLayerName(node: CSSNode): node is CSSNode {
	return node.type === NODE_PRELUDE_LAYER_NAME
}

export function isPreludeIdentifier(node: CSSNode): node is CSSNode {
	return node.type === NODE_PRELUDE_IDENTIFIER
}

export function isPreludeOperator(node: CSSNode): node is CSSNode {
	return node.type === NODE_PRELUDE_OPERATOR
}

export function isPreludeImportUrl(node: CSSNode): node is CSSNode {
	return node.type === NODE_PRELUDE_IMPORT_URL
}

export function isPreludeImportLayer(node: CSSNode): node is CSSNode {
	return node.type === NODE_PRELUDE_IMPORT_LAYER
}

export function isPreludeImportSupports(node: CSSNode): node is CSSNode {
	return node.type === NODE_PRELUDE_IMPORT_SUPPORTS
}
