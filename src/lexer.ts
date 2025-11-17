import { is_digit, is_hex_digit, is_ident_start, is_ident_char, is_whitespace, is_newline } from './char-types'
import {
	TOKEN_IDENT,
	TOKEN_FUNCTION,
	TOKEN_AT_KEYWORD,
	TOKEN_HASH,
	TOKEN_STRING,
	TOKEN_BAD_STRING,
	TOKEN_DELIM,
	TOKEN_NUMBER,
	TOKEN_PERCENTAGE,
	TOKEN_DIMENSION,
	TOKEN_WHITESPACE,
	TOKEN_CDO,
	TOKEN_CDC,
	TOKEN_COLON,
	TOKEN_SEMICOLON,
	TOKEN_COMMA,
	TOKEN_LEFT_BRACKET,
	TOKEN_RIGHT_BRACKET,
	TOKEN_LEFT_PAREN,
	TOKEN_RIGHT_PAREN,
	TOKEN_LEFT_BRACE,
	TOKEN_RIGHT_BRACE,
	TOKEN_COMMENT,
	TOKEN_EOF,
	type Token,
	type TokenType,
} from './token-types'

// Character code constants for lexer
const CHAR_LEFT_BRACE = 0x7b // {
const CHAR_RIGHT_BRACE = 0x7d // }
const CHAR_COLON = 0x3a // :
const CHAR_SEMICOLON = 0x3b // ;
const CHAR_COMMA = 0x2c // ,
const CHAR_LEFT_BRACKET = 0x5b // [
const CHAR_RIGHT_BRACKET = 0x5d // ]
const CHAR_LEFT_PAREN = 0x28 // (
const CHAR_RIGHT_PAREN = 0x29 // )
const CHAR_FORWARD_SLASH = 0x2f // /
const CHAR_ASTERISK = 0x2a // *
const CHAR_DOUBLE_QUOTE = 0x22 // "
const CHAR_SINGLE_QUOTE = 0x27 // '
const CHAR_DOT = 0x2e // .
const CHAR_LESS_THAN = 0x3c // <
const CHAR_EXCLAMATION = 0x21 // !
const CHAR_HYPHEN = 0x2d // -
const CHAR_GREATER_THAN = 0x3e // >
const CHAR_AT_SIGN = 0x40 // @
const CHAR_HASH = 0x23 // #
const CHAR_BACKSLASH = 0x5c // \
const CHAR_PLUS = 0x2b // +
const CHAR_PERCENT = 0x25 // %
const CHAR_LOWERCASE_E = 0x65 // e
const CHAR_UPPERCASE_E = 0x45 // E
const CHAR_CARRIAGE_RETURN = 0x0d // \r
const CHAR_LINE_FEED = 0x0a // \n

export class Lexer {
	source: string
	pos: number
	line: number
	column: number
	skip_comments: boolean
	// Current token properties (avoiding object allocation)
	token_type: TokenType
	token_start: number
	token_end: number
	token_line: number
	token_column: number

	constructor(source: string, skip_comments: boolean = false) {
		this.source = source
		this.pos = 0
		this.line = 1
		this.column = 1
		this.skip_comments = skip_comments
		this.token_type = TOKEN_EOF
		this.token_start = 0
		this.token_end = 0
		this.token_line = 1
		this.token_column = 1
	}

