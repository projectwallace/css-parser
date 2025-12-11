// CSS Data Arena - Single contiguous ArrayBuffer for all AST nodes
//
// Each node occupies 40 bytes with the following layout:
// Offset | Size | Field
// -------|------|-------------
//   0    |  1   | type
//   1    |  1   | flags
//   2    |  2   | (padding)
//   4    |  4   | startOffset
//   8    |  2   | length
//  10    |  2   | (padding)
//  12    |  2   | contentStartDelta (offset from startOffset, property name / at-rule name)
//  14    |  2   | contentLength
//  16    |  2   | valueStartDelta (offset from startOffset, declaration value / at-rule prelude)
//  18    |  2   | valueLength
//  20    |  4   | firstChild
//  24    |  4   | lastChild
//  28    |  4   | nextSibling
//  32    |  4   | startLine
//  36    |  2   | startColumn
//  38    |  2   | (padding)

let BYTES_PER_NODE = 40

// Node type constants
export const STYLESHEET = 1
export const STYLE_RULE = 2
export const AT_RULE = 3
export const DECLARATION = 4
export const SELECTOR = 5
export const COMMENT = 6
export const BLOCK = 7 // Block container for declarations and nested rules

// Value node type constants (for declaration values)
export const IDENTIFIER = 10 // identifier: red, auto, inherit
export const NUMBER = 11 // number: 42, 3.14, -5
export const DIMENSION = 12 // number with unit: 10px, 2em, 50%
export const STRING = 13 // quoted string: "hello", 'world'
export const HEX = 14 // hex color: #fff, #ff0000
export const FUNCTION = 15 // function: calc(), var(), url()
export const OPERATOR = 16 // operator: +, -, *, /, comma
export const PARENTHESIS = 17 // parenthesized expression: (100% - 50px)

// Selector node type constants (for detailed selector parsing)
export const SELECTOR_LIST = 20 // comma-separated selectors
export const TYPE_SELECTOR = 21 // type selector: div, span, p
export const CLASS_SELECTOR = 22 // class selector: .classname
export const ID_SELECTOR = 23 // ID selector: #identifier
export const ATTRIBUTE_SELECTOR = 24 // attribute selector: [attr], [attr=value]
export const PSEUDO_CLASS_SELECTOR = 25 // pseudo-class: :hover, :nth-child()
export const PSEUDO_ELEMENT_SELECTOR = 26 // pseudo-element: ::before, ::after
export const COMBINATOR = 27 // combinator: >, +, ~, space
export const UNIVERSAL_SELECTOR = 28 // universal selector: *
export const NESTING_SELECTOR = 29 // nesting selector: &
export const NTH_SELECTOR = 30 // An+B expression: 2n+1, odd, even
export const NTH_OF_SELECTOR = 31 // An+B with "of <selector>" syntax
export const LANG_SELECTOR = 56 // language identifier for :lang() pseudo-class

// At-rule prelude node type constants (for at-rule prelude parsing)
export const MEDIA_QUERY = 32 // media query: screen, (min-width: 768px)
export const MEDIA_FEATURE = 33 // media feature: (min-width: 768px)
export const MEDIA_TYPE = 34 // media type: screen, print, all
export const CONTAINER_QUERY = 35 // container query: sidebar (min-width: 400px)
export const SUPPORTS_QUERY = 36 // supports query: (display: flex)
export const LAYER_NAME = 37 // layer name: base, components
export const PRELUDE_IDENTIFIER = 38 // generic identifier: keyframe name, property name
export const PRELUDE_OPERATOR = 39 // logical operator: and, or, not
export const IMPORT_URL = 40 // import URL: url("file.css") or "file.css"
export const IMPORT_LAYER = 41 // import layer: layer or layer(name)

// Flag constants (bit-packed in 1 byte)
export const FLAG_IMPORTANT = 1 << 0 // Has !important
export const FLAG_HAS_ERROR = 1 << 1 // Syntax error
export const FLAG_LENGTH_OVERFLOW = 1 << 2 // Node > 65k chars
export const FLAG_HAS_BLOCK = 1 << 3 // Has { } block (for style rules and at-rules)
export const FLAG_VENDOR_PREFIXED = 1 << 4 // Has vendor prefix (-webkit-, -moz-, -ms-, -o-)
export const FLAG_HAS_DECLARATIONS = 1 << 5 // Has declarations (for style rules)
export const FLAG_HAS_PARENS = 1 << 6 // Has parentheses syntax (for pseudo-class/pseudo-element functions)

// Attribute selector operator constants (stored in 1 byte at offset 2)
export const ATTR_OPERATOR_NONE = 0 // [attr]
export const ATTR_OPERATOR_EQUAL = 1 // [attr=value]
export const ATTR_OPERATOR_TILDE_EQUAL = 2 // [attr~=value]
export const ATTR_OPERATOR_PIPE_EQUAL = 3 // [attr|=value]
export const ATTR_OPERATOR_CARET_EQUAL = 4 // [attr^=value]
export const ATTR_OPERATOR_DOLLAR_EQUAL = 5 // [attr$=value]
export const ATTR_OPERATOR_STAR_EQUAL = 6 // [attr*=value]

