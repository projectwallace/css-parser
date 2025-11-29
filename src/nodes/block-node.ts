// BlockNode - Block container for declarations and nested rules
import { CSSNode as CSSNodeBase } from '../css-node-base'
import { CSSNode } from '../css-node'
import { NODE_COMMENT } from '../arena'
import type { AnyNode } from '../types'

// Forward declarations for child types
export type DeclarationNode = AnyNode
export type StyleRuleNode = AnyNode
export type AtRuleNode = AnyNode
export type CommentNode = AnyNode

export class BlockNode extends CSSNodeBase {
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

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}
