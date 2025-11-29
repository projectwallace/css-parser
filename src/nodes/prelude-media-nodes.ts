// Media Prelude Node Classes
// Represents media query components in @media at-rules
import { CSSNode } from '../css-node-base'

// Forward declarations for child types
export type MediaComponentNode = CSSNode

/**
 * PreludeMediaQueryNode - Represents a single media query
 * Examples:
 * - screen
 * - (min-width: 768px)
 * - screen and (min-width: 768px)
 * - not print
 * - only screen and (orientation: landscape)
 */
export class PreludeMediaQueryNode extends CSSNode {
	// Override children to return media query components
	// Children can be media types, media features, and logical operators
	override get children(): MediaComponentNode[] {
		return super.children as MediaComponentNode[]
	}
}

/**
 * PreludeMediaFeatureNode - Represents a media feature
 * Examples:
 * - (min-width: 768px)
 * - (orientation: portrait)
 * - (color)
 * - (width >= 600px) - range syntax
 * - (400px <= width <= 800px) - range syntax
 */
export class PreludeMediaFeatureNode extends CSSNode {
	// Get the feature name
	// For (min-width: 768px), returns "min-width"
	// For (orientation: portrait), returns "orientation"
	get feature_name(): string {
		const text = this.text
		// Remove parentheses
		const inner = text.slice(1, -1).trim()

		// Find the first colon or comparison operator
		const colonIndex = inner.indexOf(':')
		const geIndex = inner.indexOf('>=')
		const leIndex = inner.indexOf('<=')
		const gtIndex = inner.indexOf('>')
		const ltIndex = inner.indexOf('<')
		const eqIndex = inner.indexOf('=')

		// Find the first operator position
		let opIndex = -1
		const indices = [colonIndex, geIndex, leIndex, gtIndex, ltIndex, eqIndex].filter(i => i > 0)
		if (indices.length > 0) {
			opIndex = Math.min(...indices)
		}

		if (opIndex > 0) {
			return inner.slice(0, opIndex).trim()
		}

		// No operator, just a feature name like (color)
		return inner
	}

	// Check if this is a boolean feature (no value)
	// For (color), returns true
	// For (min-width: 768px), returns false
	get is_boolean(): boolean {
		const text = this.text
		return !text.includes(':') && !text.includes('>=') && !text.includes('<=') &&
		       !text.includes('>') && !text.includes('<') && !text.includes('=')
	}

	// Override children for range syntax values
	override get children(): CSSNode[] {
		return super.children
	}
}

/**
 * PreludeMediaTypeNode - Represents a media type
 * Examples:
 * - screen
 * - print
 * - all
 * - speech
 */
export class PreludeMediaTypeNode extends CSSNode {
	// Leaf node - the media type is available via 'text'
}
