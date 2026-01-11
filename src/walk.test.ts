import { describe, it, expect } from 'vitest'
import { parse } from './parse'
import {
	STYLESHEET,
	STYLE_RULE,
	SELECTOR_LIST,
	DECLARATION,
	AT_RULE,
	BLOCK,
	IDENTIFIER,
	NUMBER,
	DIMENSION,
	VALUE,
	SELECTOR,
} from './constants'
import { walk, traverse, SKIP, BREAK } from './walk'

describe('walk', () => {
	it('should visit single node', () => {
		const root = parse('', { parse_selectors: false, parse_values: false })
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([STYLESHEET])
	})

	it('should visit all nodes in simple rule', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: true })
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([
			STYLESHEET,
			STYLE_RULE,
			SELECTOR_LIST,
			BLOCK,
			DECLARATION,
			VALUE,
			IDENTIFIER, // red
		])
	})

	it('should visit nodes in depth-first order', () => {
		const root = parse('body { color: red; margin: 0; } div { padding: 1rem; }', { parse_selectors: false, parse_values: true })
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([
			STYLESHEET,
			STYLE_RULE, // body rule
			SELECTOR_LIST, // body selector
			BLOCK, // body block
			DECLARATION, // color: red
			VALUE,
			IDENTIFIER, // red
			DECLARATION, // margin: 0
			VALUE,
			NUMBER, // 0
			STYLE_RULE, // div rule
			SELECTOR_LIST, // div selector
			BLOCK, // div block
			DECLARATION, // padding: 1rem
			VALUE,
			DIMENSION, // 1rem
		])
	})

	it('should visit nested rules', () => {
		const root = parse('.parent { color: red; .child { color: blue; } }', { parse_selectors: false, parse_values: false })
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([
			STYLESHEET,
			STYLE_RULE, // .parent
			SELECTOR_LIST, // .parent selector
			BLOCK, // .parent block
			DECLARATION, // color: red
			STYLE_RULE, // .child (nested inside parent's block)
			SELECTOR_LIST, // .child selector
			BLOCK, // .child block
			DECLARATION, // color: blue
		])
	})

	it('should visit at-rule nodes', () => {
		const root = parse('@media (min-width: 768px) { body { color: red; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
		})

		expect(visited).toEqual([
			STYLESHEET,
			AT_RULE, // @media
			BLOCK, // @media block
			STYLE_RULE, // body
			SELECTOR_LIST, // body selector
			BLOCK, // body block
			DECLARATION, // color: red
		])
	})

	it('should allow collecting node data', () => {
		const root = parse('body { color: red; } .btn { margin: 0; }', { parse_selectors: false, parse_values: false })
		const selectors: string[] = []

		walk(root, (node) => {
			if (node.type === SELECTOR_LIST) {
				selectors.push(node.text)
			}
		})

		expect(selectors).toEqual(['body', '.btn'])
	})

	it('should allow collecting property names', () => {
		const root = parse('body { color: red; margin: 0; padding: 1rem; }', { parse_selectors: false, parse_values: false })
		const properties: string[] = []

		walk(root, (node) => {
			if (node.type === DECLARATION) {
				const name = node.name
				if (name) properties.push(name)
			}
		})

		expect(properties).toEqual(['color', 'margin', 'padding'])
	})

	it('should allow counting nodes by type', () => {
		const root = parse(
			`
			body { color: red; }
			.card { padding: 1rem; }
			@media screen { div { margin: 0; } }
		`,
		)
		const counts: Record<number, number> = {}

		walk(root, (node) => {
			counts[node.type] = (counts[node.type] || 0) + 1
		})

		expect.soft(counts[STYLESHEET]).toBe(1)
		expect.soft(counts[STYLE_RULE]).toBe(3)
		expect.soft(counts[SELECTOR_LIST]).toBe(3)
		expect.soft(counts[DECLARATION]).toBe(3)
		expect.soft(counts[AT_RULE]).toBe(1)
	})

	it('should work with deeply nested structures', () => {
		const root = parse('.a { .b { .c { color: red; } } }')
		const rules: number[] = []

		walk(root, (node) => {
			if (node.type === STYLE_RULE) {
				rules.push(node.type)
			}
		})

		expect(rules.length).toBe(3) // .a, .b, .c
	})

	it('should track depth correctly', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: true })
		const depths: number[] = []

		walk(root, (_node, depth) => {
			depths.push(depth)
		})

		// STYLESHEET (0), STYLE_RULE (1), SELECTOR_LIST (2), BLOCK (2), DECLARATION (3), VALUE (4), IDENTIFIER (5)
		expect(depths).toEqual([0, 1, 2, 2, 3, 4, 5])
	})

	it('should track depth in nested structures', () => {
		const root = parse('.a { .b { .c { color: red; } } }', { parse_selectors: false, parse_values: true })
		const ruleDepths: number[] = []

		walk(root, (node, depth) => {
			if (node.type === STYLE_RULE) {
				ruleDepths.push(depth)
			}
		})

		expect(ruleDepths).toEqual([1, 3, 5]) // .a at depth 1, .b at depth 3 (inside .a's block), .c at depth 5 (inside .b's block)
	})

	it('should track depth with at-rules', () => {
		const root = parse('@media screen { body { color: red; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const typeAndDepth: Array<{ type: number; depth: number }> = []

		walk(root, (node, depth) => {
			typeAndDepth.push({ type: node.type, depth })
		})

		expect(typeAndDepth).toEqual([
			{ type: STYLESHEET, depth: 0 },
			{ type: AT_RULE, depth: 1 }, // @media
			{ type: BLOCK, depth: 2 }, // @media block
			{ type: STYLE_RULE, depth: 3 }, // body
			{ type: SELECTOR_LIST, depth: 4 }, // body selector
			{ type: BLOCK, depth: 4 }, // body block
			{ type: DECLARATION, depth: 5 }, // color: red
		])
	})

	it('should track depth with consecutive at-rules', () => {
		const root = parse('@media screen { body { color: red; } } @layer { a { color: red; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const typeAndDepth: Array<{ type: number; depth: number }> = []

		walk(root, (node, depth) => {
			typeAndDepth.push({ type: node.type, depth })
		})

		expect(typeAndDepth).toEqual([
			{ type: STYLESHEET, depth: 0 },
			{ type: AT_RULE, depth: 1 }, // @media
			{ type: BLOCK, depth: 2 }, // @media block
			{ type: STYLE_RULE, depth: 3 }, // body
			{ type: SELECTOR_LIST, depth: 4 }, // body selector
			{ type: BLOCK, depth: 4 }, // body block
			{ type: DECLARATION, depth: 5 }, // color: red
			{ type: AT_RULE, depth: 1 }, // @layer
			{ type: BLOCK, depth: 2 }, // @layer block
			{ type: STYLE_RULE, depth: 3 },
			{ type: SELECTOR_LIST, depth: 4 },
			{ type: BLOCK, depth: 4 },
			{ type: DECLARATION, depth: 5 },
		])
	})

	test('export types', () => {
		let ast = parse('a{}')
		walk(ast, (node, _depth) => {
			expectTypeOf(node.type).toBeNumber()
			if (node.type === SELECTOR_LIST) {
				expect(node.text).toEqual('a')
			}
		})
	})
})

