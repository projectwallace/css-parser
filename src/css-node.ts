// CSSNode - Ergonomic wrapper over arena node indices
import type { CSSDataArena } from './arena'
import {
	STYLESHEET,
	STYLE_RULE,
	AT_RULE,
	DECLARATION,
	SELECTOR,
	COMMENT,
	BLOCK,
	IDENTIFIER,
	NUMBER,
	DIMENSION,
	STRING,
	HASH,
	FUNCTION,
	OPERATOR,
	PARENTHESIS,
	URL,
	UNICODE_RANGE,
	VALUE,
	SELECTOR_LIST,
	TYPE_SELECTOR,
	CLASS_SELECTOR,
	ID_SELECTOR,
	ATTRIBUTE_SELECTOR,
	PSEUDO_CLASS_SELECTOR,
	PSEUDO_ELEMENT_SELECTOR,
	COMBINATOR,
	UNIVERSAL_SELECTOR,
	NESTING_SELECTOR,
	NTH_SELECTOR,
	NTH_OF_SELECTOR,
	LANG_SELECTOR,
	MEDIA_QUERY,
	MEDIA_FEATURE,
	MEDIA_TYPE,
	CONTAINER_QUERY,
	SUPPORTS_QUERY,
	LAYER_NAME,
	PRELUDE_OPERATOR,
	FEATURE_RANGE,
	AT_RULE_PRELUDE,
	FLAG_IMPORTANT,
	FLAG_HAS_ERROR,
	FLAG_HAS_BLOCK,
	FLAG_HAS_DECLARATIONS,
	FLAG_HAS_PARENS,
	FLAG_BROWSERHACK,
} from './arena'

import { CHAR_MINUS_HYPHEN, CHAR_PLUS, is_whitespace, is_vendor_prefixed, str_starts_with } from './string-utils'
import { parse_dimension } from './parse-dimension'

// Type name lookup table - maps numeric type to CSSTree-compatible strings
export const TYPE_NAMES = {
	[STYLESHEET]: 'StyleSheet',
	[STYLE_RULE]: 'Rule',
	[AT_RULE]: 'Atrule',
	[DECLARATION]: 'Declaration',
	[SELECTOR]: 'Selector',
	[COMMENT]: 'Comment',
	[BLOCK]: 'Block',
	[IDENTIFIER]: 'Identifier',
	[NUMBER]: 'Number',
	[DIMENSION]: 'Dimension',
	[STRING]: 'String',
	[HASH]: 'Hash',
	[FUNCTION]: 'Function',
	[OPERATOR]: 'Operator',
	[PARENTHESIS]: 'Parentheses',
	[URL]: 'Url',
	[UNICODE_RANGE]: 'UnicodeRange',
	[VALUE]: 'Value',
	[SELECTOR_LIST]: 'SelectorList',
	[TYPE_SELECTOR]: 'TypeSelector',
	[CLASS_SELECTOR]: 'ClassSelector',
	[ID_SELECTOR]: 'IdSelector',
	[ATTRIBUTE_SELECTOR]: 'AttributeSelector',
	[PSEUDO_CLASS_SELECTOR]: 'PseudoClassSelector',
	[PSEUDO_ELEMENT_SELECTOR]: 'PseudoElementSelector',
	[COMBINATOR]: 'Combinator',
	[UNIVERSAL_SELECTOR]: 'UniversalSelector',
	[NESTING_SELECTOR]: 'NestingSelector',
	[NTH_SELECTOR]: 'Nth',
	[NTH_OF_SELECTOR]: 'NthOf',
	[LANG_SELECTOR]: 'Lang',
	[MEDIA_QUERY]: 'MediaQuery',
	[MEDIA_FEATURE]: 'Feature',
	[MEDIA_TYPE]: 'MediaType',
	[CONTAINER_QUERY]: 'ContainerQuery',
	[SUPPORTS_QUERY]: 'SupportsQuery',
	[LAYER_NAME]: 'Layer',
	[PRELUDE_OPERATOR]: 'Operator',
	[FEATURE_RANGE]: 'MediaFeatureRange',
	[AT_RULE_PRELUDE]: 'AtrulePrelude',
} as const

export type TypeName = (typeof TYPE_NAMES)[keyof typeof TYPE_NAMES] | 'unknown'

