// CSS Data Arena - Single contiguous ArrayBuffer for all AST nodes
//
// Each node occupies 36 bytes with the following layout:
// Offset | Size | Field
// -------|------|-------------
//   0    |  1   | type
//   1    |  1   | flags
//   2    |  2   | length
//   4    |  4   | firstChild
//   8    |  4   | nextSibling
//  12    |  4   | startOffset
//  16    |  2   | contentStartDelta (offset from startOffset, property name / at-rule name)
//  18    |  2   | valueStartDelta (offset from startOffset, declaration value / at-rule prelude)
//  20    |  2   | contentLength
//  22    |  2   | valueLength
//  24    |  4   | startLine
//  28    |  4   | startColumn
//  32    |  1   | attr_operator
//  33    |  1   | attr_flags
//  34    |  2   | (padding)
//
// HOW THE ARENA WORKS:
// 1. BYTES_PER_NODE defines the size of each node (36 bytes). The ArrayBuffer size is calculated
//    as: capacity × BYTES_PER_NODE. For example, 1024 nodes = 36,864 bytes (36KB).
//    Node indices map to byte offsets via: node_offset = node_index × 36.
//
// 2. We use a single DataView over the ArrayBuffer to read/write different types at specific offsets.
//    - Uint8: 1-byte reads/writes for type, flags (e.g., view.getUint8(offset))
//    - Uint16: 2-byte reads/writes for length, deltas (e.g., view.getUint16(offset, true))
//    - Uint32: 4-byte reads/writes for startOffset, pointers, line, column (e.g., view.getUint32(offset, true))
//    The 'true' parameter specifies little-endian byte order (native on x86/ARM CPUs).
//
// 3. Padding (2 bytes at offsets 34-35) ensures memory alignment for performance:
//    - Uint32 fields align to 4-byte boundaries (offsets 4, 8, 12, 24, 28)
//    - Uint16 fields align to 2-byte boundaries (offsets 2, 16, 18, 20, 22)
//    Aligned access is faster (single CPU instruction) vs unaligned (multiple memory accesses).
//    Modern CPUs penalize unaligned reads/writes, making padding essential for performance.
//
// 4. Delta offsets (contentStartDelta, valueStartDelta) save memory: instead of storing absolute
//    positions as uint32 (4 bytes), we store relative offsets as uint16 (2 bytes). Removing unused
//    lastChild field saved another 4 bytes. startColumn was changed from Uint16 to Uint32 to avoid
//    overflow on long lines (common in minified CSS). Node size: 44→40→36 bytes.

let BYTES_PER_NODE = 36

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
export const HASH = 14 // hex color: #fff, #ff0000
export const FUNCTION = 15 // function: calc(), var()
export const OPERATOR = 16 // operator: +, -, *, /, comma
export const PARENTHESIS = 17 // parenthesized expression: (100% - 50px)
export const URL = 18 // URL: url("file.css"), url(image.png), used in values and @import
export const VALUE = 19 // Wrapper for declaration values

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
export const PRELUDE_OPERATOR = 38 // logical operator: and, or, not
export const FEATURE_RANGE = 39 // Range syntax: (50px <= width <= 100px)

// Flag constants (bit-packed in 1 byte)
export const FLAG_IMPORTANT = 1 << 0 // Has !important
export const FLAG_HAS_ERROR = 1 << 1 // Syntax error
export const FLAG_LENGTH_OVERFLOW = 1 << 2 // Node > 65k chars
export const FLAG_HAS_BLOCK = 1 << 3 // Has { } block (for style rules and at-rules)
export const FLAG_VENDOR_PREFIXED = 1 << 4 // Has vendor prefix (-webkit-, -moz-, -ms-, -o-)
export const FLAG_HAS_DECLARATIONS = 1 << 5 // Has declarations (for style rules)
export const FLAG_HAS_PARENS = 1 << 6 // Has parentheses syntax (for pseudo-class/pseudo-element functions)
export const FLAG_BROWSERHACK = 1 << 7 // Has browser hack prefix (*property, _property, etc.)

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

/** @internal */
export class CSSDataArena {
	private buffer: ArrayBuffer
	private view: DataView
	private capacity: number // Number of nodes that can fit
	private count: number // Number of nodes currently allocated
	private growth_count: number // Number of times the arena has grown
	private overflow_lengths: Map<number, number> // Stores actual lengths for nodes > 65535 chars

	// Growth multiplier when capacity is exceeded
	private static readonly GROWTH_FACTOR = 1.3

	// Estimated nodes per KB of CSS (based on real-world data)
	// Increased from 270 to 325 to account for VALUE wrapper nodes
	// (~20% of nodes are declarations, +1 VALUE node per declaration = +20% nodes)
	private static readonly NODES_PER_KB = 325

	// Buffer to avoid frequent growth (15%)
	private static readonly CAPACITY_BUFFER = 1.2

