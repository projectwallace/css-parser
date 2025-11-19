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
	FLAG_VENDOR_PREFIXED,
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
} from './token-types'
import { trim_boundaries, is_whitespace as is_whitespace_char, is_vendor_prefixed } from './string-utils'

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
	parse_selector(start: number, end: number, line: number = 1, column: number = 1): number | null {
		this.selector_end = end

		// Position lexer at selector start
		this.lexer.pos = start
		this.lexer.line = line
		this.lexer.column = column

		// Parse selector list (comma-separated selectors)
		// Returns NODE_SELECTOR_LIST directly (no wrapper)
		return this.parse_selector_list()
	}

	// Parse comma-separated selectors
	private parse_selector_list(): number | null {
		let selectors: number[] = []
		let list_start = this.lexer.pos
		let list_line = this.lexer.line
		let list_column = this.lexer.column

		while (this.lexer.pos < this.selector_end) {
			let selector = this.parse_complex_selector()
			if (selector !== null) {
				selectors.push(selector)
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

			// Link selectors as children
			this.arena.set_first_child(list_node, selectors[0])
			this.arena.set_last_child(list_node, selectors[selectors.length - 1])

			// Chain selectors as siblings
			for (let i = 0; i < selectors.length - 1; i++) {
				this.arena.set_next_sibling(selectors[i], selectors[i + 1])
			}

			return list_node
		}

		return null
	}

	// Parse a complex selector (with combinators)
	// e.g., "div.class > p + span"
	private parse_complex_selector(): number | null {
		let components: number[] = []

		// Skip leading whitespace
		this.skip_whitespace()

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
			let pos_before = this.lexer.pos
			this.skip_whitespace()
			if (this.lexer.pos >= this.selector_end) break

			this.lexer.next_token_fast(false)
			let token_type = this.lexer.token_type
			if (token_type === TOKEN_COMMA || this.lexer.pos >= this.selector_end) {
				// Reset position for comma handling
				this.lexer.pos = pos_before
				break
			}
			// Reset for next iteration
			this.lexer.pos = pos_before
			break
		}

		if (components.length === 0) return null

		// Chain components as siblings
		for (let i = 0; i < components.length - 1; i++) {
			this.arena.set_next_sibling(components[i], components[i + 1])
		}

		// Return first component (others are chained as siblings)
		return components[0]
	}

	// Parse a compound selector (no combinators)
	// e.g., "div.class#id[attr]:hover"
	private parse_compound_selector(): number | null {
		let parts: number[] = []

		while (this.lexer.pos < this.selector_end) {
			// Save position before getting token
			let pos_before = this.lexer.pos
			this.lexer.next_token_fast(false)

			if (this.lexer.token_start >= this.selector_end) break

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break

			let part = this.parse_simple_selector()
			if (part !== null) {
				parts.push(part)
			} else {
				// Not a simple selector part, reset position and break
				this.lexer.pos = pos_before
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
		let start = this.lexer.pos
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
				// > + ~
				return this.create_combinator(start, this.lexer.token_end)
			}
		}

		// If we had whitespace but no explicit combinator, it's a descendant combinator
		if (has_whitespace) {
			// Reset lexer position
			this.lexer.pos = start
			while (this.lexer.pos < this.selector_end) {
				let ch = this.source.charCodeAt(this.lexer.pos)
				if (is_whitespace_char(ch)) {
					this.lexer.pos++
				} else {
					break
				}
			}
			return this.create_combinator(start, this.lexer.pos)
		}

		// No combinator found, reset position
		this.lexer.pos = start
		return null
	}

	// Parse class selector (.classname)
	private parse_class_selector(dot_pos: number): number | null {
		// Next token should be identifier
		this.lexer.next_token_fast(false)
		if (this.lexer.token_type !== TOKEN_IDENT) {
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

		// Find matching ]
		while (this.lexer.pos < this.selector_end && bracket_depth > 0) {
			this.lexer.next_token_fast(false)
			let token_type = this.lexer.token_type
			if (token_type === TOKEN_LEFT_BRACKET) {
				bracket_depth++
			} else if (token_type === TOKEN_RIGHT_BRACKET) {
				bracket_depth--
				if (bracket_depth === 0) {
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
		// Content is everything inside the brackets, trimmed
		let trimmed = trim_boundaries(this.source, start + 1, end - 1)
		if (trimmed) {
			this.arena.set_content_start(node, trimmed[0])
			this.arena.set_content_length(node, trimmed[1] - trimmed[0])
		}
		return node
	}

	// Parse pseudo-class or pseudo-element (:hover, ::before)
	private parse_pseudo(start: number): number | null {
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

		// Find matching )
		let paren_depth = 1
		let end = this.lexer.token_end

		while (this.lexer.pos < this.selector_end && paren_depth > 0) {
			this.lexer.next_token_fast(false)
			let token_type = this.lexer.token_type
			if (token_type === TOKEN_LEFT_PAREN) {
				paren_depth++
			} else if (token_type === TOKEN_RIGHT_PAREN) {
				paren_depth--
				if (paren_depth === 0) {
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
		return node
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
