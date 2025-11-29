// CSSNode - Ergonomic wrapper over arena node indices
// This is the concrete implementation that handles all node types
// Will be replaced by type-specific classes in future batches
import { CSSNode as CSSNodeBase } from './css-node-base'
import type { CSSDataArena } from './arena'
import { NODE_STYLESHEET, NODE_COMMENT, NODE_BLOCK, NODE_DECLARATION, NODE_AT_RULE, NODE_STYLE_RULE } from './arena'
import { StylesheetNode } from './nodes/stylesheet-node'
import { CommentNode } from './nodes/comment-node'
import { BlockNode } from './nodes/block-node'
import { DeclarationNode } from './nodes/declaration-node'
import { AtRuleNode } from './nodes/at-rule-node'
import { StyleRuleNode } from './nodes/style-rule-node'

// Re-export CSSNodeType from base
export type { CSSNodeType } from './css-node-base'

// Re-export type-specific node classes
export { StylesheetNode } from './nodes/stylesheet-node'
export { CommentNode } from './nodes/comment-node'
export { BlockNode } from './nodes/block-node'
export { DeclarationNode } from './nodes/declaration-node'
export { AtRuleNode } from './nodes/at-rule-node'
export { StyleRuleNode } from './nodes/style-rule-node'

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
