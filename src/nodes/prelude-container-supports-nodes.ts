// Container and Supports Prelude Node Classes
// Represents container query and supports query components
import { CSSNode } from '../css-node-base'

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
export class PreludeContainerQueryNode extends CSSNode {
	// Override children to return query components
	override get children(): PreludeComponentNode[] {
		return super.children as PreludeComponentNode[]
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
export class PreludeSupportsQueryNode extends CSSNode {
	// Get the query value (content inside parentheses, trimmed)
	// For (display: flex), returns "display: flex"
	get value(): string {
		const text = this.text
		// Remove parentheses and trim
		if (text.startsWith('(') && text.endsWith(')')) {
			return text.slice(1, -1).trim()
		}
		return text.trim()
	}

	// Override children to return query components
	override get children(): PreludeComponentNode[] {
		return super.children as PreludeComponentNode[]
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
export class PreludeLayerNameNode extends CSSNode {
	// Leaf node - the layer name is available via 'text'

	// Get the layer name parts (split by dots)
	get parts(): string[] {
		return this.text.split('.')
	}

	// Check if this is a nested layer (has dots)
	get is_nested(): boolean {
		return this.text.includes('.')
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
export class PreludeIdentifierNode extends CSSNode {
	// Leaf node - the identifier is available via 'text'
}

/**
 * PreludeOperatorNode - Logical operator in preludes
 * Examples:
 * - and
 * - or
 * - not
 */
export class PreludeOperatorNode extends CSSNode {
	// Leaf node - the operator is available via 'text'
}