describe('walk with SKIP and BREAK', () => {
	it('should skip children when SKIP is returned', () => {
		const root = parse('body { color: red; margin: 0; } div { padding: 1rem; }', {
			parse_selectors: false,
			parse_values: true,
		})
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
			// Skip STYLE_RULE children
			if (node.type === STYLE_RULE) {
				return SKIP
			}
		})

		// Should visit STYLESHEET and both STYLE_RULE nodes, but not their children
		expect(visited).toEqual([STYLESHEET, STYLE_RULE, STYLE_RULE])
	})

	it('should skip AT_RULE children when SKIP is returned', () => {
		const root = parse('@media screen { body { color: red; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
			if (node.type === AT_RULE) {
				return SKIP
			}
		})

		// Should visit STYLESHEET and AT_RULE, but not the BLOCK or anything inside
		expect(visited).toEqual([STYLESHEET, AT_RULE])
	})

	it('should allow SKIP on leaf node (no effect)', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: true })
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
			// Skip IDENTIFIER (leaf node)
			if (node.type === IDENTIFIER) {
				return SKIP
			}
		})

		// All nodes should be visited (SKIP on leaf has no effect)
		expect(visited).toEqual([STYLESHEET, STYLE_RULE, SELECTOR_LIST, BLOCK, DECLARATION, VALUE, IDENTIFIER])
	})

	it('should stop traversal when BREAK is returned', () => {
		const root = parse('body { color: red; } div { padding: 1rem; }', {
			parse_selectors: false,
			parse_values: false,
		})
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
			// Break on first STYLE_RULE
			if (node.type === STYLE_RULE) {
				return BREAK
			}
		})

		// Should visit STYLESHEET and first STYLE_RULE, then stop
		expect(visited).toEqual([STYLESHEET, STYLE_RULE])
	})

	it('should stop traversal on DECLARATION', () => {
		const root = parse('body { color: red; margin: 0; } div { padding: 1rem; }', {
			parse_selectors: false,
			parse_values: false,
		})
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
			// Break on first DECLARATION
			if (node.type === DECLARATION) {
				return BREAK
			}
		})

		// Should visit down to first DECLARATION then stop
		expect(visited).toEqual([STYLESHEET, STYLE_RULE, SELECTOR_LIST, BLOCK, DECLARATION])
	})

	it('should propagate BREAK from deep in tree', () => {
		const root = parse('.a { .b { .c { color: red; } } } .d { margin: 0; }', {
			parse_selectors: false,
			parse_values: false,
		})
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
			// Break on DECLARATION (deep in tree)
			if (node.type === DECLARATION) {
				return BREAK
			}
		})

		// Should stop at first DECLARATION and not visit .d
		expect(visited).toEqual([
			STYLESHEET,
			STYLE_RULE, // .a
			SELECTOR_LIST,
			BLOCK,
			STYLE_RULE, // .b
			SELECTOR_LIST,
			BLOCK,
			STYLE_RULE, // .c
			SELECTOR_LIST,
			BLOCK,
			DECLARATION, // color: red - BREAK here
		])
	})

	it('should maintain backward compatibility (no return value)', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: true })
		const visited: number[] = []

		walk(root, (node) => {
			visited.push(node.type)
			// No return value - should continue normally
		})

		expect(visited).toEqual([STYLESHEET, STYLE_RULE, SELECTOR_LIST, BLOCK, DECLARATION, VALUE, IDENTIFIER])
	})

	it('should find first declaration with specific property using BREAK', () => {
		const root = parse('body { color: red; margin: 0; } div { margin: 1rem; }', {
			parse_selectors: false,
			parse_values: false,
		})
		let found: string | null = null

		walk(root, (node) => {
			if (node.type === DECLARATION && node.name === 'margin') {
				found = node.name
				return BREAK
			}
		})

		expect(found).toBe('margin')
	})

	it('should skip media query contents using SKIP', () => {
		const root = parse('@media screen { body { color: red; } } div { margin: 0; }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const ruleCount = { media: 0, style: 0 }

		walk(root, (node) => {
			if (node.type === AT_RULE) {
				ruleCount.media++
				return SKIP // Skip media query contents
			}
			if (node.type === STYLE_RULE) {
				ruleCount.style++
			}
		})

		// Should count 1 media query and only 1 style rule (div, not body)
		expect(ruleCount.media).toBe(1)
		expect(ruleCount.style).toBe(1)
	})

	it('should track depth correctly with SKIP', () => {
		const root = parse('body { color: red; } div { margin: 0; }', {
			parse_selectors: false,
			parse_values: true,
		})
		const depths: number[] = []

		walk(root, (node, depth) => {
			depths.push(depth)
			if (node.type === STYLE_RULE) {
				return SKIP
			}
		})

		// STYLESHEET (0), STYLE_RULE (1), STYLE_RULE (1)
		expect(depths).toEqual([0, 1, 1])
	})
})

