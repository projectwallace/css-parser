// DeclarationNode - CSS declaration (property: value)
import { CSSNode } from '../css-node-base'

// Forward declarations for child types (value nodes)
export type ValueNode = CSSNode

export class DeclarationNode extends CSSNode {
	// Property name (alias for name)
	override get property(): string {
		return this.name
	}

	// Get array of parsed value nodes
	override get values(): ValueNode[] {
		return super.values as ValueNode[]
	}

	// Override children with typed return
	override get children(): ValueNode[] {
		return super.children as ValueNode[]
	}

	// All other properties (is_important, is_vendor_prefixed, value, value_count)
	// are already defined in base class
}
