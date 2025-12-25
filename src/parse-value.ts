// Value Parser - Parses CSS declaration values into structured AST nodes
import { Lexer } from './tokenize'
import { CSSDataArena, IDENTIFIER, NUMBER, DIMENSION, STRING, HASH, FUNCTION, OPERATOR, PARENTHESIS, URL } from './arena'
import {
	TOKEN_IDENT,
	TOKEN_NUMBER,
	TOKEN_PERCENTAGE,
	TOKEN_DIMENSION,
	TOKEN_STRING,
	TOKEN_HASH,
	TOKEN_FUNCTION,
	TOKEN_DELIM,
	TOKEN_COMMA,
	TOKEN_EOF,
	TOKEN_LEFT_PAREN,
	TOKEN_RIGHT_PAREN,
} from './token-types'
import { is_whitespace, CHAR_MINUS_HYPHEN, CHAR_PLUS, CHAR_ASTERISK, CHAR_FORWARD_SLASH, str_equals } from './string-utils'
import { CSSNode } from './css-node'

/** @internal */
export class ValueParser {
	private lexer: Lexer
	private arena: CSSDataArena
	private source: string
	private value_end: number

	constructor(arena: CSSDataArena, source: string) {
		this.arena = arena
		this.source = source
		// Create a lexer instance for value parsing (don't skip comments in values)
		this.lexer = new Lexer(source, false)
		this.value_end = 0
	}

	// Parse a declaration value range into value nodes (standalone use)
	// Returns array of value node indices
	parse_value(start: number, end: number, start_line: number, start_column: number): number[] {
		this.value_end = end

		// Position lexer at value start with provided line/column
		this.lexer.pos = start
		this.lexer.line = start_line
		this.lexer.column = start_column

		return this.parse_value_tokens()
	}

	// Core token parsing logic
	private parse_value_tokens(): number[] {
		let nodes: number[] = []

		// Parse all tokens in the value range
		while (this.lexer.pos < this.value_end) {
			// Get next token without skipping whitespace (whitespace matters in values)
			this.lexer.next_token_fast(false)

			// Stop if we've reached the end of the value
			if (this.lexer.token_start >= this.value_end) break

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break

			// Skip whitespace tokens (they're separators, not value nodes)
			if (this.is_whitespace_inline()) {
				continue
			}

			// Parse this token into a value node (token_type already cached in lexer.token_type)
			let node = this.parse_value_node()
			if (node !== null) {
				nodes.push(node)
			}
		}

		return nodes
	}

	// Helper to check if token is all whitespace (inline for hot paths)
	private is_whitespace_inline(): boolean {
		if (this.lexer.token_start >= this.lexer.token_end) return false
		for (let i = this.lexer.token_start; i < this.lexer.token_end; i++) {
			if (!is_whitespace(this.source.charCodeAt(i))) {
				return false
			}
		}
		return true
	}

	private parse_value_node(): number | null {
		let token_type = this.lexer.token_type
		let start = this.lexer.token_start
		let end = this.lexer.token_end

		switch (token_type) {
			case TOKEN_IDENT:
				return this.create_node(IDENTIFIER, start, end)

			case TOKEN_NUMBER:
				return this.create_node(NUMBER, start, end)

			case TOKEN_PERCENTAGE:
			case TOKEN_DIMENSION:
				return this.create_node(DIMENSION, start, end)

			case TOKEN_STRING:
				return this.create_node(STRING, start, end)

			case TOKEN_HASH:
				return this.create_node(HASH, start, end)

			case TOKEN_FUNCTION:
				return this.parse_function_node(start, end)

			case TOKEN_DELIM:
				return this.parse_operator_node(start, end)

			case TOKEN_COMMA:
				return this.create_node(OPERATOR, start, end)

			case TOKEN_LEFT_PAREN:
				return this.parse_parenthesis_node(start, end)

			default:
				// Unknown token type, skip it
				return null
		}
	}

	private create_node(node_type: number, start: number, end: number): number {
		let node = this.arena.create_node(node_type, start, end - start, this.lexer.token_line, this.lexer.token_column)
		// Skip set_content_start_delta since delta = start - start = 0 (already zero-initialized)
		this.arena.set_content_length(node, end - start)
		return node
	}

	private create_operator_node(start: number, end: number): number {
		return this.create_node(OPERATOR, start, end)
	}

	private parse_operator_node(start: number, end: number): number | null {
		// Only create operator nodes for specific delimiters: + - * /
		let ch = this.source.charCodeAt(start)
		if (ch === CHAR_PLUS || ch === CHAR_MINUS_HYPHEN || ch === CHAR_ASTERISK || ch === CHAR_FORWARD_SLASH) {
			return this.create_operator_node(start, end)
		}
		// Other delimiters are ignored for now
		return null
	}