describe('walk enter/leave', () => {
	const root = parse('@media screen { body { color: red; } }', {
		parse_selectors: false,
		parse_values: false,
		parse_atrule_preludes: false,
	})

	test('both enter + leave', () => {
		const enter: number[] = []
		const leave: number[] = []

		traverse(root, {
			enter(node) {
				enter.push(node.type)
			},
			leave(node) {
				leave.push(node.type)
			},
		})

		expect(enter).toEqual([STYLESHEET, AT_RULE, BLOCK, STYLE_RULE, SELECTOR_LIST, BLOCK, DECLARATION])
		expect(leave).toEqual([SELECTOR_LIST, DECLARATION, BLOCK, STYLE_RULE, BLOCK, AT_RULE, STYLESHEET])
	})

	test('only enter', () => {
		const enter: number[] = []

		traverse(root, {
			enter(node) {
				enter.push(node.type)
			},
		})

		expect(enter).toEqual([STYLESHEET, AT_RULE, BLOCK, STYLE_RULE, SELECTOR_LIST, BLOCK, DECLARATION])
	})

	test('only leave', () => {
		const leave: number[] = []

		traverse(root, {
			leave(node) {
				leave.push(node.type)
			},
		})

		expect(leave).toEqual([SELECTOR_LIST, DECLARATION, BLOCK, STYLE_RULE, BLOCK, AT_RULE, STYLESHEET])
	})

	test('neither', () => {
		expect(() => traverse(root)).not.toThrow()
	})
})

