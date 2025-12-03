// Selector Parser - Parses CSS selectors into structured AST nodes
import { Lexer } from './lexer'
import { CSSDataArena } from './arena'
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
	NODE_SELECTOR_NTH_OF,
	NODE_SELECTOR_LANG,
	FLAG_VENDOR_PREFIXED,
	FLAG_HAS_PARENS,
	ATTR_OPERATOR_NONE,
	ATTR_OPERATOR_EQUAL,
	ATTR_OPERATOR_TILDE_EQUAL,
	ATTR_OPERATOR_PIPE_EQUAL,
	ATTR_OPERATOR_CARET_EQUAL,
	ATTR_OPERATOR_DOLLAR_EQUAL,
	ATTR_OPERATOR_STAR_EQUAL,
	ATTR_FLAG_NONE,
	ATTR_FLAG_CASE_INSENSITIVE,
	ATTR_FLAG_CASE_SENSITIVE,
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
import { skip_whitespace_forward, skip_whitespace_and_comments_forward, skip_whitespace_and_comments_backward } from './parse-utils'
import {
	is_whitespace,
	is_vendor_prefixed,
	CHAR_PLUS,
	CHAR_TILDE,
	CHAR_GREATER_THAN,
	CHAR_PERIOD,
	CHAR_ASTERISK,
	CHAR_AMPERSAND,
	is_combinator,
	CHAR_EQUALS,
	CHAR_PIPE,
	CHAR_DOLLAR,
	CHAR_CARET,
	CHAR_SINGLE_QUOTE,
	CHAR_DOUBLE_QUOTE,
	CHAR_COLON,
} from './string-utils'
import { ANplusBParser } from './parse-anplusb'
import { CSSNode } from './css-node'

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
	parse_selector(start: number, end: number, line: number = 1, column: number = 1, allow_relative: boolean = true): number | null {
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
	private parse_selector_list(allow_relative: boolean = true): number | null {
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
	// Also supports CSS Nesting relaxed syntax: "> a", "~ span", etc.
	private parse_complex_selector(allow_relative: boolean = true): number | null {
		let components: number[] = []

		// Skip leading whitespace
		this.skip_whitespace()

		// Check for leading combinator (relative selector) if allowed
		if (allow_relative && this.lexer.pos < this.selector_end) {
			const saved = this.lexer.save_position()

			this.lexer.next_token_fast(false)
			let token_type = this.lexer.token_type

			// Check if token is a combinator
			if (token_type === TOKEN_DELIM) {
				let ch = this.source.charCodeAt(this.lexer.token_start)
				if (ch === CHAR_GREATER_THAN || ch === CHAR_PLUS || ch === CHAR_TILDE) {
					// Found leading combinator (>, +, ~) - this is a relative selector
					let combinator = this.create_combinator(this.lexer.token_start, this.lexer.token_end)
					components.push(combinator)
					this.skip_whitespace()
					// Continue to parse the rest normally
				} else {
					// Not a combinator, restore position
					this.lexer.restore_position(saved)
				}
			} else {
				// Not a delimiter, restore position
				this.lexer.restore_position(saved)
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
			const saved = this.lexer.save_position()
			this.skip_whitespace()
			if (this.lexer.pos >= this.selector_end) break

			this.lexer.next_token_fast(false)
			let token_type = this.lexer.token_type
			if (token_type === TOKEN_COMMA || this.lexer.pos >= this.selector_end) {
				// Reset position for comma handling
				this.lexer.restore_position(saved)
				break
			}
			// Reset for next iteration
			this.lexer.restore_position(saved)
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
			const saved = this.lexer.save_position()
			this.lexer.next_token_fast(false)

			if (this.lexer.token_start >= this.selector_end) break

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break

			let part = this.parse_simple_selector()
			if (part !== null) {
				parts.push(part)
			} else {
				// Not a simple selector part, restore lexer state and break
				this.lexer.restore_position(saved)
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
				if (ch === CHAR_PERIOD) {
					// . - class selector
					return this.parse_class_selector(start)
				} else if (ch === CHAR_ASTERISK) {
					// * - universal selector
					return this.create_universal_selector(start, end)
				} else if (ch === CHAR_AMPERSAND) {
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
			if (is_whitespace(ch)) {
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
			if (is_combinator(ch)) {
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
				if (is_whitespace(ch)) {
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
		const saved = this.lexer.save_position()

		// Next token should be identifier
		this.lexer.next_token_fast(false)
		if (this.lexer.token_type !== TOKEN_IDENT) {
			// Restore lexer state and return null
			this.lexer.restore_position(saved)
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
		start = skip_whitespace_and_comments_forward(this.source, start, end)

		// Skip trailing whitespace and comments
		end = skip_whitespace_and_comments_backward(this.source, end, start)

		if (start >= end) return

		// Find attribute name (up to operator or end)
		let name_start = start
		let name_end = start
		let operator_end = -1
		let value_start = -1
		let value_end = -1

		// Scan for attribute name
		while (name_end < end) {
			let ch = this.source.charCodeAt(name_end)
			if (
				is_whitespace(ch) ||
				ch === CHAR_EQUALS /* = */ ||
				ch === CHAR_TILDE /* ~ */ ||
				ch === CHAR_PIPE /* | */ ||
				ch === CHAR_CARET /* ^ */ ||
				ch === CHAR_DOLLAR /* $ */ ||
				ch === CHAR_ASTERISK /* * */
			) {
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
		let pos = skip_whitespace_and_comments_forward(this.source, name_end, end)

		if (pos >= end) {
			// No operator, just [attr]
			this.arena.set_attr_operator(node, ATTR_OPERATOR_NONE)
			this.arena.set_attr_flags(node, ATTR_FLAG_NONE)
			return
		}

		// Parse operator
		let ch1 = this.source.charCodeAt(pos)

		if (ch1 === CHAR_EQUALS) {
			// =
			operator_end = pos + 1
			this.arena.set_attr_operator(node, ATTR_OPERATOR_EQUAL)
		} else if (ch1 === CHAR_TILDE && pos + 1 < end && this.source.charCodeAt(pos + 1) === CHAR_EQUALS) {
			// ~=
			operator_end = pos + 2
			this.arena.set_attr_operator(node, ATTR_OPERATOR_TILDE_EQUAL)
		} else if (ch1 === CHAR_PIPE && pos + 1 < end && this.source.charCodeAt(pos + 1) === CHAR_EQUALS) {
			// |=
			operator_end = pos + 2
			this.arena.set_attr_operator(node, ATTR_OPERATOR_PIPE_EQUAL)
		} else if (ch1 === CHAR_CARET && pos + 1 < end && this.source.charCodeAt(pos + 1) === CHAR_EQUALS) {
			// ^=
			operator_end = pos + 2
			this.arena.set_attr_operator(node, ATTR_OPERATOR_CARET_EQUAL)
		} else if (ch1 === CHAR_DOLLAR && pos + 1 < end && this.source.charCodeAt(pos + 1) === CHAR_EQUALS) {
			// $=
			operator_end = pos + 2
			this.arena.set_attr_operator(node, ATTR_OPERATOR_DOLLAR_EQUAL)
		} else if (ch1 === CHAR_ASTERISK && pos + 1 < end && this.source.charCodeAt(pos + 1) === CHAR_EQUALS) {
			// *=
			operator_end = pos + 2
			this.arena.set_attr_operator(node, ATTR_OPERATOR_STAR_EQUAL)
		} else {
			// No valid operator
			this.arena.set_attr_operator(node, ATTR_OPERATOR_NONE)
			this.arena.set_attr_flags(node, ATTR_FLAG_NONE)
			return
		}

		// Skip whitespace and comments after operator
		pos = skip_whitespace_and_comments_forward(this.source, operator_end, end)

		if (pos >= end) {
			// No value after operator
			this.arena.set_attr_flags(node, ATTR_FLAG_NONE)
			return
		}

		// Parse value (can be quoted or unquoted)
		value_start = pos
		let ch = this.source.charCodeAt(pos)

		if (ch === CHAR_SINGLE_QUOTE || ch === CHAR_DOUBLE_QUOTE) {
			// " or '
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
				if (c === 0x5c) {
					// backslash - skip next char
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
				if (is_whitespace(c)) {
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

		// Check for attribute flags (i or s) after the value
		// Skip whitespace and comments after value
		pos = skip_whitespace_and_comments_forward(this.source, value_end, end)

		if (pos < end) {
			let flag_ch = this.source.charCodeAt(pos)
			// Check for 'i' (case-insensitive) or 's' (case-sensitive)
			if (flag_ch === 0x69 /* i */ || flag_ch === 0x49 /* I */) {
				this.arena.set_attr_flags(node, ATTR_FLAG_CASE_INSENSITIVE)
			} else if (flag_ch === 0x73 /* s */ || flag_ch === 0x53 /* S */) {
				this.arena.set_attr_flags(node, ATTR_FLAG_CASE_SENSITIVE)
			} else {
				this.arena.set_attr_flags(node, ATTR_FLAG_NONE)
			}
		} else {
			this.arena.set_attr_flags(node, ATTR_FLAG_NONE)
		}
	}

	// Parse pseudo-class or pseudo-element (:hover, ::before)
	private parse_pseudo(start: number): number | null {
		// Save lexer state for potential restoration
		const saved = this.lexer.save_position()

		// Check for double colon (::)
		let is_pseudo_element = false
		if (this.lexer.pos < this.selector_end && this.source.charCodeAt(this.lexer.pos) === CHAR_COLON) {
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
		this.lexer.restore_position(saved)
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

		// Set FLAG_HAS_PARENS to indicate this is a function syntax (even if empty)
		// This allows formatters to distinguish :lang() from :hover
		this.arena.set_flag(node, FLAG_HAS_PARENS)

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
				let child = this.parse_nth_expression(content_start, content_end)
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
				const saved = this.lexer.save_position()

				// Recursively parse the content as a selector
				// Only :has() accepts relative selectors (starting with combinator)
				let allow_relative = func_name === 'has'
				let child_selector = this.parse_selector(content_start, content_end, this.lexer.line, this.lexer.column, allow_relative)

				// Restore lexer state and selector_end
				this.selector_end = saved_selector_end
				this.lexer.restore_position(saved)

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
		const saved = this.lexer.save_position()

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
		this.lexer.restore_position(saved)
	}

	// Parse An+B expression for nth-* pseudo-classes
	// Handles both simple An+B and "An+B of S" syntax
	private parse_nth_expression(start: number, end: number): number | null {
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
			selector_start = skip_whitespace_forward(this.source, selector_start, end)

			// Save current state
			let saved_selector_end = this.selector_end
			const saved = this.lexer.save_position()

			// Parse selector list
			this.selector_end = end
			this.lexer.pos = selector_start
			let selector_list = this.parse_selector_list()

			// Restore state
			this.selector_end = saved_selector_end
			this.lexer.restore_position(saved)

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
			if (this.source.charCodeAt(i) === 0x6f /* o */ && this.source.charCodeAt(i + 1) === 0x66 /* f */) {
				// Check it's a word boundary
				let before_ok = i === start || is_whitespace(this.source.charCodeAt(i - 1))
				let after_ok = i + 2 >= end || is_whitespace(this.source.charCodeAt(i + 2))

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
		this.lexer.pos = skip_whitespace_forward(this.source, this.lexer.pos, this.selector_end)
	}
}

/**
 * Parse a CSS selector string and return an AST
 * @param source - The CSS selector to parse (e.g., "div.class > p#id")
 * @returns The root CSSNode of the selector AST
 */
export function parse_selector(source: string): CSSNode {
	// Create an arena for the selector nodes
	const arena = new CSSDataArena(CSSDataArena.capacity_for_source(source.length))

	// Create selector parser
	const selector_parser = new SelectorParser(arena, source)

	// Parse the entire source as a selector
	const selector_index = selector_parser.parse_selector(0, source.length)

	if (selector_index === null) {
		// Return empty selector list node if parsing failed
		const empty = arena.create_node()
		arena.set_type(empty, NODE_SELECTOR_LIST)
		arena.set_start_offset(empty, 0)
		arena.set_length(empty, 0)
		arena.set_start_line(empty, 1)
		return new CSSNode(arena, source, empty)
	}

	// Wrap in CSSNode
	return new CSSNode(arena, source, selector_index)
}
