// CSSNode - Ergonomic wrapper over arena node indices
import type { CSSDataArena } from './arena'
import {
	RAW,
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
	PRELUDE_SELECTORLIST,
	SUPPORTS_DECLARATION,
	RATIO,
	IF_BRANCH,
	IF_CONDITION,
	FLAG_IMPORTANT,
	FLAG_HAS_ERROR,
	FLAG_HAS_BLOCK,
	FLAG_HAS_DECLARATIONS,
	FLAG_HAS_PARENS,
	FLAG_BROWSERHACK,
	FLAG_HAS_NAMESPACE,
} from './arena'

import {
	CHAR_MINUS_HYPHEN,
	CHAR_PLUS,
	CHAR_EQUALS,
	CHAR_TILDE,
	CHAR_PIPE,
	CHAR_CARET,
	CHAR_DOLLAR,
	CHAR_ASTERISK,
	is_whitespace,
	is_vendor_prefixed,
	str_starts_with,
	str_equals,
} from './string-utils'
import { dimension_number_end } from './parse-dimension'

// CSSTree-compatible node type names
export type TypeName =
	| 'StyleSheet'
	| 'Rule'
	| 'Atrule'
	| 'Declaration'
	| 'Selector'
	| 'Comment'
	| 'Block'
	| 'Raw'
	| 'Identifier'
	| 'Number'
	| 'Dimension'
	| 'String'
	| 'Hash'
	| 'Function'
	| 'Operator'
	| 'Parentheses'
	| 'Url'
	| 'UnicodeRange'
	| 'Value'
	| 'SelectorList'
	| 'TypeSelector'
	| 'ClassSelector'
	| 'IdSelector'
	| 'AttributeSelector'
	| 'PseudoClassSelector'
	| 'PseudoElementSelector'
	| 'Combinator'
	| 'UniversalSelector'
	| 'NestingSelector'
	| 'Nth'
	| 'NthOf'
	| 'Lang'
	| 'MediaQuery'
	| 'Feature'
	| 'MediaType'
	| 'ContainerQuery'
	| 'SupportsQuery'
	| 'SupportsDeclaration'
	| 'Layer'
	| 'MediaFeatureRange'
	| 'AtrulePrelude'
	| 'PreludeSelectorList'
	| 'Ratio'
	| 'IfBranch'
	| 'IfCondition'
	| 'unknown'

// Node type constants (numeric for performance)
export type CSSNodeType =
	| typeof STYLESHEET
	| typeof STYLE_RULE
	| typeof AT_RULE
	| typeof DECLARATION
	| typeof SELECTOR
	| typeof COMMENT
	| typeof BLOCK
	| typeof RAW
	| typeof IDENTIFIER
	| typeof NUMBER
	| typeof DIMENSION
	| typeof STRING
	| typeof HASH
	| typeof FUNCTION
	| typeof OPERATOR
	| typeof PARENTHESIS
	| typeof URL
	| typeof UNICODE_RANGE
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
	| typeof PRELUDE_SELECTORLIST
	| typeof SUPPORTS_DECLARATION
	| typeof RATIO
	| typeof IF_BRANCH
	| typeof IF_CONDITION

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

	// Optional properties (only when meaningful)
	children?: PlainCSSNode[]
	child_count?: number
	has_children?: boolean
	name?: string
	property?: string
	value?: PlainCSSNode | string | number | null
	unit?: string
	prelude?: PlainCSSNode | null
	left?: PlainCSSNode
	right?: PlainCSSNode

	// IfBranch-specific
	condition?: PlainCSSNode
	is_else?: boolean

	// Flags (only when true)
	is_important?: boolean
	is_vendor_prefixed?: boolean
	is_browserhack?: boolean
	has_error?: boolean

	// Selector-specific
	attr_operator?: string | null
	attr_flags?: string | null
	nth_a?: string | null
	nth_b?: string | null

	// Location (only when locations: true)
	line?: number
	column?: number
	start?: number
	length?: number
	end?: number
}

const nodes_with_name = new Set<number>([
	AT_RULE,
	IDENTIFIER,
	FUNCTION,
	TYPE_SELECTOR,
	CLASS_SELECTOR,
	ID_SELECTOR,
	ATTRIBUTE_SELECTOR,
	PSEUDO_CLASS_SELECTOR,
	PSEUDO_ELEMENT_SELECTOR,
	COMBINATOR,
	UNIVERSAL_SELECTOR,
	LANG_SELECTOR,
	LAYER_NAME,
	FEATURE_RANGE,
])

