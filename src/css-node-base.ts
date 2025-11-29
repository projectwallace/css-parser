// CSSNode Base - Abstract base class for all type-specific node classes
import type { CSSDataArena } from './arena'
import type { AnyNode } from './types'
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
	NODE_SELECTOR_NTH,
	NODE_SELECTOR_NTH_OF,
	NODE_SELECTOR_LANG,
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
	| typeof NODE_SELECTOR_NTH
	| typeof NODE_SELECTOR_NTH_OF
	| typeof NODE_SELECTOR_LANG
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

export abstract class CSSNode {
	protected arena: CSSDataArena
	protected source: string
	protected index: number

	constructor(arena: CSSDataArena, source: string, index: number) {
		this.arena = arena
		this.source = source
		this.index = index
	}

	// Factory method to create type-specific node instances
	// Subclasses will implement this to return the correct type
	static from(arena: CSSDataArena, source: string, index: number): CSSNode {
		throw new Error('from() must be implemented by concrete CSSNode class')
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

	// Check if this node has an error
	get has_error(): boolean {
		return this.arena.has_flag(this.index, FLAG_HAS_ERROR)
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
	// Returns type-specific node (StylesheetNode, DeclarationNode, etc.)
	get first_child(): AnyNode | null {
		let child_index = this.arena.get_first_child(this.index)
		if (child_index === 0) return null
		// Factory returns the correct type-specific node
		return this.create_node_wrapper(child_index)
	}

	// Get next sibling node
	// Returns type-specific node (StylesheetNode, DeclarationNode, etc.)
	get next_sibling(): AnyNode | null {
		let sibling_index = this.arena.get_next_sibling(this.index)
		if (sibling_index === 0) return null
		// Factory returns the correct type-specific node
		return this.create_node_wrapper(sibling_index)
	}

	// Helper to create node wrappers - can be overridden by subclasses
	protected create_node_wrapper(index: number): AnyNode {
		// Create instance of the same class type
		return new (this.constructor as any)(this.arena, this.source, index)
	}

	get has_next(): boolean {
		let sibling_index = this.arena.get_next_sibling(this.index)
		return sibling_index !== 0
	}

	// Check if this node has children
	get has_children(): boolean {
		return this.arena.has_children(this.index)
	}

	// Get all children as an array
	// Returns array of type-specific nodes
	get children(): AnyNode[] {
		let result: AnyNode[] = []
		let child = this.first_child
		while (child) {
			result.push(child)
			child = child.next_sibling
		}
		return result
	}

	// Make CSSNode iterable over its children
	// Yields type-specific nodes
	*[Symbol.iterator](): Iterator<AnyNode> {
		let child = this.first_child
		while (child) {
			yield child
			child = child.next_sibling
		}
	}

	// Default implementations for properties that only some node types have
	// Subclasses can override these to provide specific behavior

	// Check if this node has a prelude (for at-rules)
	// Default: false. AtRuleNode overrides this.
	get has_prelude(): boolean {
		return this.arena.get_value_length(this.index) > 0
	}

	// Check if this node has a block (for at-rules and style rules)
	// Default: false. AtRuleNode and StyleRuleNode override this.
	get has_block(): boolean {
		return false
	}

	// Check if this style rule has declarations (for style rules)
	// Default: false. Only StyleRuleNode overrides this.
	get has_declarations(): boolean {
		return false
	}

	// Check if this node has a vendor prefix
	// Default: false. DeclarationNode and selector pseudo nodes override this.
	get is_vendor_prefixed(): boolean {
		return false
	}

	// CamelCase alias for is_vendor_prefixed
	get isVendorPrefixed(): boolean {
		return this.is_vendor_prefixed
	}

}
