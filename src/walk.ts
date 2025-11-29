// AST walker - depth-first traversal
import type { CSSNode } from './css-node'

type WalkCallback = (node: CSSNode, depth: number) => void

/**
 * Walk the AST in depth-first order, calling the callback for each node
 *
 * @param node - The root node to start walking from
 * @param callback - Function to call for each node visited. Receives the node and its depth (0 for root)
 *
 * @example
 * // Find all declarations
 * import { parse, DeclarationNode } from '@projectwallace/css-parser'
 * const ast = parse('div { color: red; }')
 * walk(ast, (node) => {
 *   if (node instanceof DeclarationNode) {
 *     console.log(node.property, node.valueText)
 *   }
 * })
 *
 * @example
 * // Count nodes by type
 * const counts = new Map()
 * walk(ast, (node) => {
 *   const typename = node.constructor.name
 *   counts.set(typename, (counts.get(typename) || 0) + 1)
 * })
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
 *
 * @param node - The root node to start walking from
 * @param options - Object with optional enter and leave callback functions
 *
 * @example
 * // Transform the AST
 * import { parse, DeclarationNode } from '@projectwallace/css-parser'
 * const ast = parse('div { color: red; }')
 * const declarations = []
 * walk_enter_leave(ast, {
 *   enter(node) {
 *     if (node instanceof DeclarationNode) {
 *       declarations.push(node)
 *     }
 *   },
 *   leave(node) {
 *     // Cleanup after processing node and its children
 *   }
 * })
 */
export function walk_enter_leave(node: CSSNode, { enter = NOOP, leave = NOOP }: WalkEnterLeaveOptions = {}) {
	// Call enter callback before processing children
	enter(node)

	// Recursively walk children
	let child = node.first_child
	while (child) {
		walk_enter_leave(child, { enter, leave })
		child = child.next_sibling
	}

	// Call leave callback after processing children
	leave(node)
}
