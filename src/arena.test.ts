import { describe, it, expect } from 'vitest'
import {
	CSSDataArena,
	NODE_STYLESHEET,
	NODE_DECLARATION,
	FLAG_IMPORTANT,
	FLAG_VENDOR_PREFIXED,
	FLAG_HAS_ERROR,
} from './arena'

describe('CSSDataArena', () => {
	describe('initialization', () => {
		it('should create arena with default capacity', () => {
			const arena = new CSSDataArena()
			expect(arena.getCapacity()).toBe(1024)
			expect(arena.getCount()).toBe(0)
		})

		it('should create arena with custom capacity', () => {
			const arena = new CSSDataArena(512)
			expect(arena.getCapacity()).toBe(512)
			expect(arena.getCount()).toBe(0)
		})
	})

	describe('node creation', () => {
		it('should create nodes and increment count', () => {
			const arena = new CSSDataArena(10)

			const node1 = arena.createNode()
			expect(node1).toBe(0)
			expect(arena.getCount()).toBe(1)

			const node2 = arena.createNode()
			expect(node2).toBe(1)
			expect(arena.getCount()).toBe(2)
		})

		it('should automatically grow when capacity is exceeded', () => {
			const arena = new CSSDataArena(2)

			const node1 = arena.createNode() // 0
			const node2 = arena.createNode() // 1
			expect(arena.getCapacity()).toBe(2)

			// This should trigger growth
			const node3 = arena.createNode() // 2
			expect(node3).toBe(2)
			expect(arena.getCount()).toBe(3)
			// Capacity should be ceil(2 * 1.3) = 3
			expect(arena.getCapacity()).toBe(3)
		})

		it('should preserve existing data when growing', () => {
			const arena = new CSSDataArena(2)

			const node1 = arena.createNode()
			const node2 = arena.createNode()

			// Set data on existing nodes
			arena.setType(node1, NODE_STYLESHEET)
			arena.setStartOffset(node1, 100)
			arena.setType(node2, NODE_DECLARATION)
			arena.setStartOffset(node2, 200)

			// Trigger growth
			const node3 = arena.createNode()

			// Verify old data is preserved
			expect(arena.getType(node1)).toBe(NODE_STYLESHEET)
			expect(arena.getStartOffset(node1)).toBe(100)
			expect(arena.getType(node2)).toBe(NODE_DECLARATION)
			expect(arena.getStartOffset(node2)).toBe(200)

			// Verify new node can be used
			arena.setType(node3, NODE_STYLESHEET)
			expect(arena.getType(node3)).toBe(NODE_STYLESHEET)
		})
	})

	describe('node reading and writing', () => {
		it('should read default values for uninitialized nodes', () => {
			const arena = new CSSDataArena(10)
			const node = arena.createNode()

			expect(arena.getType(node)).toBe(0)
			expect(arena.getFlags(node)).toBe(0)
			expect(arena.getStartOffset(node)).toBe(0)
			expect(arena.getLength(node)).toBe(0)
		})

		it('should write and read node type', () => {
			const arena = new CSSDataArena(10)
			const node = arena.createNode()

			arena.setType(node, NODE_STYLESHEET)
			expect(arena.getType(node)).toBe(NODE_STYLESHEET)
		})

		it('should write and read node flags', () => {
			const arena = new CSSDataArena(10)
			const node = arena.createNode()

			arena.setFlags(node, FLAG_IMPORTANT)
			expect(arena.getFlags(node)).toBe(FLAG_IMPORTANT)
		})

		it('should write and read all node properties', () => {
			const arena = new CSSDataArena(10)
			const node = arena.createNode()

			arena.setType(node, NODE_DECLARATION)
			arena.setFlags(node, FLAG_IMPORTANT)
			arena.setStartOffset(node, 100)
			arena.setLength(node, 50)
			arena.setContentStart(node, 110)
			arena.setContentLength(node, 30)
			arena.setStartLine(node, 5)

			expect(arena.getType(node)).toBe(NODE_DECLARATION)
			expect(arena.getFlags(node)).toBe(FLAG_IMPORTANT)
			expect(arena.getStartOffset(node)).toBe(100)
			expect(arena.getLength(node)).toBe(50)
			expect(arena.getContentStart(node)).toBe(110)
			expect(arena.getContentLength(node)).toBe(30)
			expect(arena.getStartLine(node)).toBe(5)
		})

		it('should handle multiple nodes independently', () => {
			const arena = new CSSDataArena(10)
			const node1 = arena.createNode()
			const node2 = arena.createNode()

			arena.setType(node1, NODE_STYLESHEET)
			arena.setStartOffset(node1, 0)

			arena.setType(node2, NODE_DECLARATION)
			arena.setStartOffset(node2, 100)

			expect(arena.getType(node1)).toBe(NODE_STYLESHEET)
			expect(arena.getStartOffset(node1)).toBe(0)
			expect(arena.getType(node2)).toBe(NODE_DECLARATION)
			expect(arena.getStartOffset(node2)).toBe(100)
		})
	})

	describe('tree linking', () => {
		it('should append first child to parent', () => {
			const arena = new CSSDataArena(10)
			const parent = arena.createNode()
			const child = arena.createNode()

			arena.appendChild(parent, child)

			expect(arena.getFirstChild(parent)).toBe(child)
			expect(arena.hasChildren(parent)).toBe(true)
			expect(arena.hasNextSibling(child)).toBe(false)
		})

		it('should append multiple children as siblings', () => {
			const arena = new CSSDataArena(10)
			const parent = arena.createNode()
			const child1 = arena.createNode()
			const child2 = arena.createNode()
			const child3 = arena.createNode()

			arena.appendChild(parent, child1)
			arena.appendChild(parent, child2)
			arena.appendChild(parent, child3)

			expect(arena.getFirstChild(parent)).toBe(child1)
			expect(arena.getNextSibling(child1)).toBe(child2)
			expect(arena.getNextSibling(child2)).toBe(child3)
			expect(arena.getNextSibling(child3)).toBe(0)
		})

		it('should build complex tree structure', () => {
			const arena = new CSSDataArena(10)
			const root = arena.createNode()
			const rule1 = arena.createNode()
			const rule2 = arena.createNode()
			const decl1 = arena.createNode()
			const decl2 = arena.createNode()

			// Build tree: root -> [rule1, rule2]
			//                        rule1 -> [decl1, decl2]
			arena.appendChild(root, rule1)
			arena.appendChild(root, rule2)
			arena.appendChild(rule1, decl1)
			arena.appendChild(rule1, decl2)

			// Verify root level
			expect(arena.getFirstChild(root)).toBe(rule1)
			expect(arena.getNextSibling(rule1)).toBe(rule2)
			expect(arena.getNextSibling(rule2)).toBe(0)

			// Verify rule1's children
			expect(arena.getFirstChild(rule1)).toBe(decl1)
			expect(arena.getNextSibling(decl1)).toBe(decl2)
			expect(arena.getNextSibling(decl2)).toBe(0)

			// Verify rule2 has no children
			expect(arena.hasChildren(rule2)).toBe(false)
		})

		it('should handle nodes with no children or siblings', () => {
			const arena = new CSSDataArena(10)
			const node = arena.createNode()

			expect(arena.hasChildren(node)).toBe(false)
			expect(arena.hasNextSibling(node)).toBe(false)
			expect(arena.getFirstChild(node)).toBe(0)
			expect(arena.getNextSibling(node)).toBe(0)
		})
	})

	describe('flag management', () => {
		it('should set and check individual flags', () => {
			const arena = new CSSDataArena(10)
			const node = arena.createNode()

			expect(arena.hasFlag(node, FLAG_IMPORTANT)).toBe(false)

			arena.setFlag(node, FLAG_IMPORTANT)
			expect(arena.hasFlag(node, FLAG_IMPORTANT)).toBe(true)
		})

		it('should set multiple flags independently', () => {
			const arena = new CSSDataArena(10)
			const node = arena.createNode()

			arena.setFlag(node, FLAG_IMPORTANT)
			arena.setFlag(node, FLAG_VENDOR_PREFIXED)

			expect(arena.hasFlag(node, FLAG_IMPORTANT)).toBe(true)
			expect(arena.hasFlag(node, FLAG_VENDOR_PREFIXED)).toBe(true)
			expect(arena.hasFlag(node, FLAG_HAS_ERROR)).toBe(false)
		})

		it('should clear individual flags without affecting others', () => {
			const arena = new CSSDataArena(10)
			const node = arena.createNode()

			arena.setFlag(node, FLAG_IMPORTANT)
			arena.setFlag(node, FLAG_VENDOR_PREFIXED)
			arena.setFlag(node, FLAG_HAS_ERROR)

			arena.clearFlag(node, FLAG_VENDOR_PREFIXED)

			expect(arena.hasFlag(node, FLAG_IMPORTANT)).toBe(true)
			expect(arena.hasFlag(node, FLAG_VENDOR_PREFIXED)).toBe(false)
			expect(arena.hasFlag(node, FLAG_HAS_ERROR)).toBe(true)
		})

		it('should handle all flag combinations', () => {
			const arena = new CSSDataArena(10)
			const node = arena.createNode()

			// Set all flags at once using setFlags
			const allFlags = FLAG_IMPORTANT | FLAG_VENDOR_PREFIXED | FLAG_HAS_ERROR
			arena.setFlags(node, allFlags)

			expect(arena.getFlags(node)).toBe(allFlags)
			expect(arena.hasFlag(node, FLAG_IMPORTANT)).toBe(true)
			expect(arena.hasFlag(node, FLAG_VENDOR_PREFIXED)).toBe(true)
			expect(arena.hasFlag(node, FLAG_HAS_ERROR)).toBe(true)

			// Clear all flags
			arena.setFlags(node, 0)
			expect(arena.getFlags(node)).toBe(0)
		})
	})

	describe('capacity planning', () => {
		it('should have minimum capacity for empty files', () => {
			const capacity = CSSDataArena.capacityForSource(0)
			expect(capacity).toBe(16)
		})

		it('should calculate capacity for small CSS files', () => {
			// 1KB CSS = 60 nodes * 1.15 buffer = 69 nodes
			const capacity = CSSDataArena.capacityForSource(1024)
			expect(capacity).toBe(69)
		})

		it('should calculate capacity for medium CSS files', () => {
			// 100KB CSS = 6000 nodes * 1.15 buffer = 6900 nodes
			const capacity = CSSDataArena.capacityForSource(100 * 1024)
			expect(capacity).toBe(6900)
		})

		it('should calculate capacity for large CSS files', () => {
			// 10MB = 10240 KB CSS = 614400 nodes * 1.15 buffer = 706560 nodes
			const capacity = CSSDataArena.capacityForSource(10 * 1024 * 1024)
			expect(capacity).toBe(706560)
		})

		it('should round up for partial KBs', () => {
			// 1.5KB = ceil(1.5 * 60) * 1.15 = 90 * 1.15 = 104 (rounded up)
			const capacity = CSSDataArena.capacityForSource(1536)
			expect(capacity).toBe(104)
		})
	})
})
