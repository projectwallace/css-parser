// CSS Data Arena - Single contiguous ArrayBuffer for all AST nodes
//
// Each node occupies 32 bytes with the following layout:
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
//
// HOW THE ARENA WORKS:
// 1. BYTES_PER_NODE defines the size of each node (32 bytes). The ArrayBuffer size is calculated
//    as: capacity × BYTES_PER_NODE. For example, 1024 nodes = 32,768 bytes (32KB).
//
// 2. We keep three TypedArray views over the *same* ArrayBuffer instead of a single DataView:
//    - u8  (Uint8Array):  type, flags
//    - u16 (Uint16Array): length, deltas, contentLength, valueLength
//    - u32 (Uint32Array): firstChild, nextSibling, startOffset, startLine, startColumn
//    Every field is naturally aligned (see point 3), so each one maps to a whole-number element
//    index in its view — no DataView.getX(byteOffset, littleEndian) call is needed. Indexed
//    TypedArray access avoids that call's argument handling and reads native (little-endian)
//    byte order directly, which is the only order actually used on real hardware (x86/ARM).
//    A node's element index within each view is node_index × (BYTES_PER_NODE / element size):
//    ×32 for u8, ×16 for u16, ×8 for u32 — see U16_PER_NODE/U32_PER_NODE below.
//
// 3. All fields are naturally aligned:
//    - Uint32 fields align to 4-byte boundaries (offsets 4, 8, 12, 24, 28)
//    - Uint16 fields align to 2-byte boundaries (offsets 2, 16, 18, 20, 22)
//    Aligned access is faster (single CPU instruction) vs unaligned (multiple memory accesses).
//    Modern CPUs penalize unaligned reads/writes, making alignment essential for performance.
//
// 4. Delta offsets (contentStartDelta, valueStartDelta) save memory: instead of storing absolute
//    positions as uint32 (4 bytes), we store relative offsets as uint16 (2 bytes). Removing unused
//    lastChild field saved another 4 bytes. startColumn was changed from Uint16 to Uint32 to avoid
//    overflow on long lines (common in minified CSS).

const BYTES_PER_NODE = 32
const U16_PER_NODE = BYTES_PER_NODE / 2 // element stride into the Uint16Array view
const U32_PER_NODE = BYTES_PER_NODE / 4 // element stride into the Uint32Array view

// Element indices within a node, in each view's own element units (not bytes).
const U16_LENGTH = 1 // byte offset 2
const U16_CONTENT_START_DELTA = 8 // byte offset 16
const U16_VALUE_START_DELTA = 9 // byte offset 18
const U16_CONTENT_LENGTH = 10 // byte offset 20
const U16_VALUE_LENGTH = 11 // byte offset 22

const U32_FIRST_CHILD = 1 // byte offset 4
const U32_NEXT_SIBLING = 2 // byte offset 8
const U32_START_OFFSET = 3 // byte offset 12
const U32_START_LINE = 6 // byte offset 24
const U32_START_COLUMN = 7 // byte offset 28

// Node type constants
export const STYLESHEET = 1
export const STYLE_RULE = 2
export const AT_RULE = 3
export const DECLARATION = 4
export const SELECTOR = 5
export const COMMENT = 6
export const BLOCK = 7 // Block container for declarations and nested rules
export const RAW = 8 // Unparsed nodes

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
export const UNICODE_RANGE = 19 // unicode range: u+0025-00ff, u+4??
export const IF_BRANCH = 59 // Branch inside an if() function: <condition>: <value>
export const IF_CONDITION = 60 // Compound if()-branch condition: not style(...), style(...) and media(...), etc.

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
export const AT_RULE_PRELUDE = 40 // Wrapper for at-rule prelude children
export const PRELUDE_SELECTORLIST = 41 // Parenthesized selector list in at-rule preludes: (.parent), (figure) in @scope
export const SUPPORTS_DECLARATION = 57 // declaration wrapper inside @supports: (display: flex)
export const RATIO = 58 // ratio value: 16/9 in aspect-ratio: 16/9

// Wrapper node types
export const VALUE = 50 // Wrapper for declaration values

