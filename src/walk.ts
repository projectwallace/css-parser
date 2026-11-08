// AST walker - depth-first traversal
import type { AnyNode, CSSNode } from './node-types'
import { CSSNode as CSSNodeImpl } from './css-node'
import type { CSSDataArena } from './arena'
import { STYLE_RULE, AT_RULE } from './constants'

// Control flow symbols for walk callbacks
export const SKIP: unique symbol = Symbol('SKIP')
export const BREAK: unique symbol = Symbol('BREAK')

type WalkCallback = (node: AnyNode, depth: number) => void | typeof SKIP | typeof BREAK

/**
 * Walk the AST depth-first, calling `callback` for each node. Return SKIP to skip
 * children, BREAK to stop. `depth` tracks rule nesting (STYLE_RULE/AT_RULE only),
 * not tree depth.
 */
export function walk(node: CSSNode, callback: WalkCallback, depth = 0): boolean {
	const impl = node as unknown as CSSNodeImpl
	return _walk(impl.__get_arena(), impl.__get_source(), impl.__get_index(), callback, depth)
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

type WalkEnterLeaveCallback = (node: AnyNode, depth: number) => void | typeof SKIP | typeof BREAK

interface WalkEnterLeaveOptions {
	enter?: WalkEnterLeaveCallback
	leave?: WalkEnterLeaveCallback
}

/**
 * Walk the AST depth-first, calling `enter` before children and `leave` after.
 * SKIP in enter skips children (leave still runs); BREAK stops (leave doesn't run).
 * Both callbacks receive the same `depth` as `walk`: it counts rule and at-rule nesting only.
 */
export function traverse(
	node: CSSNode,
	{ enter = NOOP, leave = NOOP }: WalkEnterLeaveOptions = {},
	depth = 0,
): boolean {
	const impl = node as unknown as CSSNodeImpl
	return _traverse(impl.__get_arena(), impl.__get_source(), impl.__get_index(), enter, leave, depth)
}

function _traverse(
	arena: CSSDataArena,
	source: string,
	index: number,
	enter: WalkEnterLeaveCallback,
	leave: WalkEnterLeaveCallback,
	depth: number,
): boolean {
	const node = new CSSNodeImpl(arena, source, index) as unknown as AnyNode
	const enter_result = enter(node, depth)

	if (enter_result === BREAK) return false

	if (enter_result !== SKIP) {
		const type = arena.get_type(index)
		const child_depth = type === STYLE_RULE || type === AT_RULE ? depth + 1 : depth
		let child = arena.get_first_child(index)
		while (child !== 0) {
			if (!_traverse(arena, source, child, enter, leave, child_depth)) return false
			child = arena.get_next_sibling(child)
		}
	}

	const leave_result = leave(node, depth)
	if (leave_result === BREAK) return false

	return true
}
