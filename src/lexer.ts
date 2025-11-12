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

export class Lexer {
	source: string
	pos: number
	line: number
	column: number

	constructor(source: string) {
		this.source = source
		this.pos = 0
		this.line = 1
		this.column = 1
	}

	next_token(): Token | null {
		if (this.pos >= this.source.length) {
			return this.make_token(TOKEN_EOF, this.pos, this.pos)
		}

		let ch = this.source.charCodeAt(this.pos)
		let start = this.pos
		let start_line = this.line
		let start_column = this.column

		// Fast path for single-character tokens
		if (ch === 0x7b) {
			// {
			this.advance()
			return this.make_token(TOKEN_LEFT_BRACE, start, this.pos, start_line, start_column)
		}
		if (ch === 0x7d) {
			// }
			this.advance()
			return this.make_token(TOKEN_RIGHT_BRACE, start, this.pos, start_line, start_column)
		}
		if (ch === 0x3a) {
			// :
			this.advance()
			return this.make_token(TOKEN_COLON, start, this.pos, start_line, start_column)
		}
		if (ch === 0x3b) {
			// ;
			this.advance()
			return this.make_token(TOKEN_SEMICOLON, start, this.pos, start_line, start_column)
		}
		if (ch === 0x2c) {
			// ,
			this.advance()
			return this.make_token(TOKEN_COMMA, start, this.pos, start_line, start_column)
		}
		if (ch === 0x5b) {
			// [
			this.advance()
			return this.make_token(TOKEN_LEFT_BRACKET, start, this.pos, start_line, start_column)
		}
		if (ch === 0x5d) {
			// ]
			this.advance()
			return this.make_token(TOKEN_RIGHT_BRACKET, start, this.pos, start_line, start_column)
		}
		if (ch === 0x28) {
			// (
			this.advance()
			return this.make_token(TOKEN_LEFT_PAREN, start, this.pos, start_line, start_column)
		}
		if (ch === 0x29) {
			// )
			this.advance()
			return this.make_token(TOKEN_RIGHT_PAREN, start, this.pos, start_line, start_column)
		}

		// Whitespace
		if (is_whitespace(ch) || is_newline(ch)) {
			return this.consume_whitespace(start_line, start_column)
		}

		// Comments: /* */
		if (ch === 0x2f && this.peek() === 0x2a) {
			// /*
			return this.consume_comment(start_line, start_column)
		}

		// Strings: " or '
		if (ch === 0x22 || ch === 0x27) {
			// " or '
			return this.consume_string(ch, start_line, start_column)
		}

		// Numbers: digit or . followed by digit
		if (is_digit(ch)) {
			return this.consume_number(start_line, start_column)
		}
		if (ch === 0x2e && is_digit(this.peek())) {
			// .
			return this.consume_number(start_line, start_column)
		}

		// CDO: <!--
		if (ch === 0x3c && this.peek() === 0x21 && this.peek(2) === 0x2d && this.peek(3) === 0x2d) {
			this.advance(4)
			return this.make_token(TOKEN_CDO, start, this.pos, start_line, start_column)
		}

		// CDC: -->
		if (ch === 0x2d && this.peek() === 0x2d && this.peek(2) === 0x3e) {
			this.advance(3)
			return this.make_token(TOKEN_CDC, start, this.pos, start_line, start_column)
		}

		// At-keyword: @media, @keyframes, etc
		if (ch === 0x40) {
			// @
			return this.consume_at_keyword(start_line, start_column)
		}

		// Hash: #id or #fff
		if (ch === 0x23) {
			// #
			return this.consume_hash(start_line, start_column)
		}

		// Identifier or function
		if (is_ident_start(ch) || (ch === 0x2d && is_ident_start(this.peek())) || (ch === 0x2d && this.peek() === 0x2d)) {
			// - followed by ident start (e.g., -webkit-) or -- for CSS custom properties
			return this.consume_ident_or_function(start_line, start_column)
		}

		// Backslash: escape sequence starting an identifier
		if (ch === 0x5c) {
			// \
			let next = this.peek()
			// Valid escape if not followed by newline or EOF
			if (next !== 0 && !is_newline(next)) {
				return this.consume_ident_or_function(start_line, start_column)
			}
		}

		// Hyphen-minus: could be number like -5 or identifier like -webkit-
		if (ch === 0x2d) {
			// -
			const next = this.peek()
			if (is_digit(next) || (next === 0x2e && is_digit(this.peek(2)))) {
				return this.consume_number(start_line, start_column)
			}
		}

		// Plus: could be number like +5
		if (ch === 0x2b) {
			// +
			const next = this.peek()
			if (is_digit(next) || (next === 0x2e && is_digit(this.peek(2)))) {
				return this.consume_number(start_line, start_column)
			}
		}

		// Default: delimiter
		this.advance()
		return this.make_token(TOKEN_DELIM, start, this.pos, start_line, start_column)
	}

	consume_whitespace(start_line: number, start_column: number): Token {
		let start = this.pos
		while (this.pos < this.source.length) {
			let ch = this.source.charCodeAt(this.pos)
			if (!is_whitespace(ch) && !is_newline(ch)) break
			this.advance()
		}
		return this.make_token(TOKEN_WHITESPACE, start, this.pos, start_line, start_column)
	}

