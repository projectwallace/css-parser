// AST walker - depth-first traversal
import type { CSSNode } from './css-node'

type WalkCallback = (node: CSSNode, depth: number) => void

/**
 * Walk the AST in depth-first order, calling the callback for each node
 * @param node - The root node to start walking from
 * @param callback - Function to call for each node visited. Receives the node and its depth (0 for root)
 */
export function walk(node: CSSNode, callback: WalkCallback): void {
	walk_internal(node, callback, 0)
}

function walk_internal(node: CSSNode, callback: WalkCallback, depth: number): void {
	// Call callback for current node
	callback(node, depth)

	// Recursively walk children
	let child = node.first_child
	while (child) {
		walk_internal(child, callback, depth + 1)
		child = child.next_sibling
	}
}

const NOOP = function () {}

type WalkEnterLeaveCallback = (node: CSSNode) => void

interface WalkEnterLeaveOptions {
	enter?: WalkEnterLeaveCallback
	leave?: WalkEnterLeaveCallback
}

/**
 * Walk the AST in depth-first order, calling enter before visiting children and leave after
 * @param node - The root node to start walking from
 * @param options - Object with optional enter and leave callback functions
 */
export function walk_enter_leave(
	node: CSSNode,
	{ enter = NOOP, leave = NOOP }: WalkEnterLeaveOptions = {}
) {
	walk_enter_leave_internal(node, enter, leave)
}

function walk_enter_leave_internal(
	node: CSSNode,
	enter: WalkEnterLeaveCallback,
	leave: WalkEnterLeaveCallback
): void {
	// Call enter callback before processing children
	enter(node)

	// Recursively walk children
	let child = node.first_child
	while (child) {
		walk_enter_leave_internal(child, enter, leave)
		child = child.next_sibling
	}

	// Call leave callback after processing children
	leave(node)
}