// Flag constants (bit-packed in 1 byte)
export const FLAG_IMPORTANT = 1 << 0 // Has !important
export const FLAG_HAS_ERROR = 1 << 1 // Syntax error
export const FLAG_LENGTH_OVERFLOW = 1 << 2 // Node > 65k chars
export const FLAG_HAS_BLOCK = 1 << 3 // Has { } block (for style rules and at-rules)
// export const FLAG_VENDOR_PREFIXED = 1 << 4 // Has vendor prefix (-webkit-, -moz-, -ms-, -o-)
export const FLAG_HAS_NAMESPACE = 1 << 4 // Has namespace qualifier (for type/universal selectors)
export const FLAG_HAS_DECLARATIONS = 1 << 5 // Has direct declaration children (style rules and at-rules)
export const FLAG_HAS_PARENS = 1 << 6 // Has parentheses syntax (for pseudo-class/pseudo-element functions)
export const FLAG_BROWSERHACK = 1 << 7 // Has browser hack prefix (*property, _property, etc.)

/** @internal */
export class CSSDataArena {
	private buffer: ArrayBuffer
	private u8: Uint8Array
	private u16: Uint16Array
	private u32: Uint32Array
	private capacity: number // Number of nodes that can fit
	private count: number // Number of nodes currently allocated
	private growth_count: number // Number of times the arena has grown
	private overflow_lengths: Map<number, number> // Stores actual lengths for nodes > 65535 chars

	// Growth multiplier when capacity is exceeded
	private static readonly GROWTH_FACTOR = 1.3

	// Estimated nodes per KB of CSS.
	// Measured across real-world files (unminified and minified):
	//   bootstrap.css 137 | bootstrap.min 166 | tailwind.css 157 | tailwind.min 195 | small 198
	// 210 keeps ~16% headroom above the observed ceiling of 198 nodes/KB.
	private static readonly NODES_PER_KB = 210

	// Safety buffer on top of NODES_PER_KB to absorb variance without a grow.
	// Combined with the constant above: effective ceiling = 210 × 1.1 = 231 nodes/KB.
	private static readonly CAPACITY_BUFFER = 1.1

