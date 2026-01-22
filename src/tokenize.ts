import {
	is_hex_digit,
	is_ident_start,
	is_ident_char,
	is_whitespace,
	is_newline,
	char_types,
	CHAR_DIGIT,
	CHAR_WHITESPACE,
	CHAR_NEWLINE,
} from './char-types'
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
	TOKEN_EOF,
	TOKEN_UNICODE_RANGE,
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
const CHAR_LOWERCASE_U = 0x75 // u
const CHAR_UPPERCASE_U = 0x55 // U
const CHAR_QUESTION_MARK = 0x3f // ?
const CHAR_CARRIAGE_RETURN = 0x0d // \r
const CHAR_LINE_FEED = 0x0a // \n

export interface LexerPosition {
	pos: number
	line: number
	column: number
	token_type: TokenType
	token_start: number
	token_end: number
	token_line: number
	token_column: number
}

export interface CommentInfo {
	start: number
	end: number
	length: number
	line: number
	column: number
}

/** @internal */
export class Lexer {
	source: string
	pos: number
	line: number
	column: number
	on_comment: ((info: CommentInfo) => void) | undefined
	// Current token properties (avoiding object allocation)
	token_type: TokenType
	token_start: number
	token_end: number
	token_line: number
	token_column: number

	constructor(source: string, on_comment?: (info: CommentInfo) => void) {
		this.source = source
		this.pos = 0
		this.line = 1
		this.column = 1
		this.on_comment = on_comment
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
				// Hot path: inline whitespace/newline check in tight loop
				if (ch >= 128 || (char_types[ch] & (CHAR_WHITESPACE | CHAR_NEWLINE)) === 0) break
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
		switch (ch) {
			case CHAR_LEFT_BRACE:
				this.advance()
				return this.make_token(TOKEN_LEFT_BRACE, start, this.pos, start_line, start_column)
			case CHAR_RIGHT_BRACE:
				this.advance()
				return this.make_token(TOKEN_RIGHT_BRACE, start, this.pos, start_line, start_column)
			case CHAR_COLON:
				this.advance()
				return this.make_token(TOKEN_COLON, start, this.pos, start_line, start_column)
			case CHAR_SEMICOLON:
				this.advance()
				return this.make_token(TOKEN_SEMICOLON, start, this.pos, start_line, start_column)
			case CHAR_COMMA:
				this.advance()
				return this.make_token(TOKEN_COMMA, start, this.pos, start_line, start_column)
			case CHAR_LEFT_BRACKET:
				this.advance()
				return this.make_token(TOKEN_LEFT_BRACKET, start, this.pos, start_line, start_column)
			case CHAR_RIGHT_BRACKET:
				this.advance()
				return this.make_token(TOKEN_RIGHT_BRACKET, start, this.pos, start_line, start_column)
			case CHAR_LEFT_PAREN:
				this.advance()
				return this.make_token(TOKEN_LEFT_PAREN, start, this.pos, start_line, start_column)
			case CHAR_RIGHT_PAREN:
				this.advance()
				return this.make_token(TOKEN_RIGHT_PAREN, start, this.pos, start_line, start_column)
		}

		// Whitespace
		// Hot path: inline whitespace/newline check
		if (ch < 128 && (char_types[ch] & (CHAR_WHITESPACE | CHAR_NEWLINE)) !== 0) {
			return this.consume_whitespace(start_line, start_column)
		}

		// Comments: /* */
		if (ch === CHAR_FORWARD_SLASH && this.peek() === CHAR_ASTERISK) {
			// Always skip comments, but call callback if provided
			let comment_start = start
			let comment_line = start_line
			let comment_column = start_column

			this.advance(2) // Skip /*
			while (this.pos < this.source.length - 1) {
				let ch = this.source.charCodeAt(this.pos)
				if (ch === CHAR_ASTERISK && this.peek() === CHAR_FORWARD_SLASH) {
					this.advance(2)
					break
				}
				this.advance()
			}

			let comment_end = this.pos

			// Call on_comment callback if provided
			if (this.on_comment) {
				this.on_comment({
					start: comment_start,
					end: comment_end,
					length: comment_end - comment_start,
					line: comment_line,
					column: comment_column,
				})
			}

			// Recursively get next token
			return this.next_token_fast(skip_whitespace)
		}

		// Strings: " or '
		if (ch === CHAR_DOUBLE_QUOTE || ch === CHAR_SINGLE_QUOTE) {
			return this.consume_string(ch, start_line, start_column)
		}

		// Numbers: digit or . followed by digit
		// Hot path: inline digit check to eliminate function call overhead
		if (ch < 128 && (char_types[ch] & CHAR_DIGIT) !== 0) {
			return this.consume_number(start_line, start_column)
		}

		// Hot path: inline digit check for decimal detection
		if (ch === CHAR_DOT) {
			let next = this.peek()
			if (next < 128 && (char_types[next] & CHAR_DIGIT) !== 0) {
				return this.consume_number(start_line, start_column)
			}
		}

		// CDO: <!--
		if (ch === CHAR_LESS_THAN && this.pos + 3 < this.source.length) {
			const p1 = this.peek(),
				p2 = this.peek(2),
				p3 = this.peek(3)
			if (p1 === CHAR_EXCLAMATION && p2 === CHAR_HYPHEN && p3 === CHAR_HYPHEN) {
				this.advance(4)
				return this.make_token(TOKEN_CDO, start, this.pos, start_line, start_column)
			}
		}

		// CDC: -->
		if (ch === CHAR_HYPHEN && this.pos + 2 < this.source.length) {
			const p1 = this.peek(),
				p2 = this.peek(2)
			if (p1 === CHAR_HYPHEN && p2 === CHAR_GREATER_THAN) {
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
			// Hot path: inline digit checks for signed number detection
			let is_next_digit = next < 128 && (char_types[next] & CHAR_DIGIT) !== 0
			if (is_next_digit) {
				return this.consume_number(start_line, start_column)
			}
			if (next === CHAR_DOT) {
				let next2 = this.peek(2)
				if (next2 < 128 && (char_types[next2] & CHAR_DIGIT) !== 0) {
					return this.consume_number(start_line, start_column)
				}
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
			// Hot path: inline whitespace/newline check in tight loop
			if (ch >= 128 || (char_types[ch] & (CHAR_WHITESPACE | CHAR_NEWLINE)) === 0) break
			this.advance()
		}
		return this.make_token(TOKEN_WHITESPACE, start, this.pos, start_line, start_column)
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
		// Hot path: inline digit check in tight loop
		while (this.pos < this.source.length) {
			let ch = this.source.charCodeAt(this.pos)
			if (ch >= 128 || (char_types[ch] & CHAR_DIGIT) === 0) break
			this.advance()
		}

		// Decimal part
		// Hot path: inline digit check for decimal detection
		if (this.pos < this.source.length && this.source.charCodeAt(this.pos) === CHAR_DOT && this.pos + 1 < this.source.length) {
			let next = this.peek()
			if (next < 128 && (char_types[next] & CHAR_DIGIT) !== 0) {
				this.advance() // .
				// Hot path: inline digit check in tight loop
				while (this.pos < this.source.length) {
					let ch = this.source.charCodeAt(this.pos)
					if (ch >= 128 || (char_types[ch] & CHAR_DIGIT) === 0) break
					this.advance()
				}
			}
		}

		// Exponent: e or E
		if (this.pos < this.source.length) {
			let ch = this.source.charCodeAt(this.pos)
			if (ch === CHAR_LOWERCASE_E || ch === CHAR_UPPERCASE_E) {
				let next = this.peek()
				// Hot path: inline digit checks for exponent detection
				let is_next_digit = next < 128 && (char_types[next] & CHAR_DIGIT) !== 0
				let next2 = this.peek(2)
				let is_next2_digit = next2 < 128 && (char_types[next2] & CHAR_DIGIT) !== 0
				if (is_next_digit || ((next === CHAR_PLUS || next === CHAR_HYPHEN) && is_next2_digit)) {
					this.advance() // e or E
					if (this.pos < this.source.length) {
						let sign = this.source.charCodeAt(this.pos)
						if (sign === CHAR_PLUS || sign === CHAR_HYPHEN) {
							this.advance() // + or -
						}
					}
					// Hot path: inline digit check in tight loop
					while (this.pos < this.source.length) {
						let ch = this.source.charCodeAt(this.pos)
						if (ch >= 128 || (char_types[ch] & CHAR_DIGIT) === 0) break
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

				let next = this.peek()

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

		// Check for unicode-range: u+ or U+
		// Must be exactly 'u' or 'U' followed by '+'
		if (this.pos - start === 1) {
			let first_ch = this.source.charCodeAt(start)
			if (
				(first_ch === CHAR_LOWERCASE_U || first_ch === CHAR_UPPERCASE_U) &&
				this.pos < this.source.length &&
				this.source.charCodeAt(this.pos) === CHAR_PLUS
			) {
				return this.consume_unicode_range(start, start_line, start_column)
			}
		}

		// Check for function: ident(
		if (this.pos < this.source.length && this.source.charCodeAt(this.pos) === CHAR_LEFT_PAREN) {
			this.advance()
			return this.make_token(TOKEN_FUNCTION, start, this.pos, start_line, start_column)
		}

		return this.make_token(TOKEN_IDENT, start, this.pos, start_line, start_column)
	}

	consume_unicode_range(start: number, start_line: number, start_column: number): TokenType {
		// We're positioned after 'u' or 'U', at the '+'
		this.advance() // consume '+'

		let hex_digits = 0
		let has_question = false

		// Consume hex digits and/or question marks (up to 6 total)
		while (this.pos < this.source.length && hex_digits < 6) {
			let ch = this.source.charCodeAt(this.pos)
			if (is_hex_digit(ch)) {
				if (has_question) {
					// Can't have hex digits after question marks
					break
				}
				this.advance()
				hex_digits++
			} else if (ch === CHAR_QUESTION_MARK) {
				this.advance()
				hex_digits++
				has_question = true
			} else {
				break
			}
		}

		// If we have question marks, we're done (no range allowed)
		if (has_question) {
			return this.make_token(TOKEN_UNICODE_RANGE, start, this.pos, start_line, start_column)
		}

		// Check for range syntax: -HHHHHH
		if (this.pos < this.source.length && this.source.charCodeAt(this.pos) === CHAR_HYPHEN) {
			// Peek ahead to see if there's a hex digit
			if (this.pos + 1 < this.source.length && is_hex_digit(this.source.charCodeAt(this.pos + 1))) {
				this.advance() // consume '-'

				// Consume up to 6 hex digits for the end of the range
				let end_hex_digits = 0
				while (this.pos < this.source.length && end_hex_digits < 6) {
					let ch = this.source.charCodeAt(this.pos)
					if (is_hex_digit(ch)) {
						this.advance()
						end_hex_digits++
					} else {
						break
					}
				}
			}
		}

		return this.make_token(TOKEN_UNICODE_RANGE, start, this.pos, start_line, start_column)
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

	/**
	 * Save complete lexer state for backtracking
	 * @returns Object containing all lexer state
	 */
	save_position(): LexerPosition {
		return {
			pos: this.pos,
			line: this.line,
			column: this.column,
			token_type: this.token_type,
			token_start: this.token_start,
			token_end: this.token_end,
			token_line: this.token_line,
			token_column: this.token_column,
		}
	}

	/**
	 * Restore lexer state from saved position
	 * @param saved The saved position to restore
	 */
	restore_position(saved: LexerPosition): void {
		this.pos = saved.pos
		this.line = saved.line
		this.column = saved.column
		this.token_type = saved.token_type
		this.token_start = saved.token_start
		this.token_end = saved.token_end
		this.token_line = saved.token_line
		this.token_column = saved.token_column
	}
}

/**
 * Tokenize CSS source code
 * @param source - The CSS source code to tokenize
 * @param on_comment - Optional callback for comment tokens
 * @yields CSS tokens
 */
export function* tokenize(source: string, on_comment?: (info: CommentInfo) => void): Generator<Token, void, undefined> {
	const lexer = new Lexer(source, on_comment)

	while (true) {
		const token = lexer.next_token()
		if (!token || token.type === TOKEN_EOF) {
			break
		}
		yield token
	}
}