// Node type constants (numeric for performance)
export type CSSNodeType =
	| typeof STYLESHEET
	| typeof STYLE_RULE
	| typeof AT_RULE
	| typeof DECLARATION
	| typeof SELECTOR
	| typeof COMMENT
	| typeof BLOCK
	| typeof IDENTIFIER
	| typeof NUMBER
	| typeof DIMENSION
	| typeof STRING
	| typeof HASH
	| typeof FUNCTION
	| typeof OPERATOR
	| typeof PARENTHESIS
	| typeof URL
	| typeof VALUE
	| typeof SELECTOR_LIST
	| typeof TYPE_SELECTOR
	| typeof CLASS_SELECTOR
	| typeof ID_SELECTOR
	| typeof ATTRIBUTE_SELECTOR
	| typeof PSEUDO_CLASS_SELECTOR
	| typeof PSEUDO_ELEMENT_SELECTOR
	| typeof COMBINATOR
	| typeof UNIVERSAL_SELECTOR
	| typeof NESTING_SELECTOR
	| typeof NTH_SELECTOR
	| typeof NTH_OF_SELECTOR
	| typeof LANG_SELECTOR
	| typeof MEDIA_QUERY
	| typeof MEDIA_FEATURE
	| typeof MEDIA_TYPE
	| typeof CONTAINER_QUERY
	| typeof SUPPORTS_QUERY
	| typeof LAYER_NAME
	| typeof PRELUDE_OPERATOR
	| typeof FEATURE_RANGE
	| typeof AT_RULE_PRELUDE

// Options for cloning nodes
export interface CloneOptions {
	/**
	 * Recursively clone all children
	 * @default true
	 */
	deep?: boolean
	/**
	 * Include location information (line, column, start, length)
	 * @default false
	 */
	locations?: boolean
}

// Plain object representation of a CSSNode
export type PlainCSSNode = {
	// Core properties (always present)
	type: number
	type_name: TypeName
	text: string
	children: PlainCSSNode[]

	// Optional properties (only when meaningful)
	name?: string
	property?: string
	value?: string | number | null
	unit?: string
	prelude?: PlainCSSNode | null

	// Flags (only when true)
	is_important?: boolean
	is_vendor_prefixed?: boolean
	is_browserhack?: boolean
	has_error?: boolean

	// Selector-specific
	attr_operator?: number
	attr_flags?: number
	nth_a?: string | null
	nth_b?: string | null

	// Location (only when locations: true)
	line?: number
	column?: number
	start?: number
	length?: number
	end?: number
}

export class CSSNode {
	private arena: CSSDataArena
	private source: string
	private index: number

	constructor(arena: CSSDataArena, source: string, index: number) {
		this.arena = arena
		this.source = source
		this.index = index
	}

	/**
	 * @internal
	 * Get the arena (for internal/advanced use only)
	 */
	__get_arena(): CSSDataArena {
		return this.arena
	}

	private get_content(): string {
		let start = this.arena.get_content_start(this.index)
		let length = this.arena.get_content_length(this.index)
		if (length === 0) return ''
		return this.source.substring(start, start + length)
	}

	/** Get node type as number (for performance) */
	get type(): CSSNodeType {
		return this.arena.get_type(this.index) as CSSNodeType
	}

	/** Get node type as human-readable string */
	get type_name(): TypeName {
		return TYPE_NAMES[this.type] || 'unknown'
	}

	/** Get the full text of this node from source */
	get text(): string {
		let start = this.arena.get_start_offset(this.index)
		let length = this.arena.get_length(this.index)
		return this.source.substring(start, start + length)
	}

	/** Get the "content" text (at-rule name for at-rules, layer name for import layers) */
	get name(): string | undefined {
		if (this.type === DECLARATION) return
		return this.get_content()
	}

	/**
	 * Alias for name (for declarations: "color" in "color: blue")
	 * More semantic than `name` for declaration nodes
	 */
	get property(): string | undefined {
		let { type } = this
		if (type !== DECLARATION && type !== MEDIA_FEATURE) return
		return this.get_content()
	}

