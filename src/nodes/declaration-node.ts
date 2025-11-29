// DeclarationNode - CSS declaration (property: value)
import { CSSNode } from '../css-node-base'
import { FLAG_IMPORTANT, FLAG_VENDOR_PREFIXED, NODE_VALUE_DIMENSION, NODE_VALUE_NUMBER } from '../arena'
import { parse_dimension } from '../string-utils'

// Forward declarations for child types (value nodes)
export type ValueNode = CSSNode

export class DeclarationNode extends CSSNode {
	// Get the property name (e.g., "color", "display")
	get name(): string {
		let start = this.arena.get_content_start(this.index)
		let length = this.arena.get_content_length(this.index)
		if (length === 0) return ''
		return this.source.substring(start, start + length)
	}

	// Property name (alias for name)
	get property(): string {
		return this.name
	}

	// Get array of parsed value nodes
	get values(): ValueNode[] {
		return super.children as ValueNode[]
	}

	// Override children with typed return
	override get children(): ValueNode[] {
		return super.children as ValueNode[]
	}

	// Get the value text (for declarations: "blue" in "color: blue")
	// For dimension/number nodes: returns the numeric value as a number
	// For string nodes: returns the string content without quotes
	get value(): string | number | null {
		// For dimension and number nodes, parse and return as number
		if (this.type === NODE_VALUE_DIMENSION || this.type === NODE_VALUE_NUMBER) {
			return parse_dimension(this.text).value
		}

		// For other nodes, return as string
		let start = this.arena.get_value_start(this.index)
		let length = this.arena.get_value_length(this.index)
		if (length === 0) return null
		return this.source.substring(start, start + length)
	}

	// Check if this declaration has !important
	get isImportant(): boolean {
		return this.arena.has_flag(this.index, FLAG_IMPORTANT)
	}

	// Snake_case alias for isImportant
	get is_important(): boolean {
		return this.isImportant
	}

	// Check if this has a vendor prefix (flag-based for performance)
	get isVendorPrefixed(): boolean {
		return this.arena.has_flag(this.index, FLAG_VENDOR_PREFIXED)
	}

	// Snake_case alias for isVendorPrefixed
	get is_vendor_prefixed(): boolean {
		return this.isVendorPrefixed
	}

	// Get count of value nodes
	get value_count(): number {
		let count = 0
		let child = this.first_child
		while (child) {
			count++
			child = child.next_sibling
		}
		return count
	}
}
