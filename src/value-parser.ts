// Value Parser - Parses CSS declaration values into structured AST nodes
import { Lexer } from './lexer'
import type { CSSDataArena } from './arena'
import {
	NODE_VALUE_KEYWORD,
	NODE_VALUE_NUMBER,
	NODE_VALUE_DIMENSION,
	NODE_VALUE_STRING,
	NODE_VALUE_COLOR,
	NODE_VALUE_FUNCTION,
	NODE_VALUE_OPERATOR,
} from './arena'
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
import { is_whitespace, CHAR_MINUS_HYPHEN, CHAR_PLUS, CHAR_ASTERISK, CHAR_FORWARD_SLASH } from './string-utils'

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

	// Parse a declaration value range into value nodes
	// Returns array of value node indices
	parse_value(start: number, end: number): number[] {
		this.value_end = end

		// Position lexer at value start
		this.lexer.pos = start
		this.lexer.line = 1

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
			if (this.is_whitespace_token()) {
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

	private is_whitespace_token(): boolean {
		// Whitespace is implicit between tokens, we don't create nodes for it
		let start = this.lexer.token_start
		let end = this.lexer.token_end
		if (start >= end) return false

		// Check if all characters are whitespace
		for (let i = start; i < end; i++) {
			let ch = this.source.charCodeAt(i)
			if (!is_whitespace(ch)) {
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
				return this.create_node(NODE_VALUE_KEYWORD, start, end)

			case TOKEN_NUMBER:
				return this.create_node(NODE_VALUE_NUMBER, start, end)

			case TOKEN_PERCENTAGE:
			case TOKEN_DIMENSION:
				return this.create_node(NODE_VALUE_DIMENSION, start, end)

			case TOKEN_STRING:
				return this.create_node(NODE_VALUE_STRING, start, end)

			case TOKEN_HASH:
				return this.create_node(NODE_VALUE_COLOR, start, end)

			case TOKEN_FUNCTION:
				return this.parse_function_node(start, end)

			case TOKEN_DELIM:
				return this.parse_operator_node(start, end)

			case TOKEN_COMMA:
				return this.create_node(NODE_VALUE_OPERATOR, start, end)

			default:
				// Unknown token type, skip it
				return null
		}
	}

	private create_node(node_type: number, start: number, end: number): number {
		let node = this.arena.create_node()
		this.arena.set_type(node, node_type)
		this.arena.set_start_offset(node, start)
		this.arena.set_length(node, end - start)
		this.arena.set_content_start(node, start)
		this.arena.set_content_length(node, end - start)
		return node
	}

	private create_operator_node(start: number, end: number): number {
		return this.create_node(NODE_VALUE_OPERATOR, start, end)
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
		// Create function node
		let node = this.arena.create_node()
		this.arena.set_type(node, NODE_VALUE_FUNCTION)
		this.arena.set_start_offset(node, start)

		// Function name is everything before the '('
		// The lexer's TOKEN_FUNCTION includes the '(' at the end
		let name_end = end - 1 // Exclude the '('
		this.arena.set_content_start(node, start)
		this.arena.set_content_length(node, name_end - start)

		// Parse function arguments (everything until matching ')')
		let args: number[] = []
		let paren_depth = 1
		let func_end = end

		while (this.lexer.pos < this.value_end && paren_depth > 0) {
			this.lexer.next_token_fast(false)

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break
			if (this.lexer.token_start >= this.value_end) break

			// Track parentheses depth
			if (token_type === TOKEN_LEFT_PAREN || token_type === TOKEN_FUNCTION) {
				paren_depth++
			} else if (token_type === TOKEN_RIGHT_PAREN) {
				paren_depth--
				if (paren_depth === 0) {
					func_end = this.lexer.token_end
					break
				}
			}

			// Skip whitespace
			if (this.is_whitespace_token()) continue

			// Parse argument node
			let arg_node = this.parse_value_node()
			if (arg_node !== null) {
				args.push(arg_node)
			}
		}

		// Set function total length
		this.arena.set_length(node, func_end - start)

		// Link arguments as children
		if (args.length > 0) {
			this.arena.set_first_child(node, args[0])
			this.arena.set_last_child(node, args[args.length - 1])

			// Chain arguments as siblings
			for (let i = 0; i < args.length - 1; i++) {
				this.arena.set_next_sibling(args[i], args[i + 1])
			}
		}

		return node
	}
}