	private parse_function_node(start: number, end: number): number {
		// Function name is everything before the '('
		// The lexer's TOKEN_FUNCTION includes the '(' at the end
		let name_end = end - 1 // Exclude the '('

		// Get function name to check for special handling
		let func_name_substr = this.source.substring(start, name_end)

		// Create URL or function node based on function name (length will be set later)
		let node = this.arena.create_node(
			str_equals('url', func_name_substr) ? URL : FUNCTION,
			start,
			0, // length unknown yet
			this.lexer.token_line,
			this.lexer.token_column,
		)
		this.arena.set_content_start_delta(node, 0)
		this.arena.set_content_length(node, name_end - start)

		// Special handling for url() and src() functions with unquoted content:
		// Don't parse contents to preserve URLs with dots, base64, inline SVGs, etc.
		// Users can extract the full URL from the function's text property
		// Note: Quoted urls like url("...") or url('...') parse normally
		if (str_equals('url', func_name_substr) || str_equals('src', func_name_substr)) {
			// Peek at the next token to see if it's a string
			// If it's a string, parse normally. Otherwise, skip parsing children.
			let save_pos = this.lexer.save_position()
			this.lexer.next_token_fast(false)

			// Skip whitespace
			while (this.is_whitespace_inline() && this.lexer.pos < this.value_end) {
				this.lexer.next_token_fast(false)
			}

			let first_token_type = this.lexer.token_type

			// Restore lexer position
			this.lexer.restore_position(save_pos)

			// If the first non-whitespace token is a string, parse normally
			if (first_token_type === TOKEN_STRING) {
				// Fall through to normal parsing below
			} else {
				// Unquoted URL - don't parse children
				// Note: We can't rely on value_end because URLs may contain semicolons
				// that confuse the declaration parser (e.g., data:image/png;base64,...)
				// So we consume tokens until we find the matching ')' regardless of value_end
				let paren_depth = 1
				let func_end = end
				let content_start = end // Position after 'url('
				let content_end = end

				// Just consume tokens until we find the matching ')'
				// Don't create child nodes
				while (paren_depth > 0) {
					this.lexer.next_token_fast(false)

					let token_type = this.lexer.token_type
					if (token_type === TOKEN_EOF) break

					// Track parentheses depth
					if (token_type === TOKEN_LEFT_PAREN || token_type === TOKEN_FUNCTION) {
						paren_depth++
					} else if (token_type === TOKEN_RIGHT_PAREN) {
						paren_depth--
						if (paren_depth === 0) {
							content_end = this.lexer.token_start // Position of ')'
							func_end = this.lexer.token_end
							break
						}
					}
				}

				// Set function total length (includes opening and closing parens)
				this.arena.set_length(node, func_end - start)

				// Set value to the content between parentheses (accessible via node.value)
				this.arena.set_value_start_delta(node, content_start - start)
				this.arena.set_value_length(node, content_end - content_start)

				return node
			}
		}

		// Parse function arguments (everything until matching ')')
		let args: number[] = []
		let paren_depth = 1
		let func_end = end
		let content_start = end // Position after function name and '('
		let content_end = end

		while (this.lexer.pos < this.value_end && paren_depth > 0) {
			this.lexer.next_token_fast(false)

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break
			if (this.lexer.token_start >= this.value_end) break

			// Check for closing paren
			// Note: We don't track paren_depth for TOKEN_LEFT_PAREN or TOKEN_FUNCTION here
			// because parse_value_node() will recursively handle them
			if (token_type === TOKEN_RIGHT_PAREN) {
				paren_depth--
				if (paren_depth === 0) {
					content_end = this.lexer.token_start // Position of ')'
					func_end = this.lexer.token_end
					break
				}
			}

			// Skip whitespace
			if (this.is_whitespace_inline()) continue

			// Parse argument node
			let arg_node = this.parse_value_node()
			if (arg_node !== null) {
				args.push(arg_node)
			}
		}

		// Set function total length
		this.arena.set_length(node, func_end - start)

		// Set value to the content between parentheses (accessible via node.value)
		this.arena.set_value_start_delta(node, content_start - start)
		this.arena.set_value_length(node, content_end - content_start)

		// Link arguments as children
		this.arena.append_children(node, args)

		return node
	}

	private parse_parenthesis_node(start: number, end: number): number {
		// Create parenthesis node (length will be set later)
		let node = this.arena.create_node(
			PARENTHESIS,
			start,
			0, // length unknown yet
			this.lexer.token_line,
			this.lexer.token_column,
		)

		// Parse parenthesized content (everything until matching ')')
		let children: number[] = []
		let paren_depth = 1
		let paren_end = end

		while (this.lexer.pos < this.value_end && paren_depth > 0) {
			this.lexer.next_token_fast(false)

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break
			if (this.lexer.token_start >= this.value_end) break

			// Check for closing paren BEFORE parsing child nodes
			// This is important because child nodes (like nested parentheses or functions)
			// will consume tokens including closing parens
			if (token_type === TOKEN_RIGHT_PAREN) {
				paren_depth--
				if (paren_depth === 0) {
					paren_end = this.lexer.token_end
					break
				}
			}

			// Skip whitespace
			if (this.is_whitespace_inline()) continue

			// Parse child node
			// Note: We don't track paren_depth for LEFT_PAREN or TOKEN_FUNCTION here
			// because parse_value_node() will recursively handle them
			let child_node = this.parse_value_node()
			if (child_node !== null) {
				children.push(child_node)
			}
		}

		// Set parenthesis total length (includes opening and closing parens)
		this.arena.set_length(node, paren_end - start)

		// Link children as siblings
		this.arena.append_children(node, children)

		return node
	}
}

/**
 * Parse a CSS declaration value string and return an array of value AST nodes
 * @param value_string - The CSS value to parse (e.g., "1px solid red")
 * @returns An array of CSSNode objects representing the parsed value
 */
export function parse_value(value_string: string): CSSNode[] {
	// Create an arena for the value nodes
	const arena = new CSSDataArena(CSSDataArena.capacity_for_source(value_string.length))

	// Create value parser
	const value_parser = new ValueParser(arena, value_string)

	// Parse the entire source as a value (starting at line 1, column 1)
	const node_indices = value_parser.parse_value(0, value_string.length, 1, 1)

	// Wrap each node index in a CSSNode
	return node_indices.map((index) => new CSSNode(arena, value_string, index))
}
