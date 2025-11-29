// Import Prelude Node Classes
// Represents components of @import at-rule preludes
import { CSSNode } from '../css-node-base'

// Forward declarations for child types
export type ImportComponentNode = CSSNode

/**
 * PreludeImportUrlNode - Represents the URL in an @import statement
 * Examples:
 * - url("styles.css")
 * - "styles.css"
 * - url(https://example.com/styles.css)
 */
export class PreludeImportUrlNode extends CSSNode {
	// Get the URL value (without url() wrapper or quotes if present)
	get url(): string {
		const text = this.text.trim()

		// Handle url() wrapper
		if (text.startsWith('url(') && text.endsWith(')')) {
			const inner = text.slice(4, -1).trim()
			// Remove quotes if present
			if ((inner.startsWith('"') && inner.endsWith('"')) ||
			    (inner.startsWith("'") && inner.endsWith("'"))) {
				return inner.slice(1, -1)
			}
			return inner
		}

		// Handle quoted string
		if ((text.startsWith('"') && text.endsWith('"')) ||
		    (text.startsWith("'") && text.endsWith("'"))) {
			return text.slice(1, -1)
		}

		return text
	}

	// Check if the URL uses the url() function syntax
	get uses_url_function(): boolean {
		return this.text.trim().startsWith('url(')
	}
}

/**
 * PreludeImportLayerNode - Represents the layer() component in @import
 * Examples:
 * - layer
 * - layer(utilities)
 * - layer(theme.dark)
 */
export class PreludeImportLayerNode extends CSSNode {
	// Get the layer name (null if just "layer" without parentheses)
	get layer_name(): string | null {
		const text = this.text.trim()

		// Just "layer" keyword
		if (text === 'layer') {
			return null
		}

		// layer(name) syntax
		if (text.startsWith('layer(') && text.endsWith(')')) {
			return text.slice(6, -1).trim()
		}

		return null
	}

	// Check if this is an anonymous layer (just "layer" without a name)
	get is_anonymous(): boolean {
		return this.layer_name === null
	}
}

/**
 * PreludeImportSupportsNode - Represents the supports() component in @import
 * Examples:
 * - supports(display: flex)
 * - supports(display: grid)
 * - supports(selector(:has(a)))
 */
export class PreludeImportSupportsNode extends CSSNode {
	// Get the supports condition (content inside parentheses)
	get condition(): string {
		const text = this.text.trim()

		// supports(condition) syntax
		if (text.startsWith('supports(') && text.endsWith(')')) {
			return text.slice(9, -1).trim()
		}

		return text
	}

	// Override children for complex supports conditions
	override get children(): CSSNode[] {
		return super.children
	}
}
