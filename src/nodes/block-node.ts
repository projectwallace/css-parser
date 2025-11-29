// BlockNode - Block container for declarations and nested rules
import { CSSNode } from '../css-node-base'

// Forward declarations for child types
export type DeclarationNode = CSSNode
export type StyleRuleNode = CSSNode
export type AtRuleNode = CSSNode
export type CommentNode = CSSNode

export class BlockNode extends CSSNode {
	// Override children with typed return
	// Blocks can contain declarations, style rules, at-rules, and comments
	override get children(): (DeclarationNode | StyleRuleNode | AtRuleNode | CommentNode)[] {
		return super.children as (DeclarationNode | StyleRuleNode | AtRuleNode | CommentNode)[]
	}

	// is_empty is already defined in base class, no need to override
}
