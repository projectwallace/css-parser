// CSSNode - Ergonomic wrapper over arena node indices
// This is the concrete implementation that handles all node types
// Will be replaced by type-specific classes in future batches
import { CSSNode as CSSNodeBase } from './css-node-base'
import type { CSSDataArena } from './arena'
import { NODE_STYLESHEET, NODE_COMMENT, NODE_BLOCK, NODE_DECLARATION, NODE_AT_RULE, NODE_STYLE_RULE, NODE_SELECTOR, NODE_VALUE_KEYWORD, NODE_VALUE_STRING, NODE_VALUE_COLOR, NODE_VALUE_OPERATOR, NODE_VALUE_NUMBER, NODE_VALUE_DIMENSION, NODE_VALUE_FUNCTION, NODE_SELECTOR_LIST, NODE_SELECTOR_TYPE, NODE_SELECTOR_UNIVERSAL, NODE_SELECTOR_NESTING, NODE_SELECTOR_COMBINATOR, NODE_SELECTOR_CLASS, NODE_SELECTOR_ID, NODE_SELECTOR_LANG, NODE_SELECTOR_ATTRIBUTE, NODE_SELECTOR_PSEUDO_CLASS, NODE_SELECTOR_PSEUDO_ELEMENT, NODE_SELECTOR_NTH, NODE_SELECTOR_NTH_OF, NODE_PRELUDE_MEDIA_QUERY, NODE_PRELUDE_MEDIA_FEATURE, NODE_PRELUDE_MEDIA_TYPE, NODE_PRELUDE_CONTAINER_QUERY, NODE_PRELUDE_SUPPORTS_QUERY, NODE_PRELUDE_LAYER_NAME, NODE_PRELUDE_IDENTIFIER, NODE_PRELUDE_OPERATOR } from './arena'
import { StylesheetNode } from './nodes/stylesheet-node'
import { CommentNode } from './nodes/comment-node'
import { BlockNode } from './nodes/block-node'
import { DeclarationNode } from './nodes/declaration-node'
import { AtRuleNode } from './nodes/at-rule-node'
import { StyleRuleNode } from './nodes/style-rule-node'
import { SelectorNode } from './nodes/selector-node'
import { ValueKeywordNode, ValueStringNode, ValueColorNode, ValueOperatorNode, ValueNumberNode, ValueDimensionNode, ValueFunctionNode } from './nodes/value-nodes'
import { SelectorListNode, SelectorTypeNode, SelectorUniversalNode, SelectorNestingNode, SelectorCombinatorNode } from './nodes/selector-nodes-simple'
import { SelectorClassNode, SelectorIdNode, SelectorLangNode } from './nodes/selector-nodes-named'
import { SelectorAttributeNode } from './nodes/selector-attribute-node'
import { SelectorPseudoClassNode, SelectorPseudoElementNode } from './nodes/selector-pseudo-nodes'
import { SelectorNthNode, SelectorNthOfNode } from './nodes/selector-nth-nodes'
import { PreludeMediaQueryNode, PreludeMediaFeatureNode, PreludeMediaTypeNode } from './nodes/prelude-media-nodes'
import { PreludeContainerQueryNode, PreludeSupportsQueryNode, PreludeLayerNameNode, PreludeIdentifierNode, PreludeOperatorNode } from './nodes/prelude-container-supports-nodes'

// Re-export CSSNodeType from base
export type { CSSNodeType } from './css-node-base'

// Re-export type-specific node classes
export { StylesheetNode } from './nodes/stylesheet-node'
export { CommentNode } from './nodes/comment-node'
export { BlockNode } from './nodes/block-node'
export { DeclarationNode } from './nodes/declaration-node'
export { AtRuleNode } from './nodes/at-rule-node'
export { StyleRuleNode } from './nodes/style-rule-node'
export { SelectorNode } from './nodes/selector-node'
export { ValueKeywordNode, ValueStringNode, ValueColorNode, ValueOperatorNode, ValueNumberNode, ValueDimensionNode, ValueFunctionNode } from './nodes/value-nodes'
export { SelectorListNode, SelectorTypeNode, SelectorUniversalNode, SelectorNestingNode, SelectorCombinatorNode } from './nodes/selector-nodes-simple'
export { SelectorClassNode, SelectorIdNode, SelectorLangNode } from './nodes/selector-nodes-named'
export { SelectorAttributeNode } from './nodes/selector-attribute-node'
export { SelectorPseudoClassNode, SelectorPseudoElementNode } from './nodes/selector-pseudo-nodes'
export { SelectorNthNode, SelectorNthOfNode } from './nodes/selector-nth-nodes'
export { PreludeMediaQueryNode, PreludeMediaFeatureNode, PreludeMediaTypeNode } from './nodes/prelude-media-nodes'
export { PreludeContainerQueryNode, PreludeSupportsQueryNode, PreludeLayerNameNode, PreludeIdentifierNode, PreludeOperatorNode } from './nodes/prelude-container-supports-nodes'

