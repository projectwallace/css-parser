// Selector Parser - Parses CSS selectors into structured AST nodes
import { Lexer } from './lexer'
import type { CSSDataArena } from './arena'
import {
	NODE_SELECTOR,
	NODE_SELECTOR_LIST,
	NODE_SELECTOR_TYPE,
	NODE_SELECTOR_CLASS,
	NODE_SELECTOR_ID,
	NODE_SELECTOR_ATTRIBUTE,
	NODE_SELECTOR_PSEUDO_CLASS,
	NODE_SELECTOR_PSEUDO_ELEMENT,
	NODE_SELECTOR_COMBINATOR,
	NODE_SELECTOR_UNIVERSAL,
	NODE_SELECTOR_NESTING,
	NODE_SELECTOR_NTH,
	NODE_SELECTOR_NTH_OF,
	NODE_SELECTOR_LANG,
	FLAG_VENDOR_PREFIXED,
	ATTR_OPERATOR_NONE,
	ATTR_OPERATOR_EQUAL,
	ATTR_OPERATOR_TILDE_EQUAL,
	ATTR_OPERATOR_PIPE_EQUAL,
	ATTR_OPERATOR_CARET_EQUAL,
	ATTR_OPERATOR_DOLLAR_EQUAL,
	ATTR_OPERATOR_STAR_EQUAL,
} from './arena'
import {
	TOKEN_IDENT,
	TOKEN_HASH,
	TOKEN_DELIM,
	TOKEN_COLON,
	TOKEN_COMMA,
	TOKEN_LEFT_BRACKET,
	TOKEN_RIGHT_BRACKET,
	TOKEN_FUNCTION,
	TOKEN_LEFT_PAREN,
	TOKEN_RIGHT_PAREN,
	TOKEN_EOF,
	TOKEN_WHITESPACE,
	TOKEN_STRING,
} from './token-types'
import { trim_boundaries, is_whitespace as is_whitespace_char, is_vendor_prefixed } from './string-utils'
import { ANplusBParser } from './anplusb-parser'

export class SelectorParser {
	private lexer: Lexer
	private arena: CSSDataArena
	private source: string
	private selector_end: number

	constructor(arena: CSSDataArena, source: string) {
		this.arena = arena
		this.source = source
		// Create a lexer instance for selector parsing
		this.lexer = new Lexer(source, false)
		this.selector_end = 0
	}

	// Parse a selector range into selector nodes
	// Always returns a NODE_SELECTOR_LIST with selector components as children
	parse_selector(start: number, end: number, line: number = 1, column: number = 1, allow_relative: boolean = false): number | null {
		this.selector_end = end

		// Position lexer at selector start
		this.lexer.pos = start
		this.lexer.line = line
		this.lexer.column = column

		// Parse selector list (comma-separated selectors)
		// Returns NODE_SELECTOR_LIST directly (no wrapper)
		return this.parse_selector_list(allow_relative)
	}

	// Parse comma-separated selectors
	private parse_selector_list(allow_relative: boolean = false): number | null {
		let selectors: number[] = []
		let list_start = this.lexer.pos
		let list_line = this.lexer.line
		let list_column = this.lexer.column

		while (this.lexer.pos < this.selector_end) {
			let selector_start = this.lexer.pos
			let selector_line = this.lexer.line
			let selector_column = this.lexer.column

			let complex_selector = this.parse_complex_selector(allow_relative)
			if (complex_selector !== null) {
				// Wrap the complex selector (chain of components) in a NODE_SELECTOR
				let selector_wrapper = this.arena.create_node()
				this.arena.set_type(selector_wrapper, NODE_SELECTOR)
				this.arena.set_start_offset(selector_wrapper, selector_start)
				this.arena.set_length(selector_wrapper, this.lexer.pos - selector_start)
				this.arena.set_start_line(selector_wrapper, selector_line)
				this.arena.set_start_column(selector_wrapper, selector_column)

				// Find the last component in the chain
				let last_component = complex_selector
				while (this.arena.get_next_sibling(last_component) !== 0) {
					last_component = this.arena.get_next_sibling(last_component)
				}

				// Set the complex selector chain as children
				this.arena.set_first_child(selector_wrapper, complex_selector)
				this.arena.set_last_child(selector_wrapper, last_component)

				selectors.push(selector_wrapper)
			}

			// Check for comma (selector separator)
			this.skip_whitespace()
			if (this.lexer.pos >= this.selector_end) break

			this.lexer.next_token_fast(false)
			let token_type = this.lexer.token_type
			if (token_type === TOKEN_COMMA) {
				this.skip_whitespace()
				continue
			} else {
				// No more selectors
				break
			}
		}

		// Always wrap in selector list node, even for single selectors
		if (selectors.length >= 1) {
			let list_node = this.arena.create_node()
			this.arena.set_type(list_node, NODE_SELECTOR_LIST)
			this.arena.set_start_offset(list_node, list_start)
			this.arena.set_length(list_node, this.lexer.pos - list_start)
			this.arena.set_start_line(list_node, list_line)
			this.arena.set_start_column(list_node, list_column)

			// Link selector wrapper nodes as children
			this.arena.set_first_child(list_node, selectors[0])
			this.arena.set_last_child(list_node, selectors[selectors.length - 1])

			// Chain selector wrappers as siblings (simple since they're already wrapped)
			for (let i = 0; i < selectors.length - 1; i++) {
				this.arena.set_next_sibling(selectors[i], selectors[i + 1])
			}

			return list_node
		}

		return null
	}

