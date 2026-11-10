// AST walker - depth-first traversal
import type { AnyNode, CSSNode, Declaration, Selector } from './node-types'
import { CSSNode as CSSNodeImpl } from './css-node'
import type { CSSDataArena } from './arena'
import {
	STYLESHEET,
	STYLE_RULE,
	AT_RULE,
	AT_RULE_PRELUDE,
	BLOCK,
	DECLARATION,
	SELECTOR,
	VALUE,
} from './constants'
import { str_equals, strip_vendor_prefix } from './string-utils'

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

type WalkVisitor<T> = (node: T) => void | typeof SKIP | typeof BREAK

/**
 * Visit every declaration in a stylesheet, rule, at-rule or block (including nested rules and
 * at-rules), in source order. Only rule/at-rule/block structure is traversed: selectors,
 * preludes and values are never entered, and no wrapper is created for other nodes.
 * Return BREAK to stop. SKIP has no effect, since declarations are not walked into.
 */
export function walk_declarations(root: CSSNode, callback: WalkVisitor<Declaration>): boolean {
	const impl = root as unknown as CSSNodeImpl
	return _walk_declarations(impl.__get_arena(), impl.__get_source(), impl.__get_index(), callback)
}

function _walk_declarations(
	arena: CSSDataArena,
	source: string,
	index: number,
	callback: WalkVisitor<Declaration>,
): boolean {
	const type = arena.get_type(index)
	if (type === DECLARATION) {
		return callback(new CSSNodeImpl(arena, source, index) as unknown as Declaration) !== BREAK
	}
	if (type !== STYLESHEET && type !== STYLE_RULE && type !== AT_RULE && type !== BLOCK) return true

	let child = arena.get_first_child(index)
	while (child !== 0) {
		if (!_walk_declarations(arena, source, child, callback)) return false
		child = arena.get_next_sibling(child)
	}
	return true
}

interface WalkSelectorsOptions {
	/**
	 * Also visit selectors nested inside other selectors, e.g. `b` in `a:is(b)` or `:not(b)`.
	 * Default `false`: only selectors of style rules and at-rule preludes (`@scope`, `selector()`).
	 */
	recursive?: boolean
	/** Skip selectors in at-rule preludes, e.g. `@scope (.a) to (.b)` and `@supports selector(a)`. Default `false`. */
	skip_atrule_preludes?: boolean
	/** Skip the selectors of keyframes (`from`, `50%`) in `@keyframes` and `@-vendor-keyframes`. Default `false`. */
	skip_keyframes?: boolean
}

/**
 * Visit every complex selector (`Selector` node) in source order, e.g. `a` and `b > c` in `a, b > c {}`.
 * Declarations and their values are never entered. With `{ recursive: true }` selectors nested in
 * pseudo-classes are visited as well, after the selector that contains them.
 * Return SKIP to skip the selectors nested in this one (only relevant when recursive), BREAK to stop.
 */
export function walk_selectors(
	root: CSSNode,
	callback: WalkVisitor<Selector>,
	options: WalkSelectorsOptions = {},
): boolean {
	const impl = root as unknown as CSSNodeImpl
	return _walk_selectors(
		impl.__get_arena(),
		impl.__get_source(),
		impl.__get_index(),
		callback,
		options,
	)
}

function _walk_selectors(
	arena: CSSDataArena,
	source: string,
	index: number,
	callback: WalkVisitor<Selector>,
	options: WalkSelectorsOptions,
): boolean {
	const type = arena.get_type(index)
	if (type === DECLARATION) return true
	if (type === AT_RULE_PRELUDE && options.skip_atrule_preludes) return true
	if (type === SELECTOR) {
		const result = callback(new CSSNodeImpl(arena, source, index) as unknown as Selector)
		if (result === BREAK) return false
		if (result === SKIP || !options.recursive) return true
	}

	// Keyframes: only the prelude (name) is walked, never the block of frame selectors
	const skip_block =
		type === AT_RULE && options.skip_keyframes === true && is_keyframes(arena, source, index)

	let child = arena.get_first_child(index)
	while (child !== 0) {
		if (!(skip_block && arena.get_type(child) === BLOCK)) {
			if (!_walk_selectors(arena, source, child, callback, options)) return false
		}
		child = arena.get_next_sibling(child)
	}
	return true
}

function is_keyframes(arena: CSSDataArena, source: string, index: number): boolean {
	const start = arena.get_content_start(index)
	const name = source.substring(start, start + arena.get_content_length(index))
	return str_equals('keyframes', strip_vendor_prefix(name))
}

/**
 * Visit every node inside a declaration's value (or a `Value` node), depth-first. The `Value`
 * wrapper itself is not visited. Return SKIP to skip a node's children (e.g. function arguments),
 * BREAK to stop. Visits nothing when the value is unparsed (`parse_values: false`).
 */
export function walk_values(root: CSSNode, callback: WalkCallbackNoDepth): boolean {
	const impl = root as unknown as CSSNodeImpl
	const arena = impl.__get_arena()
	const source = impl.__get_source()
	let value = impl.__get_index()
	if (arena.get_type(value) === DECLARATION) {
		value = arena.get_first_child(value)
	}
	if (value === 0 || arena.get_type(value) !== VALUE) return true

	let child = arena.get_first_child(value)
	while (child !== 0) {
		if (!_walk_value_node(arena, source, child, callback)) return false
		child = arena.get_next_sibling(child)
	}
	return true
}

type WalkCallbackNoDepth = WalkVisitor<AnyNode>

function _walk_value_node(
	arena: CSSDataArena,
	source: string,
	index: number,
	callback: WalkCallbackNoDepth,
): boolean {
	const result = callback(new CSSNodeImpl(arena, source, index) as unknown as AnyNode)
	if (result === BREAK) return false
	if (result === SKIP) return true

	let child = arena.get_first_child(index)
	while (child !== 0) {
		if (!_walk_value_node(arena, source, child, callback)) return false
		child = arena.get_next_sibling(child)
	}
	return true
}