	/**
	 * Get the value text (for declarations: "blue" in "color: blue")
	 * For dimension/number nodes: returns the numeric value as a number
	 * For string nodes: returns the string content without quotes
	 * For URL nodes with quoted string: returns the string with quotes (consistent with STRING node)
	 * For URL nodes with unquoted URL: returns the URL content without quotes
	 */
	get value(): CSSNode | string | number | null {
		let { type, text } = this

		// For DECLARATION nodes with parsed values, return the VALUE node
		// For DECLARATION nodes without parsed values, fall through to get raw text
		if (type === DECLARATION && this.first_child) {
			return this.first_child // VALUE node (when parse_values=true)
		}

		if (type === DIMENSION) {
			return parse_dimension(text).value
		}

		if (type === NUMBER) {
			return Number.parseFloat(this.text)
		}

		// Special handling for URL nodes
		if (type === URL) {
			let firstChild = this.first_child
			if (firstChild && firstChild.type === STRING) {
				// Return the string as-is (with quotes) - consistent with STRING node
				return firstChild.text
			}
			// For URL nodes without children (e.g., @import url(...)), extract from text
			// Handle both url("...") and url('...') and just "..." or '...'
			if (str_starts_with(text, 'url(')) {
				// url("...") or url('...') or url(...) - extract content between parens
				let openParen = text.indexOf('(')
				let closeParen = text.lastIndexOf(')')
				if (openParen !== -1 && closeParen !== -1 && closeParen > openParen) {
					let content = text.substring(openParen + 1, closeParen).trim()
					return content
				}
			} else if (text.startsWith('"') || text.startsWith("'")) {
				// Just a quoted string: "..." or '...'
				return text
			}
			// For unquoted URLs, fall through to value delta logic below
		}

		// For other nodes, return as string
		let start = this.arena.get_value_start(this.index)
		let length = this.arena.get_value_length(this.index)
		if (length === 0) return null
		return this.source.substring(start, start + length)
	}

	/** Get the numeric value for NUMBER and DIMENSION nodes, or null for other node types */
	get value_as_number(): number | null {
		let text = this.text
		if (this.type === NUMBER) {
			return Number.parseFloat(text)
		}
		if (this.type === DIMENSION) {
			return parse_dimension(text).value
		}
		return null
	}

	/**
	 * Get the prelude node:
	 * - For at-rules: AT_RULE_PRELUDE wrapper containing structured prelude children (media queries, layer names, etc.)
	 * - For style rules: SELECTOR_LIST or SELECTOR node
	 * Returns null if no prelude exists
	 */
	get prelude(): CSSNode | null | undefined {
		if (this.type === AT_RULE) {
			let first = this.first_child
			if (first && first.type === AT_RULE_PRELUDE) {
				return first
			}
			return null
		}
		if (this.type === STYLE_RULE) {
			// For style rules, prelude is the selector (first child)
			return this.first_child
		}
		return undefined
	}

	/**
	 * Get the attribute operator (for attribute selectors: =, ~=, |=, ^=, $=, *=)
	 * Returns one of the ATTR_OPERATOR_* constants
	 */
	get attr_operator(): number | undefined {
		if (this.type !== ATTRIBUTE_SELECTOR) return undefined
		return this.arena.get_attr_operator(this.index)
	}

	/**
	 * Get the attribute flags (for attribute selectors: i, s)
	 * Returns one of the ATTR_FLAG_* constants
	 */
	get attr_flags(): number | undefined {
		if (this.type !== ATTRIBUTE_SELECTOR) return undefined
		return this.arena.get_attr_flags(this.index)
	}

	/** Get the unit for dimension nodes (e.g., "px" from "100px", "%" from "50%") */
	get unit(): string | undefined {
		if (this.type !== DIMENSION) return undefined
		return parse_dimension(this.text).unit
	}

	/** Check if this declaration has !important */
	get is_important(): boolean | undefined {
		if (this.type !== DECLARATION) return undefined
		return this.arena.has_flag(this.index, FLAG_IMPORTANT)
	}

	/** Check if this declaration has a browser hack prefix */
	get is_browserhack(): boolean | undefined {
		if (this.type !== DECLARATION) return undefined
		return this.arena.has_flag(this.index, FLAG_BROWSERHACK)
	}

	/** Check if this has a vendor prefix (computed on-demand) */
	get is_vendor_prefixed(): boolean {
		switch (this.type) {
			case DECLARATION:
				// Check property name (e.g., -webkit-transform)
				return is_vendor_prefixed(this.get_content())
			case PSEUDO_CLASS_SELECTOR:
			case PSEUDO_ELEMENT_SELECTOR:
				// Check pseudo-class/element name without colons (e.g., -webkit-autofill, -webkit-scrollbar)
				return is_vendor_prefixed(this.get_content())
			case AT_RULE:
				// Check at-rule name (e.g., -webkit-keyframes from @-webkit-keyframes)
				return is_vendor_prefixed(this.get_content())
			case FUNCTION:
				// Check function name (e.g., -webkit-gradient from -webkit-gradient())
				return is_vendor_prefixed(this.get_content())
			case IDENTIFIER:
				// Check identifier value (e.g., -webkit-sticky)
				return is_vendor_prefixed(this.text)
			default:
				return false
		}
	}

	/** Check if this node has an error */
	get has_error(): boolean {
		return this.arena.has_flag(this.index, FLAG_HAS_ERROR)
	}