	// Parse a complex selector (with combinators)
	// e.g., "div.class > p + span"
	private parse_complex_selector(allow_relative: boolean = false): number | null {
		let components: number[] = []

		// Skip leading whitespace
		this.skip_whitespace()

		// Check for leading combinator (relative selector) if allowed
		if (allow_relative && this.lexer.pos < this.selector_end) {
			let saved_pos = this.lexer.pos
			let saved_line = this.lexer.line
			let saved_column = this.lexer.column

			this.lexer.next_token_fast(false)
			let token_type = this.lexer.token_type

			// Check if token is a combinator
			if (token_type === TOKEN_DELIM) {
				let ch = this.source.charCodeAt(this.lexer.token_start)
				if (ch === 0x3e || ch === 0x2b || ch === 0x7e) {
					// Found leading combinator (>, +, ~) - this is a relative selector
					let combinator = this.create_combinator(this.lexer.token_start, this.lexer.token_end)
					components.push(combinator)
					this.skip_whitespace()
					// Continue to parse the rest normally
				} else {
					// Not a combinator, restore position
					this.lexer.pos = saved_pos
					this.lexer.line = saved_line
					this.lexer.column = saved_column
				}
			} else {
				// Not a delimiter, restore position
				this.lexer.pos = saved_pos
				this.lexer.line = saved_line
				this.lexer.column = saved_column
			}
		}

		while (this.lexer.pos < this.selector_end) {
			if (this.lexer.pos >= this.selector_end) break

			// Parse compound selector first
			let compound = this.parse_compound_selector()
			if (compound !== null) {
				components.push(compound)
			} else {
				break
			}

			// After a compound selector, check if there's a combinator
			let combinator = this.try_parse_combinator()
			if (combinator !== null) {
				components.push(combinator)
				// Skip whitespace after combinator before next compound
				this.skip_whitespace()
				continue
			}

			// Peek ahead for comma or end
			let saved_pos = this.lexer.pos
			let saved_line = this.lexer.line
			let saved_column = this.lexer.column
			this.skip_whitespace()
			if (this.lexer.pos >= this.selector_end) break

			this.lexer.next_token_fast(false)
			let token_type = this.lexer.token_type
			if (token_type === TOKEN_COMMA || this.lexer.pos >= this.selector_end) {
				// Reset position for comma handling
				this.lexer.pos = saved_pos
				this.lexer.line = saved_line
				this.lexer.column = saved_column
				break
			}
			// Reset for next iteration
			this.lexer.pos = saved_pos
			this.lexer.line = saved_line
			this.lexer.column = saved_column
			break
		}

		if (components.length === 0) return null

		// Chain components as siblings (need to find last node in each compound selector chain)
		for (let i = 0; i < components.length - 1; i++) {
			// Find the last node in the current component's chain
			let last_node = components[i]
			while (this.arena.get_next_sibling(last_node) !== 0) {
				last_node = this.arena.get_next_sibling(last_node)
			}
			// Link the last node to the next component
			this.arena.set_next_sibling(last_node, components[i + 1])
		}

		// Return first component (others are chained as siblings)
		return components[0]
	}

