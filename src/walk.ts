// AST walker - depth-first traversal
import type { CSSNode } from './css-node'
import { STYLE_RULE, AT_RULE, DECLARATION, SELECTOR } from './constants'

// Control flow symbols for walk callbacks
export const SKIP = Symbol('SKIP')
export const BREAK = Symbol('BREAK')

/**
 * Context information provided during AST traversal when include_context is enabled.
 * Tracks closest ancestors by category for efficient context-aware traversal.
 */
export interface WalkContext {
	/** Closest STYLE_RULE ancestor (null if none exists) */
	rule: CSSNode | null
	/** Closest AT_RULE ancestor (null if none exists) */
	atrule: CSSNode | null
	/** Closest DECLARATION ancestor (null if none exists) */
	declaration: CSSNode | null
	/** Closest value node ancestor - types 10-19 (null if none exists) */
	value: CSSNode | null
	/** Closest selector node ancestor - SELECTOR (5) or types 20-31 (null if none exists) */
	selector: CSSNode | null
	/** Immediate parent node - this is always the closest ancestor (null for root) */
	parent: CSSNode | null
	/** Current depth in the tree (0 for root) */
	depth: number
}

/**
 * Options for the walk() function.
 */
export interface WalkOptions {
	/** Starting depth (default: 0) */
	depth?: number
	/**
	 * Enable ancestor context tracking (default: false)
	 * WARNING: Adds ~2-3x CPU overhead and ~19% memory overhead.
	 * Only enable when you need ancestor context information.
	 */
	include_context?: boolean
}

type WalkCallback = (node: CSSNode, depth: number, context?: WalkContext) => void | typeof SKIP | typeof BREAK

/**
 * Internal implementation of walk with context tracking.
 * @internal
 */
function walk_impl(
	node: CSSNode,
	callback: WalkCallback,
	depth: number,
	include_context: boolean,
	parent: CSSNode | null,
	current_rule: CSSNode | null,
	current_atrule: CSSNode | null,
	current_declaration: CSSNode | null,
	current_value: CSSNode | null,
	current_selector: CSSNode | null,
): boolean {
	// Build context if enabled
	let context: WalkContext | undefined
	if (include_context) {
		context = {
			rule: current_rule,
			atrule: current_atrule,
			declaration: current_declaration,
			value: current_value,
			selector: current_selector,
			parent,
			depth,
		}
	}

	// Call callback for current node
	const result = include_context ? callback(node, depth, context) : callback(node, depth, undefined)

	// Check for BREAK - stop immediately
	if (result === BREAK) {
		return false
	}

	// Check for SKIP - don't traverse children
	if (result === SKIP) {
		return true
	}

	// Stop updating context once inside value or selector nodes
	// (children of value/selector nodes keep the same context)
	const inside_value_or_selector = current_value !== null || current_selector !== null

	// Update current pointers based on node type (only if not inside value/selector)
	const next_rule = !inside_value_or_selector && node.type === STYLE_RULE ? node : current_rule
	const next_atrule = !inside_value_or_selector && node.type === AT_RULE ? node : current_atrule
	const next_declaration = !inside_value_or_selector && node.type === DECLARATION ? node : current_declaration
	const next_value = !inside_value_or_selector && node.type >= 10 && node.type <= 19 ? node : current_value
	const next_selector =
		!inside_value_or_selector && (node.type === SELECTOR || (node.type >= 20 && node.type <= 31)) ? node : current_selector

	// Recursively walk children
	let child = node.first_child
	while (child) {
		const should_continue = walk_impl(
			child,
			callback,
			depth + 1,
			include_context,
			node, // parent
			next_rule,
			next_atrule,
			next_declaration,
			next_value,
			next_selector,
		)
		if (!should_continue) {
			return false
		}
		child = child.next_sibling
	}

	return true
}

/**
 * Walk the AST in depth-first order, calling the callback for each node.
 * Set include_context: true for ancestor tracking.
 * Return SKIP to skip children, BREAK to stop traversal.
 *
 * @param node - The root node to start walking from
 * @param callback - Function called for each node. Receives (node, depth, context?).
 * @param options - Walk options
 */