const nodes_with_children = new Set<number>([
	STYLESHEET,
	SELECTOR,
	SELECTOR_LIST,
	BLOCK,
	FUNCTION,
	PARENTHESIS,
	VALUE,
	PSEUDO_CLASS_SELECTOR,
	PSEUDO_ELEMENT_SELECTOR,
	AT_RULE_PRELUDE,
	MEDIA_QUERY,
	MEDIA_FEATURE,
	CONTAINER_QUERY,
	FEATURE_RANGE,
	SUPPORTS_QUERY,
	SUPPORTS_DECLARATION,
	IF_BRANCH,
	IF_CONDITION,
])

const enumerable_properties = [
	'name',
	'namespace',
	'property',
	'value',
	'unit',
	'attr_operator',
	'attr_flags',
	'nth_a',
	'nth_b',
	'selector',
	'condition',
	'is_else',
	'is_browserhack',
	'is_vendor_prefixed',
	'has_error',
	'is_important',
	'left',
	'right',
] as const

export class CSSNode {
	private arena: CSSDataArena
	private source: string
	private index: number

	constructor(arena: CSSDataArena, source: string, index: number) {
		this.arena = arena
		this.source = source
		this.index = index
	}

	// Get the arena (for internal/advanced use only)
	__get_arena(): CSSDataArena {
		return this.arena
	}

	__get_source(): string {
		return this.source
	}

	__get_index(): number {
		return this.index
	}

	private get_content(): string {
		const start = this.arena.get_content_start(this.index)
		const length = this.arena.get_content_length(this.index)
		if (length === 0) return ''
		return this.source.substring(start, start + length)
	}

	/** Get node type as number (for performance) */
	get type(): CSSNodeType {
		return this.arena.get_type(this.index) as CSSNodeType
	}

	/** Get node type as human-readable string */
	get type_name(): TypeName {
		// A switch compiles to a jump table, which is faster than an object lookup
		switch (this.type) {
			case STYLESHEET:
				return 'StyleSheet'
			case STYLE_RULE:
				return 'Rule'
			case AT_RULE:
				return 'Atrule'
			case DECLARATION:
				return 'Declaration'
			case SELECTOR:
				return 'Selector'
			case COMMENT:
				return 'Comment'
			case BLOCK:
				return 'Block'
			case RAW:
				return 'Raw'
			case IDENTIFIER:
				return 'Identifier'
			case NUMBER:
				return 'Number'
			case DIMENSION:
				return 'Dimension'
			case STRING:
				return 'String'
			case HASH:
				return 'Hash'
			case FUNCTION:
				return 'Function'
			case OPERATOR:
				return 'Operator'
			case PARENTHESIS:
				return 'Parentheses'
			case URL:
				return 'Url'
			case UNICODE_RANGE:
				return 'UnicodeRange'
			case VALUE:
				return 'Value'
			case SELECTOR_LIST:
				return 'SelectorList'
			case TYPE_SELECTOR:
				return 'TypeSelector'
			case CLASS_SELECTOR:
				return 'ClassSelector'
			case ID_SELECTOR:
				return 'IdSelector'
			case ATTRIBUTE_SELECTOR:
				return 'AttributeSelector'
			case PSEUDO_CLASS_SELECTOR:
				return 'PseudoClassSelector'
			case PSEUDO_ELEMENT_SELECTOR:
				return 'PseudoElementSelector'
			case COMBINATOR:
				return 'Combinator'
			case UNIVERSAL_SELECTOR:
				return 'UniversalSelector'
			case NESTING_SELECTOR:
				return 'NestingSelector'
			case NTH_SELECTOR:
				return 'Nth'
			case NTH_OF_SELECTOR:
				return 'NthOf'
			case LANG_SELECTOR:
				return 'Lang'
			case MEDIA_QUERY:
				return 'MediaQuery'
			case MEDIA_FEATURE:
				return 'Feature'
			case MEDIA_TYPE:
				return 'MediaType'
			case CONTAINER_QUERY:
				return 'ContainerQuery'
			case SUPPORTS_QUERY:
				return 'SupportsQuery'
			case SUPPORTS_DECLARATION:
				return 'SupportsDeclaration'
			case LAYER_NAME:
				return 'Layer'
			case PRELUDE_OPERATOR:
				return 'Operator'
			case FEATURE_RANGE:
				return 'MediaFeatureRange'
			case AT_RULE_PRELUDE:
				return 'AtrulePrelude'
			case PRELUDE_SELECTORLIST:
				return 'PreludeSelectorList'
			case RATIO:
				return 'Ratio'
			case IF_BRANCH:
				return 'IfBranch'
			case IF_CONDITION:
				return 'IfCondition'
			default:
				return 'unknown'
		}
	}

