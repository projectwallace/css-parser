// CSSNode - Ergonomic wrapper over arena node indices
import type { CSSDataArena } from './arena'
import {
	NODE_STYLESHEET,
	NODE_STYLE_RULE,
	NODE_AT_RULE,
	NODE_DECLARATION,
	NODE_SELECTOR,
	NODE_COMMENT,
	NODE_BLOCK,
	NODE_VALUE_KEYWORD,
	NODE_VALUE_NUMBER,
	NODE_VALUE_DIMENSION,
	NODE_VALUE_STRING,
	NODE_VALUE_COLOR,
	NODE_VALUE_FUNCTION,
	NODE_VALUE_OPERATOR,
	NODE_SELECTOR_LIST,
	NODE_SELECTOR_TYPE,
	NODE_SELECTOR_CLASS,
	NODE_SELECTOR_ID,
	NODE_SELECTOR_ATTRIBUTE,
	NODE_SELECTOR_PSEUDO_CLASS,
	NODE_SELECTOR_PSEUDO_ELEMENT,
	NODE_SELECTOR_COMBINATOR,
	NODE_SELECTOR_UNIVERSAL,
	NODE_SELECTOR_NESTING,
	NODE_PRELUDE_MEDIA_QUERY,
	NODE_PRELUDE_MEDIA_FEATURE,
	NODE_PRELUDE_MEDIA_TYPE,
	NODE_PRELUDE_CONTAINER_QUERY,
	NODE_PRELUDE_SUPPORTS_QUERY,
	NODE_PRELUDE_LAYER_NAME,
	NODE_PRELUDE_IDENTIFIER,
	NODE_PRELUDE_OPERATOR,
	NODE_PRELUDE_IMPORT_URL,
	NODE_PRELUDE_IMPORT_LAYER,
	NODE_PRELUDE_IMPORT_SUPPORTS,
	FLAG_IMPORTANT,
	FLAG_HAS_ERROR,
	FLAG_HAS_BLOCK,
	FLAG_VENDOR_PREFIXED,
	FLAG_HAS_DECLARATIONS,
} from './arena'

// Node type constants (numeric for performance)
export type CSSNodeType =
	| typeof NODE_STYLESHEET
	| typeof NODE_STYLE_RULE
	| typeof NODE_AT_RULE
	| typeof NODE_DECLARATION
	| typeof NODE_SELECTOR
	| typeof NODE_COMMENT
	| typeof NODE_BLOCK
	| typeof NODE_VALUE_KEYWORD
	| typeof NODE_VALUE_NUMBER
	| typeof NODE_VALUE_DIMENSION
	| typeof NODE_VALUE_STRING
	| typeof NODE_VALUE_COLOR
	| typeof NODE_VALUE_FUNCTION
	| typeof NODE_VALUE_OPERATOR
	| typeof NODE_SELECTOR_LIST
	| typeof NODE_SELECTOR_TYPE
	| typeof NODE_SELECTOR_CLASS
	| typeof NODE_SELECTOR_ID
	| typeof NODE_SELECTOR_ATTRIBUTE
	| typeof NODE_SELECTOR_PSEUDO_CLASS
	| typeof NODE_SELECTOR_PSEUDO_ELEMENT
	| typeof NODE_SELECTOR_COMBINATOR
	| typeof NODE_SELECTOR_UNIVERSAL
	| typeof NODE_SELECTOR_NESTING
	| typeof NODE_PRELUDE_MEDIA_QUERY
	| typeof NODE_PRELUDE_MEDIA_FEATURE
	| typeof NODE_PRELUDE_MEDIA_TYPE
	| typeof NODE_PRELUDE_CONTAINER_QUERY
	| typeof NODE_PRELUDE_SUPPORTS_QUERY
	| typeof NODE_PRELUDE_LAYER_NAME
	| typeof NODE_PRELUDE_IDENTIFIER
	| typeof NODE_PRELUDE_OPERATOR
	| typeof NODE_PRELUDE_IMPORT_URL
	| typeof NODE_PRELUDE_IMPORT_LAYER
	| typeof NODE_PRELUDE_IMPORT_SUPPORTS

export class CSSNode {
	private arena: CSSDataArena
	private source: string
	private index: number

	constructor(arena: CSSDataArena, source: string, index: number) {
		this.arena = arena
		this.source = source
		this.index = index
	}

	// Get the node index (for internal use)
	get_index(): number {
		return this.index
	}

	// Get node type as number (for performance)
	get type(): CSSNodeType {
		return this.arena.get_type(this.index) as CSSNodeType
	}

	// Get the full text of this node from source
	get text(): string {
		let start = this.arena.get_start_offset(this.index)
		let length = this.arena.get_length(this.index)
		return this.source.substring(start, start + length)
	}

