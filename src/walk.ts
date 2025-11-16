// AST walker - depth-first traversal
import type { CSSNode } from './css-node'

/**
 * Walk the AST in depth-first order, calling the callback for each node
 * @param node - The root node to start walking from
 * @param callback - Function to call for each node visited. Receives the node and its depth (0 for root)
 */
export function walk(node: CSSNode, callback: (node: CSSNode, depth: number) => void): void {
	walk_internal(node, callback, 0)
}

function walk_internal(node: CSSNode, callback: (node: CSSNode, depth: number) => void, depth: number): void {
	// Call callback for current node
	callback(node, depth)

	// Recursively walk children
	let child = node.first_child
	while (child) {
		walk_internal(child, callback, depth + 1)
		child = child.next_sibling
	}
}