// Attribute selector flag constants (stored in 1 byte at offset 3)
export const ATTR_FLAG_NONE = 0 // No flag
export const ATTR_FLAG_CASE_INSENSITIVE = 1 // [attr=value i]
export const ATTR_FLAG_CASE_SENSITIVE = 2 // [attr=value s]

export class CSSDataArena {
	private buffer: ArrayBuffer
	private view: DataView
	private capacity: number // Number of nodes that can fit
	private count: number // Number of nodes currently allocated

	// Growth multiplier when capacity is exceeded
	private static readonly GROWTH_FACTOR = 1.3

	// Estimated nodes per KB of CSS (based on real-world data)
	private static readonly NODES_PER_KB = 60

	// Buffer to avoid frequent growth (15%)
	private static readonly CAPACITY_BUFFER = 1.15

	constructor(initial_capacity: number = 1024) {
		this.capacity = initial_capacity
		// Start count at 1 since 0 is reserved for "no node"
		this.count = 1
		this.buffer = new ArrayBuffer(initial_capacity * BYTES_PER_NODE)
		this.view = new DataView(this.buffer)
	}

	// Calculate recommended initial capacity based on CSS source size
	static capacity_for_source(source_length: number): number {
		let size_in_kb = source_length / 1024
		let estimated_nodes = Math.ceil(size_in_kb * CSSDataArena.NODES_PER_KB)
		// Add 15% buffer to avoid growth during parsing
		let capacity = Math.ceil(estimated_nodes * CSSDataArena.CAPACITY_BUFFER)
		// Ensure minimum capacity of 16 nodes (even for empty stylesheets)
		return Math.max(16, capacity)
	}

	// Get the number of nodes currently in the arena
	get_count(): number {
		return this.count
	}

	// Get the capacity (max nodes without reallocation)
	get_capacity(): number {
		return this.capacity
	}

	// Calculate byte offset for a node
	private node_offset(node_index: number): number {
		return node_index * BYTES_PER_NODE
	}

	// Read node type
	get_type(node_index: number): number {
		return this.view.getUint8(this.node_offset(node_index))
	}

	// Read node flags
	get_flags(node_index: number): number {
		return this.view.getUint8(this.node_offset(node_index) + 1)
	}

	// Read start offset in source
	get_start_offset(node_index: number): number {
		return this.view.getUint32(this.node_offset(node_index) + 4, true)
	}

	// Read length in source
	get_length(node_index: number): number {
		return this.view.getUint16(this.node_offset(node_index) + 8, true)
	}

	// Read content start offset (stored as delta from startOffset)
	get_content_start(node_index: number): number {
		const startOffset = this.get_start_offset(node_index)
		const delta = this.view.getUint16(this.node_offset(node_index) + 12, true)
		return startOffset + delta
	}

	// Read content length
	get_content_length(node_index: number): number {
		return this.view.getUint16(this.node_offset(node_index) + 14, true)
	}

	// Read attribute operator (for NODE_SELECTOR_ATTRIBUTE)
	get_attr_operator(node_index: number): number {
		return this.view.getUint8(this.node_offset(node_index) + 2)
	}

	// Read attribute flags (for NODE_SELECTOR_ATTRIBUTE)
	get_attr_flags(node_index: number): number {
		return this.view.getUint8(this.node_offset(node_index) + 3)
	}

	// Read first child index (0 = no children)
	get_first_child(node_index: number): number {
		return this.view.getUint32(this.node_offset(node_index) + 20, true)
	}

	// Read last child index (0 = no children)
	get_last_child(node_index: number): number {
		return this.view.getUint32(this.node_offset(node_index) + 24, true)
	}

	// Read next sibling index (0 = no sibling)
	get_next_sibling(node_index: number): number {
		return this.view.getUint32(this.node_offset(node_index) + 28, true)
	}

	// Read start line
	get_start_line(node_index: number): number {
		return this.view.getUint32(this.node_offset(node_index) + 32, true)
	}

	// Read start column
	get_start_column(node_index: number): number {
		return this.view.getUint16(this.node_offset(node_index) + 36, true)
	}

	// Read value start offset (stored as delta from startOffset, declaration value / at-rule prelude)
	get_value_start(node_index: number): number {
		const startOffset = this.get_start_offset(node_index)
		const delta = this.view.getUint16(this.node_offset(node_index) + 16, true)
		return startOffset + delta
	}

	// Read value length
	get_value_length(node_index: number): number {
		return this.view.getUint16(this.node_offset(node_index) + 18, true)
	}

	// --- Write Methods ---

	// Write node type
	set_type(node_index: number, type: number): void {
		this.view.setUint8(this.node_offset(node_index), type)
	}

	// Write node flags
	set_flags(node_index: number, flags: number): void {
		this.view.setUint8(this.node_offset(node_index) + 1, flags)
	}

