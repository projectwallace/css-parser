// AST walker - depth-first traversal
import type { CSSNode } from './css-node'

/**
 * Walk the AST in depth-first order, calling the callback for each node
 * @param node - The root node to start walking from
 * @param callback - Function to call for each node visited
 */
export function walk(node: CSSNode, callback: (node: CSSNode) => void): void {
	// Call callback for current node
	callback(node)

	// Recursively walk children
	let child = node.first_child
	while (child) {
		walk(child, callback)
		child = child.next_sibling
	}
}
