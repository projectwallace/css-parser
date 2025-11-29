// Type definitions for the CSS parser
// Union type of all possible node types returned by tree traversal

// Use type-only imports to avoid circular dependencies
import type { StylesheetNode } from './nodes/stylesheet-node'
import type { StyleRuleNode } from './nodes/style-rule-node'
import type { AtRuleNode } from './nodes/at-rule-node'
import type { DeclarationNode } from './nodes/declaration-node'
import type { SelectorNode } from './nodes/selector-node'
import type { CommentNode } from './nodes/comment-node'
import type { BlockNode } from './nodes/block-node'

// Value nodes
import type {
	ValueKeywordNode,
	ValueNumberNode,
	ValueDimensionNode,
	ValueStringNode,
	ValueColorNode,
	ValueFunctionNode,
	ValueOperatorNode,
} from './nodes/value-nodes'

// Selector nodes
import type {
	SelectorListNode,
	SelectorTypeNode,
	SelectorUniversalNode,
	SelectorNestingNode,
	SelectorCombinatorNode,
} from './nodes/selector-nodes-simple'

import type {
	SelectorClassNode,
	SelectorIdNode,
	SelectorLangNode,
} from './nodes/selector-nodes-named'

import type { SelectorAttributeNode } from './nodes/selector-attribute-node'

import type {
	SelectorPseudoClassNode,
	SelectorPseudoElementNode,
} from './nodes/selector-pseudo-nodes'

import type {
	SelectorNthNode,
	SelectorNthOfNode,
} from './nodes/selector-nth-nodes'

// Prelude nodes
import type {
	PreludeMediaQueryNode,
	PreludeMediaFeatureNode,
	PreludeMediaTypeNode,
} from './nodes/prelude-media-nodes'

import type {
	PreludeContainerQueryNode,
	PreludeSupportsQueryNode,
	PreludeLayerNameNode,
	PreludeIdentifierNode,
	PreludeOperatorNode,
} from './nodes/prelude-container-supports-nodes'

import type {
	PreludeImportUrlNode,
	PreludeImportLayerNode,
	PreludeImportSupportsNode,
} from './nodes/prelude-import-nodes'

/**
 * Union type of all possible CSS node types
 * Used for tree traversal return types (first_child, next_sibling, children, etc.)
 */
export type AnyNode =
	// Core structure nodes (7)
	| StylesheetNode
	| StyleRuleNode
	| AtRuleNode
	| DeclarationNode
	| SelectorNode
	| CommentNode
	| BlockNode
	// Value nodes (7)
	| ValueKeywordNode
	| ValueNumberNode
	| ValueDimensionNode
	| ValueStringNode
	| ValueColorNode
	| ValueFunctionNode
	| ValueOperatorNode
	// Selector nodes (13)
	| SelectorListNode
	| SelectorTypeNode
	| SelectorClassNode
	| SelectorIdNode
	| SelectorAttributeNode
	| SelectorPseudoClassNode
	| SelectorPseudoElementNode
	| SelectorCombinatorNode
	| SelectorUniversalNode
	| SelectorNestingNode
	| SelectorNthNode
	| SelectorNthOfNode
	| SelectorLangNode
	// Prelude nodes (11)
	| PreludeMediaQueryNode
	| PreludeMediaFeatureNode
	| PreludeMediaTypeNode
	| PreludeContainerQueryNode
	| PreludeSupportsQueryNode
	| PreludeLayerNameNode
	| PreludeIdentifierNode
	| PreludeOperatorNode
	| PreludeImportUrlNode
	| PreludeImportLayerNode
	| PreludeImportSupportsNode