	// Parse a compound selector (no combinators)
	// e.g., "div.class#id[attr]:hover"
	private parse_compound_selector(): number | null {
		let parts: number[] = []

		while (this.lexer.pos < this.selector_end) {
			// Save lexer state before getting token
			let saved_pos = this.lexer.pos
			let saved_line = this.lexer.line
			let saved_column = this.lexer.column
			this.lexer.next_token_fast(false)

			if (this.lexer.token_start >= this.selector_end) break

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break

			let part = this.parse_simple_selector()
			if (part !== null) {
				parts.push(part)
			} else {
				// Not a simple selector part, restore lexer state and break
				this.lexer.pos = saved_pos
				this.lexer.line = saved_line
				this.lexer.column = saved_column
				break
			}
		}

		if (parts.length === 0) return null

		// Chain parts as siblings
		for (let i = 0; i < parts.length - 1; i++) {
			this.arena.set_next_sibling(parts[i], parts[i + 1])
		}

		// Return first part (others are chained as siblings)
		return parts[0]
	}

	// Parse a simple selector (single component)
	private parse_simple_selector(): number | null {
		let token_type = this.lexer.token_type
		let start = this.lexer.token_start
		let end = this.lexer.token_end

		switch (token_type) {
			case TOKEN_IDENT:
				// Type selector: div, span, p
				return this.create_type_selector(start, end)

			case TOKEN_HASH:
				// ID selector: #id
				return this.create_id_selector(start, end)

			case TOKEN_DELIM:
				// Could be: . (class), * (universal), & (nesting)
				let ch = this.source.charCodeAt(start)
				if (ch === 0x2e) {
					// . - class selector
					return this.parse_class_selector(start)
				} else if (ch === 0x2a) {
					// * - universal selector
					return this.create_universal_selector(start, end)
				} else if (ch === 0x26) {
					// & - nesting selector
					return this.create_nesting_selector(start, end)
				}
				// Other delimiters signal end of selector
				return null

			case TOKEN_LEFT_BRACKET:
				// Attribute selector: [attr], [attr=value]
				return this.parse_attribute_selector(start)

			case TOKEN_COLON:
				// Pseudo-class or pseudo-element: :hover, ::before
				return this.parse_pseudo(start)

			case TOKEN_FUNCTION:
				// Pseudo-class function: :nth-child(), :is()
				return this.parse_pseudo_function(start, end)

			case TOKEN_WHITESPACE:
			case TOKEN_COMMA:
				// These signal end of compound selector
				return null

			default:
				return null
		}
	}

	// Parse combinator (>, +, ~, or descendant space)
	private try_parse_combinator(): number | null {
		let whitespace_start = this.lexer.pos
		let has_whitespace = false

		// Skip whitespace and check for combinator
		while (this.lexer.pos < this.selector_end) {
			let ch = this.source.charCodeAt(this.lexer.pos)
			if (is_whitespace_char(ch)) {
				has_whitespace = true
				this.lexer.pos++
			} else {
				break
			}
		}

		if (this.lexer.pos >= this.selector_end) return null

		this.lexer.next_token_fast(false)

		// Check for explicit combinators
		if (this.lexer.token_type === TOKEN_DELIM) {
			let ch = this.source.charCodeAt(this.lexer.token_start)
			if (ch === 0x3e || ch === 0x2b || ch === 0x7e) {
				// > + ~ (combinator text excludes leading whitespace)
				return this.create_combinator(this.lexer.token_start, this.lexer.token_end)
			}
		}

		// If we had whitespace but no explicit combinator, it's a descendant combinator
		if (has_whitespace) {
			// Reset lexer position
			this.lexer.pos = whitespace_start
			while (this.lexer.pos < this.selector_end) {
				let ch = this.source.charCodeAt(this.lexer.pos)
				if (is_whitespace_char(ch)) {
					this.lexer.pos++
				} else {
					break
				}
			}
			return this.create_combinator(whitespace_start, this.lexer.pos)
		}

		// No combinator found, reset position
		this.lexer.pos = whitespace_start
		return null
	}

