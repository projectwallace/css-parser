// CSSNode - Ergonomic wrapper over arena node indices
// This is the concrete implementation that handles all node types
// Will be replaced by type-specific classes in future batches
import { CSSNode as CSSNodeBase } from './css-node-base'
import type { CSSDataArena } from './arena'
import { NODE_STYLESHEET } from './arena'
import { StylesheetNode } from './nodes/stylesheet-node'

// Re-export CSSNodeType from base
export type { CSSNodeType } from './css-node-base'

// Re-export type-specific node classes
export { StylesheetNode } from './nodes/stylesheet-node'

export class CSSNode extends CSSNodeBase {
	// Implement factory method that returns type-specific node classes
	// Gradually expanding to cover all node types
	static override from(arena: CSSDataArena, source: string, index: number): CSSNode {
		const type = arena.get_type(index)

		// Return type-specific nodes
		switch (type) {
			case NODE_STYLESHEET:
				return new StylesheetNode(arena, source, index)
			default:
				// For all other types, return generic CSSNode
				return new CSSNode(arena, source, index)
		}
	}
}