	consume_comment(start_line: number, start_column: number): Token {
		let start = this.pos
		this.advance(2) // Skip /*

		while (this.pos < this.source.length - 1) {
			if (this.source.charCodeAt(this.pos) === 0x2a && this.source.charCodeAt(this.pos + 1) === 0x2f) {
				// */
				this.advance(2)
				break
			}
			this.advance()
		}

		return this.make_token(TOKEN_COMMENT, start, this.pos, start_line, start_column)
	}

	consume_string(quote: number, start_line: number, start_column: number): Token {
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
			if (ch === 0x5c) {
				// \
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
		let ch = this.source.charCodeAt(this.pos)
		if (is_whitespace(ch) || is_newline(ch)) {
			this.advance()
		}
	}

	consume_number(start_line: number, start_column: number): Token {
		let start = this.pos

		// Optional sign
		let ch = this.source.charCodeAt(this.pos)
		if (ch === 0x2b || ch === 0x2d) {
			// + or -
			this.advance()
		}

		// Integer part
		while (this.pos < this.source.length && is_digit(this.source.charCodeAt(this.pos))) {
			this.advance()
		}

		// Decimal part
		if (
			this.pos < this.source.length &&
			this.source.charCodeAt(this.pos) === 0x2e &&
			this.pos + 1 < this.source.length &&
			is_digit(this.source.charCodeAt(this.pos + 1))
		) {
			this.advance() // .
			while (this.pos < this.source.length && is_digit(this.source.charCodeAt(this.pos))) {
				this.advance()
			}
		}

		// Exponent: e or E
		if (this.pos < this.source.length && (this.source.charCodeAt(this.pos) === 0x65 || this.source.charCodeAt(this.pos) === 0x45)) {
			let next = this.peek()
			if (is_digit(next) || ((next === 0x2b || next === 0x2d) && is_digit(this.peek(2)))) {
				this.advance() // e or E
				if (this.source.charCodeAt(this.pos) === 0x2b || this.source.charCodeAt(this.pos) === 0x2d) {
					this.advance() // + or -
				}
				while (this.pos < this.source.length && is_digit(this.source.charCodeAt(this.pos))) {
					this.advance()
				}
			}
		}

		// Check for unit (dimension) or percentage
		if (this.pos < this.source.length) {
			let ch = this.source.charCodeAt(this.pos)
			if (ch === 0x25) {
				// %
				this.advance()
				return this.make_token(TOKEN_PERCENTAGE, start, this.pos, start_line, start_column)
			}
			if (is_ident_start(ch) || (ch === 0x2d && is_ident_start(this.peek()))) {
				// Unit: px, em, rem, etc
				while (this.pos < this.source.length && is_ident_char(this.source.charCodeAt(this.pos))) {
					this.advance()
				}
				return this.make_token(TOKEN_DIMENSION, start, this.pos, start_line, start_column)
			}
		}

		return this.make_token(TOKEN_NUMBER, start, this.pos, start_line, start_column)
	}

	consume_ident_or_function(start_line: number, start_column: number): Token {
		let start = this.pos

		// Consume identifier (with escape sequence support)
		while (this.pos < this.source.length) {
			let ch = this.source.charCodeAt(this.pos)

			// Handle escape sequences: \ followed by hex digits or any character
			if (ch === 0x5c) {
				// \
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
		if (this.pos < this.source.length && this.source.charCodeAt(this.pos) === 0x28) {
			// (
			this.advance()
			return this.make_token(TOKEN_FUNCTION, start, this.pos, start_line, start_column)
		}

		return this.make_token(TOKEN_IDENT, start, this.pos, start_line, start_column)
	}

	consume_at_keyword(start_line: number, start_column: number): Token {
		let start = this.pos
		this.advance() // Skip @

		// Consume identifier
		while (this.pos < this.source.length && is_ident_char(this.source.charCodeAt(this.pos))) {
			this.advance()
		}

		return this.make_token(TOKEN_AT_KEYWORD, start, this.pos, start_line, start_column)
	}

	consume_hash(start_line: number, start_column: number): Token {
		let start = this.pos
		this.advance() // Skip #

		// Consume identifier or hex digits
		while (this.pos < this.source.length && is_ident_char(this.source.charCodeAt(this.pos))) {
			this.advance()
		}

		return this.make_token(TOKEN_HASH, start, this.pos, start_line, start_column)
	}

	advance(count: number = 1): void {
		for (let i = 0; i < count; i++) {
			if (this.pos >= this.source.length) break

			let ch = this.source.charCodeAt(this.pos)
			this.pos++

			if (is_newline(ch)) {
				// Handle \r\n as single newline
				if (ch === 0x0d && this.pos < this.source.length && this.source.charCodeAt(this.pos) === 0x0a) {
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

	make_token(type: TokenType, start: number, end: number, line: number = this.line, column: number = this.column): Token {
		return { type, start, end, line, column }
	}
}