	// Parse class selector (.classname)
	private parse_class_selector(dot_pos: number): number | null {
		// Save lexer state for potential restoration
		let saved_pos = this.lexer.pos
		let saved_line = this.lexer.line
		let saved_column = this.lexer.column

		// Next token should be identifier
		this.lexer.next_token_fast(false)
		if (this.lexer.token_type !== TOKEN_IDENT) {
			// Restore lexer state and return null
			this.lexer.pos = saved_pos
			this.lexer.line = saved_line
			this.lexer.column = saved_column
			return null
		}

		let node = this.arena.create_node()
		this.arena.set_type(node, NODE_SELECTOR_CLASS)
		this.arena.set_start_offset(node, dot_pos)
		this.arena.set_length(node, this.lexer.token_end - dot_pos)
		this.arena.set_start_line(node, this.lexer.line)
		this.arena.set_start_column(node, this.lexer.column)
		// Content is the class name (without the dot)
		this.arena.set_content_start(node, this.lexer.token_start)
		this.arena.set_content_length(node, this.lexer.token_end - this.lexer.token_start)
		return node
	}

	// Parse attribute selector ([attr], [attr=value], etc.)
	private parse_attribute_selector(start: number): number | null {
		let bracket_depth = 1
		let end = this.lexer.token_end
		let content_start = start + 1 // Position after '['
		let content_end = content_start

		// Find matching ]
		while (this.lexer.pos < this.selector_end && bracket_depth > 0) {
			this.lexer.next_token_fast(false)
			let token_type = this.lexer.token_type
			if (token_type === TOKEN_LEFT_BRACKET) {
				bracket_depth++
			} else if (token_type === TOKEN_RIGHT_BRACKET) {
				bracket_depth--
				if (bracket_depth === 0) {
					content_end = this.lexer.token_start // Position before ']'
					end = this.lexer.token_end
					break
				}
			}
		}

		let node = this.arena.create_node()
		this.arena.set_type(node, NODE_SELECTOR_ATTRIBUTE)
		this.arena.set_start_offset(node, start)
		this.arena.set_length(node, end - start)
		this.arena.set_start_line(node, this.lexer.line)
		this.arena.set_start_column(node, this.lexer.column)

		// Parse the content inside brackets to extract name, operator, and value
		this.parse_attribute_content(node, content_start, content_end)

		return node
	}