	// Get the "content" text (property name for declarations, at-rule name for at-rules, layer name for import layers)
	get name(): string {
		let start = this.arena.get_content_start(this.index)
		let length = this.arena.get_content_length(this.index)
		if (length === 0) return ''
		return this.source.substring(start, start + length)
	}

	// Alias for name (for declarations: "color" in "color: blue")
	// More semantic than `name` for declaration nodes
	get property(): string {
		return this.name
	}

	// Get the value text (for declarations: "blue" in "color: blue")
	get value(): string | null {
		let start = this.arena.get_value_start(this.index)
		let length = this.arena.get_value_length(this.index)
		if (length === 0) return null
		return this.source.substring(start, start + length)
	}

	// Get the prelude text (for at-rules: "(min-width: 768px)" in "@media (min-width: 768px)")
	// This is an alias for `value` to make at-rule usage more semantic
	get prelude(): string | null {
		return this.value
	}

	// Check if this declaration has !important
	get is_important(): boolean {
		return this.arena.has_flag(this.index, FLAG_IMPORTANT)
	}

	// Check if this has a vendor prefix (flag-based for performance)
	get is_vendor_prefixed(): boolean {
		return this.arena.has_flag(this.index, FLAG_VENDOR_PREFIXED)
	}

	// Check if this node has an error
	get has_error(): boolean {
		return this.arena.has_flag(this.index, FLAG_HAS_ERROR)
	}

	// Check if this at-rule has a prelude
	get has_prelude(): boolean {
		return this.arena.get_value_length(this.index) > 0
	}

	// Check if this rule has a block { }
	get has_block(): boolean {
		return this.arena.has_flag(this.index, FLAG_HAS_BLOCK)
	}

	// Check if this style rule has declarations
	get has_declarations(): boolean {
		return this.arena.has_flag(this.index, FLAG_HAS_DECLARATIONS)
	}

	// Get the block node (for style rules and at-rules with blocks)
	get block(): CSSNode | null {
		// For StyleRule: block is sibling after selector list
		if (this.type === NODE_STYLE_RULE) {
			let first = this.first_child
			if (!first) return null
			// Block is the sibling after selector list
			let blockNode = first.next_sibling
			if (blockNode && blockNode.type === NODE_BLOCK) {
				return blockNode
			}
			return null
		}

		// For AtRule: block is last child (after prelude nodes)
		if (this.type === NODE_AT_RULE) {
			// Find last child that is a block
			let child = this.first_child
			while (child) {
				if (child.type === NODE_BLOCK && !child.next_sibling) {
					return child
				}
				child = child.next_sibling
			}
			return null
		}

		return null
	}

	// Check if this block is empty (no declarations or rules, only comments allowed)
	get is_empty(): boolean {
		// Only valid on block nodes
		if (this.type !== NODE_BLOCK) {
			return false
		}

		// Empty if no children, or all children are comments
		let child = this.first_child
		while (child) {
			if (child.type !== NODE_COMMENT) {
				return false
			}
			child = child.next_sibling
		}
		return true
	}

	// --- Value Node Access (for declarations) ---

	// Get array of parsed value nodes (for declarations only)
	get values(): CSSNode[] {
		let result: CSSNode[] = []
		let child = this.first_child
		while (child) {
			result.push(child)
			child = child.next_sibling
		}
		return result
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

	// Get start line number
	get line(): number {
		return this.arena.get_start_line(this.index)
	}

	// Get start column number
	get column(): number {
		return this.arena.get_start_column(this.index)
	}

	// Get start offset in source
	get offset(): number {
		return this.arena.get_start_offset(this.index)
	}

	// Get length in source
	get length(): number {
		return this.arena.get_length(this.index)
	}

	// --- Tree Traversal ---

	// Get first child node
	get first_child(): CSSNode | null {
		let child_index = this.arena.get_first_child(this.index)
		if (child_index === 0) return null
		return new CSSNode(this.arena, this.source, child_index)
	}

	// Get next sibling node
	get next_sibling(): CSSNode | null {
		let sibling_index = this.arena.get_next_sibling(this.index)
		if (sibling_index === 0) return null
		return new CSSNode(this.arena, this.source, sibling_index)
	}

	// Check if this node has children
	get has_children(): boolean {
		return this.arena.has_children(this.index)
	}

	// Get all children as an array
	get children(): CSSNode[] {
		let result: CSSNode[] = []
		let child = this.first_child
		while (child) {
			result.push(child)
			child = child.next_sibling
		}
		return result
	}

	// Make CSSNode iterable over its children
	*[Symbol.iterator](): Iterator<CSSNode> {
		let child = this.first_child
		while (child) {
			yield child
			child = child.next_sibling
		}
	}
}