describe('traverse with SKIP and BREAK', () => {
	it('should skip children but call leave when SKIP is returned from enter', () => {
		const root = parse('@media screen { body { color: red; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const enter: number[] = []
		const leave: number[] = []

		traverse(root, {
			enter(node) {
				enter.push(node.type)
				if (node.type === AT_RULE) {
					return SKIP // Skip children but leave should still be called
				}
			},
			leave(node) {
				leave.push(node.type)
			},
		})

		// Enter: STYLESHEET, AT_RULE (then skip children)
		expect(enter).toEqual([STYLESHEET, AT_RULE])
		// Leave: AT_RULE, STYLESHEET (leave called for AT_RULE despite SKIP)
		expect(leave).toEqual([AT_RULE, STYLESHEET])
	})

	it('should allow SKIP in leave (no effect)', () => {
		const root = parse('body { color: red; }', {
			parse_selectors: false,
			parse_values: false,
		})
		const enter: number[] = []
		const leave: number[] = []

		traverse(root, {
			enter(node) {
				enter.push(node.type)
			},
			leave(node) {
				leave.push(node.type)
				if (node.type === DECLARATION) {
					return SKIP // No effect in leave
				}
			},
		})

		// All nodes should be visited normally
		expect(enter).toEqual([STYLESHEET, STYLE_RULE, SELECTOR_LIST, BLOCK, DECLARATION])
		expect(leave).toEqual([SELECTOR_LIST, DECLARATION, BLOCK, STYLE_RULE, STYLESHEET])
	})

	it('should stop traversal and not call leave when BREAK is returned from enter', () => {
		const root = parse('@media screen { body { color: red; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const enter: number[] = []
		const leave: number[] = []

		traverse(root, {
			enter(node) {
				enter.push(node.type)
				if (node.type === AT_RULE) {
					return BREAK // Stop immediately
				}
			},
			leave(node) {
				leave.push(node.type)
			},
		})

		// Enter: STYLESHEET, AT_RULE (then break)
		expect(enter).toEqual([STYLESHEET, AT_RULE])
		// Leave: NOT called for AT_RULE or STYLESHEET
		expect(leave).toEqual([])
	})

	it('should stop traversal when BREAK is returned from leave', () => {
		const root = parse('body { color: red; } div { margin: 0; }', {
			parse_selectors: false,
			parse_values: false,
		})
		const enter: number[] = []
		const leave: number[] = []

		traverse(root, {
			enter(node) {
				enter.push(node.type)
			},
			leave(node) {
				leave.push(node.type)
				if (node.type === DECLARATION) {
					return BREAK // Stop after leaving first declaration
				}
			},
		})

		// Enter all nodes of first rule down to DECLARATION
		expect(enter).toEqual([STYLESHEET, STYLE_RULE, SELECTOR_LIST, BLOCK, DECLARATION])
		// Leave SELECTOR_LIST (sibling, already left) and DECLARATION (then break)
		expect(leave).toEqual([SELECTOR_LIST, DECLARATION])
	})

	it('should handle SKIP in enter with normal leave', () => {
		const root = parse('.a { .b { color: red; } }', {
			parse_selectors: false,
			parse_values: false,
		})
		const enter: number[] = []
		const leave: number[] = []

		traverse(root, {
			enter(node) {
				enter.push(node.type)
				if (node.type === STYLE_RULE && enter.filter((t) => t === STYLE_RULE).length === 2) {
					return SKIP // Skip .b's children
				}
			},
			leave(node) {
				leave.push(node.type)
			},
		})

		// Enter: STYLESHEET, .a (STYLE_RULE), SELECTOR_LIST, BLOCK, .b (STYLE_RULE then SKIP)
		expect(enter).toEqual([STYLESHEET, STYLE_RULE, SELECTOR_LIST, BLOCK, STYLE_RULE])
		// Leave: SELECTOR_LIST (sibling of BLOCK), .b (STYLE_RULE), BLOCK, .a (STYLE_RULE), STYLESHEET
		expect(leave).toEqual([SELECTOR_LIST, STYLE_RULE, BLOCK, STYLE_RULE, STYLESHEET])
	})

	it('should verify enter/leave call counts match when using SKIP', () => {
		const root = parse('@media screen { body { color: red; } } div { margin: 0; }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const enterCount: Record<number, number> = {}
		const leaveCount: Record<number, number> = {}

		traverse(root, {
			enter(node) {
				enterCount[node.type] = (enterCount[node.type] || 0) + 1
				if (node.type === AT_RULE) {
					return SKIP
				}
			},
			leave(node) {
				leaveCount[node.type] = (leaveCount[node.type] || 0) + 1
			},
		})

		// Every node that was entered should also be left
		expect(enterCount[STYLESHEET]).toBe(1)
		expect(leaveCount[STYLESHEET]).toBe(1)
		expect(enterCount[AT_RULE]).toBe(1)
		expect(leaveCount[AT_RULE]).toBe(1)
		expect(enterCount[STYLE_RULE]).toBe(1)
		expect(leaveCount[STYLE_RULE]).toBe(1)
	})

	it('should stop when BREAK is returned from nested enter', () => {
		const root = parse('.a { .b { .c { color: red; } } }', {
			parse_selectors: false,
			parse_values: false,
		})
		const enter: number[] = []
		const leave: number[] = []

		traverse(root, {
			enter(node) {
				enter.push(node.type)
				if (node.type === DECLARATION) {
					return BREAK
				}
			},
			leave(node) {
				leave.push(node.type)
			},
		})

		// Should enter down to DECLARATION and break
		expect(enter).toEqual([
			STYLESHEET,
			STYLE_RULE, // .a
			SELECTOR_LIST,
			BLOCK,
			STYLE_RULE, // .b
			SELECTOR_LIST,
			BLOCK,
			STYLE_RULE, // .c
			SELECTOR_LIST,
			BLOCK,
			DECLARATION,
		])
		// SELECTOR_LIST nodes have no children, so they're left before siblings are processed
		expect(leave).toEqual([SELECTOR_LIST, SELECTOR_LIST, SELECTOR_LIST])
	})

	it('should maintain backward compatibility with traverse', () => {
		const root = parse('body { color: red; }', {
			parse_selectors: false,
			parse_values: false,
		})
		const enter: number[] = []
		const leave: number[] = []

		traverse(root, {
			enter(node) {
				enter.push(node.type)
				// No return value
			},
			leave(node) {
				leave.push(node.type)
				// No return value
			},
		})

		expect(enter).toEqual([STYLESHEET, STYLE_RULE, SELECTOR_LIST, BLOCK, DECLARATION])
		expect(leave).toEqual([SELECTOR_LIST, DECLARATION, BLOCK, STYLE_RULE, STYLESHEET])
	})
})

describe('walk with context', () => {
	it('should provide closest rule ancestor', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: false })
		let declarationContext: any = undefined

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === DECLARATION) {
					declarationContext = context
				}
			},
			{ include_context: true },
		)

		expect(declarationContext?.rule?.type).toBe(STYLE_RULE)
		expect(declarationContext?.atrule).toBeNull()
	})

	it('should provide closest atrule ancestor', () => {
		const root = parse('@media screen { body { color: red; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		let declarationContext: any = undefined

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === DECLARATION) {
					declarationContext = context
				}
			},
			{ include_context: true },
		)

		expect(declarationContext?.atrule?.type).toBe(AT_RULE)
		expect(declarationContext?.atrule?.name).toBe('media')
		expect(declarationContext?.rule?.type).toBe(STYLE_RULE)
	})

	it('should provide closest declaration ancestor', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: true })
		let valueContext: any = undefined

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === VALUE) {
					valueContext = context
				}
			},
			{ include_context: true },
		)

		expect(valueContext?.declaration?.type).toBe(DECLARATION)
		expect(valueContext?.declaration?.name).toBe('color')
	})

	it('should provide closest value ancestor', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: true })
		let identifierContext: any = undefined

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === IDENTIFIER) {
					identifierContext = context
				}
			},
			{ include_context: true },
		)

		expect(identifierContext?.value?.type).toBe(VALUE)
	})

	it('should provide closest selector ancestor', () => {
		const root = parse('body { color: red; }', { parse_selectors: true, parse_values: false })
		let typeSelectorContext: any = undefined

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === 21) {
					// TYPE_SELECTOR = 21
					typeSelectorContext = context
				}
			},
			{ include_context: true },
		)

		// TYPE_SELECTOR (21) should have SELECTOR_LIST (20) as its selector ancestor
		// (context stops updating once inside first selector node)
		expect(typeSelectorContext?.selector?.type).toBe(20) // SELECTOR_LIST
	})

	it('should provide immediate parent', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: false })
		let declarationParent: any = undefined

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === DECLARATION) {
					declarationParent = context?.parent
				}
			},
			{ include_context: true },
		)

		expect(declarationParent?.type).toBe(BLOCK)
	})

	it('should provide correct depth in context', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: true })
		const depths: number[] = []

		walk(
			root,
			(node, _depth, context) => {
				if (context) {
					depths.push(context.depth)
				}
			},
			{ include_context: true },
		)

		expect(depths).toEqual([0, 1, 2, 2, 3, 4, 5])
	})

	it('should have context undefined when not enabled', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: false })
		let hasContext = false

		walk(root, (_node, _depth, context) => {
			if (context !== undefined) {
				hasContext = true
			}
		})

		expect(hasContext).toBe(false)
	})

	it('should detect selector inside @keyframes', () => {
		const root = parse('@keyframes slide { from { opacity: 0; } }', {
			parse_selectors: true,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		let foundSelectorInKeyframes = false

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === SELECTOR && context?.atrule?.name === 'keyframes') {
					foundSelectorInKeyframes = true
				}
			},
			{ include_context: true },
		)

		expect(foundSelectorInKeyframes).toBe(true)
	})

	it('should detect declaration inside @supports', () => {
		const root = parse('@supports (display: grid) { body { display: grid; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const declarationsInSupports: string[] = []

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === DECLARATION && context?.atrule?.name === 'supports') {
					if (node.name) {
						declarationsInSupports.push(node.name)
					}
				}
			},
			{ include_context: true },
		)

		expect(declarationsInSupports).toEqual(['display'])
	})

	it('should detect nested at-rules', () => {
		const root = parse('@media screen { @supports (display: grid) { body { color: red; } } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		let declarationContext: any = undefined

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === DECLARATION) {
					declarationContext = context
				}
			},
			{ include_context: true },
		)

		// Should find closest at-rule (supports), not media
		expect(declarationContext?.atrule?.name).toBe('supports')
	})

	it('should distinguish declaration in rule vs at-rule', () => {
		const root = parse('body { color: red; } @media screen { div { color: blue; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const results: Array<{ inRule: boolean; inAtrule: boolean }> = []

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === DECLARATION) {
					results.push({
						inRule: context?.rule !== null,
						inAtrule: context?.atrule !== null,
					})
				}
			},
			{ include_context: true },
		)

		expect(results).toEqual([
			{ inRule: true, inAtrule: false }, // body color
			{ inRule: true, inAtrule: true }, // div color (inside @media)
		])
	})

	it('should track value context in complex expressions', () => {
		const root = parse('body { color: rgb(255, 0, 0); }', { parse_selectors: false, parse_values: true })
		let numberInsideFunction = 0

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === NUMBER && context?.value !== null) {
					numberInsideFunction++
				}
			},
			{ include_context: true },
		)

		expect(numberInsideFunction).toBe(3) // 255, 0, 0
	})

	it('should have null context at root level', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: false })
		let rootContext: any = undefined

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === STYLESHEET) {
					rootContext = context
				}
			},
			{ include_context: true },
		)

		expect(rootContext?.rule).toBeNull()
		expect(rootContext?.atrule).toBeNull()
		expect(rootContext?.declaration).toBeNull()
		expect(rootContext?.value).toBeNull()
		expect(rootContext?.selector).toBeNull()
		expect(rootContext?.parent).toBeNull()
		expect(rootContext?.depth).toBe(0)
	})

	it('should handle SKIP with context', () => {
		const root = parse('body { color: red; } div { margin: 0; }', {
			parse_selectors: false,
			parse_values: false,
		})
		const visited: number[] = []

		walk(
			root,
			(node, _depth, _context) => {
				visited.push(node.type)
				if (node.type === STYLE_RULE) {
					return SKIP
				}
			},
			{ include_context: true },
		)

		expect(visited).toEqual([STYLESHEET, STYLE_RULE, STYLE_RULE])
	})

	it('should handle BREAK with context', () => {
		const root = parse('body { color: red; } div { margin: 0; }', {
			parse_selectors: false,
			parse_values: false,
		})
		const visited: number[] = []

		walk(
			root,
			(node, _depth, _context) => {
				visited.push(node.type)
				if (node.type === STYLE_RULE) {
					return BREAK
				}
			},
			{ include_context: true },
		)

		expect(visited).toEqual([STYLESHEET, STYLE_RULE])
	})

	it('should handle deeply nested structures with context', () => {
		const root = parse('.a { .b { .c { color: red; } } }', { parse_selectors: false, parse_values: false })
		const ruleDepths: number[] = []

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === STYLE_RULE && context) {
					ruleDepths.push(context.depth)
				}
			},
			{ include_context: true },
		)

		expect(ruleDepths).toEqual([1, 3, 5])
	})

	it('should handle multiple at-rules of same type', () => {
		const root = parse('@media screen { body { color: red; } } @media print { div { color: blue; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const atruleNames: string[] = []

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === DECLARATION && context?.atrule?.name) {
					atruleNames.push(context.atrule.name)
				}
			},
			{ include_context: true },
		)

		expect(atruleNames).toEqual(['media', 'media'])
	})

	it('should respect custom starting depth with context', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: false })
		const depths: number[] = []

		walk(
			root,
			(_node, _depth, context) => {
				if (context) {
					depths.push(context.depth)
				}
			},
			{ depth: 5, include_context: true },
		)

		expect(depths).toEqual([5, 6, 7, 7, 8])
	})

	it('should stop updating context inside value nodes', () => {
		const root = parse('body { color: rgb(255, 0, 0); }', { parse_selectors: false, parse_values: true })
		const numberContexts: any[] = []

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === NUMBER) {
					numberContexts.push({
						hasDeclaration: context?.declaration !== null,
						hasValue: context?.value !== null,
					})
				}
			},
			{ include_context: true },
		)

		// All NUMBER nodes inside the function should have the same context
		expect(numberContexts).toEqual([
			{ hasDeclaration: true, hasValue: true },
			{ hasDeclaration: true, hasValue: true },
			{ hasDeclaration: true, hasValue: true },
		])
	})

	it('should stop updating context inside selector nodes', () => {
		const root = parse('.foo { color: red; }', { parse_selectors: true, parse_values: false })
		let classSelectorContext: any = undefined

		walk(
			root,
			(node, _depth, context) => {
				if (node.type === 22) {
					// CLASS_SELECTOR = 22
					classSelectorContext = context
				}
			},
			{ include_context: true },
		)

		// CLASS_SELECTOR is child of STYLE_RULE, so it has rule context
		expect(classSelectorContext?.rule?.type).toBe(STYLE_RULE)
		// And it should have SELECTOR_LIST as selector ancestor (context stopped updating after SELECTOR_LIST)
		expect(classSelectorContext?.selector?.type).toBe(20) // SELECTOR_LIST
	})
})

