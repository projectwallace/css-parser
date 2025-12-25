import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { CSSDataArena, STYLESHEET, STYLE_RULE, DECLARATION, FLAG_IMPORTANT, FLAG_HAS_ERROR, FLAG_LENGTH_OVERFLOW } from './arena'
import { parse } from './parse'

describe('CSSDataArena', () => {
	describe('initialization', () => {
		test('should create arena with default capacity', () => {
			const arena = new CSSDataArena()
			expect(arena.get_capacity()).toBe(1024)
			expect(arena.get_count()).toBe(1) // Count starts at 1 (0 is reserved for "no node")
		})

		test('should create arena with custom capacity', () => {
			const arena = new CSSDataArena(512)
			expect(arena.get_capacity()).toBe(512)
			expect(arena.get_count()).toBe(1) // Count starts at 1 (0 is reserved for "no node")
		})
	})

	describe('node creation', () => {
		test('should create nodes and increment count', () => {
			const arena = new CSSDataArena(10)

			const node1 = arena.create_node(STYLESHEET, 0, 0, 1, 1)
			expect(node1).toBe(1) // First node index is 1 (0 is reserved for "no node")
			expect(arena.get_count()).toBe(2)

			const node2 = arena.create_node(STYLESHEET, 0, 0, 1, 1)
			expect(node2).toBe(2)
			expect(arena.get_count()).toBe(3)
		})

		test('should automatically grow when capacity is exceeded', () => {
			const arena = new CSSDataArena(3)

			arena.create_node(STYLESHEET, 0, 0, 1, 1) // 1
			arena.create_node(STYLESHEET, 0, 0, 1, 1) // 2
			expect(arena.get_capacity()).toBe(3)

			// This should trigger growth (count is now 3, capacity is 3)
			const node3 = arena.create_node(STYLESHEET, 0, 0, 1, 1) // 3
			expect(node3).toBe(3)
			expect(arena.get_count()).toBe(4)
			// Capacity should be ceil(3 * 1.3) = 4
			expect(arena.get_capacity()).toBe(4)
		})

		test('should preserve existing data when growing', () => {
			const arena = new CSSDataArena(2)

			const node1 = arena.create_node(STYLESHEET, 100, 0, 1, 1)
			const node2 = arena.create_node(DECLARATION, 200, 0, 1, 1)

			// Trigger growth
			const node3 = arena.create_node(STYLESHEET, 0, 0, 1, 1)

			// Verify old data is preserved
			expect(arena.get_type(node1)).toBe(STYLESHEET)
			expect(arena.get_start_offset(node1)).toBe(100)
			expect(arena.get_type(node2)).toBe(DECLARATION)
			expect(arena.get_start_offset(node2)).toBe(200)

			// Verify new node can be used
			arena.set_type(node3, STYLESHEET)
			expect(arena.get_type(node3)).toBe(STYLESHEET)
		})
	})

	describe('node reading and writing', () => {
		test('should read default values for uninitialized nodes', () => {
			const arena = new CSSDataArena(10)
			const node = arena.create_node(STYLESHEET, 0, 0, 1, 1)

			expect(arena.get_type(node)).toBe(STYLESHEET)
			expect(arena.get_flags(node)).toBe(0)
			expect(arena.get_start_offset(node)).toBe(0)
			expect(arena.get_length(node)).toBe(0)
		})

		test('should write and read node type', () => {
			const arena = new CSSDataArena(10)
			const node = arena.create_node(DECLARATION, 0, 0, 1, 1)

			arena.set_type(node, STYLESHEET)
			expect(arena.get_type(node)).toBe(STYLESHEET)
		})

		test('should write and read node flags', () => {
			const arena = new CSSDataArena(10)
			const node = arena.create_node(DECLARATION, 0, 0, 1, 1)

			arena.set_flags(node, FLAG_IMPORTANT)
			expect(arena.get_flags(node)).toBe(FLAG_IMPORTANT)
		})

		test('should write and read all node properties', () => {
			const arena = new CSSDataArena(10)
			const node = arena.create_node(DECLARATION, 100, 50, 5, 1)

			arena.set_flags(node, FLAG_IMPORTANT)
			arena.set_content_start_delta(node, 10)
			arena.set_content_length(node, 30)

			expect(arena.get_type(node)).toBe(DECLARATION)
			expect(arena.get_flags(node)).toBe(FLAG_IMPORTANT)
			expect(arena.get_start_offset(node)).toBe(100)
			expect(arena.get_length(node)).toBe(50)
			expect(arena.get_content_start(node)).toBe(110)
			expect(arena.get_content_length(node)).toBe(30)
			expect(arena.get_start_line(node)).toBe(5)
		})

		test('should handle multiple nodes independently', () => {
			const arena = new CSSDataArena(10)
			const node1 = arena.create_node(STYLESHEET, 0, 0, 1, 1)
			const node2 = arena.create_node(DECLARATION, 100, 0, 1, 1)

			expect(arena.get_type(node1)).toBe(STYLESHEET)
			expect(arena.get_start_offset(node1)).toBe(0)
			expect(arena.get_type(node2)).toBe(DECLARATION)
			expect(arena.get_start_offset(node2)).toBe(100)
		})
	})

	describe('tree linking', () => {
		test('should append first child to parent', () => {
			const arena = new CSSDataArena(10)
			const parent = arena.create_node(STYLESHEET, 0, 0, 1, 1)
			const child = arena.create_node(STYLE_RULE, 0, 0, 1, 1)

			arena.append_children(parent, [child])

			expect(arena.get_first_child(parent)).toBe(child)
			expect(arena.has_children(parent)).toBe(true)
			expect(arena.has_next_sibling(child)).toBe(false)
		})

		test('should append multiple children as siblings', () => {
			const arena = new CSSDataArena(10)
			const parent = arena.create_node(STYLESHEET, 0, 0, 1, 1)
			const child1 = arena.create_node(STYLE_RULE, 0, 0, 1, 1)
			const child2 = arena.create_node(STYLE_RULE, 0, 0, 1, 1)
			const child3 = arena.create_node(STYLE_RULE, 0, 0, 1, 1)

			arena.append_children(parent, [child1, child2, child3])

			expect(arena.get_first_child(parent)).toBe(child1)
			expect(arena.get_next_sibling(child1)).toBe(child2)
			expect(arena.get_next_sibling(child2)).toBe(child3)
			expect(arena.get_next_sibling(child3)).toBe(0)
		})

		test('should build complex tree structure', () => {
			const arena = new CSSDataArena(10)
			const root = arena.create_node(STYLESHEET, 0, 0, 1, 1)
			const rule1 = arena.create_node(STYLE_RULE, 0, 0, 1, 1)
			const rule2 = arena.create_node(STYLE_RULE, 0, 0, 1, 1)
			const decl1 = arena.create_node(DECLARATION, 0, 0, 1, 1)
			const decl2 = arena.create_node(DECLARATION, 0, 0, 1, 1)

			// Build tree: root -> [rule1, rule2]
			//                        rule1 -> [decl1, decl2]
			arena.append_children(root, [rule1, rule2])
			arena.append_children(rule1, [decl1, decl2])

			// Verify root level
			expect(arena.get_first_child(root)).toBe(rule1)
			expect(arena.get_next_sibling(rule1)).toBe(rule2)
			expect(arena.get_next_sibling(rule2)).toBe(0)

			// Verify rule1's children
			expect(arena.get_first_child(rule1)).toBe(decl1)
			expect(arena.get_next_sibling(decl1)).toBe(decl2)
			expect(arena.get_next_sibling(decl2)).toBe(0)

			// Verify rule2 has no children
			expect(arena.has_children(rule2)).toBe(false)
		})

		test('should handle nodes with no children or siblings', () => {
			const arena = new CSSDataArena(10)
			const node = arena.create_node(STYLESHEET, 0, 0, 1, 1)

			expect(arena.has_children(node)).toBe(false)
			expect(arena.has_next_sibling(node)).toBe(false)
			expect(arena.get_first_child(node)).toBe(0)
			expect(arena.get_next_sibling(node)).toBe(0)
		})
	})

	describe('flag management', () => {
		test('should set and check individual flags', () => {
			const arena = new CSSDataArena(10)
			const node = arena.create_node(STYLESHEET, 0, 0, 1, 1)

			expect(arena.has_flag(node, FLAG_IMPORTANT)).toBe(false)

			arena.set_flag(node, FLAG_IMPORTANT)
			expect(arena.has_flag(node, FLAG_IMPORTANT)).toBe(true)
		})

		test('should set multiple flags independently', () => {
			const arena = new CSSDataArena(10)
			const node = arena.create_node(STYLESHEET, 0, 0, 1, 1)

			arena.set_flag(node, FLAG_IMPORTANT)

			expect(arena.has_flag(node, FLAG_IMPORTANT)).toBe(true)
			expect(arena.has_flag(node, FLAG_HAS_ERROR)).toBe(false)
		})

		test('should clear individual flags without affecting others', () => {
			const arena = new CSSDataArena(10)
			const node = arena.create_node(STYLESHEET, 0, 0, 1, 1)

			arena.set_flag(node, FLAG_IMPORTANT)
			arena.set_flag(node, FLAG_HAS_ERROR)

			expect(arena.has_flag(node, FLAG_IMPORTANT)).toBe(true)
			expect(arena.has_flag(node, FLAG_HAS_ERROR)).toBe(true)
		})

		test('should handle all flag combinations', () => {
			const arena = new CSSDataArena(10)
			const node = arena.create_node(STYLESHEET, 0, 0, 1, 1)

			// Set all flags at once using setFlags
			const allFlags = FLAG_IMPORTANT | FLAG_HAS_ERROR
			arena.set_flags(node, allFlags)

			expect(arena.get_flags(node)).toBe(allFlags)
			expect(arena.has_flag(node, FLAG_IMPORTANT)).toBe(true)
			expect(arena.has_flag(node, FLAG_HAS_ERROR)).toBe(true)

			// Clear all flags
			arena.set_flags(node, 0)
			expect(arena.get_flags(node)).toBe(0)
		})

		test('should set FLAG_LENGTH_OVERFLOW when length > 65535', () => {
			const arena = new CSSDataArena(10)
			const node = arena.create_node(DECLARATION, 0, 0, 1, 1)

			// Set length to exceed Uint16 max (65535)
			arena.set_length(node, 70000)

			expect(arena.get_length(node)).toBe(70000) // Should return actual length from Map
			expect(arena.has_flag(node, FLAG_LENGTH_OVERFLOW)).toBe(true)
		})

		test('should not set FLAG_LENGTH_OVERFLOW when length <= 65535', () => {
			const arena = new CSSDataArena(10)
			const node = arena.create_node(DECLARATION, 0, 0, 1, 1)

			arena.set_length(node, 65535)

			expect(arena.get_length(node)).toBe(65535)
			expect(arena.has_flag(node, FLAG_LENGTH_OVERFLOW)).toBe(false)
		})
	})

	describe('growth tracking', () => {
		test('should initialize growth count to zero', () => {
			const arena = new CSSDataArena()
			expect(arena.get_growth_count()).toBe(0)
		})

		test('should track single growth event', () => {
			const arena = new CSSDataArena(2)
			expect(arena.get_growth_count()).toBe(0)

			// Create nodes to trigger growth
			arena.create_node(STYLESHEET, 0, 0, 1, 1) // count = 2
			expect(arena.get_growth_count()).toBe(0)

			arena.create_node(STYLESHEET, 0, 0, 1, 1) // count = 3, triggers growth
			expect(arena.get_growth_count()).toBe(1)
		})

		test('should track multiple growth events', () => {
			const arena = new CSSDataArena(2)
			expect(arena.get_growth_count()).toBe(0)

			// First growth: 2 -> 3
			arena.create_node(STYLESHEET, 0, 0, 1, 1)
			arena.create_node(STYLESHEET, 0, 0, 1, 1)
			expect(arena.get_growth_count()).toBe(1)
			expect(arena.get_capacity()).toBe(3) // ceil(2 * 1.3) = 3

			// Second growth: 3 -> 4
			arena.create_node(STYLESHEET, 0, 0, 1, 1)
			expect(arena.get_growth_count()).toBe(2)
			expect(arena.get_capacity()).toBe(4) // ceil(3 * 1.3) = 4

			// Third growth: 4 -> 6
			arena.create_node(STYLESHEET, 0, 0, 1, 1)
			expect(arena.get_growth_count()).toBe(3)
			expect(arena.get_capacity()).toBe(6) // ceil(4 * 1.3) = 6
		})

		test('should not increment growth count when capacity is sufficient', () => {
			const arena = new CSSDataArena(100)

			// Create many nodes without exceeding capacity
			for (let i = 0; i < 50; i++) {
				arena.create_node(STYLESHEET, 0, 0, 1, 1)
			}

			expect(arena.get_growth_count()).toBe(0)
			expect(arena.get_count()).toBe(51) // 50 created + 1 initial
		})
	})

	describe('real-world CSS frameworks', () => {
		test('should not grow for Bootstrap CSS', () => {
			const css = readFileSync('node_modules/bootstrap/dist/css/bootstrap.css', 'utf-8')
			const result = parse(css)

			expect(result.__get_arena().get_growth_count()).toBe(0)
			const utilization = (result.__get_arena().get_count() / result.__get_arena().get_capacity()) * 100
			expect(utilization).toBeLessThan(85)
			expect(utilization).toBeGreaterThan(30)
		})

		test('should not grow for Bootstrap minified CSS', () => {
			const css = readFileSync('node_modules/bootstrap/dist/css/bootstrap.min.css', 'utf-8')
			const result = parse(css)
			const arena = result.__get_arena()

			expect(arena.get_growth_count()).toBe(0)
			const utilization = (arena.get_count() / arena.get_capacity()) * 100
			expect(utilization).toBeLessThan(85)
			expect(utilization).toBeGreaterThan(30)
		})

		test('should not grow for Tailwind CSS', () => {
			const css = readFileSync('node_modules/tailwindcss/dist/tailwind.css', 'utf-8')
			const result = parse(css)
			const arena = result.__get_arena()

			expect(arena.get_growth_count()).toBe(0)
			const utilization = (arena.get_count() / arena.get_capacity()) * 100
			expect(utilization).toBeLessThan(85)
			expect(utilization).toBeGreaterThan(30)
		})

		test('should not grow for Tailwind minified CSS', () => {
			const css = readFileSync('node_modules/tailwindcss/dist/tailwind.min.css', 'utf-8')
			const result = parse(css)

			expect(result.__get_arena().get_growth_count()).toBe(0)
			const utilization = (result.__get_arena().get_count() / result.__get_arena().get_capacity()) * 100
			expect(utilization).toBeLessThan(85)
			expect(utilization).toBeGreaterThan(30)
		})
	})
})
