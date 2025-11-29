// SelectorNode - Wrapper for individual selector
// Used for pseudo-class arguments like :is(), :where(), :has()
import { CSSNode as CSSNodeBase } from '../css-node-base'
import { CSSNode } from '../css-node'
import type { AnyNode } from '../types'

// Forward declarations for child types (selector components)
export type SelectorComponentNode = AnyNode

export class SelectorNode extends CSSNodeBase {
	// Override children with typed return
	// Selector contains selector components (type, class, id, pseudo, etc.)
	override get children(): SelectorComponentNode[] {
		return super.children as SelectorComponentNode[]
	}

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}