	// Parse attribute content to extract name, operator, and value
	private parse_attribute_content(node: number, start: number, end: number): void {
		// Skip leading whitespace and comments
		while (start < end) {
			let ch = this.source.charCodeAt(start)
			if (is_whitespace_char(ch)) {
				start++
				continue
			}
			// Skip comments /*...*/
			if (ch === 0x2f /* / */ && start + 1 < end && this.source.charCodeAt(start + 1) === 0x2a /* * */) {
				start += 2 // Skip /*
				while (start < end) {
					if (this.source.charCodeAt(start) === 0x2a && start + 1 < end && this.source.charCodeAt(start + 1) === 0x2f) {
						start += 2 // Skip */
						break
					}
					start++
				}
				continue
			}
			break
		}

		// Skip trailing whitespace and comments
		while (end > start) {
			let ch = this.source.charCodeAt(end - 1)
			if (is_whitespace_char(ch)) {
				end--
				continue
			}
			// Skip comments /*...*/
			if (ch === 0x2f && end >= 2 && this.source.charCodeAt(end - 2) === 0x2a) {
				// Find start of comment
				let pos = end - 2
				while (pos > start && !(this.source.charCodeAt(pos) === 0x2f && this.source.charCodeAt(pos + 1) === 0x2a)) {
					pos--
				}
				if (pos > start) {
					end = pos
					continue
				}
			}
			break
		}

		if (start >= end) return

		// Find attribute name (up to operator or end)
		let name_start = start
		let name_end = start
		let operator_start = -1
		let operator_end = -1
		let value_start = -1
		let value_end = -1

		// Scan for attribute name
		while (name_end < end) {
			let ch = this.source.charCodeAt(name_end)
			if (is_whitespace_char(ch) || ch === 0x3d /* = */ || ch === 0x7e /* ~ */ || ch === 0x7c /* | */ || ch === 0x5e /* ^ */ || ch === 0x24 /* $ */ || ch === 0x2a /* * */) {
				break
			}
			name_end++
		}

		// Store attribute name in content fields
		if (name_end > name_start) {
			this.arena.set_content_start(node, name_start)
			this.arena.set_content_length(node, name_end - name_start)
		}

		// Skip whitespace and comments after name
		let pos = name_end
		while (pos < end) {
			let ch = this.source.charCodeAt(pos)
			if (is_whitespace_char(ch)) {
				pos++
				continue
			}
			// Skip comments
			if (ch === 0x2f && pos + 1 < end && this.source.charCodeAt(pos + 1) === 0x2a) {
				pos += 2
				while (pos < end) {
					if (this.source.charCodeAt(pos) === 0x2a && pos + 1 < end && this.source.charCodeAt(pos + 1) === 0x2f) {
						pos += 2
						break
					}
					pos++
				}
				continue
			}
			break
		}

		if (pos >= end) {
			// No operator, just [attr]
			this.arena.set_attr_operator(node, ATTR_OPERATOR_NONE)
			return
		}

		// Parse operator
		operator_start = pos
		let ch1 = this.source.charCodeAt(pos)

		if (ch1 === 0x3d) { // =
			operator_end = pos + 1
			this.arena.set_attr_operator(node, ATTR_OPERATOR_EQUAL)
		} else if (ch1 === 0x7e && pos + 1 < end && this.source.charCodeAt(pos + 1) === 0x3d) { // ~=
			operator_end = pos + 2
			this.arena.set_attr_operator(node, ATTR_OPERATOR_TILDE_EQUAL)
		} else if (ch1 === 0x7c && pos + 1 < end && this.source.charCodeAt(pos + 1) === 0x3d) { // |=
			operator_end = pos + 2
			this.arena.set_attr_operator(node, ATTR_OPERATOR_PIPE_EQUAL)
		} else if (ch1 === 0x5e && pos + 1 < end && this.source.charCodeAt(pos + 1) === 0x3d) { // ^=
			operator_end = pos + 2
			this.arena.set_attr_operator(node, ATTR_OPERATOR_CARET_EQUAL)
		} else if (ch1 === 0x24 && pos + 1 < end && this.source.charCodeAt(pos + 1) === 0x3d) { // $=
			operator_end = pos + 2
			this.arena.set_attr_operator(node, ATTR_OPERATOR_DOLLAR_EQUAL)
		} else if (ch1 === 0x2a && pos + 1 < end && this.source.charCodeAt(pos + 1) === 0x3d) { // *=
			operator_end = pos + 2
			this.arena.set_attr_operator(node, ATTR_OPERATOR_STAR_EQUAL)
		} else {
			// No valid operator
			this.arena.set_attr_operator(node, ATTR_OPERATOR_NONE)
			return
		}

		// Skip whitespace and comments after operator
		pos = operator_end
		while (pos < end) {
			let ch = this.source.charCodeAt(pos)
			if (is_whitespace_char(ch)) {
				pos++
				continue
			}
			// Skip comments
			if (ch === 0x2f && pos + 1 < end && this.source.charCodeAt(pos + 1) === 0x2a) {
				pos += 2
				while (pos < end) {
					if (this.source.charCodeAt(pos) === 0x2a && pos + 1 < end && this.source.charCodeAt(pos + 1) === 0x2f) {
						pos += 2
						break
					}
					pos++
				}
				continue
			}
			break
		}

		if (pos >= end) {
			// No value after operator
			return
		}

		// Parse value (can be quoted or unquoted)
		value_start = pos
		let ch = this.source.charCodeAt(pos)

		if (ch === 0x22 || ch === 0x27) { // " or '
			// Quoted string - find matching quote
			let quote = ch
			value_start = pos // Include quotes in value
			pos++
			while (pos < end) {
				let c = this.source.charCodeAt(pos)
				if (c === quote) {
					pos++
					break
				}
				if (c === 0x5c) { // backslash - skip next char
					pos += 2
				} else {
					pos++
				}
			}
			value_end = pos
		} else {
			// Unquoted identifier
			while (pos < end) {
				let c = this.source.charCodeAt(pos)
				if (is_whitespace_char(c)) {
					break
				}
				pos++
			}
			value_end = pos
		}

		// Store value in value fields
		if (value_end > value_start) {
			this.arena.set_value_start(node, value_start)
			this.arena.set_value_length(node, value_end - value_start)
		}
	}

