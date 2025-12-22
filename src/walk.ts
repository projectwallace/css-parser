// AST walker - depth-first traversal
import type { CSSNode } from './css-node'

// Control flow symbols for walk callbacks
export const SKIP = Symbol('SKIP')
export const BREAK = Symbol('BREAK')

type WalkCallback = (node: CSSNode, depth: number) => void | typeof SKIP | typeof BREAK

/**
 * Walk the AST in depth-first order, calling the callback for each node
 *
 * @param node - The root node to start walking from
 * @param callback - Function to call for each node visited. Receives the node and its depth (0 for root).
 *                   Return SKIP to skip children of current node, or BREAK to stop traversal entirely.
 * @param depth - Starting depth (default: 0)
 *
 * @example
 * import { parse, walk, SKIP, BREAK } from '@projectwallace/css-parser'
 *
 * const ast = parse('.a { .b { .c { color: red; } } }')
 *
 * // Skip nested rules
 * walk(ast, (node) => {
 *   if (node.type === STYLE_RULE) {
 *     console.log(node.text)
 *     return SKIP // Don't visit nested rules
 *   }
 * })
 * // Output: .a { ... }, but not .b or .c
 *
 * // Stop on first declaration
 * walk(ast, (node) => {
 *   if (node.type === DECLARATION) {
 *     console.log(node.name)
 *     return BREAK // Stop traversal
 *   }
 * })
 */
export function walk(node: CSSNode, callback: WalkCallback, depth = 0): boolean {
	// Call callback for current node
	const result = callback(node, depth)

	// Check for BREAK - stop immediately
	if (result === BREAK) {
		return false
	}

	// Check for SKIP - don't traverse children
	if (result === SKIP) {
		return true
	}

	// Recursively walk children
	let child = node.first_child
	while (child) {
		const should_continue = walk(child, callback, depth + 1)
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
 * Walk the AST in depth-first order, calling enter before visiting children and leave after
 *
 * @param node - The root node to start walking from
 * @param options - Object with optional enter and leave callback functions
 * @param options.enter - Called before visiting children. Return SKIP to skip children (leave still called),
 *                        or BREAK to stop traversal entirely (leave NOT called).
 * @param options.leave - Called after visiting children. Return BREAK to stop traversal.
 *
 * @example
 * import { parse, traverse, SKIP, BREAK } from '@projectwallace/css-parser'
 *
 * const ast = parse('@media screen { .a { color: red; } }')
 *
 * // Track context with skip
 * let depth = 0
 * traverse(ast, {
 *   enter(node) {
 *     depth++
 *     if (node.type === AT_RULE) {
 *       console.log('Entering media query at depth', depth)
 *       return SKIP // Skip contents but still call leave
 *     }
 *   },
 *   leave(node) {
 *     if (node.type === AT_RULE) {
 *       console.log('Leaving media query at depth', depth)
 *     }
 *     depth--
 *   }
 * })
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
