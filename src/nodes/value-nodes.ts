// Value Node Classes - For declaration values
// These nodes represent parsed values in CSS declarations
import { CSSNode as CSSNodeBase } from '../css-node-base'
import { CSSNode } from '../css-node'

/**
 * ValueKeywordNode - Represents a keyword value (identifier)
 * Examples: red, auto, inherit, initial, flex, block
 */
export class ValueKeywordNode extends CSSNodeBase {
	// Keyword nodes are leaf nodes with no additional properties
	// The keyword text is available via the inherited 'text' property

	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * ValueStringNode - Represents a quoted string value
 * Examples: "hello", 'world', "path/to/file.css"
 */
export class ValueStringNode extends CSSNodeBase {
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

	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * ValueColorNode - Represents a hex color value
 * Examples: #fff, #ff0000, #rgba
 */
export class ValueColorNode extends CSSNodeBase {
	// Color nodes are leaf nodes
	// The hex color (including #) is available via 'text'

	// Get the color value without the # prefix
	get hex(): string {
		const text = this.text
		return text.startsWith('#') ? text.slice(1) : text
	}

	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * ValueOperatorNode - Represents an operator in a value
 * Examples: +, -, *, /, comma (,)
 */
export class ValueOperatorNode extends CSSNodeBase {
	// Operator nodes are leaf nodes
	// The operator symbol is available via 'text'

	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * ValueNumberNode - Represents a numeric value
 * Examples: 42, 3.14, -5, .5
 */
export class ValueNumberNode extends CSSNodeBase {
	// Number nodes are leaf nodes

	// Get the numeric value
	get value(): number {
		return parseFloat(this.text)
	}

	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * ValueDimensionNode - Represents a number with a unit
 * Examples: 10px, 2em, 50%, 1.5rem, 90deg
 */
export class ValueDimensionNode extends CSSNodeBase {
	// Dimension nodes are leaf nodes

	// Get the numeric value (without the unit)
	get value(): number {
		// Parse the number from the beginning of the text
		return parseFloat(this.text)
	}

	// Get the unit string
	get unit(): string {
		const text = this.text
		// Find where the number ends and unit begins
		let i = 0
		// Skip optional leading sign
		if (text[i] === '+' || text[i] === '-') i++
		// Skip digits and decimal point
		while (i < text.length) {
			const c = text[i]
			if (c >= '0' && c <= '9' || c === '.') {
				i++
			} else {
				break
			}
		}
		return text.slice(i)
	}

	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * ValueFunctionNode - Represents a function call in a value
 * Examples: calc(100% - 20px), var(--color), rgb(255, 0, 0), url("image.png")
 */
export class ValueFunctionNode extends CSSNodeBase {
	// Function nodes can have children (function arguments)

	// Get the function name (without parentheses)
	get name(): string {
		return this.text.slice(0, this.text.indexOf('('))
	}

	// Override children to return typed value nodes
	// Function arguments are value nodes
	override get children(): CSSNode[] {
		return super.children
	}

	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}