	// Fast token advancing without object allocation (for internal parser use)
	next_token_fast(skip_whitespace: boolean = false): TokenType {
		// Fast path: skip whitespace if requested
		if (skip_whitespace) {
			while (this.pos < this.source.length) {
				let ch = this.source.charCodeAt(this.pos)
				if (!is_whitespace(ch) && !is_newline(ch)) break
				this.advance()
			}
		}

		if (this.pos >= this.source.length) {
			return this.make_token(TOKEN_EOF, this.pos, this.pos)
		}

		let ch = this.source.charCodeAt(this.pos)
		let start = this.pos
		let start_line = this.line
		let start_column = this.column

		// Fast path for single-character tokens
		if (ch === CHAR_LEFT_BRACE) {
			this.advance()
			return this.make_token(TOKEN_LEFT_BRACE, start, this.pos, start_line, start_column)
		}
		if (ch === CHAR_RIGHT_BRACE) {
			this.advance()
			return this.make_token(TOKEN_RIGHT_BRACE, start, this.pos, start_line, start_column)
		}
		if (ch === CHAR_COLON) {
			this.advance()
			return this.make_token(TOKEN_COLON, start, this.pos, start_line, start_column)
		}
		if (ch === CHAR_SEMICOLON) {
			this.advance()
			return this.make_token(TOKEN_SEMICOLON, start, this.pos, start_line, start_column)
		}
		if (ch === CHAR_COMMA) {
			this.advance()
			return this.make_token(TOKEN_COMMA, start, this.pos, start_line, start_column)
		}
		if (ch === CHAR_LEFT_BRACKET) {
			this.advance()
			return this.make_token(TOKEN_LEFT_BRACKET, start, this.pos, start_line, start_column)
		}
		if (ch === CHAR_RIGHT_BRACKET) {
			this.advance()
			return this.make_token(TOKEN_RIGHT_BRACKET, start, this.pos, start_line, start_column)
		}
		if (ch === CHAR_LEFT_PAREN) {
			this.advance()
			return this.make_token(TOKEN_LEFT_PAREN, start, this.pos, start_line, start_column)
		}
		if (ch === CHAR_RIGHT_PAREN) {
			this.advance()
			return this.make_token(TOKEN_RIGHT_PAREN, start, this.pos, start_line, start_column)
		}

		// Whitespace
		if (is_whitespace(ch) || is_newline(ch)) {
			return this.consume_whitespace(start_line, start_column)
		}

		// Comments: /* */
		if (ch === CHAR_FORWARD_SLASH && this.peek() === CHAR_ASTERISK) {
			if (this.skip_comments) {
				// Skip comment without creating token
				this.advance(2) // Skip /*
				while (this.pos < this.source.length - 1) {
					let ch = this.source.charCodeAt(this.pos)
					if (ch === CHAR_ASTERISK && this.source.charCodeAt(this.pos + 1) === CHAR_FORWARD_SLASH) {
						this.advance(2)
						break
					}
					this.advance()
				}
				// Recursively get next token
				return this.next_token_fast(skip_whitespace)
			}
			return this.consume_comment(start_line, start_column)
		}

		// Strings: " or '
		if (ch === CHAR_DOUBLE_QUOTE || ch === CHAR_SINGLE_QUOTE) {
			return this.consume_string(ch, start_line, start_column)
		}

		// Numbers: digit or . followed by digit
		if (is_digit(ch)) {
			return this.consume_number(start_line, start_column)
		}
		if (ch === CHAR_DOT && is_digit(this.peek())) {
			return this.consume_number(start_line, start_column)
		}

		// CDO: <!--
		if (ch === CHAR_LESS_THAN && this.pos + 3 < this.source.length) {
			if (this.source.charCodeAt(this.pos + 1) === CHAR_EXCLAMATION &&
				this.source.charCodeAt(this.pos + 2) === CHAR_HYPHEN &&
				this.source.charCodeAt(this.pos + 3) === CHAR_HYPHEN) {
				this.advance(4)
				return this.make_token(TOKEN_CDO, start, this.pos, start_line, start_column)
			}
		}

		// CDC: -->
		if (ch === CHAR_HYPHEN && this.pos + 2 < this.source.length) {
			if (this.source.charCodeAt(this.pos + 1) === CHAR_HYPHEN &&
				this.source.charCodeAt(this.pos + 2) === CHAR_GREATER_THAN) {
				this.advance(3)
				return this.make_token(TOKEN_CDC, start, this.pos, start_line, start_column)
			}
		}

		// At-keyword: @media, @keyframes, etc
		if (ch === CHAR_AT_SIGN) {
			return this.consume_at_keyword(start_line, start_column)
		}

		// Hash: #id or #fff
		if (ch === CHAR_HASH) {
			return this.consume_hash(start_line, start_column)
		}

		// Identifier or function
		if (is_ident_start(ch)) {
			return this.consume_ident_or_function(start_line, start_column)
		}
		if (ch === CHAR_HYPHEN) {
			let next = this.peek()
			if (is_ident_start(next) || next === CHAR_HYPHEN) {
				// - followed by ident start (e.g., -webkit-) or -- for CSS custom properties
				return this.consume_ident_or_function(start_line, start_column)
			}
		}

		// Backslash: escape sequence starting an identifier
		if (ch === CHAR_BACKSLASH) {
			let next = this.peek()
			// Valid escape if not followed by newline or EOF
			if (next !== 0 && !is_newline(next)) {
				return this.consume_ident_or_function(start_line, start_column)
			}
		}

		// Hyphen/Plus: could be signed number like -5 or +5
		if (ch === CHAR_HYPHEN || ch === CHAR_PLUS) {
			let next = this.peek()
			if (is_digit(next) || (next === CHAR_DOT && is_digit(this.peek(2)))) {
				return this.consume_number(start_line, start_column)
			}
		}

		// Default: delimiter
		this.advance()
		return this.make_token(TOKEN_DELIM, start, this.pos, start_line, start_column)
	}