export class CSSNode extends CSSNodeBase {
	// Implement factory method that returns type-specific node classes
	// Gradually expanding to cover all node types
	static override from(arena: CSSDataArena, source: string, index: number): CSSNode {
		const type = arena.get_type(index)

		// Return type-specific nodes
		switch (type) {
			case NODE_STYLESHEET:
				return new StylesheetNode(arena, source, index)
			case NODE_COMMENT:
				return new CommentNode(arena, source, index)
			case NODE_BLOCK:
				return new BlockNode(arena, source, index)
			case NODE_DECLARATION:
				return new DeclarationNode(arena, source, index)
			case NODE_AT_RULE:
				return new AtRuleNode(arena, source, index)
			case NODE_STYLE_RULE:
				return new StyleRuleNode(arena, source, index)
			case NODE_SELECTOR:
				return new SelectorNode(arena, source, index)
			// Value nodes
			case NODE_VALUE_KEYWORD:
				return new ValueKeywordNode(arena, source, index)
			case NODE_VALUE_STRING:
				return new ValueStringNode(arena, source, index)
			case NODE_VALUE_COLOR:
				return new ValueColorNode(arena, source, index)
			case NODE_VALUE_OPERATOR:
				return new ValueOperatorNode(arena, source, index)
			case NODE_VALUE_NUMBER:
				return new ValueNumberNode(arena, source, index)
			case NODE_VALUE_DIMENSION:
				return new ValueDimensionNode(arena, source, index)
			case NODE_VALUE_FUNCTION:
				return new ValueFunctionNode(arena, source, index)
			// Selector nodes
			case NODE_SELECTOR_LIST:
				return new SelectorListNode(arena, source, index)
			case NODE_SELECTOR_TYPE:
				return new SelectorTypeNode(arena, source, index)
			case NODE_SELECTOR_UNIVERSAL:
				return new SelectorUniversalNode(arena, source, index)
			case NODE_SELECTOR_NESTING:
				return new SelectorNestingNode(arena, source, index)
			case NODE_SELECTOR_COMBINATOR:
				return new SelectorCombinatorNode(arena, source, index)
			case NODE_SELECTOR_CLASS:
				return new SelectorClassNode(arena, source, index)
			case NODE_SELECTOR_ID:
				return new SelectorIdNode(arena, source, index)
			case NODE_SELECTOR_LANG:
				return new SelectorLangNode(arena, source, index)
			case NODE_SELECTOR_ATTRIBUTE:
				return new SelectorAttributeNode(arena, source, index)
			case NODE_SELECTOR_PSEUDO_CLASS:
				return new SelectorPseudoClassNode(arena, source, index)
			case NODE_SELECTOR_PSEUDO_ELEMENT:
				return new SelectorPseudoElementNode(arena, source, index)
			case NODE_SELECTOR_NTH:
				return new SelectorNthNode(arena, source, index)
			case NODE_SELECTOR_NTH_OF:
				return new SelectorNthOfNode(arena, source, index)
			// Media prelude nodes
			case NODE_PRELUDE_MEDIA_QUERY:
				return new PreludeMediaQueryNode(arena, source, index)
			case NODE_PRELUDE_MEDIA_FEATURE:
				return new PreludeMediaFeatureNode(arena, source, index)
			case NODE_PRELUDE_MEDIA_TYPE:
				return new PreludeMediaTypeNode(arena, source, index)
			case NODE_PRELUDE_CONTAINER_QUERY:
				return new PreludeContainerQueryNode(arena, source, index)
			case NODE_PRELUDE_SUPPORTS_QUERY:
				return new PreludeSupportsQueryNode(arena, source, index)
			case NODE_PRELUDE_LAYER_NAME:
				return new PreludeLayerNameNode(arena, source, index)
			case NODE_PRELUDE_IDENTIFIER:
				return new PreludeIdentifierNode(arena, source, index)
			case NODE_PRELUDE_OPERATOR:
				return new PreludeOperatorNode(arena, source, index)
			default:
				// For all other types, return generic CSSNode
				return new CSSNode(arena, source, index)
		}
	}

	// Override create_node_wrapper to use the factory
	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}