	constructor(initial_capacity: number = 1024) {
		this.capacity = initial_capacity
		// Start count at 1 since 0 is reserved for "no node"
		this.count = 1
		this.growth_count = 0
		this.buffer = new ArrayBuffer(initial_capacity * BYTES_PER_NODE)
		this.view = new DataView(this.buffer)
		this.overflow_lengths = new Map()
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

	// Get the number of times the arena has grown
	get_growth_count(): number {
		return this.growth_count
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
		return this.view.getUint32(this.node_offset(node_index) + 12, true)
	}

	// Read length in source
	get_length(node_index: number): number {
		// Check if this node has overflow length stored
		if (this.has_flag(node_index, FLAG_LENGTH_OVERFLOW)) {
			const overflow_length = this.overflow_lengths.get(node_index)
			if (overflow_length !== undefined) {
				return overflow_length
			}
		}
		return this.view.getUint16(this.node_offset(node_index) + 2, true)
	}

	// Read content start offset (stored as delta from startOffset)
	get_content_start(node_index: number): number {
		const startOffset = this.get_start_offset(node_index)
		const delta = this.view.getUint16(this.node_offset(node_index) + 16, true)
		return startOffset + delta
	}

	// Read content length
	get_content_length(node_index: number): number {
		return this.view.getUint16(this.node_offset(node_index) + 20, true)
	}

	// Read attribute operator (for NODE_SELECTOR_ATTRIBUTE)
	get_attr_operator(node_index: number): number {
		return this.view.getUint8(this.node_offset(node_index) + 32)
	}

	// Read attribute flags (for NODE_SELECTOR_ATTRIBUTE)
	get_attr_flags(node_index: number): number {
		return this.view.getUint8(this.node_offset(node_index) + 33)
	}

	// Read first child index (0 = no children)
	get_first_child(node_index: number): number {
		return this.view.getUint32(this.node_offset(node_index) + 4, true)
	}

	// Read next sibling index (0 = no sibling)
	get_next_sibling(node_index: number): number {
		return this.view.getUint32(this.node_offset(node_index) + 8, true)
	}

	// Read start line
	get_start_line(node_index: number): number {
		return this.view.getUint32(this.node_offset(node_index) + 24, true)
	}

	// Read start column
	get_start_column(node_index: number): number {
		return this.view.getUint32(this.node_offset(node_index) + 28, true)
	}

	// Read value start offset (stored as delta from startOffset, declaration value / at-rule prelude)
	get_value_start(node_index: number): number {
		const startOffset = this.get_start_offset(node_index)
		const delta = this.view.getUint16(this.node_offset(node_index) + 18, true)
		return startOffset + delta
	}

	// Read value length
	get_value_length(node_index: number): number {
		return this.view.getUint16(this.node_offset(node_index) + 22, true)
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

	// Write length in source
	set_length(node_index: number, length: number): void {
		// Uint16 max value is 65535
		if (length > 65535) {
			this.view.setUint16(this.node_offset(node_index) + 2, 65535, true)
			this.set_flag(node_index, FLAG_LENGTH_OVERFLOW)
			// Store the actual length in the overflow map
			this.overflow_lengths.set(node_index, length)
		} else {
			this.view.setUint16(this.node_offset(node_index) + 2, length, true)
		}
	}

	// Write content start delta (offset from startOffset)
	set_content_start_delta(node_index: number, delta: number): void {
		this.view.setUint16(this.node_offset(node_index) + 16, delta, true)
	}

	// Write content length
	set_content_length(node_index: number, length: number): void {
		this.view.setUint16(this.node_offset(node_index) + 20, length, true)
	}

	// Write attribute operator (for NODE_SELECTOR_ATTRIBUTE)
	set_attr_operator(node_index: number, operator: number): void {
		this.view.setUint8(this.node_offset(node_index) + 32, operator)
	}

	// Write attribute flags (for NODE_SELECTOR_ATTRIBUTE)
	set_attr_flags(node_index: number, flags: number): void {
		this.view.setUint8(this.node_offset(node_index) + 33, flags)
	}

	// Write first child index
	set_first_child(node_index: number, childIndex: number): void {
		this.view.setUint32(this.node_offset(node_index) + 4, childIndex, true)
	}

	// Write next sibling index
	set_next_sibling(node_index: number, siblingIndex: number): void {
		this.view.setUint32(this.node_offset(node_index) + 8, siblingIndex, true)
	}

	// Write value start delta (offset from startOffset, declaration value / at-rule prelude)
	set_value_start_delta(node_index: number, delta: number): void {
		this.view.setUint16(this.node_offset(node_index) + 18, delta, true)
	}

	// Write value length
	set_value_length(node_index: number, length: number): void {
		this.view.setUint16(this.node_offset(node_index) + 22, length, true)
	}

	// --- Node Creation ---

	// Grow the arena by 1.3x when capacity is exceeded
	private grow(): void {
		this.growth_count++
		let new_capacity = Math.ceil(this.capacity * CSSDataArena.GROWTH_FACTOR)
		let new_buffer = new ArrayBuffer(new_capacity * BYTES_PER_NODE)

		// Copy existing data to new buffer
		new Uint8Array(new_buffer).set(new Uint8Array(this.buffer))

		// Update arena state
		this.buffer = new_buffer
		this.view = new DataView(new_buffer)
		this.capacity = new_capacity
	}

	// Allocate and initialize a new node with core properties
	// Automatically grows the arena if capacity is exceeded
	create_node(type: number, start_offset: number, length: number, start_line: number, start_column: number): number {
		if (this.count >= this.capacity) {
			this.grow()
		}
		const node_index = this.count
		this.count++

		const offset = node_index * BYTES_PER_NODE
		this.view.setUint8(offset, type) // +0: type
		this.view.setUint32(offset + 12, start_offset, true) // +12: startOffset
		this.view.setUint32(offset + 24, start_line, true) // +24: startLine
		this.view.setUint32(offset + 28, start_column, true) // +28: startColumn

		// Use setter method to handle overflow
		this.set_length(node_index, length)

		return node_index
	}

	// --- Tree Building Helpers ---

	// Link multiple child nodes to a parent
	// Children are linked as siblings in the order provided
	append_children(parent_index: number, children: number[]): void {
		if (children.length === 0) return

		const offset = this.node_offset(parent_index)
		this.view.setUint32(offset + 4, children[0], true) // firstChild

		// Chain siblings
		for (let i = 0; i < children.length - 1; i++) {
			this.set_next_sibling(children[i], children[i + 1])
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