	consume_whitespace(start_line: number, start_column: number): TokenType {
		let start = this.pos
		while (this.pos < this.source.length) {
			let ch = this.source.charCodeAt(this.pos)
			if (!is_whitespace(ch) && !is_newline(ch)) break
			this.advance()
		}
		return this.make_token(TOKEN_WHITESPACE, start, this.pos, start_line, start_column)
	}

	consume_comment(start_line: number, start_column: number): TokenType {
		let start = this.pos
		this.advance(2) // Skip /*

		while (this.pos < this.source.length - 1) {
			let ch = this.source.charCodeAt(this.pos)
			if (ch === CHAR_ASTERISK && this.source.charCodeAt(this.pos + 1) === CHAR_FORWARD_SLASH) {
				this.advance(2)
				break
			}
			this.advance()
		}

		return this.make_token(TOKEN_COMMENT, start, this.pos, start_line, start_column)
	}

	consume_string(quote: number, start_line: number, start_column: number): TokenType {
		let start = this.pos
		this.advance() // Skip opening quote

		while (this.pos < this.source.length) {
			let ch = this.source.charCodeAt(this.pos)

			// Closing quote
			if (ch === quote) {
				this.advance()
				return this.make_token(TOKEN_STRING, start, this.pos, start_line, start_column)
			}

			// Newline: unclosed string
			if (is_newline(ch)) {
				return this.make_token(TOKEN_BAD_STRING, start, this.pos, start_line, start_column)
			}

			// Escape sequence
			if (ch === CHAR_BACKSLASH) {
				this.advance()
				if (this.pos < this.source.length) {
					let next = this.source.charCodeAt(this.pos)
					// Hex escape: \20 or \000020
					if (is_hex_digit(next)) {
						this.consume_hex_escape()
					} else if (!is_newline(next)) {
						this.advance()
					} else {
						// Escaped newline: skip it
						this.advance()
					}
				}
				continue
			}

			this.advance()
		}

		// EOF: unclosed string
		return this.make_token(TOKEN_BAD_STRING, start, this.pos, start_line, start_column)
	}

	consume_hex_escape(): void {
		// Consume up to 6 hex digits
		let count = 0
		while (count < 6 && this.pos < this.source.length) {
			let ch = this.source.charCodeAt(this.pos)
			if (!is_hex_digit(ch)) break
			this.advance()
			count++
		}
		// Optional whitespace after hex escape
		if (this.pos < this.source.length) {
			let ch = this.source.charCodeAt(this.pos)
			if (is_whitespace(ch) || is_newline(ch)) {
				this.advance()
			}
		}
	}

	consume_number(start_line: number, start_column: number): TokenType {
		let start = this.pos

		// Optional sign
		let ch = this.source.charCodeAt(this.pos)
		if (ch === CHAR_PLUS || ch === CHAR_HYPHEN) {
			this.advance()
		}

		// Integer part
		while (this.pos < this.source.length && is_digit(this.source.charCodeAt(this.pos))) {
			this.advance()
		}

		// Decimal part
		if (
			this.pos < this.source.length &&
			this.source.charCodeAt(this.pos) === CHAR_DOT &&
			this.pos + 1 < this.source.length &&
			is_digit(this.source.charCodeAt(this.pos + 1))
		) {
			this.advance() // .
			while (this.pos < this.source.length && is_digit(this.source.charCodeAt(this.pos))) {
				this.advance()
			}
		}

		// Exponent: e or E
		if (this.pos < this.source.length) {
			let ch = this.source.charCodeAt(this.pos)
			if (ch === CHAR_LOWERCASE_E || ch === CHAR_UPPERCASE_E) {
				let next = this.peek()
				if (is_digit(next) || ((next === CHAR_PLUS || next === CHAR_HYPHEN) && is_digit(this.peek(2)))) {
					this.advance() // e or E
					if (this.pos < this.source.length) {
						let sign = this.source.charCodeAt(this.pos)
						if (sign === CHAR_PLUS || sign === CHAR_HYPHEN) {
							this.advance() // + or -
						}
					}
					while (this.pos < this.source.length && is_digit(this.source.charCodeAt(this.pos))) {
						this.advance()
					}
				}
			}
		}

		// Check for unit (dimension) or percentage
		if (this.pos < this.source.length) {
			let ch = this.source.charCodeAt(this.pos)
			if (ch === CHAR_PERCENT) {
				this.advance()
				return this.make_token(TOKEN_PERCENTAGE, start, this.pos, start_line, start_column)
			}
			if (is_ident_start(ch) || (ch === CHAR_HYPHEN && is_ident_start(this.peek()))) {
				// Unit: px, em, rem, etc
				while (this.pos < this.source.length && is_ident_char(this.source.charCodeAt(this.pos))) {
					this.advance()
				}
				return this.make_token(TOKEN_DIMENSION, start, this.pos, start_line, start_column)
			}
		}

		return this.make_token(TOKEN_NUMBER, start, this.pos, start_line, start_column)
	}

