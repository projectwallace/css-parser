// CSSNode - Ergonomic wrapper over arena node indices
import type { CSSDataArena } from './arena'
import {
	NODE_STYLESHEET,
	NODE_STYLE_RULE,
	NODE_AT_RULE,
	NODE_DECLARATION,
	NODE_SELECTOR,
	NODE_COMMENT,
	FLAG_IMPORTANT,
	FLAG_HAS_ERROR,
} from './arena'

// Node type constants (numeric for performance)
export type CSSNodeType =
	| typeof NODE_STYLESHEET
	| typeof NODE_STYLE_RULE
	| typeof NODE_AT_RULE
	| typeof NODE_DECLARATION
	| typeof NODE_SELECTOR
	| typeof NODE_COMMENT

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

	// Get the "content" text (property name for declarations, at-rule name for at-rules)
	get name(): string | null {
		let start = this.arena.get_content_start(this.index)
		let length = this.arena.get_content_length(this.index)
		if (length === 0) return null
		return this.source.substring(start, start + length)
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

	// Check if this has a vendor prefix (lazy computation for performance)
	get is_vendor_prefixed(): boolean {
		const name = this.name
		if (!name) return false
		return name.startsWith('-webkit-') || name.startsWith('-moz-') || name.startsWith('-ms-') || name.startsWith('-o-')
	}

	// Check if this node has an error
	get has_error(): boolean {
		return this.arena.has_flag(this.index, FLAG_HAS_ERROR)
	}

	// Get start line number
	get line(): number {
		return this.arena.get_start_line(this.index)
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

	toJSON() {
		return {
			type: this.type,
			line: this.line,
			text: this.text,
		}
	}
}