	constructor(initial_capacity: number = 1024) {
		this.capacity = initial_capacity
		// Start count at 1 since 0 is reserved for "no node"
		this.count = 1
		this.growth_count = 0
		this.buffer = new ArrayBuffer(initial_capacity * BYTES_PER_NODE)
		this.u8 = new Uint8Array(this.buffer)
		this.u16 = new Uint16Array(this.buffer)
		this.u32 = new Uint32Array(this.buffer)
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

	// Read node type
	get_type(node_index: number): number {
		return this.u8[node_index * BYTES_PER_NODE]
	}

	// Read node flags
	get_flags(node_index: number): number {
		return this.u8[node_index * BYTES_PER_NODE + 1]
	}

	// Read start offset in source
	get_start_offset(node_index: number): number {
		return this.u32[node_index * U32_PER_NODE + U32_START_OFFSET]
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
		return this.u16[node_index * U16_PER_NODE + U16_LENGTH]
	}

	// Read content start offset (stored as delta from startOffset)
	get_content_start(node_index: number): number {
		const startOffset = this.get_start_offset(node_index)
		const delta = this.u16[node_index * U16_PER_NODE + U16_CONTENT_START_DELTA]
		return startOffset + delta
	}

	// Read content length
	get_content_length(node_index: number): number {
		return this.u16[node_index * U16_PER_NODE + U16_CONTENT_LENGTH]
	}

	// Read first child index (0 = no children)
	get_first_child(node_index: number): number {
		return this.u32[node_index * U32_PER_NODE + U32_FIRST_CHILD]
	}

	// Read next sibling index (0 = no sibling)
	get_next_sibling(node_index: number): number {
		return this.u32[node_index * U32_PER_NODE + U32_NEXT_SIBLING]
	}

	// Read start line
	get_start_line(node_index: number): number {
		return this.u32[node_index * U32_PER_NODE + U32_START_LINE]
	}

	// Read start column
	get_start_column(node_index: number): number {
		return this.u32[node_index * U32_PER_NODE + U32_START_COLUMN]
	}

	// Read value start offset (stored as delta from startOffset, declaration value / at-rule prelude)
	get_value_start(node_index: number): number {
		const startOffset = this.get_start_offset(node_index)
		const delta = this.u16[node_index * U16_PER_NODE + U16_VALUE_START_DELTA]
		return startOffset + delta
	}

	// Read value length
	get_value_length(node_index: number): number {
		return this.u16[node_index * U16_PER_NODE + U16_VALUE_LENGTH]
	}

	// --- Write Methods ---

	// Write node type
	set_type(node_index: number, type: number): void {
		this.u8[node_index * BYTES_PER_NODE] = type
	}

	// Write node flags
	set_flags(node_index: number, flags: number): void {
		this.u8[node_index * BYTES_PER_NODE + 1] = flags
	}

	// Write length in source
	set_length(node_index: number, length: number): void {
		// Uint16 max value is 65535
		if (length > 65535) {
			this.u16[node_index * U16_PER_NODE + U16_LENGTH] = 65535
			this.set_flag(node_index, FLAG_LENGTH_OVERFLOW)
			// Store the actual length in the overflow map
			this.overflow_lengths.set(node_index, length)
		} else {
			this.u16[node_index * U16_PER_NODE + U16_LENGTH] = length
		}
	}

	// Write content start delta (offset from startOffset)
	set_content_start_delta(node_index: number, delta: number): void {
		this.u16[node_index * U16_PER_NODE + U16_CONTENT_START_DELTA] = delta
	}

	// Write content length
	set_content_length(node_index: number, length: number): void {
		this.u16[node_index * U16_PER_NODE + U16_CONTENT_LENGTH] = length
	}

	// Write first child index
	set_first_child(node_index: number, childIndex: number): void {
		this.u32[node_index * U32_PER_NODE + U32_FIRST_CHILD] = childIndex
	}

	// Write next sibling index
	set_next_sibling(node_index: number, siblingIndex: number): void {
		this.u32[node_index * U32_PER_NODE + U32_NEXT_SIBLING] = siblingIndex
	}

	// Write value start delta (offset from startOffset, declaration value / at-rule prelude)
	set_value_start_delta(node_index: number, delta: number): void {
		this.u16[node_index * U16_PER_NODE + U16_VALUE_START_DELTA] = delta
	}

	// Write value length
	set_value_length(node_index: number, length: number): void {
		this.u16[node_index * U16_PER_NODE + U16_VALUE_LENGTH] = length
	}

	// --- Node Creation ---

	// Grow the arena by 1.3x when capacity is exceeded
	private grow(): void {
		this.growth_count++
		let new_capacity = Math.ceil(this.capacity * CSSDataArena.GROWTH_FACTOR)
		let new_buffer = new ArrayBuffer(new_capacity * BYTES_PER_NODE)

		// Copy existing data to new buffer
		new Uint8Array(new_buffer).set(new Uint8Array(this.buffer))

		// Update arena state — views must be recreated, they don't follow a buffer swap
		this.buffer = new_buffer
		this.u8 = new Uint8Array(new_buffer)
		this.u16 = new Uint16Array(new_buffer)
		this.u32 = new Uint32Array(new_buffer)
		this.capacity = new_capacity
	}

	// Allocate and initialize a new node with core properties
	// Automatically grows the arena if capacity is exceeded
	create_node(
		type: number,
		start_offset: number,
		length: number,
		start_line: number,
		start_column: number,
	): number {
		if (this.count >= this.capacity) {
			this.grow()
		}
		const node_index = this.count
		this.count++

		this.u8[node_index * BYTES_PER_NODE] = type // +0: type
		this.u32[node_index * U32_PER_NODE + U32_START_OFFSET] = start_offset
		this.u32[node_index * U32_PER_NODE + U32_START_LINE] = start_line
		this.u32[node_index * U32_PER_NODE + U32_START_COLUMN] = start_column

		// Use setter method to handle overflow
		this.set_length(node_index, length)

		return node_index
	}

	// --- Tree Building Helpers ---

	// Link multiple child nodes to a parent
	// Children are linked as siblings in the order provided
	append_children(parent_index: number, children: number[]): void {
		if (children.length === 0) return

		this.u32[parent_index * U32_PER_NODE + U32_FIRST_CHILD] = children[0]

		// Chain siblings
		for (let i = 0; i < children.length - 1; i++) {
			this.set_next_sibling(children[i], children[i + 1])
		}
	}

	/** Shrink the buffer to the live node count, releasing wasted capacity. Call once after parsing; no-op if already tight. */
	trim(): void {
		if (this.count === this.capacity) {
			// no-op: already tightly packed
			return
		}

		let byte_count = this.count * BYTES_PER_NODE
		let new_buffer = new ArrayBuffer(byte_count)
		new Uint8Array(new_buffer).set(new Uint8Array(this.buffer, 0, byte_count))
		this.buffer = new_buffer
		this.u8 = new Uint8Array(new_buffer)
		this.u16 = new Uint16Array(new_buffer)
		this.u32 = new Uint32Array(new_buffer)
		this.capacity = this.count
	}

	// Walk a sibling chain to find its last node. Used by parsers that build sibling chains
	// incrementally (without an intermediate array) and need to append to the tail.
	get_last_sibling(node_index: number): number {
		let node = node_index
		let next = this.get_next_sibling(node)
		while (next !== 0) {
			node = next
			next = this.get_next_sibling(node)
		}
		return node
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