	// Parse pseudo-class or pseudo-element (:hover, ::before)
	private parse_pseudo(start: number): number | null {
		// Save lexer state for potential restoration
		let saved_pos = this.lexer.pos
		let saved_line = this.lexer.line
		let saved_column = this.lexer.column

		// Check for double colon (::)
		let is_pseudo_element = false
		if (this.lexer.pos < this.selector_end && this.source.charCodeAt(this.lexer.pos) === 0x3a) {
			is_pseudo_element = true
			this.lexer.pos++ // skip second colon
		}

		// Next token should be identifier or function
		this.lexer.next_token_fast(false)

		let token_type = this.lexer.token_type
		if (token_type === TOKEN_IDENT) {
			let node = this.arena.create_node()
			this.arena.set_type(node, is_pseudo_element ? NODE_SELECTOR_PSEUDO_ELEMENT : NODE_SELECTOR_PSEUDO_CLASS)
			this.arena.set_start_offset(node, start)
			this.arena.set_length(node, this.lexer.token_end - start)
			this.arena.set_start_line(node, this.lexer.line)
			this.arena.set_start_column(node, this.lexer.column)
			// Content is the pseudo name (without colons)
			this.arena.set_content_start(node, this.lexer.token_start)
			this.arena.set_content_length(node, this.lexer.token_end - this.lexer.token_start)
			// Check for vendor prefix and set flag if detected
			if (is_vendor_prefixed(this.source, this.lexer.token_start, this.lexer.token_end)) {
				this.arena.set_flag(node, FLAG_VENDOR_PREFIXED)
			}
			return node
		} else if (token_type === TOKEN_FUNCTION) {
			// Pseudo-class function like :nth-child()
			return this.parse_pseudo_function_after_colon(start, is_pseudo_element)
		}

		// Restore lexer state and return null
		this.lexer.pos = saved_pos
		this.lexer.line = saved_line
		this.lexer.column = saved_column
		return null
	}

	// Parse pseudo-class function (:nth-child(), :is(), etc.)
	private parse_pseudo_function(_start: number, _end: number): number | null {
		// This should not be called in current flow, but keep for completeness
		return null
	}

	// Parse pseudo-class function after we've seen the colon
	private parse_pseudo_function_after_colon(start: number, is_pseudo_element: boolean): number | null {
		let func_name_start = this.lexer.token_start
		let func_name_end = this.lexer.token_end - 1 // Exclude the '('

		// Capture content start (right after the '(')
		let content_start = this.lexer.pos
		let content_end = content_start

		// Find matching )
		let paren_depth = 1
		let end = this.lexer.token_end

		while (this.lexer.pos < this.selector_end && paren_depth > 0) {
			this.lexer.next_token_fast(false)
			let token_type = this.lexer.token_type
			if (token_type === TOKEN_LEFT_PAREN || token_type === TOKEN_FUNCTION) {
				paren_depth++
			} else if (token_type === TOKEN_RIGHT_PAREN) {
				paren_depth--
				if (paren_depth === 0) {
					content_end = this.lexer.token_start // Position before ')'
					end = this.lexer.token_end
					break
				}
			}
		}

		let node = this.arena.create_node()
		this.arena.set_type(node, is_pseudo_element ? NODE_SELECTOR_PSEUDO_ELEMENT : NODE_SELECTOR_PSEUDO_CLASS)
		this.arena.set_start_offset(node, start)
		this.arena.set_length(node, end - start)
		this.arena.set_start_line(node, this.lexer.line)
		this.arena.set_start_column(node, this.lexer.column)
		// Content is the function name (without colons and parentheses)
		this.arena.set_content_start(node, func_name_start)
		this.arena.set_content_length(node, func_name_end - func_name_start)
		// Check for vendor prefix and set flag if detected
		if (is_vendor_prefixed(this.source, func_name_start, func_name_end)) {
			this.arena.set_flag(node, FLAG_VENDOR_PREFIXED)
		}

		// Parse the content inside the parentheses
		if (content_end > content_start) {
			// Check if this is an nth-* pseudo-class
			let func_name = this.source.substring(func_name_start, func_name_end).toLowerCase()

			if (this.is_nth_pseudo(func_name)) {
				// Parse as An+B expression
				let child = this.parse_nth_expression(content_start, content_end, node)
				if (child !== null) {
					this.arena.set_first_child(node, child)
					this.arena.set_last_child(node, child)
				}
			} else if (func_name === 'lang') {
				// Parse as :lang() - comma-separated language identifiers
				this.parse_lang_identifiers(content_start, content_end, node)
			} else {
				// Parse as selector (for :is(), :where(), :has(), etc.)
				// Save current lexer state and selector_end
				let saved_selector_end = this.selector_end
				let saved_pos = this.lexer.pos
				let saved_line = this.lexer.line
				let saved_column = this.lexer.column

				// Recursively parse the content as a selector
				// Only :has() accepts relative selectors (starting with combinator)
				let allow_relative = func_name === 'has'
				let child_selector = this.parse_selector(content_start, content_end, this.lexer.line, this.lexer.column, allow_relative)

				// Restore lexer state and selector_end
				this.selector_end = saved_selector_end
				this.lexer.pos = saved_pos
				this.lexer.line = saved_line
				this.lexer.column = saved_column

				// Add as child if parsed successfully
				if (child_selector !== null) {
					this.arena.set_first_child(node, child_selector)
					this.arena.set_last_child(node, child_selector)
				}
			}
		}

		return node
	}

