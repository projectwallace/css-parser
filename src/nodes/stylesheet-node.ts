// StylesheetNode - Root node of the CSS AST
import { CSSNode as CSSNodeBase } from '../css-node-base'
import { CSSNode } from '../css-node'
import { NODE_STYLESHEET } from '../arena'
import type { CSSDataArena } from '../arena'
import type { AnyNode } from '../types'

// Forward declarations for child types (will be implemented in future batches)
// For now, these are all AnyNode, but will become specific types later
export type StyleRuleNode = AnyNode
export type AtRuleNode = AnyNode
export type CommentNode = AnyNode

export class StylesheetNode extends CSSNodeBase {
	constructor(arena: CSSDataArena, source: string, index: number) {
		super(arena, source, index)
	}

	override get type(): typeof NODE_STYLESHEET {
		return this.arena.get_type(this.index) as typeof NODE_STYLESHEET
	}

	// Override children with typed return
	// Stylesheet can contain style rules, at-rules, and comments
	override get children(): (StyleRuleNode | AtRuleNode | CommentNode)[] {
		return super.children as (StyleRuleNode | AtRuleNode | CommentNode)[]
	}

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}
