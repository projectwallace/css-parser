// Container and Supports Prelude Node Classes
// Represents container query and supports query components
import { CSSNode as CSSNodeBase } from '../css-node-base'
import { CSSNode } from '../css-node'

// Forward declarations for child types
export type PreludeComponentNode = CSSNode

/**
 * PreludeContainerQueryNode - Represents a container query
 * Examples:
 * - (min-width: 400px)
 * - sidebar (min-width: 400px)
 * - (orientation: portrait)
 * - style(--custom-property: value)
 */
export class PreludeContainerQueryNode extends CSSNodeBase {
	// Override children to return query components
	override get children(): PreludeComponentNode[] {
		return super.children as PreludeComponentNode[]
	}

	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * PreludeSupportsQueryNode - Represents a supports query/condition
 * Examples:
 * - (display: flex)
 * - (display: grid) and (gap: 1rem)
 * - not (display: flex)
 * - selector(:has(a))
 */
export class PreludeSupportsQueryNode extends CSSNodeBase {
	// Get the query value (content inside parentheses, trimmed)
	// For (display: flex), returns "display: flex"
	get value(): string {
		let text = this.text
		// Remove parentheses
		if (text.startsWith('(') && text.endsWith(')')) {
			text = text.slice(1, -1)
		}
		// Remove comments and normalize whitespace
		text = text.replace(/\/\*.*?\*\//g, '').replace(/\s+/g, ' ').trim()
		return text
	}

	// Override children to return query components
	override get children(): PreludeComponentNode[] {
		return super.children as PreludeComponentNode[]
	}

	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * PreludeLayerNameNode - Represents a layer name
 * Examples:
 * - base
 * - components
 * - utilities
 * - theme.dark (dot notation)
 */
export class PreludeLayerNameNode extends CSSNodeBase {
	// Leaf node - the layer name is available via 'text'

	// Get the layer name parts (split by dots)
	get parts(): string[] {
		return this.text.split('.')
	}

	// Check if this is a nested layer (has dots)
	get is_nested(): boolean {
		return this.text.includes('.')
	}

	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * PreludeIdentifierNode - Generic identifier in preludes
 * Used for:
 * - Keyframe names in @keyframes
 * - Property names in @property
 * - Container names in @container
 * - Generic identifiers in various contexts
 */
export class PreludeIdentifierNode extends CSSNodeBase {
	// Leaf node - the identifier is available via 'text'

	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * PreludeOperatorNode - Logical operator in preludes
 * Examples:
 * - and
 * - or
 * - not
 */
export class PreludeOperatorNode extends CSSNodeBase {
	// Leaf node - the operator is available via 'text'

	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}