	/** Check if this node has a prelude (at-rules and style rules) */
	get has_prelude(): boolean {
		if (this.type === AT_RULE) {
			return this.arena.get_value_length(this.index) > 0
		}
		if (this.type === STYLE_RULE) {
			return this.first_child !== null
		}
		return false
	}

	/** Check if this rule has a block { } */
	get has_block(): boolean {
		return this.arena.has_flag(this.index, FLAG_HAS_BLOCK)
	}

	/** Check if this style rule has declarations */
	get has_declarations(): boolean {
		return this.arena.has_flag(this.index, FLAG_HAS_DECLARATIONS)
	}

	/** Get the block node (for style rules and at-rules with blocks) */
	get block(): CSSNode | null {
		// For StyleRule: block is sibling after selector list
		if (this.type === STYLE_RULE) {
			let first = this.first_child
			if (!first) return null
			// Block is the sibling after selector list
			let blockNode = first.next_sibling
			if (blockNode && blockNode.type === BLOCK) {
				return blockNode
			}
			return null
		}

		// For AtRule: block is last child (after prelude nodes)
		if (this.type === AT_RULE) {
			// Find last child that is a block
			let child = this.first_child
			while (child) {
				if (child.type === BLOCK && !child.next_sibling) {
					return child
				}
				child = child.next_sibling
			}
			return null
		}

		return null
	}

	/** Check if this block is empty (no declarations or rules, only comments allowed) */
	get is_empty(): boolean | undefined {
		// Only valid on block nodes
		if (this.type !== BLOCK) return undefined

		// Empty if no children, or all children are comments
		let child = this.first_child
		while (child) {
			if (child.type !== COMMENT) {
				return false
			}
			child = child.next_sibling
		}
		return true
	}

	/** Get start line number */
	get line(): number {
		return this.arena.get_start_line(this.index)
	}

	/** Get start column number */
	get column(): number {
		return this.arena.get_start_column(this.index)
	}

	/** Get start offset in source */
	get start(): number {
		return this.arena.get_start_offset(this.index)
	}

	/** Get length in source */
	get length(): number {
		return this.arena.get_length(this.index)
	}

	/**
	 * Get end offset in source
	 * End is not stored, must be calculated
	 */
	get end(): number {
		return this.start + this.length
	}

	// --- Tree Traversal ---

	/** Get first child node */
	get first_child(): CSSNode | null {
		let child_index = this.arena.get_first_child(this.index)
		if (child_index === 0) return null
		return new CSSNode(this.arena, this.source, child_index)
	}

	/** Get next sibling node */
	get next_sibling(): CSSNode | null {
		let sibling_index = this.arena.get_next_sibling(this.index)
		if (sibling_index === 0) return null
		return new CSSNode(this.arena, this.source, sibling_index)
	}

	/** Check if this node has a next sibling */
	get has_next(): boolean {
		let sibling_index = this.arena.get_next_sibling(this.index)
		return sibling_index !== 0
	}

	/**
	 * Check if this node has children
	 * For pseudo-class/pseudo-element functions, returns true if FLAG_HAS_PARENS is set
	 * This allows formatters to distinguish :lang() from :hover
	 */
	get has_children(): boolean {
		// For pseudo-class/pseudo-element nodes, check if they have function syntax
		if (this.type === PSEUDO_CLASS_SELECTOR || this.type === PSEUDO_ELEMENT_SELECTOR) {
			// If FLAG_HAS_PARENS is set, return true even if no actual children
			// This indicates that `()` is there but contains no children which can be caught by checking `.children.length`
			if (this.arena.has_flag(this.index, FLAG_HAS_PARENS)) {
				return true
			}
		}
		return this.arena.has_children(this.index)
	}

	/** Get all children as an array */
	get children(): CSSNode[] {
		let result: CSSNode[] = []
		let child = this.first_child
		while (child) {
			result.push(child)
			child = child.next_sibling
		}
		return result
	}

	/** Make CSSNode iterable over its children */
	*[Symbol.iterator](): Iterator<CSSNode> {
		let child = this.first_child
		while (child) {
			yield child
			child = child.next_sibling
		}
	}

	// --- An+B Expression Helpers (for NODE_SELECTOR_NTH) ---

	/** Get the 'a' coefficient from An+B expression (e.g., "2n" from "2n+1", "odd" from "odd") */
	get nth_a(): string | undefined {
		if (this.type !== NTH_SELECTOR && this.type !== NTH_OF_SELECTOR) return undefined

		let len = this.arena.get_content_length(this.index)
		if (len === 0) return undefined
		let start = this.arena.get_content_start(this.index)
		return this.source.substring(start, start + len)
	}

