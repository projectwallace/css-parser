// AtRuleNode - CSS at-rule (@media, @import, @keyframes, etc.)
import { CSSNode } from '../css-node-base'

// Forward declarations for child types
export type PreludeNode = CSSNode
export type BlockNode = CSSNode

export class AtRuleNode extends CSSNode {
	// Get prelude nodes (children before the block, if any)
	get prelude_nodes(): PreludeNode[] {
		const nodes: PreludeNode[] = []
		let child = this.first_child
		while (child) {
			// Stop when we hit the block
			if (child.type === 7 /* NODE_BLOCK */) {
				break
			}
			nodes.push(child as PreludeNode)
			child = child.next_sibling
		}
		return nodes
	}

	// Override children with typed return
	override get children(): (PreludeNode | BlockNode)[] {
		return super.children as (PreludeNode | BlockNode)[]
	}

	// All other properties (name, prelude, has_prelude, block, has_block, is_vendor_prefixed)
	// are already defined in base class
}
