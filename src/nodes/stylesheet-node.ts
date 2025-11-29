// StylesheetNode - Root node of the CSS AST
import { CSSNode } from '../css-node-base'
import type { CSSDataArena } from '../arena'

// Forward declarations for child types (will be implemented in future batches)
// For now, these are all CSSNode, but will become specific types later
export type StyleRuleNode = CSSNode
export type AtRuleNode = CSSNode
export type CommentNode = CSSNode

export class StylesheetNode extends CSSNode {
	constructor(arena: CSSDataArena, source: string, index: number) {
		super(arena, source, index)
	}

	// Override children with typed return
	// Stylesheet can contain style rules, at-rules, and comments
	override get children(): (StyleRuleNode | AtRuleNode | CommentNode)[] {
		return super.children as (StyleRuleNode | AtRuleNode | CommentNode)[]
	}
}