	/** Get the full text of this node from source */
	get text(): string {
		const start = this.arena.get_start_offset(this.index)
		const length = this.arena.get_length(this.index)
		return this.source.substring(start, start + length)
	}

	/** Get the "content" text (at-rule name for at-rules, layer name for import layers) */
	get name(): string | null | undefined {
		if (!nodes_with_name.has(this.type)) return
		const { type } = this
		if (type === UNIVERSAL_SELECTOR) return null
		const content = this.get_content()
		if (type === LANG_SELECTOR && content === '') return null
		return content
	}

	/** Namespace prefix for type/universal selectors: null (none), '' (`|div`), 'ns' (`ns|div`), or '*' (`*|div`). */
	get namespace(): string | null | undefined {
		const { type } = this
		if (type !== TYPE_SELECTOR && type !== UNIVERSAL_SELECTOR) return undefined
		if (!this.arena.has_flag(this.index, FLAG_HAS_NAMESPACE)) return null
		const start = this.arena.get_value_start(this.index)
		const length = this.arena.get_value_length(this.index)
		return this.source.substring(start, start + length)
	}

	/** Alias for `name` on declarations ("color" in "color: blue"), more semantic than `name` there. */
	get property(): string | undefined {
		const { type } = this
		if (type !== DECLARATION && type !== MEDIA_FEATURE && type !== SUPPORTS_DECLARATION) return
		return this.get_content()
	}

	/**
	 * Declarations: the value text ("1px solid blue"). Dimension/number: the numeric value.
	 * String: content without quotes. URL: quoted string keeps quotes, unquoted URL doesn't.
	 */
	get value(): CSSNode | string | number | null | undefined {
		const { type, text, first_child } = this

		if (type === AT_RULE) return undefined

		if (type === MEDIA_TYPE) return text

		// For DECLARATION nodes with parsed values, return the VALUE node
		// For DECLARATION nodes without parsed values, fall through to get raw text
		if (type === DECLARATION && first_child) {
			return first_child // VALUE node (when parse_values=true)
		}

		if (type === MEDIA_FEATURE) {
			return first_child ?? null
		}

		// SupportsDeclaration wraps a Declaration; go one hop deeper than MEDIA_FEATURE to reach VALUE
		if (type === SUPPORTS_DECLARATION) {
			return first_child?.first_child ?? null
		}

		if (type === IF_BRANCH) {
			// First child is the condition node; second child (if any) is the VALUE wrapper
			return first_child?.next_sibling ?? null
		}

		if (type === DIMENSION) {
			// Slice only the numeric part — avoids parse_dimension's extra unit substring + object
			const num_str = text.substring(0, dimension_number_end(text))
			// oxlint-disable-next-line prefer-number-coercion
			return num_str ? Number.parseFloat(num_str) : 0
		}

		if (type === NUMBER) {
			return Number(text)
		}

		// Special handling for URL nodes
		if (type === URL) {
			if (first_child?.type === STRING) {
				// Return the string as-is (with quotes) - consistent with STRING node
				return first_child.text
			}
			// For URL nodes without children (e.g., @import url(...)), extract from text
			// Handle both url("...") and url('...') and just "..." or '...'
			if (str_starts_with('url(', text)) {
				// url("...") or url('...') or url(...) - extract content between parens
				const open_paren = text.indexOf('(')
				const close_paren = text.lastIndexOf(')')
				if (open_paren !== -1 && close_paren !== -1 && close_paren > open_paren) {
					const content = text.substring(open_paren + 1, close_paren).trim()
					return content
				}
			} else if (text.startsWith('"') || text.startsWith("'")) {
				// Just a quoted string: "..." or '...'
				return text
			}
			// For unquoted URLs, fall through to value delta logic below
		}

		if (type === OPERATOR || type === LAYER_NAME) {
			return this.get_content()
		}

		// Only these types store a value in the arena value_start/value_length field.
		// Every other node type has no value concept and must return undefined.
		if (
			type !== DECLARATION &&
			type !== FUNCTION &&
			type !== ATTRIBUTE_SELECTOR &&
			type !== SUPPORTS_QUERY &&
			type !== PRELUDE_SELECTORLIST
		) {
			return undefined
		}

		const start = this.arena.get_value_start(this.index)
		const length = this.arena.get_value_length(this.index)
		if (length === 0) return null
		return this.source.substring(start, start + length)
	}