	// Write start offset in source
	set_start_offset(node_index: number, offset: number): void {
		this.view.setUint32(this.node_offset(node_index) + 4, offset, true)
	}

	// Write length in source
	set_length(node_index: number, length: number): void {
		this.view.setUint16(this.node_offset(node_index) + 8, length, true)
	}

	// Write content start offset (stored as delta from startOffset)
	set_content_start(node_index: number, offset: number): void {
		const startOffset = this.get_start_offset(node_index)
		const delta = offset - startOffset
		this.view.setUint16(this.node_offset(node_index) + 12, delta, true)
	}

	// Write content length
	set_content_length(node_index: number, length: number): void {
		this.view.setUint16(this.node_offset(node_index) + 14, length, true)
	}

	// Write attribute operator (for NODE_SELECTOR_ATTRIBUTE)
	set_attr_operator(node_index: number, operator: number): void {
		this.view.setUint8(this.node_offset(node_index) + 2, operator)
	}

	// Write attribute flags (for NODE_SELECTOR_ATTRIBUTE)
	set_attr_flags(node_index: number, flags: number): void {
		this.view.setUint8(this.node_offset(node_index) + 3, flags)
	}

	// Write first child index
	set_first_child(node_index: number, childIndex: number): void {
		this.view.setUint32(this.node_offset(node_index) + 20, childIndex, true)
	}

	// Write last child index
	set_last_child(node_index: number, childIndex: number): void {
		this.view.setUint32(this.node_offset(node_index) + 24, childIndex, true)
	}

	// Write next sibling index
	set_next_sibling(node_index: number, siblingIndex: number): void {
		this.view.setUint32(this.node_offset(node_index) + 28, siblingIndex, true)
	}

	// Write start line
	set_start_line(node_index: number, line: number): void {
		this.view.setUint32(this.node_offset(node_index) + 32, line, true)
	}

	// Write start column
	set_start_column(node_index: number, column: number): void {
		this.view.setUint16(this.node_offset(node_index) + 36, column, true)
	}

	// Write value start offset (stored as delta from startOffset, declaration value / at-rule prelude)
	set_value_start(node_index: number, offset: number): void {
		const startOffset = this.get_start_offset(node_index)
		const delta = offset - startOffset
		this.view.setUint16(this.node_offset(node_index) + 16, delta, true)
	}

	// Write value length
	set_value_length(node_index: number, length: number): void {
		this.view.setUint16(this.node_offset(node_index) + 18, length, true)
	}

	// --- Node Creation ---

	// Grow the arena by 1.3x when capacity is exceeded
	private grow(): void {
		let new_capacity = Math.ceil(this.capacity * CSSDataArena.GROWTH_FACTOR)
		let new_buffer = new ArrayBuffer(new_capacity * BYTES_PER_NODE)

		// Copy existing data to new buffer
		new Uint8Array(new_buffer).set(new Uint8Array(this.buffer))

		// Update arena state
		this.buffer = new_buffer
		this.view = new DataView(new_buffer)
		this.capacity = new_capacity
	}

	// Allocate a new node and return its index
	// The node is zero-initialized by default (ArrayBuffer guarantees this)
	// Automatically grows the arena if capacity is exceeded
	create_node(): number {
		if (this.count >= this.capacity) {
			this.grow()
		}
		let node_index = this.count
		this.count++
		return node_index
	}

	// --- Tree Building Helpers ---

	// Add a child node to a parent node
	// This appends to the end of the child list using the sibling chain
	// O(1) operation using lastChild pointer
	append_child(parentIndex: number, childIndex: number): void {
		let last_child = this.get_last_child(parentIndex)

		if (last_child === 0) {
			// No children yet, make this the first and last child
			this.set_first_child(parentIndex, childIndex)
			this.set_last_child(parentIndex, childIndex)
		} else {
			// Append to the current last child's sibling chain
			this.set_next_sibling(last_child, childIndex)
			// Update parent's last child pointer
			this.set_last_child(parentIndex, childIndex)
		}
	}

	// Check if a node has any children
	has_children(node_index: number): boolean {
		return this.get_first_child(node_index) !== 0
	}

	// Check if a node has a next sibling
	has_next_sibling(node_index: number): boolean {
		return this.get_next_sibling(node_index) !== 0
	}

	// --- Flag Management Helpers ---

	// Set a specific flag bit (doesn't clear other flags)
	set_flag(node_index: number, flag: number): void {
		let current_flags = this.get_flags(node_index)
		this.set_flags(node_index, current_flags | flag)
	}

	// Clear a specific flag bit (doesn't affect other flags)
	clear_flag(node_index: number, flag: number): void {
		let current_flags = this.get_flags(node_index)
		this.set_flags(node_index, current_flags & ~flag)
	}

	// Check if a specific flag is set
	has_flag(node_index: number, flag: number): boolean {
		return (this.get_flags(node_index) & flag) !== 0
	}
}
