import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
	CSSDataArena,
	STYLESHEET,
	STYLE_RULE,
	DECLARATION,
	FLAG_IMPORTANT,
	FLAG_HAS_ERROR,
	FLAG_LENGTH_OVERFLOW,
} from './arena'
import { parse } from './parse'
import { walk } from './walk'
import { CSSNode } from './css-node'

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

	describe('flag and length storage', () => {
		test('clear_flag clears only the requested flag', () => {
			const arena = new CSSDataArena(10)
			const node = arena.create_node(STYLESHEET, 0, 0, 1, 1)

			arena.set_flag(node, FLAG_IMPORTANT)
			arena.set_flag(node, FLAG_HAS_ERROR)
			arena.clear_flag(node, FLAG_IMPORTANT)

			expect(arena.has_flag(node, FLAG_IMPORTANT)).toBe(false)
			expect(arena.has_flag(node, FLAG_HAS_ERROR)).toBe(true)
			expect(arena.get_flags(node)).toBe(FLAG_HAS_ERROR)
		})

		test('set_flag and clear_flag do not touch neighbouring fields or nodes', () => {
			const arena = new CSSDataArena(10)
			const before = arena.create_node(DECLARATION, 5, 7, 2, 3)
			const node = arena.create_node(STYLE_RULE, 11, 13, 4, 6)
			const after = arena.create_node(DECLARATION, 17, 19, 8, 9)

			arena.set_flag(node, FLAG_IMPORTANT | FLAG_HAS_ERROR)
			arena.clear_flag(node, FLAG_HAS_ERROR)

			expect(arena.get_type(node)).toBe(STYLE_RULE)
			expect(arena.get_length(node)).toBe(13)
			expect(arena.get_start_offset(node)).toBe(11)
			expect(arena.get_start_line(node)).toBe(4)
			expect(arena.get_start_column(node)).toBe(6)
			expect(arena.get_flags(node)).toBe(FLAG_IMPORTANT)
			expect(arena.get_flags(before)).toBe(0)
			expect(arena.get_flags(after)).toBe(0)
			expect(arena.get_length(before)).toBe(7)
			expect(arena.get_length(after)).toBe(19)
		})

		test('create_node stores lengths up to 65535 inline without the overflow flag', () => {
			const arena = new CSSDataArena(10)
			const small = arena.create_node(DECLARATION, 0, 0, 1, 1)
			const max = arena.create_node(DECLARATION, 0, 65535, 1, 1)

			expect(arena.get_length(small)).toBe(0)
			expect(arena.has_flag(small, FLAG_LENGTH_OVERFLOW)).toBe(false)
			expect(arena.get_length(max)).toBe(65535)
			expect(arena.has_flag(max, FLAG_LENGTH_OVERFLOW)).toBe(false)
		})

		test('create_node stores lengths above 65535 via the overflow map', () => {
			const arena = new CSSDataArena(10)
			const node = arena.create_node(DECLARATION, 42, 70000, 3, 4)

			expect(arena.get_length(node)).toBe(70000)
			expect(arena.has_flag(node, FLAG_LENGTH_OVERFLOW)).toBe(true)
			expect(arena.get_start_offset(node)).toBe(42)
			expect(arena.get_start_line(node)).toBe(3)
			expect(arena.get_start_column(node)).toBe(4)
		})

		test('overflow does not affect other nodes and keeps other flags', () => {
			const arena = new CSSDataArena(10)
			const exact = arena.create_node(DECLARATION, 0, 65535, 1, 1)
			const big = arena.create_node(DECLARATION, 0, 0, 1, 1)
			arena.set_flag(big, FLAG_IMPORTANT)
			arena.set_length(big, 100000)

			expect(arena.get_length(big)).toBe(100000)
			expect(arena.has_flag(big, FLAG_IMPORTANT)).toBe(true)
			expect(arena.has_flag(big, FLAG_LENGTH_OVERFLOW)).toBe(true)
			// A node whose real length is exactly the saturated value must not read the map
			expect(arena.get_length(exact)).toBe(65535)
		})
	})

	describe('16-bit content/value field overflow', () => {
		// [setter, getter-of-absolute-or-raw-value]
		const fields = [
			['content_length', 'set_content_length', 'get_content_length'],
			['value_length', 'set_value_length', 'get_value_length'],
		] as const
		const deltas = [
			['content_start_delta', 'set_content_start_delta', 'get_content_start'],
			['value_start_delta', 'set_value_start_delta', 'get_value_start'],
		] as const

		test.each(fields)('%s round-trips values around the 16-bit limit', (_name, set, get) => {
			const arena = new CSSDataArena(10)
			for (const value of [0, 1, 65534, 65535, 65536, 70000, 1_000_000]) {
				const node = arena.create_node(DECLARATION, 0, 0, 1, 1)
				arena[set](node, value)
				expect(arena[get](node)).toBe(value)
			}
		})

		test.each(deltas)('%s round-trips values around the 16-bit limit', (_name, set, get) => {
			const arena = new CSSDataArena(10)
			for (const value of [0, 1, 65534, 65535, 65536, 70000, 1_000_000]) {
				const node = arena.create_node(DECLARATION, 100, 0, 1, 1)
				arena[set](node, value)
				expect(arena[get](node)).toBe(100 + value)
			}
		})

		test('overflowing one field does not affect other fields or nodes', () => {
			const arena = new CSSDataArena(10)
			const a = arena.create_node(DECLARATION, 0, 0, 1, 1)
			const b = arena.create_node(DECLARATION, 0, 0, 1, 1)
			arena.set_content_length(a, 70000)
			arena.set_value_length(a, 5)
			arena.set_content_length(b, 3)
			arena.set_value_length(b, 80000)

			expect(arena.get_content_length(a)).toBe(70000)
			expect(arena.get_value_length(a)).toBe(5)
			expect(arena.get_content_length(b)).toBe(3)
			expect(arena.get_value_length(b)).toBe(80000)
		})

		test('rewriting a field replaces a previous overflow value', () => {
			const arena = new CSSDataArena(10)
			const node = arena.create_node(DECLARATION, 0, 0, 1, 1)
			arena.set_content_length(node, 70000)
			arena.set_content_length(node, 65535)
			expect(arena.get_content_length(node)).toBe(65535)
			arena.set_content_length(node, 12)
			expect(arena.get_content_length(node)).toBe(12)
		})

		test('overflow values survive arena growth and trim', () => {
			const arena = new CSSDataArena(2)
			const node = arena.create_node(DECLARATION, 0, 0, 1, 1)
			arena.set_value_length(node, 70000)
			for (let i = 0; i < 50; i++) arena.create_node(DECLARATION, 0, 0, 1, 1)
			arena.trim()
			expect(arena.get_value_length(node)).toBe(70000)
		})

		describe('through the parser', () => {
			const long = (char: string, count = 70_000) => char.repeat(count)
			const find = (css: string, type_name: string) => {
				let found: any
				walk(parse(css), (node) => {
					if (!found && node.type_name === type_name) found = node
				})
				return found
			}

			test('declaration property names over 65535 characters', () => {
				const decl = find(`a{${long('p')}:red}`, 'Declaration')
				expect(decl.property).toBe(long('p'))
				expect(decl.value.text).toBe('red')
			})

			test('a long name cannot collide with a shorter, real property name', () => {
				// 65536 + 8 characters would wrap to the 8-character "behavior" if truncated
				const decl = find(`a{${long('x', 65536 + 8)}:red}`, 'Declaration')
				expect(decl.property).toBe(long('x', 65536 + 8))
			})

			test('at-rule names over 65535 characters', () => {
				expect(find(`@${long('n')} x;`, 'Atrule').name).toBe(long('n'))
			})

			test('function names and arguments over 65535 characters', () => {
				expect(find(`a{b:${long('f')}(1)}`, 'Function').name).toBe(long('f'))
				expect(find(`a{b:f(${long('x')})}`, 'Function').value).toBe(long('x'))
			})

			test('selector names, attribute names and values over 65535 characters', () => {
				expect(find(`${long('t')}{}`, 'TypeSelector').name).toBe(long('t'))
				expect(find(`[${long('a')}=b]{}`, 'AttributeSelector').name).toBe(long('a'))
				expect(find(`[a=${long('b')}]{}`, 'AttributeSelector').value).toBe(long('b'))
				expect(find(`:${long('p')}{}`, 'PseudoClassSelector').name).toBe(long('p'))
			})

			test('media feature and layer names over 65535 characters', () => {
				expect(find(`@media (${long('w')}: 1px){}`, 'Feature').property).toBe(long('w'))
				expect(find(`@layer ${long('l')};`, 'Layer').name).toBe(long('l'))
			})

			test('values after more than 65535 characters of whitespace or comments', () => {
				expect(find(`a{b :${long(' ')}red}`, 'Declaration').value.text).toBe('red')
				expect(find(`a{b:/*${long('x')}*/red}`, 'Declaration').value.text).toBe('red')
				expect(find(`a{b:f(${long(' ')}1)}`, 'Function').value.trim()).toBe('1')
			})
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

	describe('trim', () => {
		test('should set capacity equal to count', () => {
			const arena = new CSSDataArena(100)
			arena.create_node(STYLESHEET, 0, 0, 1, 1)
			arena.create_node(DECLARATION, 0, 0, 1, 1)
			expect(arena.get_capacity()).toBe(100)
			arena.trim()
			expect(arena.get_capacity()).toBe(arena.get_count())
		})

		test('should preserve all node data after trim', () => {
			const arena = new CSSDataArena(100)
			const n1 = arena.create_node(STYLESHEET, 10, 500, 1, 1)
			const n2 = arena.create_node(DECLARATION, 20, 30, 2, 5)
			arena.set_flag(n2, FLAG_IMPORTANT)
			arena.trim()

			expect(arena.get_type(n1)).toBe(STYLESHEET)
			expect(arena.get_start_offset(n1)).toBe(10)
			expect(arena.get_type(n2)).toBe(DECLARATION)
			expect(arena.get_start_offset(n2)).toBe(20)
			expect(arena.has_flag(n2, FLAG_IMPORTANT)).toBe(true)
		})

		test('should be a no-op when already tight', () => {
			const arena = new CSSDataArena(2)
			arena.create_node(STYLESHEET, 0, 0, 1, 1) // count = 2, triggers grow to capacity 3
			arena.create_node(STYLESHEET, 0, 0, 1, 1) // count = 3 = capacity
			expect(arena.get_count()).toBe(arena.get_capacity())
			arena.trim() // should not throw or corrupt
			expect(arena.get_count()).toBe(arena.get_capacity())
		})
	})

	describe('real-world CSS frameworks', () => {
		test('should not grow for Bootstrap CSS', () => {
			const css = readFileSync('benchmark/bootstrap.min.css', 'utf-8')
			const result = parse(css) as unknown as CSSNode
			const arena = result.__get_arena()

			expect(arena.get_growth_count()).toBe(0)
			// parse() calls trim(), so capacity must equal count
			expect(arena.get_capacity()).toBe(arena.get_count())
		})

		test('should not grow for Tailwind CSS', () => {
			const css = readFileSync('benchmark/tailwind.min.css', 'utf-8')
			const result = parse(css) as unknown as CSSNode
			const arena = result.__get_arena()

			expect(arena.get_growth_count()).toBe(0)
			expect(arena.get_capacity()).toBe(arena.get_count())
		})
	})
})