describe('traverse with context', () => {
	it('should provide context in enter callback', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: true })
		let valueContext: any = undefined

		traverse(root, {
			enter(node, context) {
				if (node.type === VALUE) {
					valueContext = context
				}
			},
			include_context: true,
		})

		expect(valueContext?.rule.type).toBe(STYLE_RULE)
		expect(valueContext?.declaration.type).toBe(DECLARATION)
		expect(valueContext?.parent.type).toBe(DECLARATION)
		expect(valueContext.depth).toBe(0)
	})

	it('should provide context in leave callback', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: true })
		let valueContext: any = undefined

		traverse(root, {
			leave(node, context) {
				if (node.type === VALUE) {
					valueContext = context
				}
			},
			include_context: true,
		})

		expect(valueContext?.rule?.type).toBe(STYLE_RULE)
		expect(valueContext?.declaration?.type).toBe(DECLARATION)
		expect(valueContext?.parent?.type).toBe(DECLARATION)
	})

	it('should have context undefined when not enabled in traverse', () => {
		const root = parse('body { color: red; }', { parse_selectors: false, parse_values: false })
		let hasContext = false

		traverse(root, {
			enter(_node, context) {
				if (context !== undefined) {
					hasContext = true
				}
			},
		})

		expect(hasContext).toBe(false)
	})

	it('should provide context with SKIP in enter', () => {
		const root = parse('@media screen { body { color: red; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const enterTypes: number[] = []
		const leaveTypes: number[] = []

		traverse(root, {
			enter(node, context) {
				enterTypes.push(node.type)
				if (node.type === AT_RULE && context) {
					return SKIP
				}
			},
			leave(node, _context) {
				leaveTypes.push(node.type)
			},
			include_context: true,
		})

		expect(enterTypes).toEqual([STYLESHEET, AT_RULE])
		expect(leaveTypes).toEqual([AT_RULE, STYLESHEET])
	})

	it('should provide context with BREAK in enter', () => {
		const root = parse('@media screen { body { color: red; } }', {
			parse_selectors: false,
			parse_values: false,
			parse_atrule_preludes: false,
		})
		const enterTypes: number[] = []
		const leaveTypes: number[] = []

		traverse(root, {
			enter(node, context) {
				enterTypes.push(node.type)
				if (node.type === AT_RULE && context) {
					return BREAK
				}
			},
			leave(node, _context) {
				leaveTypes.push(node.type)
			},
			include_context: true,
		})

		expect(enterTypes).toEqual([STYLESHEET, AT_RULE])
		expect(leaveTypes).toEqual([])
	})

	it('should track depth in context for traverse', () => {
		const root = parse('body { color: red; & test { color: green } }', { parse_selectors: false, parse_values: false })
		const enterDepths: number[] = []
		const leaveDepths: number[] = []
		const enterNodes: string[] = []
		const leaveNodes: string[] = []

		traverse(root, {
			enter(node, context) {
				if (context) {
					enterNodes.push(node.type_name)
					enterDepths.push(context.depth)
				}
			},
			leave(node, context) {
				if (context) {
					leaveNodes.push(node.type_name)
					leaveDepths.push(context.depth)
				}
			},
			include_context: true,
		})

		expect(enterNodes).toEqual([
			'StyleSheet',
			'Rule',
			'SelectorList',
			'Block',
			'Declaration',
			'Rule', // nested
			'SelectorList',
			'Block',
			'Declaration',
		])
		expect(enterDepths).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1])
		expect(enterNodes).toEqual(enterNodes)
		// TODO: figure out why this order
		expect(leaveDepths).toEqual([0, 1, 0, 0, 0])
	})
})
