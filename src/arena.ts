// CSS Data Arena - Single contiguous ArrayBuffer for all AST nodes
//
// Each node occupies 44 bytes with the following layout:
// Offset | Size | Field
// -------|------|-------------
//   0    |  1   | type
//   1    |  1   | flags
//   2    |  2   | (padding)
//   4    |  4   | startOffset
//   8    |  2   | length
//  10    |  2   | (padding)
//  12    |  4   | contentStart (property name / at-rule name)
//  16    |  2   | contentLength
//  18    |  2   | (padding)
//  20    |  4   | firstChild
//  24    |  4   | lastChild
//  28    |  4   | nextSibling
//  32    |  4   | startLine
//  36    |  4   | valueStart (declaration value / at-rule prelude)
//  40    |  2   | valueLength
//  42    |  2   | (padding)

let BYTES_PER_NODE = 44

// Node type constants
export const NODE_STYLESHEET = 1
export const NODE_STYLE_RULE = 2
export const NODE_AT_RULE = 3
export const NODE_DECLARATION = 4
export const NODE_SELECTOR = 5
export const NODE_COMMENT = 6

// Value node type constants (for declaration values)
export const NODE_VALUE_KEYWORD = 10      // identifier: red, auto, inherit
export const NODE_VALUE_NUMBER = 11        // number: 42, 3.14, -5
export const NODE_VALUE_DIMENSION = 12     // number with unit: 10px, 2em, 50%
export const NODE_VALUE_STRING = 13        // quoted string: "hello", 'world'
export const NODE_VALUE_COLOR = 14         // hex color: #fff, #ff0000
export const NODE_VALUE_FUNCTION = 15      // function: calc(), var(), url()
export const NODE_VALUE_OPERATOR = 16      // operator: +, -, *, /, comma

// Flag constants (bit-packed in 1 byte)
export const FLAG_IMPORTANT = 1 << 0 // Has !important
export const FLAG_HAS_ERROR = 1 << 1 // Syntax error
export const FLAG_LENGTH_OVERFLOW = 1 << 2 // Node > 65k chars

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
		this.count = 0
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
	getCount(): number {
		return this.count
	}

	// Get the capacity (max nodes without reallocation)
	getCapacity(): number {
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

	// Read content start offset
	get_content_start(node_index: number): number {
		return this.view.getUint32(this.node_offset(node_index) + 12, true)
	}

	// Read content length
	get_content_length(node_index: number): number {
		return this.view.getUint16(this.node_offset(node_index) + 16, true)
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

	// Read value start offset (declaration value / at-rule prelude)
	get_value_start(node_index: number): number {
		return this.view.getUint32(this.node_offset(node_index) + 36, true)
	}

	// Read value length
	get_value_length(node_index: number): number {
		return this.view.getUint16(this.node_offset(node_index) + 40, true)
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

	// Write content start offset
	set_content_start(node_index: number, offset: number): void {
		this.view.setUint32(this.node_offset(node_index) + 12, offset, true)
	}

	// Write content length
	set_content_length(node_index: number, length: number): void {
		this.view.setUint16(this.node_offset(node_index) + 16, length, true)
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

	// Write value start offset (declaration value / at-rule prelude)
	set_value_start(node_index: number, offset: number): void {
		this.view.setUint32(this.node_offset(node_index) + 36, offset, true)
	}

	// Write value length
	set_value_length(node_index: number, length: number): void {
		this.view.setUint16(this.node_offset(node_index) + 40, length, true)
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