export function walk(node: CSSNode, callback: WalkCallback, options: WalkOptions = {}): boolean {
	return walk_impl(
		node,
		callback,
		options.depth ?? 0,
		options.include_context ?? false,
		null, // parent
		null, // current_rule
		null, // current_atrule
		null, // current_declaration
		null, // current_value
		null, // current_selector,
	)
}

const NOOP = function () {}

type WalkEnterLeaveCallback = (node: CSSNode, context?: WalkContext) => void | typeof SKIP | typeof BREAK

/**
 * Options for the traverse() function.
 */
export interface TraverseOptions {
	/** Callback called before visiting children */
	enter?: WalkEnterLeaveCallback
	/** Callback called after visiting children */
	leave?: WalkEnterLeaveCallback
	/**
	 * Enable ancestor context tracking (default: false)
	 * WARNING: Adds ~2-3x CPU overhead and ~19% memory overhead.
	 * Only enable when you need ancestor context information.
	 */
	include_context?: boolean
}

/**
 * Internal implementation of traverse with context tracking.
 * @internal
 */
function traverse_impl(
	node: CSSNode,
	enter: WalkEnterLeaveCallback,
	leave: WalkEnterLeaveCallback,
	depth: number,
	include_context: boolean,
	parent: CSSNode | null,
	current_rule: CSSNode | null,
	current_atrule: CSSNode | null,
	current_declaration: CSSNode | null,
	current_value: CSSNode | null,
	current_selector: CSSNode | null,
): boolean {
	// Build context if enabled
	let context: WalkContext | undefined
	if (include_context) {
		context = {
			rule: current_rule,
			atrule: current_atrule,
			declaration: current_declaration,
			value: current_value,
			selector: current_selector,
			parent,
			depth,
		}
	}

	// Call enter callback before processing children
	const enter_result = include_context ? enter(node, context) : enter(node, undefined)

	// Check for BREAK in enter - stop immediately
	if (enter_result === BREAK) {
		return false
	}

	// Only traverse children if SKIP was not returned
	if (enter_result !== SKIP) {
		// Stop updating context once inside value or selector nodes
		const inside_value_or_selector = current_value !== null || current_selector !== null

		// Update current pointers based on node type (only if not inside value/selector)
		const next_rule = !inside_value_or_selector && node.type === STYLE_RULE ? node : current_rule
		const next_atrule = !inside_value_or_selector && node.type === AT_RULE ? node : current_atrule
		const next_declaration = !inside_value_or_selector && node.type === DECLARATION ? node : current_declaration
		const next_value = !inside_value_or_selector && node.type >= 10 && node.type <= 19 ? node : current_value
		const next_selector =
			!inside_value_or_selector && (node.type === SELECTOR || (node.type >= 20 && node.type <= 31)) ? node : current_selector

		let child = node.first_child
		while (child) {
			const should_continue = traverse_impl(
				child,
				enter,
				leave,
				depth + 1,
				include_context,
				node,
				next_rule,
				next_atrule,
				next_declaration,
				next_value,
				next_selector,
			)
			if (!should_continue) {
				return false
			}
			child = child.next_sibling
		}
	}

	// Call leave callback after processing children
	// Note: leave() is called even if children were skipped via SKIP
	const leave_result = include_context ? leave(node, context) : leave(node, undefined)

	// Check for BREAK in leave
	if (leave_result === BREAK) {
		return false
	}

	return true
}

/**
 * Walk the AST in depth-first order, calling enter before visiting children and leave after.
 * Context always includes depth and parent. Set include_context: true for ancestor tracking.
 * Return SKIP in enter to skip children (leave still called), BREAK to stop (leave NOT called).
 *
 * @param node - The root node to start walking from
 * @param options - Object with enter/leave callbacks and include_context flag
 */
export function traverse(node: CSSNode, options: TraverseOptions = {}): boolean {
	const { enter = NOOP, leave = NOOP, include_context = false } = options

	return traverse_impl(
		node,
		enter,
		leave,
		0, // depth
		include_context,
		null, // parent
		null, // current_rule
		null, // current_atrule
		null, // current_declaration
		null, // current_value
		null, // current_selector
	)
}