	/** At-rules: AT_RULE_PRELUDE wrapper (media queries, layer names, …). Style rules: SELECTOR_LIST/SELECTOR. Null if none. */
	get prelude(): CSSNode | null | undefined {
		if (this.type === AT_RULE) {
			const first = this.first_child
			if (first?.type === AT_RULE_PRELUDE || first?.type === RAW) {
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

	/** Attribute selector operator (=, ~=, |=, ^=, $=, *=), or null for the bare `[attr]` form. */
	get attr_operator(): string | null | undefined {
		if (this.type !== ATTRIBUTE_SELECTOR) return undefined

		const content_start = this.arena.get_content_start(this.index)
		const content_end = content_start + this.arena.get_content_length(this.index)
		const node_start = this.arena.get_start_offset(this.index)
		const node_end = node_start + this.arena.get_length(this.index)

		// Skip whitespace after attribute name
		let pos = content_end
		while (pos < node_end && is_whitespace(this.source.charCodeAt(pos))) pos++

		if (pos >= node_end) return null

		const ch1 = this.source.charCodeAt(pos)
		const ch2 = pos + 1 < node_end ? this.source.charCodeAt(pos + 1) : 0

		if (ch1 === CHAR_EQUALS) return this.source.at(pos)!
		if (ch1 === CHAR_TILDE && ch2 === CHAR_EQUALS) return this.source.substring(pos, pos + 2)
		if (ch1 === CHAR_PIPE && ch2 === CHAR_EQUALS) return this.source.substring(pos, pos + 2)
		if (ch1 === CHAR_CARET && ch2 === CHAR_EQUALS) return this.source.substring(pos, pos + 2)
		if (ch1 === CHAR_DOLLAR && ch2 === CHAR_EQUALS) return this.source.substring(pos, pos + 2)
		if (ch1 === CHAR_ASTERISK && ch2 === CHAR_EQUALS) return this.source.substring(pos, pos + 2)
		return null
	}

	/** Attribute selector flag: "i" (case-insensitive), "s" (case-sensitive), or null if absent. */
	get attr_flags(): string | null | undefined {
		if (this.type !== ATTRIBUTE_SELECTOR) return undefined

		const value_len = this.arena.get_value_length(this.index)
		if (value_len === 0) return null

		const value_start = this.arena.get_value_start(this.index)
		const value_end = value_start + value_len
		const node_start = this.arena.get_start_offset(this.index)
		const node_end = node_start + this.arena.get_length(this.index)

		// Skip whitespace after value
		let pos = value_end
		while (pos < node_end && is_whitespace(this.source.charCodeAt(pos))) pos++

		if (pos >= node_end) return null
		const flag_ch = this.source.charCodeAt(pos)
		if (flag_ch === 0x69 || flag_ch === 0x49 || flag_ch === 0x73 || flag_ch === 0x53) {
			return this.source.at(pos)!
		}
		return null
	}

	/** Get the unit for dimension nodes (e.g., "px" from "100px", "%" from "50%") */
	get unit(): string | undefined {
		if (this.type !== DIMENSION) return undefined
		const text = this.text
		return text.substring(dimension_number_end(text))
	}

	/** Numerator for ratio values, e.g. the Number "16" in `aspect-ratio: 16/9` */
	get left(): CSSNode | undefined {
		if (this.type !== RATIO) return undefined
		return this.first_child ?? undefined
	}

	/** Denominator for ratio values, e.g. the Number "9" in `aspect-ratio: 16/9` */
	get right(): CSSNode | undefined {
		if (this.type !== RATIO) return undefined
		return this.first_child?.next_sibling ?? undefined
	}

	/** Get the parsed condition node of an if() branch, e.g. the Function "style(--active: 1)" or the Identifier "else" */
	get condition(): CSSNode | undefined {
		if (this.type !== IF_BRANCH) {
			return undefined
		}
		return this.first_child ?? undefined
	}

	/** True when this is the else branch of an if() function */
	get is_else(): boolean | undefined {
		if (this.type !== IF_BRANCH) return undefined
		return str_equals('else', this.get_content())
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
			case MEDIA_FEATURE:
				// Check property name (e.g., -ms-high-contrast)
				return is_vendor_prefixed(this.get_content())
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
		const { type } = this
		if (type === AT_RULE) {
			return this.first_child !== null && this.first_child.type !== BLOCK
		}
		if (type === STYLE_RULE) {
			return this.first_child !== null
		}
		return false
	}

	/** Check if this rule has a block { } */
	get has_block(): boolean {
		return this.arena.has_flag(this.index, FLAG_HAS_BLOCK)
	}

	/** Check if this style rule has declarations */
	get has_declarations(): boolean | undefined {
		const { type } = this
		if (type !== AT_RULE && type !== STYLE_RULE) return undefined
		return this.arena.has_flag(this.index, FLAG_HAS_DECLARATIONS)
	}

	/** Get the block node (for style rules and at-rules with blocks) */
	get block(): CSSNode | null {
		const { type } = this
		// For StyleRule: block is sibling after selector list
		if (type === STYLE_RULE) {
			const first = this.first_child
			if (!first) return null
			// Block is the sibling after selector list
			const block_node = first.next_sibling
			if (block_node?.type === BLOCK) {
				return block_node
			}
			return null
		}

		// For AtRule: block is last child (after prelude nodes)
		if (type === AT_RULE) {
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
		const child_index = this.arena.get_first_child(this.index)
		if (child_index === 0) return null
		return new CSSNode(this.arena, this.source, child_index)
	}

	/** Get next sibling node */
	get next_sibling(): CSSNode | null {
		const sibling_index = this.arena.get_next_sibling(this.index)
		if (sibling_index === 0) return null
		return new CSSNode(this.arena, this.source, sibling_index)
	}

	/** Check if this node has a next sibling */
	get has_next(): boolean {
		const sibling_index = this.arena.get_next_sibling(this.index)
		return sibling_index !== 0
	}

	/** Whether this node has children. For pseudo-class/element functions, tracks FLAG_HAS_PARENS so formatters can tell `:lang()` from `:hover`. */
	get has_children(): boolean {
		const { type } = this
		// For pseudo-class/pseudo-element nodes, check if they have function syntax
		if (type === PSEUDO_CLASS_SELECTOR || type === PSEUDO_ELEMENT_SELECTOR) {
			// If FLAG_HAS_PARENS is set, return true even if no actual children
			// This indicates that `()` is there but contains no children which can be caught by checking `.children.length`
			if (this.arena.has_flag(this.index, FLAG_HAS_PARENS)) {
				return true
			}
		}
		return this.arena.has_children(this.index)
	}

	/** Count children without allocating an intermediate array */
	get child_count(): number {
		let count = 0
		let child_index = this.arena.get_first_child(this.index)
		while (child_index !== 0) {
			count++
			child_index = this.arena.get_next_sibling(child_index)
		}
		return count
	}

	/** Get all children as an array */
	get children(): CSSNode[] | undefined {
		const result: CSSNode[] = []
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
	get nth_a(): string | null | undefined {
		const { type, arena, index } = this
		if (type !== NTH_SELECTOR && type !== NTH_OF_SELECTOR) return undefined

		const len = arena.get_content_length(index)
		if (len === 0) return null
		const start = arena.get_content_start(index)
		return this.source.substring(start, start + len)
	}

	/** Get the 'b' coefficient from An+B expression (e.g., "+1" from "2n+1") */
	get nth_b(): string | null | undefined {
		const { type, arena, index, source } = this
		if (type !== NTH_SELECTOR && type !== NTH_OF_SELECTOR) return undefined

		const len = arena.get_value_length(index)
		if (len === 0) return null
		const start = arena.get_value_start(index)
		let value = source.substring(start, start + len)

		// Check if there's a - or + sign before this position (handling "2n - 1" or "2n + 1" with spaces)
		// Look backwards for a - or + sign, skipping whitespace
		let check_pos = start - 1
		while (check_pos >= 0) {
			const ch = source.charCodeAt(check_pos)
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
		const first = this.first_child
		return first?.next_sibling ?? undefined // Second child is NODE_SELECTOR_LIST
	}

	// --- Node Cloning ---

	/**
	 * Clone this node as a mutable plain object with children as arrays.
	 * Use sparingly — can consume a lot of memory.
	 */
	clone(options: CloneOptions = {}): PlainCSSNode {
		const { deep = true, locations = false } = options
		const { type } = this

		const plain: any = {
			type,
			type_name: this.type_name,
			text: this.text,
		}

		for (const key of enumerable_properties) {
			const val = this[key]
			if (val instanceof CSSNode) {
				plain[key] = val.clone({ deep, locations })
			} else if (val !== undefined && val !== false) {
				plain[key] = val
			}
		}

		if (locations) {
			plain.line = this.line
			plain.column = this.column
			plain.start = this.start
			plain.length = this.length
			plain.end = this.end
		}

		if (deep && nodes_with_children.has(type)) {
			plain.children = []
			plain.child_count = this.child_count
			plain.has_children = this.has_children

			const children = this.children
			if (children) {
				for (const child of children) {
					plain.children.push(child.clone({ deep: true, locations }))
				}
			}
		}

		return plain
	}
}
