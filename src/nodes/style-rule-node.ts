// StyleRuleNode - CSS style rule with selector and declarations
import { CSSNode } from '../css-node-base'

// Forward declarations for child types
export type SelectorListNode = CSSNode
export type BlockNode = CSSNode

export class StyleRuleNode extends CSSNode {
	// Get selector list (always first child of style rule)
	get selector_list(): SelectorListNode | null {
		const first = this.first_child
		if (!first) return null
		// First child should be selector list
		if (first.type === 20 /* NODE_SELECTOR_LIST */) {
			return first as SelectorListNode
		}
		return null
	}

	// Override children with typed return
	// StyleRule has [SelectorListNode, BlockNode?]
	override get children(): (SelectorListNode | BlockNode)[] {
		return super.children as (SelectorListNode | BlockNode)[]
	}

	// All other properties (block, has_block, has_declarations)
	// are already defined in base class
}