	/** Get the 'b' coefficient from An+B expression (e.g., "+1" from "2n+1") */
	get nth_b(): string | undefined {
		if (this.type !== NTH_SELECTOR && this.type !== NTH_OF_SELECTOR) return undefined

		let len = this.arena.get_value_length(this.index)
		if (len === 0) return undefined
		let start = this.arena.get_value_start(this.index)
		let value = this.source.substring(start, start + len)

		// Check if there's a - or + sign before this position (handling "2n - 1" or "2n + 1" with spaces)
		// Look backwards for a - or + sign, skipping whitespace
		let check_pos = start - 1
		while (check_pos >= 0) {
			let ch = this.source.charCodeAt(check_pos)
			if (is_whitespace(ch)) {
				check_pos--
				continue
			}
			// Found non-whitespace
			if (ch === CHAR_MINUS_HYPHEN) {
				value = '-' + value
			} else if (ch === CHAR_PLUS) {
				value = '+' + value
			}
			break
		}

		return value
	}

	// --- Pseudo-Class Nth-Of Helpers (for NODE_SELECTOR_NTH_OF) ---

	/** Get the An+B formula node from :nth-child(2n+1 of .foo) */
	get nth(): CSSNode | undefined {
		if (this.type !== NTH_OF_SELECTOR) return undefined
		return this.first_child ?? undefined // First child is always NODE_SELECTOR_NTH
	}

	/** Get the selector list from :nth-child(2n+1 of .foo) */
	get selector(): CSSNode | undefined {
		if (this.type !== NTH_OF_SELECTOR) return undefined
		let first = this.first_child
		return first?.next_sibling ?? undefined // Second child is NODE_SELECTOR_LIST
	}

	// --- Pseudo-Class Selector List Helper ---

	/**
	 * Get selector list from pseudo-class functions
	 * Works for :is(.a), :not(.b), :has(.c), :where(.d), :nth-child(2n of .e)
	 */
	get selector_list(): CSSNode | undefined {
		if (this.type !== PSEUDO_CLASS_SELECTOR) return undefined

		let child = this.first_child
		if (!child) return undefined

		// For simple cases (:is, :not, :where, :has), first_child is the selector list
		if (child.type === SELECTOR_LIST) {
			return child
		}

		// For :nth-child(of) cases, need to look inside NODE_SELECTOR_NTH_OF
		if (child.type === NTH_OF_SELECTOR) {
			// Use the convenience getter we just added
			return child.selector
		}

		return undefined
	}

	// --- Node Cloning ---

	/**
	 * Clone this node as a mutable plain JavaScript object with children as arrays.
	 * See API.md for examples.
	 *
	 * @param options - Cloning configuration
	 * @param options.deep - Recursively clone children (default: true)
	 * @param options.locations - Include line/column/start/length (default: false)
	 */
	clone(options: CloneOptions = {}): PlainCSSNode {
		const { deep = true, locations = false } = options

		// 1. Create plain object with base properties
		let plain: any = {
			type: this.type,
			type_name: this.type_name,
			text: this.text,
			children: [],
		}

		// 2. Extract type-specific properties (only if meaningful)
		if (this.name) plain.name = this.name
		if (this.property) plain.property = this.property

		// 3. Handle value types
		if (this.value !== undefined && this.value !== null) {
			plain.value = this.value
			if (this.unit) plain.unit = this.unit
		}

		// 4. At-rule preludes are now child nodes (AT_RULE_PRELUDE wrapper)
		// They will be cloned as part of children in deep clones
		// No special extraction needed - breaking change from string to CSSNode

		// 5. Extract flags
		if (this.type === DECLARATION) {
			plain.is_important = this.is_important
			plain.is_browserhack = this.is_browserhack
		}
		plain.is_vendor_prefixed = this.is_vendor_prefixed
		plain.has_error = this.has_error

		// 6. Extract selector-specific properties
		if (this.type === ATTRIBUTE_SELECTOR) {
			plain.attr_operator = this.attr_operator
			plain.attr_flags = this.attr_flags
		}
		if (this.type === NTH_SELECTOR || this.type === NTH_OF_SELECTOR) {
			plain.nth_a = this.nth_a
			plain.nth_b = this.nth_b
		}

		// 7. Include location if requested
		if (locations) {
			plain.line = this.line
			plain.column = this.column
			plain.start = this.start
			plain.length = this.length
			plain.end = this.end
		}

		// 8. Deep clone children - just push to array!
		if (deep) {
			for (let child of this.children) {
				plain.children.push(child.clone({ deep: true, locations }))
			}
		}

		return plain
	}
}
