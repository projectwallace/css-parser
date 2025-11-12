// CSS Data Arena - Single contiguous ArrayBuffer for all AST nodes
//
// Each node occupies 32 bytes with the following layout:
// Offset | Size | Field
// -------|------|-------------
//   0    |  1   | type
//   1    |  1   | flags
//   2    |  2   | (padding)
//   4    |  4   | startOffset
//   8    |  2   | length
//  10    |  2   | (padding)
//  12    |  4   | contentStart
//  16    |  2   | contentLength
//  18    |  2   | (padding)
//  20    |  4   | firstChild
//  24    |  4   | nextSibling
//  28    |  4   | startLine

const BYTES_PER_NODE = 32

// Node type constants
export const NODE_STYLESHEET = 1
export const NODE_STYLE_RULE = 2
export const NODE_AT_RULE = 3
export const NODE_DECLARATION = 4
export const NODE_SELECTOR = 5
export const NODE_COMMENT = 6

// Flag constants (bit-packed in 1 byte)
export const FLAG_IMPORTANT = 1 << 0 // Has !important
export const FLAG_VENDOR_PREFIXED = 1 << 1 // -webkit-, -moz-, etc
export const FLAG_HAS_ERROR = 1 << 2 // Syntax error
export const FLAG_LENGTH_OVERFLOW = 1 << 3 // Node > 65k chars

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

	constructor(initialCapacity: number = 1024) {
		this.capacity = initialCapacity
		this.count = 0
		this.buffer = new ArrayBuffer(initialCapacity * BYTES_PER_NODE)
		this.view = new DataView(this.buffer)
	}

	// Calculate recommended initial capacity based on CSS source size
	static capacityForSource(sourceLength: number): number {
		const sizeInKB = sourceLength / 1024
		const estimatedNodes = Math.ceil(sizeInKB * CSSDataArena.NODES_PER_KB)
		// Add 15% buffer to avoid growth during parsing
		return Math.ceil(estimatedNodes * CSSDataArena.CAPACITY_BUFFER)
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
	private nodeOffset(nodeIndex: number): number {
		return nodeIndex * BYTES_PER_NODE
	}

	// Read node type
	getType(nodeIndex: number): number {
		return this.view.getUint8(this.nodeOffset(nodeIndex))
	}

	// Read node flags
	getFlags(nodeIndex: number): number {
		return this.view.getUint8(this.nodeOffset(nodeIndex) + 1)
	}

	// Read start offset in source
	getStartOffset(nodeIndex: number): number {
		return this.view.getUint32(this.nodeOffset(nodeIndex) + 4, true)
	}

	// Read length in source
	getLength(nodeIndex: number): number {
		return this.view.getUint16(this.nodeOffset(nodeIndex) + 8, true)
	}

	// Read content start offset
	getContentStart(nodeIndex: number): number {
		return this.view.getUint32(this.nodeOffset(nodeIndex) + 12, true)
	}

	// Read content length
	getContentLength(nodeIndex: number): number {
		return this.view.getUint16(this.nodeOffset(nodeIndex) + 16, true)
	}

	// Read first child index (0 = no children)
	getFirstChild(nodeIndex: number): number {
		return this.view.getUint32(this.nodeOffset(nodeIndex) + 20, true)
	}

	// Read next sibling index (0 = no sibling)
	getNextSibling(nodeIndex: number): number {
		return this.view.getUint32(this.nodeOffset(nodeIndex) + 24, true)
	}

	// Read start line
	getStartLine(nodeIndex: number): number {
		return this.view.getUint32(this.nodeOffset(nodeIndex) + 28, true)
	}

	// --- Write Methods ---

	// Write node type
	setType(nodeIndex: number, type: number): void {
		this.view.setUint8(this.nodeOffset(nodeIndex), type)
	}

	// Write node flags
	setFlags(nodeIndex: number, flags: number): void {
		this.view.setUint8(this.nodeOffset(nodeIndex) + 1, flags)
	}

	// Write start offset in source
	setStartOffset(nodeIndex: number, offset: number): void {
		this.view.setUint32(this.nodeOffset(nodeIndex) + 4, offset, true)
	}

	// Write length in source
	setLength(nodeIndex: number, length: number): void {
		this.view.setUint16(this.nodeOffset(nodeIndex) + 8, length, true)
	}

	// Write content start offset
	setContentStart(nodeIndex: number, offset: number): void {
		this.view.setUint32(this.nodeOffset(nodeIndex) + 12, offset, true)
	}

	// Write content length
	setContentLength(nodeIndex: number, length: number): void {
		this.view.setUint16(this.nodeOffset(nodeIndex) + 16, length, true)
	}

	// Write first child index
	setFirstChild(nodeIndex: number, childIndex: number): void {
		this.view.setUint32(this.nodeOffset(nodeIndex) + 20, childIndex, true)
	}

	// Write next sibling index
	setNextSibling(nodeIndex: number, siblingIndex: number): void {
		this.view.setUint32(this.nodeOffset(nodeIndex) + 24, siblingIndex, true)
	}

	// Write start line
	setStartLine(nodeIndex: number, line: number): void {
		this.view.setUint32(this.nodeOffset(nodeIndex) + 28, line, true)
	}

	// --- Node Creation ---

	// Grow the arena by 1.3x when capacity is exceeded
	private grow(): void {
		const newCapacity = Math.ceil(this.capacity * CSSDataArena.GROWTH_FACTOR)
		const newBuffer = new ArrayBuffer(newCapacity * BYTES_PER_NODE)

		// Copy existing data to new buffer
		new Uint8Array(newBuffer).set(new Uint8Array(this.buffer))

		// Update arena state
		this.buffer = newBuffer
		this.view = new DataView(newBuffer)
		this.capacity = newCapacity
	}

	// Allocate a new node and return its index
	// The node is zero-initialized by default (ArrayBuffer guarantees this)
	// Automatically grows the arena if capacity is exceeded
	createNode(): number {
		if (this.count >= this.capacity) {
			this.grow()
		}
		const nodeIndex = this.count
		this.count++
		return nodeIndex
	}

	// --- Tree Building Helpers ---

	// Add a child node to a parent node
	// This appends to the end of the child list using the sibling chain
	appendChild(parentIndex: number, childIndex: number): void {
		const firstChild = this.getFirstChild(parentIndex)

		if (firstChild === 0) {
			// No children yet, make this the first child
			this.setFirstChild(parentIndex, childIndex)
		} else {
			// Find the last sibling and append
			let lastSibling = firstChild
			let nextSibling = this.getNextSibling(lastSibling)

			while (nextSibling !== 0) {
				lastSibling = nextSibling
				nextSibling = this.getNextSibling(lastSibling)
			}

			this.setNextSibling(lastSibling, childIndex)
		}
	}

	// Check if a node has any children
	hasChildren(nodeIndex: number): boolean {
		return this.getFirstChild(nodeIndex) !== 0
	}

	// Check if a node has a next sibling
	hasNextSibling(nodeIndex: number): boolean {
		return this.getNextSibling(nodeIndex) !== 0
	}

	// --- Flag Management Helpers ---

	// Set a specific flag bit (doesn't clear other flags)
	setFlag(nodeIndex: number, flag: number): void {
		const currentFlags = this.getFlags(nodeIndex)
		this.setFlags(nodeIndex, currentFlags | flag)
	}

	// Clear a specific flag bit (doesn't affect other flags)
	clearFlag(nodeIndex: number, flag: number): void {
		const currentFlags = this.getFlags(nodeIndex)
		this.setFlags(nodeIndex, currentFlags & ~flag)
	}

	// Check if a specific flag is set
	hasFlag(nodeIndex: number, flag: number): boolean {
		return (this.getFlags(nodeIndex) & flag) !== 0
	}
}