	consume_ident_or_function(start_line: number, start_column: number): TokenType {
		let start = this.pos

		// Consume identifier (with escape sequence support)
		while (this.pos < this.source.length) {
			let ch = this.source.charCodeAt(this.pos)

			// Handle escape sequences: \ followed by hex digits or any character
			if (ch === CHAR_BACKSLASH) {
				// Check what follows the backslash before consuming it
				if (this.pos + 1 >= this.source.length) break

				let next = this.source.charCodeAt(this.pos + 1)

				// If followed by newline, it's invalid, stop without consuming backslash
				if (is_newline(next)) break

				this.advance() // consume \

				// Consume hex escape: 1-6 hex digits
				if (is_hex_digit(next)) {
					this.advance() // consume first hex digit
					// Consume up to 5 more hex digits (total 6)
					for (let i = 0; i < 5 && this.pos < this.source.length; i++) {
						if (!is_hex_digit(this.source.charCodeAt(this.pos))) break
						this.advance()
					}
					// Consume optional whitespace after hex escape
					if (this.pos < this.source.length) {
						let ws = this.source.charCodeAt(this.pos)
						if (is_whitespace(ws) || is_newline(ws)) {
							this.advance()
						}
					}
				} else {
					// Escape any other character (except newline, already checked)
					this.advance()
				}
			} else if (is_ident_char(ch)) {
				// Normal identifier character
				this.advance()
			} else {
				// Not part of identifier
				break
			}
		}

		// Check for function: ident(
		if (this.pos < this.source.length && this.source.charCodeAt(this.pos) === CHAR_LEFT_PAREN) {
			this.advance()
			return this.make_token(TOKEN_FUNCTION, start, this.pos, start_line, start_column)
		}

		return this.make_token(TOKEN_IDENT, start, this.pos, start_line, start_column)
	}

	consume_at_keyword(start_line: number, start_column: number): TokenType {
		let start = this.pos
		this.advance() // Skip @

		// Consume identifier
		while (this.pos < this.source.length && is_ident_char(this.source.charCodeAt(this.pos))) {
			this.advance()
		}

		return this.make_token(TOKEN_AT_KEYWORD, start, this.pos, start_line, start_column)
	}

	consume_hash(start_line: number, start_column: number): TokenType {
		let start = this.pos
		this.advance() // Skip #

		// Consume identifier or hex digits
		while (this.pos < this.source.length && is_ident_char(this.source.charCodeAt(this.pos))) {
			this.advance()
		}

		return this.make_token(TOKEN_HASH, start, this.pos, start_line, start_column)
	}

	advance(count: number = 1): void {
		// Fast path for advance(1) - most common case
		if (count === 1) {
			if (this.pos >= this.source.length) return

			let ch = this.source.charCodeAt(this.pos)
			this.pos++

			if (is_newline(ch)) {
				// Handle \r\n as single newline
				if (ch === CHAR_CARRIAGE_RETURN && this.pos < this.source.length && this.source.charCodeAt(this.pos) === CHAR_LINE_FEED) {
					this.pos++
				}
				this.line++
				this.column = 1
			} else {
				this.column++
			}
			return
		}

		// General case for count > 1
		for (let i = 0; i < count; i++) {
			if (this.pos >= this.source.length) break

			let ch = this.source.charCodeAt(this.pos)
			this.pos++

			if (is_newline(ch)) {
				// Handle \r\n as single newline
				if (ch === CHAR_CARRIAGE_RETURN && this.pos < this.source.length && this.source.charCodeAt(this.pos) === CHAR_LINE_FEED) {
					this.pos++
					i++ // Count \r\n as 2 characters for advance(count)
				}
				this.line++
				this.column = 1
			} else {
				this.column++
			}
		}
	}

	peek(offset: number = 1): number {
		let index = this.pos + offset
		if (index >= this.source.length) return 0
		return this.source.charCodeAt(index)
	}

	make_token(type: TokenType, start: number, end: number, line: number = this.line, column: number = this.column): TokenType {
		this.token_type = type
		this.token_start = start
		this.token_end = end
		this.token_line = line
		this.token_column = column
		return type
	}

	// Public API: returns Token object for backwards compatibility
	next_token(skip_whitespace: boolean = false): Token | null {
		this.next_token_fast(skip_whitespace)
		return {
			type: this.token_type,
			start: this.token_start,
			end: this.token_end,
			line: this.token_line,
			column: this.token_column,
		}
	}
}