	// Check if pseudo-class name is an nth-* pseudo
	private is_nth_pseudo(name: string): boolean {
		return (
			name === 'nth-child' ||
			name === 'nth-last-child' ||
			name === 'nth-of-type' ||
			name === 'nth-last-of-type' ||
			name === 'nth-col' ||
			name === 'nth-last-col'
		)
	}

	// Parse :lang() content - comma-separated language identifiers
	// Accepts both quoted strings: :lang("en", "fr") and unquoted: :lang(en, fr)
	private parse_lang_identifiers(start: number, end: number, parent_node: number): void {
		// Save current lexer state
		let saved_selector_end = this.selector_end
		let saved_pos = this.lexer.pos
		let saved_line = this.lexer.line
		let saved_column = this.lexer.column

		// Set lexer to parse this range
		this.lexer.pos = start
		this.selector_end = end

		let first_child: number | null = null
		let last_child: number | null = null

		while (this.lexer.pos < end) {
			this.lexer.next_token_fast(false)
			let token_type = this.lexer.token_type
			let token_start = this.lexer.token_start
			let token_end = this.lexer.token_end

			// Skip whitespace
			if (token_type === TOKEN_WHITESPACE) {
				continue
			}

			// Skip commas
			if (token_type === TOKEN_COMMA) {
				continue
			}

			// Accept both strings and identifiers
			if (token_type === TOKEN_STRING || token_type === TOKEN_IDENT) {
				// Create language identifier node
				let lang_node = this.arena.create_node()
				this.arena.set_type(lang_node, NODE_SELECTOR_LANG)
				this.arena.set_start_offset(lang_node, token_start)
				this.arena.set_length(lang_node, token_end - token_start)
				this.arena.set_start_line(lang_node, this.lexer.line)
				this.arena.set_start_column(lang_node, this.lexer.column)

				// Link as child of :lang() pseudo-class
				if (first_child === null) {
					first_child = lang_node
				}
				if (last_child !== null) {
					this.arena.set_next_sibling(last_child, lang_node)
				}
				last_child = lang_node
			}

			// Stop if we've reached the end
			if (this.lexer.pos >= end) {
				break
			}
		}

		// Set children on parent node
		if (first_child !== null) {
			this.arena.set_first_child(parent_node, first_child)
		}
		if (last_child !== null) {
			this.arena.set_last_child(parent_node, last_child)
		}

		// Restore lexer state
		this.selector_end = saved_selector_end
		this.lexer.pos = saved_pos
		this.lexer.line = saved_line
		this.lexer.column = saved_column
	}

	// Parse An+B expression for nth-* pseudo-classes
	// Handles both simple An+B and "An+B of S" syntax
	private parse_nth_expression(start: number, end: number, parent_node: number): number | null {
		// Check for "of <selector>" syntax
		// e.g., "2n+1 of .active, .disabled"
		let of_index = this.find_of_keyword(start, end)

		if (of_index !== -1) {
			// Parse An+B part before "of"
			let anplusb_parser = new ANplusBParser(this.arena, this.source)
			let anplusb_node = anplusb_parser.parse_anplusb(start, of_index, this.lexer.line)

			// Parse selector list after "of"
			let selector_start = of_index + 2 // skip "of"
			// Skip whitespace
			while (
				selector_start < end &&
				is_whitespace_char(this.source.charCodeAt(selector_start))
			) {
				selector_start++
			}

			// Save current state
			let saved_selector_end = this.selector_end
			let saved_pos = this.lexer.pos
			let saved_line = this.lexer.line
			let saved_column = this.lexer.column

			// Parse selector list
			this.selector_end = end
			this.lexer.pos = selector_start
			let selector_list = this.parse_selector_list()

			// Restore state
			this.selector_end = saved_selector_end
			this.lexer.pos = saved_pos
			this.lexer.line = saved_line
			this.lexer.column = saved_column

			// Create NTH_OF wrapper
			let of_node = this.arena.create_node()
			this.arena.set_type(of_node, NODE_SELECTOR_NTH_OF)
			this.arena.set_start_offset(of_node, start)
			this.arena.set_length(of_node, end - start)
			this.arena.set_start_line(of_node, this.lexer.line)

			// Link An+B and selector list
			if (anplusb_node !== null && selector_list !== null) {
				this.arena.set_first_child(of_node, anplusb_node)
				this.arena.set_last_child(of_node, selector_list)
				this.arena.set_next_sibling(anplusb_node, selector_list)
			} else if (anplusb_node !== null) {
				this.arena.set_first_child(of_node, anplusb_node)
				this.arena.set_last_child(of_node, anplusb_node)
			}

			return of_node
		} else {
			// Just An+B, no "of" clause
			let anplusb_parser = new ANplusBParser(this.arena, this.source)
			return anplusb_parser.parse_anplusb(start, end, this.lexer.line)
		}
	}

