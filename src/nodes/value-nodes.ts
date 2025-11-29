// Value Node Classes - For declaration values
// These nodes represent parsed values in CSS declarations
import { CSSNode } from '../css-node-base'

/**
 * ValueKeywordNode - Represents a keyword value (identifier)
 * Examples: red, auto, inherit, initial, flex, block
 */
export class ValueKeywordNode extends CSSNode {
	// Keyword nodes are leaf nodes with no additional properties
	// The keyword text is available via the inherited 'text' property
}

/**
 * ValueStringNode - Represents a quoted string value
 * Examples: "hello", 'world', "path/to/file.css"
 */
export class ValueStringNode extends CSSNode {
	// String nodes are leaf nodes
	// The full string (including quotes) is available via 'text'

	// Get the string content without quotes
	get value(): string {
		const text = this.text
		// Remove surrounding quotes (first and last character)
		if (text.length >= 2 && (text[0] === '"' || text[0] === "'")) {
			return text.slice(1, -1)
		}
		return text
	}
}

/**
 * ValueColorNode - Represents a hex color value
 * Examples: #fff, #ff0000, #rgba
 */
export class ValueColorNode extends CSSNode {
	// Color nodes are leaf nodes
	// The hex color (including #) is available via 'text'

	// Get the color value without the # prefix
	get hex(): string {
		const text = this.text
		return text.startsWith('#') ? text.slice(1) : text
	}
}

/**
 * ValueOperatorNode - Represents an operator in a value
 * Examples: +, -, *, /, comma (,)
 */
export class ValueOperatorNode extends CSSNode {
	// Operator nodes are leaf nodes
	// The operator symbol is available via 'text'
}
