// CSSNode - Ergonomic wrapper over arena node indices
// This is the concrete implementation that handles all node types
// Will be replaced by type-specific classes in future batches
import { CSSNode as CSSNodeBase } from './css-node-base'
import type { CSSDataArena } from './arena'

// Re-export CSSNodeType from base
export type { CSSNodeType } from './css-node-base'

export class CSSNode extends CSSNodeBase {
	// Implement factory method that returns CSSNode for all types
	// In future batches, this will return type-specific node classes
	static override from(arena: CSSDataArena, source: string, index: number): CSSNode {
		return new CSSNode(arena, source, index)
	}
}