	// Find the position of standalone "of" keyword
	private find_of_keyword(start: number, end: number): number {
		for (let i = start; i < end - 1; i++) {
			if (
				this.source.charCodeAt(i) === 0x6f /* o */ &&
				this.source.charCodeAt(i + 1) === 0x66 /* f */
			) {
				// Check it's a word boundary
				let before_ok =
					i === start || is_whitespace_char(this.source.charCodeAt(i - 1))
				let after_ok =
					i + 2 >= end || is_whitespace_char(this.source.charCodeAt(i + 2))

				if (before_ok && after_ok) {
					return i
				}
			}
		}
		return -1
	}

	// Create simple selector nodes
	private create_type_selector(start: number, end: number): number {
		let node = this.arena.create_node()
		this.arena.set_type(node, NODE_SELECTOR_TYPE)
		this.arena.set_start_offset(node, start)
		this.arena.set_length(node, end - start)
		this.arena.set_start_line(node, this.lexer.line)
		this.arena.set_start_column(node, this.lexer.column)
		this.arena.set_content_start(node, start)
		this.arena.set_content_length(node, end - start)
		return node
	}

	private create_id_selector(start: number, end: number): number {
		let node = this.arena.create_node()
		this.arena.set_type(node, NODE_SELECTOR_ID)
		this.arena.set_start_offset(node, start)
		this.arena.set_length(node, end - start)
		this.arena.set_start_line(node, this.lexer.line)
		this.arena.set_start_column(node, this.lexer.column)
		// Content is the ID name (without the #)
		this.arena.set_content_start(node, start + 1)
		this.arena.set_content_length(node, end - start - 1)
		return node
	}

	private create_universal_selector(start: number, end: number): number {
		let node = this.arena.create_node()
		this.arena.set_type(node, NODE_SELECTOR_UNIVERSAL)
		this.arena.set_start_offset(node, start)
		this.arena.set_length(node, end - start)
		this.arena.set_start_line(node, this.lexer.line)
		this.arena.set_start_column(node, this.lexer.column)
		this.arena.set_content_start(node, start)
		this.arena.set_content_length(node, end - start)
		return node
	}

	private create_nesting_selector(start: number, end: number): number {
		let node = this.arena.create_node()
		this.arena.set_type(node, NODE_SELECTOR_NESTING)
		this.arena.set_start_offset(node, start)
		this.arena.set_length(node, end - start)
		this.arena.set_start_line(node, this.lexer.line)
		this.arena.set_start_column(node, this.lexer.column)
		this.arena.set_content_start(node, start)
		this.arena.set_content_length(node, end - start)
		return node
	}

	private create_combinator(start: number, end: number): number {
		let node = this.arena.create_node()
		this.arena.set_type(node, NODE_SELECTOR_COMBINATOR)
		this.arena.set_start_offset(node, start)
		this.arena.set_length(node, end - start)
		this.arena.set_start_line(node, this.lexer.line)
		this.arena.set_start_column(node, this.lexer.column)
		this.arena.set_content_start(node, start)
		this.arena.set_content_length(node, end - start)
		return node
	}

	// Helper to skip whitespace
	private skip_whitespace(): void {
		while (this.lexer.pos < this.selector_end) {
			let ch = this.source.charCodeAt(this.lexer.pos)
			if (is_whitespace_char(ch)) {
				this.lexer.pos++
			} else {
				break
			}
		}
	}
}
