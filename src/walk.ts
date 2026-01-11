// AST walker - depth-first traversal
import type { CSSNode } from './css-node'
import { STYLE_RULE, AT_RULE } from './constants'

// Control flow symbols for walk callbacks
export const SKIP = Symbol('SKIP')
export const BREAK = Symbol('BREAK')

type WalkCallback = (node: CSSNode, depth: number) => void | typeof SKIP | typeof BREAK

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
	// Call callback for current node with current depth
	const result = callback(node, depth)

	// Check for BREAK - stop immediately
	if (result === BREAK) {
		return false
	}

	// Check for SKIP - don't traverse children
	if (result === SKIP) {
		return true
	}

	// Increment depth for children if this is a rule or at-rule (tracks nesting depth)
	let child_depth = depth
	if (node.type === STYLE_RULE || node.type === AT_RULE) {
		child_depth = depth + 1
	}

	// Recursively walk children with potentially incremented depth
	let child = node.first_child
	while (child) {
		const should_continue = walk(child, callback, child_depth)
		if (!should_continue) {
			return false
		}
		child = child.next_sibling
	}

	return true
}

const NOOP = function () {}

type WalkEnterLeaveCallback = (node: CSSNode) => void | typeof SKIP | typeof BREAK

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
export function traverse(node: CSSNode, { enter = NOOP, leave = NOOP }: WalkEnterLeaveOptions = {}): boolean {
	// Call enter callback before processing children
	const enter_result = enter(node)

	// Check for BREAK in enter - stop immediately
	if (enter_result === BREAK) {
		return false
	}

	// Only traverse children if SKIP was not returned
	if (enter_result !== SKIP) {
		let child = node.first_child
		while (child) {
			const should_continue = traverse(child, { enter, leave })
			if (!should_continue) {
				return false
			}
			child = child.next_sibling
		}
	}

	// Call leave callback after processing children
	// Note: leave() is called even if children were skipped via SKIP
	const leave_result = leave(node)

	// Check for BREAK in leave
	if (leave_result === BREAK) {
		return false
	}

	return true
}
