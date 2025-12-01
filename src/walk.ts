// AST walker - depth-first traversal
import type { CSSNode } from './css-node'

type WalkCallback = (node: CSSNode, depth: number) => void

/**
 * Walk the AST in depth-first order, calling the callback for each node
 * @param node - The root node to start walking from
 * @param callback - Function to call for each node visited. Receives the node and its depth (0 for root)
 */
export function walk(node: CSSNode, callback: WalkCallback, depth = 0): void {
	// Call callback for current node
	callback(node, depth)

	// Recursively walk children
	let child = node.first_child
	while (child) {
		walk(child, callback, depth + 1)
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
export function traverse(node: CSSNode, { enter = NOOP, leave = NOOP }: WalkEnterLeaveOptions = {}) {
	// Call enter callback before processing children
	enter(node)

	// Recursively walk children
	let child = node.first_child
	while (child) {
		traverse(child, { enter, leave })
		child = child.next_sibling
	}

	// Call leave callback after processing children
	leave(node)
}
