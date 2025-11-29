// SelectorNode - Wrapper for individual selector
// Used for pseudo-class arguments like :is(), :where(), :has()
import { CSSNode } from '../css-node-base'

// Forward declarations for child types (selector components)
export type SelectorComponentNode = CSSNode

export class SelectorNode extends CSSNode {
	// Override children with typed return
	// Selector contains selector components (type, class, id, pseudo, etc.)
	override get children(): SelectorComponentNode[] {
		return super.children as SelectorComponentNode[]
	}
}
