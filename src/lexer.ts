import { isDigit, isHexDigit, isIdentStart, isIdentChar, isWhitespace, isNewline } from './char-types'
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

	nextToken(): Token | null {
		if (this.pos >= this.source.length) {
			return this.makeToken(TOKEN_EOF, this.pos, this.pos)
		}

		const ch = this.source.charCodeAt(this.pos)
		const start = this.pos
		const start_line = this.line
		const start_column = this.column

		// Fast path for single-character tokens
		if (ch === 0x7b) {
			// {
			this.advance()
			return this.makeToken(TOKEN_LEFT_BRACE, start, this.pos, start_line, start_column)
		}
		if (ch === 0x7d) {
			// }
			this.advance()
			return this.makeToken(TOKEN_RIGHT_BRACE, start, this.pos, start_line, start_column)
		}
		if (ch === 0x3a) {
			// :
			this.advance()
			return this.makeToken(TOKEN_COLON, start, this.pos, start_line, start_column)
		}
		if (ch === 0x3b) {
			// ;
			this.advance()
			return this.makeToken(TOKEN_SEMICOLON, start, this.pos, start_line, start_column)
		}
		if (ch === 0x2c) {
			// ,
			this.advance()
			return this.makeToken(TOKEN_COMMA, start, this.pos, start_line, start_column)
		}
		if (ch === 0x5b) {
			// [
			this.advance()
			return this.makeToken(TOKEN_LEFT_BRACKET, start, this.pos, start_line, start_column)
		}
		if (ch === 0x5d) {
			// ]
			this.advance()
			return this.makeToken(TOKEN_RIGHT_BRACKET, start, this.pos, start_line, start_column)
		}
		if (ch === 0x28) {
			// (
			this.advance()
			return this.makeToken(TOKEN_LEFT_PAREN, start, this.pos, start_line, start_column)
		}
		if (ch === 0x29) {
			// )
			this.advance()
			return this.makeToken(TOKEN_RIGHT_PAREN, start, this.pos, start_line, start_column)
		}

		// Whitespace
		if (isWhitespace(ch) || isNewline(ch)) {
			return this.consumeWhitespace(start_line, start_column)
		}

		// Comments: /* */
		if (ch === 0x2f && this.peek() === 0x2a) {
			// /*
			return this.consumeComment(start_line, start_column)
		}

		// Strings: " or '
		if (ch === 0x22 || ch === 0x27) {
			// " or '
			return this.consumeString(ch, start_line, start_column)
		}

		// Numbers: digit or . followed by digit
		if (isDigit(ch)) {
			return this.consumeNumber(start_line, start_column)
		}
		if (ch === 0x2e && isDigit(this.peek())) {
			// .
			return this.consumeNumber(start_line, start_column)
		}

		// CDO: <!--
		if (ch === 0x3c && this.peek() === 0x21 && this.peek(2) === 0x2d && this.peek(3) === 0x2d) {
			this.advance(4)
			return this.makeToken(TOKEN_CDO, start, this.pos, start_line, start_column)
		}

		// CDC: -->
		if (ch === 0x2d && this.peek() === 0x2d && this.peek(2) === 0x3e) {
			this.advance(3)
			return this.makeToken(TOKEN_CDC, start, this.pos, start_line, start_column)
		}

		// At-keyword: @media, @keyframes, etc
		if (ch === 0x40) {
			// @
			return this.consumeAtKeyword(start_line, start_column)
		}

		// Hash: #id or #fff
		if (ch === 0x23) {
			// #
			return this.consumeHash(start_line, start_column)
		}

		// Identifier or function
		if (isIdentStart(ch) || (ch === 0x2d && isIdentStart(this.peek()))) {
			// - followed by ident start (e.g., -webkit-)
			return this.consumeIdentOrFunction(start_line, start_column)
		}

		// Hyphen-minus: could be number like -5 or identifier like -webkit-
		if (ch === 0x2d) {
			// -
			const next = this.peek()
			if (isDigit(next) || (next === 0x2e && isDigit(this.peek(2)))) {
				return this.consumeNumber(start_line, start_column)
			}
		}

		// Plus: could be number like +5
		if (ch === 0x2b) {
			// +
			const next = this.peek()
			if (isDigit(next) || (next === 0x2e && isDigit(this.peek(2)))) {
				return this.consumeNumber(start_line, start_column)
			}
		}

		// Default: delimiter
		this.advance()
		return this.makeToken(TOKEN_DELIM, start, this.pos, start_line, start_column)
	}

	consumeWhitespace(start_line: number, start_column: number): Token {
		const start = this.pos
		while (this.pos < this.source.length) {
			const ch = this.source.charCodeAt(this.pos)
			if (!isWhitespace(ch) && !isNewline(ch)) break
			this.advance()
		}
		return this.makeToken(TOKEN_WHITESPACE, start, this.pos, start_line, start_column)
	}

	consumeComment(start_line: number, start_column: number): Token {
		const start = this.pos
		this.advance(2) // Skip /*

		while (this.pos < this.source.length - 1) {
			if (this.source.charCodeAt(this.pos) === 0x2a && this.source.charCodeAt(this.pos + 1) === 0x2f) {
				// */
				this.advance(2)
				break
			}
			this.advance()
		}

		return this.makeToken(TOKEN_COMMENT, start, this.pos, start_line, start_column)
	}

	consumeString(quote: number, start_line: number, start_column: number): Token {
		const start = this.pos
		this.advance() // Skip opening quote

		while (this.pos < this.source.length) {
			const ch = this.source.charCodeAt(this.pos)

			// Closing quote
			if (ch === quote) {
				this.advance()
				return this.makeToken(TOKEN_STRING, start, this.pos, start_line, start_column)
			}

			// Newline: unclosed string
			if (isNewline(ch)) {
				return this.makeToken(TOKEN_BAD_STRING, start, this.pos, start_line, start_column)
			}

			// Escape sequence
			if (ch === 0x5c) {
				// \
				this.advance()
				if (this.pos < this.source.length) {
					const next = this.source.charCodeAt(this.pos)
					// Hex escape: \20 or \000020
					if (isHexDigit(next)) {
						this.consumeHexEscape()
					} else if (!isNewline(next)) {
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
		return this.makeToken(TOKEN_BAD_STRING, start, this.pos, start_line, start_column)
	}

	consumeHexEscape(): void {
		// Consume up to 6 hex digits
		let count = 0
		while (count < 6 && this.pos < this.source.length) {
			const ch = this.source.charCodeAt(this.pos)
			if (!isHexDigit(ch)) break
			this.advance()
			count++
		}
		// Optional whitespace after hex escape
		const ch = this.source.charCodeAt(this.pos)
		if (isWhitespace(ch) || isNewline(ch)) {
			this.advance()
		}
	}

	consumeNumber(start_line: number, start_column: number): Token {
		const start = this.pos

		// Optional sign
		const ch = this.source.charCodeAt(this.pos)
		if (ch === 0x2b || ch === 0x2d) {
			// + or -
			this.advance()
		}

		// Integer part
		while (this.pos < this.source.length && isDigit(this.source.charCodeAt(this.pos))) {
			this.advance()
		}

		// Decimal part
		if (
			this.pos < this.source.length &&
			this.source.charCodeAt(this.pos) === 0x2e &&
			this.pos + 1 < this.source.length &&
			isDigit(this.source.charCodeAt(this.pos + 1))
		) {
			this.advance() // .
			while (this.pos < this.source.length && isDigit(this.source.charCodeAt(this.pos))) {
				this.advance()
			}
		}

		// Exponent: e or E
		if (this.pos < this.source.length && (this.source.charCodeAt(this.pos) === 0x65 || this.source.charCodeAt(this.pos) === 0x45)) {
			const next = this.peek()
			if (isDigit(next) || ((next === 0x2b || next === 0x2d) && isDigit(this.peek(2)))) {
				this.advance() // e or E
				if (this.source.charCodeAt(this.pos) === 0x2b || this.source.charCodeAt(this.pos) === 0x2d) {
					this.advance() // + or -
				}
				while (this.pos < this.source.length && isDigit(this.source.charCodeAt(this.pos))) {
					this.advance()
				}
			}
		}

		// Check for unit (dimension) or percentage
		if (this.pos < this.source.length) {
			const ch = this.source.charCodeAt(this.pos)
			if (ch === 0x25) {
				// %
				this.advance()
				return this.makeToken(TOKEN_PERCENTAGE, start, this.pos, start_line, start_column)
			}
			if (isIdentStart(ch) || (ch === 0x2d && isIdentStart(this.peek()))) {
				// Unit: px, em, rem, etc
				while (this.pos < this.source.length && isIdentChar(this.source.charCodeAt(this.pos))) {
					this.advance()
				}
				return this.makeToken(TOKEN_DIMENSION, start, this.pos, start_line, start_column)
			}
		}

		return this.makeToken(TOKEN_NUMBER, start, this.pos, start_line, start_column)
	}

	consumeIdentOrFunction(start_line: number, start_column: number): Token {
		const start = this.pos

		// Consume identifier
		while (this.pos < this.source.length && isIdentChar(this.source.charCodeAt(this.pos))) {
			this.advance()
		}

		// Check for function: ident(
		if (this.pos < this.source.length && this.source.charCodeAt(this.pos) === 0x28) {
			// (
			this.advance()
			return this.makeToken(TOKEN_FUNCTION, start, this.pos, start_line, start_column)
		}

		return this.makeToken(TOKEN_IDENT, start, this.pos, start_line, start_column)
	}

	consumeAtKeyword(start_line: number, start_column: number): Token {
		const start = this.pos
		this.advance() // Skip @

		// Consume identifier
		while (this.pos < this.source.length && isIdentChar(this.source.charCodeAt(this.pos))) {
			this.advance()
		}

		return this.makeToken(TOKEN_AT_KEYWORD, start, this.pos, start_line, start_column)
	}

	consumeHash(start_line: number, start_column: number): Token {
		const start = this.pos
		this.advance() // Skip #

		// Consume identifier or hex digits
		while (this.pos < this.source.length && isIdentChar(this.source.charCodeAt(this.pos))) {
			this.advance()
		}

		return this.makeToken(TOKEN_HASH, start, this.pos, start_line, start_column)
	}

	advance(count: number = 1): void {
		for (let i = 0; i < count; i++) {
			if (this.pos >= this.source.length) break

			const ch = this.source.charCodeAt(this.pos)
			this.pos++

			if (isNewline(ch)) {
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
		const index = this.pos + offset
		if (index >= this.source.length) return 0
		return this.source.charCodeAt(index)
	}

	makeToken(type: TokenType, start: number, end: number, line: number = this.line, column: number = this.column): Token {
		return { type, start, end, line, column }
	}
}
