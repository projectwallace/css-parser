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
	FLAG_VENDOR_PREFIXED,
	FLAG_HAS_ERROR,
} from './arena'

// Node type strings for ergonomic API
export type CSSNodeType = 'stylesheet' | 'rule' | 'atrule' | 'declaration' | 'selector' | 'comment'

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
	getIndex(): number {
		return this.index
	}

	// Get node type as string
	get type(): CSSNodeType {
		const typeNum = this.arena.getType(this.index)
		switch (typeNum) {
			case NODE_STYLESHEET:
				return 'stylesheet'
			case NODE_STYLE_RULE:
				return 'rule'
			case NODE_AT_RULE:
				return 'atrule'
			case NODE_DECLARATION:
				return 'declaration'
			case NODE_SELECTOR:
				return 'selector'
			case NODE_COMMENT:
				return 'comment'
			default:
				return 'stylesheet' // fallback
		}
	}

	// Get the full text of this node from source
	get text(): string {
		const start = this.arena.getStartOffset(this.index)
		const length = this.arena.getLength(this.index)
		return this.source.substring(start, start + length)
	}

	// Get the "content" text (property name for declarations, at-rule name for at-rules)
	get name(): string | null {
		const start = this.arena.getContentStart(this.index)
		const length = this.arena.getContentLength(this.index)
		if (length === 0) return null
		return this.source.substring(start, start + length)
	}

	// Check if this declaration has !important
	get isImportant(): boolean {
		return this.arena.hasFlag(this.index, FLAG_IMPORTANT)
	}

	// Check if this has a vendor prefix
	get isVendorPrefixed(): boolean {
		return this.arena.hasFlag(this.index, FLAG_VENDOR_PREFIXED)
	}

	// Check if this node has an error
	get hasError(): boolean {
		return this.arena.hasFlag(this.index, FLAG_HAS_ERROR)
	}

	// Get start line number
	get line(): number {
		return this.arena.getStartLine(this.index)
	}

	// Get start offset in source
	get offset(): number {
		return this.arena.getStartOffset(this.index)
	}

	// Get length in source
	get length(): number {
		return this.arena.getLength(this.index)
	}

	// --- Tree Traversal ---

	// Get first child node
	get firstChild(): CSSNode | null {
		const childIndex = this.arena.getFirstChild(this.index)
		if (childIndex === 0) return null
		return new CSSNode(this.arena, this.source, childIndex)
	}

	// Get next sibling node
	get nextSibling(): CSSNode | null {
		const siblingIndex = this.arena.getNextSibling(this.index)
		if (siblingIndex === 0) return null
		return new CSSNode(this.arena, this.source, siblingIndex)
	}

	// Check if this node has children
	get hasChildren(): boolean {
		return this.arena.hasChildren(this.index)
	}

	// Get all children as an array
	get children(): CSSNode[] {
		const result: CSSNode[] = []
		let child = this.firstChild
		while (child) {
			result.push(child)
			child = child.nextSibling
		}
		return result
	}

	// Make CSSNode iterable over its children
	*[Symbol.iterator](): Iterator<CSSNode> {
		let child = this.firstChild
		while (child) {
			yield child
			child = child.nextSibling
		}
	}
}
