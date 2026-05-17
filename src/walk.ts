// AST walker - depth-first traversal
import type { AnyNode, CSSNode } from './node-types'
import { CSSNode as CSSNodeImpl } from './css-node'
import type { CSSDataArena } from './arena'
import { STYLE_RULE, AT_RULE } from './constants'

// Control flow symbols for walk callbacks
export const SKIP = Symbol('SKIP')
export const BREAK = Symbol('BREAK')

type WalkCallback = (node: AnyNode, depth: number) => void | typeof SKIP | typeof BREAK

/**
 * Walk the AST in depth-first order, calling the callback for each node.
 * Return SKIP to skip children, BREAK to stop traversal. See API.md for examples.
 *
 * @param node - The root node to start walking from
 * @param callback - Function called for each node. Receives the node and its nesting depth.
 *                   Depth increments only for STYLE_RULE and AT_RULE nodes (tracks rule nesting, not tree depth).
 * @param depth - Starting depth (default: 0)
 */
export function walk(node: CSSNode, callback: WalkCallback, depth = 0): boolean {
	const result = callback(node as AnyNode, depth)

	if (result === BREAK) return false
	if (result === SKIP) return true

	const impl = node as unknown as CSSNodeImpl
	const arena = impl.__get_arena()
	const source = impl.__get_source()
	const index = impl.__get_index()

	const type = arena.get_type(index)
	const child_depth = type === STYLE_RULE || type === AT_RULE ? depth + 1 : depth

	let child = arena.get_first_child(index)
	while (child !== 0) {
		if (!_walk(arena, source, child, callback, child_depth)) return false
		child = arena.get_next_sibling(child)
	}

	return true
}

function _walk(
	arena: CSSDataArena,
	source: string,
	index: number,
	callback: WalkCallback,
	depth: number,
): boolean {
	const node = new CSSNodeImpl(arena, source, index) as unknown as AnyNode
	const result = callback(node, depth)

	if (result === BREAK) return false
	if (result === SKIP) return true

	const type = arena.get_type(index)
	const child_depth = type === STYLE_RULE || type === AT_RULE ? depth + 1 : depth

	let child = arena.get_first_child(index)
	while (child !== 0) {
		if (!_walk(arena, source, child, callback, child_depth)) return false
		child = arena.get_next_sibling(child)
	}

	return true
}

const NOOP = function () {}

type WalkEnterLeaveCallback = (node: AnyNode) => void | typeof SKIP | typeof BREAK

interface WalkEnterLeaveOptions {
	enter?: WalkEnterLeaveCallback
	leave?: WalkEnterLeaveCallback
}

/**
 * Walk the AST in depth-first order, calling enter before visiting children and leave after.
 * Return SKIP in enter to skip children (leave still called), BREAK to stop (leave NOT called). See API.md for examples.
 *
 * @param node - The root node to start walking from
 * @param options - Object with optional enter and leave callback functions
 */
export function traverse(
	node: CSSNode,
	{ enter = NOOP, leave = NOOP }: WalkEnterLeaveOptions = {},
): boolean {
	const enter_result = enter(node as AnyNode)

	if (enter_result === BREAK) return false

	if (enter_result !== SKIP) {
		const impl = node as unknown as CSSNodeImpl
		const arena = impl.__get_arena()
		const source = impl.__get_source()
		const index = impl.__get_index()

		let child = arena.get_first_child(index)
		while (child !== 0) {
			if (!_traverse(arena, source, child, enter, leave)) return false
			child = arena.get_next_sibling(child)
		}
	}

	const leave_result = leave(node as AnyNode)
	if (leave_result === BREAK) return false

	return true
}

function _traverse(
	arena: CSSDataArena,
	source: string,
	index: number,
	enter: WalkEnterLeaveCallback,
	leave: WalkEnterLeaveCallback,
): boolean {
	const node = new CSSNodeImpl(arena, source, index) as unknown as AnyNode
	const enter_result = enter(node)

	if (enter_result === BREAK) return false

	if (enter_result !== SKIP) {
		let child = arena.get_first_child(index)
		while (child !== 0) {
			if (!_traverse(arena, source, child, enter, leave)) return false
			child = arena.get_next_sibling(child)
		}
	}

	const leave_result = leave(node)
	if (leave_result === BREAK) return false

	return true
}
