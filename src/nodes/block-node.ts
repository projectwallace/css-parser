// BlockNode - Block container for declarations and nested rules
import { CSSNode } from '../css-node-base'
import { NODE_COMMENT } from '../arena'

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

	// Check if this block is empty (no declarations or rules, only comments allowed)
	get isEmpty(): boolean {
		// Empty if no children, or all children are comments
		let child = this.first_child
		while (child) {
			if (child.type !== NODE_COMMENT) {
				return false
			}
			child = child.next_sibling
		}
		return true
	}

	// Snake_case alias for isEmpty
	get is_empty(): boolean {
		return this.isEmpty
	}
}
