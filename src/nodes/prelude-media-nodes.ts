// Media Prelude Node Classes
// Represents media query components in @media at-rules
import { CSSNode as CSSNodeBase } from '../css-node-base'
import { CSSNode } from '../css-node'
import type { AnyNode } from '../types'
import { NODE_PRELUDE_MEDIA_FEATURE, NODE_PRELUDE_MEDIA_QUERY, NODE_PRELUDE_MEDIA_TYPE } from '../arena'

// Forward declarations for child types
export type MediaComponentNode = AnyNode

/**
 * PreludeMediaQueryNode - Represents a single media query
 * Examples:
 * - screen
 * - (min-width: 768px)
 * - screen and (min-width: 768px)
 * - not print
 * - only screen and (orientation: landscape)
 */
export class PreludeMediaQueryNode extends CSSNodeBase {
	override get type(): typeof NODE_PRELUDE_MEDIA_QUERY {
		return this.arena.get_type(this.index) as typeof NODE_PRELUDE_MEDIA_QUERY
	}

	// Override children to return media query components
	// Children can be media types, media features, and logical operators
	override get children(): MediaComponentNode[] {
		return super.children as MediaComponentNode[]
	}

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
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
export class PreludeMediaFeatureNode extends CSSNodeBase {
	override get type(): typeof NODE_PRELUDE_MEDIA_FEATURE {
		return this.arena.get_type(this.index) as typeof NODE_PRELUDE_MEDIA_FEATURE
	}

	// Get the feature value (content inside parentheses, trimmed)
	// For (min-width: 768px), returns "min-width: 768px"
	get value(): string {
		const text = this.text
		// Remove parentheses
		let inner = text.slice(1, -1)
		// Remove comments and normalize whitespace
		inner = inner
			.replace(/\/\*.*?\*\//g, '')
			.replace(/\s+/g, ' ')
			.trim()
		return inner
	}

	// Get the feature name
	// For (min-width: 768px), returns "min-width"
	// For (orientation: portrait), returns "orientation"
	get feature_name(): string {
		const inner = this.value

		// Find the first colon or comparison operator
		const colonIndex = inner.indexOf(':')
		const geIndex = inner.indexOf('>=')
		const leIndex = inner.indexOf('<=')
		const gtIndex = inner.indexOf('>')
		const ltIndex = inner.indexOf('<')
		const eqIndex = inner.indexOf('=')

		// Find the first operator position
		let opIndex = -1
		const indices = [colonIndex, geIndex, leIndex, gtIndex, ltIndex, eqIndex].filter((i) => i > 0)
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
		return (
			!text.includes(':') &&
			!text.includes('>=') &&
			!text.includes('<=') &&
			!text.includes('>') &&
			!text.includes('<') &&
			!text.includes('=')
		)
	}

	// Override children for range syntax values
	override get children(): AnyNode[] {
		return super.children
	}

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
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
export class PreludeMediaTypeNode extends CSSNodeBase {
	override get type(): typeof NODE_PRELUDE_MEDIA_TYPE {
		return this.arena.get_type(this.index) as typeof NODE_PRELUDE_MEDIA_TYPE
	}

	// Leaf node - the media type is available via 'text'

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}
