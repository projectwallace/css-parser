import {
	is_hex_digit,
	is_ident_start,
	char_types,
	CHAR_DIGIT,
	CHAR_WHITESPACE,
	CHAR_NEWLINE,
	CHAR_IDENT,
} from './char-types'

// Bit mask for hex digits — mirrors the unexported CHAR_HEX in char-types.ts
const CHAR_HEX_MASK = 1 << 2 // 4

function is_newline(ch: number): boolean {
	return ch < 128 && (char_types[ch] & CHAR_NEWLINE) !== 0
}
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

const CHAR_LEFT_BRACE = 0x7b
const CHAR_RIGHT_BRACE = 0x7d
const CHAR_COLON = 0x3a
const CHAR_SEMICOLON = 0x3b
const CHAR_COMMA = 0x2c
const CHAR_LEFT_BRACKET = 0x5b
const CHAR_RIGHT_BRACKET = 0x5d
const CHAR_LEFT_PAREN = 0x28
const CHAR_RIGHT_PAREN = 0x29
const CHAR_FORWARD_SLASH = 0x2f
const CHAR_ASTERISK = 0x2a
const CHAR_DOUBLE_QUOTE = 0x22
const CHAR_SINGLE_QUOTE = 0x27
const CHAR_DOT = 0x2e
const CHAR_LESS_THAN = 0x3c
const CHAR_EXCLAMATION = 0x21
const CHAR_HYPHEN = 0x2d
const CHAR_GREATER_THAN = 0x3e
const CHAR_AT_SIGN = 0x40
const CHAR_HASH = 0x23
const CHAR_BACKSLASH = 0x5c
const CHAR_PLUS = 0x2b
const CHAR_PERCENT = 0x25
const CHAR_LOWERCASE_E = 0x65
const CHAR_UPPERCASE_E = 0x45
const CHAR_LOWERCASE_U = 0x75
const CHAR_UPPERCASE_U = 0x55
const CHAR_QUESTION_MARK = 0x3f

export interface LexerPosition {
	pos: number
	line: number
	column: number
	_line_offset: number
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
	// Uint8Array view of the source: ASCII chars stored as-is (0–127),
	// non-ASCII stored as sentinel 128. Typed-array indexing is faster than
	// charCodeAt() in tight loops because it avoids method-call overhead and
	// allows the JIT to emit direct memory reads.
	private _src: Uint8Array
	// Sorted list of source positions that are the first character *after*
	// each newline (or after a \r\n pair). Built once in the constructor so
	// hot-path loops never branch on newlines at all; line/column are resolved
	// by binary search in make_token() instead.
	private _nl: Int32Array
	private _nl_count: number
	// Monotonic hint for the binary search: because tokens are consumed
	// left-to-right, the next search result is always >= the last one.
	// The hint lets us skip the already-known prefix, making the amortized
	// cost nearly O(1) per token during sequential parsing.
	private _nl_hint: number
	pos: number
	on_comment: ((info: CommentInfo) => void) | undefined
	token_type: TokenType
	token_start: number
	token_end: number
	token_line: number
	token_column: number

	constructor(source: string, on_comment?: (info: CommentInfo) => void) {
		this.source = source
		this.pos = 0
		this.on_comment = on_comment
		this.token_type = TOKEN_EOF
		this.token_start = 0
		this.token_end = 0
		this.token_line = 1
		this.token_column = 1
		this._nl_hint = 0

		const n = source.length
		const src = new Uint8Array(n)
		const nl: number[] = []

		// Single pass: fill the byte buffer and collect newline offsets.
		// Non-ASCII characters are stored as 128 (sentinel). All existing
		// guards of the form `ch >= 128 || ...` or `ch < 0x80 && ...` remain
		// correct because 128 >= 128 is true, so those paths treat sentinel
		// as non-ASCII — exactly the same as the original charCodeAt logic.
		for (let i = 0; i < n; i++) {
			const c = source.charCodeAt(i)
			src[i] = c > 127 ? 128 : c
			if (c === 0x0a || c === 0x0c) {
				nl.push(i + 1)
			} else if (c === 0x0d) {
				// Treat \r\n as one newline; fill the \n slot manually since
				// we skip that loop iteration.
				if (i + 1 < n && source.charCodeAt(i + 1) === 0x0a) {
					i++
					src[i] = 0x0a
					nl.push(i + 1)
				} else {
					nl.push(i + 1)
				}
			}
		}

		this._src = src
		this._nl = new Int32Array(nl)
		this._nl_count = nl.length
	}

	get line(): number {
		return this._line_at(this.pos)
	}

	get column(): number {
		return this._col_at(this.pos)
	}

	private _bsearch(pos: number): number {
		const nl = this._nl
		const nl_count = this._nl_count
		// Use the monotonic hint to skip the prefix already known to be ≤ pos.
		// Fall back to 0 on backtracking (hint too large).
		let lo = this._nl_hint < nl_count && nl[this._nl_hint] <= pos ? this._nl_hint : 0
		let hi = nl_count
		while (lo < hi) {
			const mid = (lo + hi) >>> 1
			if (nl[mid] <= pos) lo = mid + 1
			else hi = mid
		}
		return lo
	}

	private _line_at(pos: number): number {
		const nl = this._nl
		let lo = 0,
			hi = this._nl_count
		while (lo < hi) {
			const mid = (lo + hi) >>> 1
			if (nl[mid] <= pos) lo = mid + 1
			else hi = mid
		}
		return lo + 1
	}

	private _col_at(pos: number): number {
		const nl = this._nl
		let lo = 0,
			hi = this._nl_count
		while (lo < hi) {
			const mid = (lo + hi) >>> 1
			if (nl[mid] <= pos) lo = mid + 1
			else hi = mid
		}
		return pos - (lo > 0 ? nl[lo - 1] : 0) + 1
	}

	seek(pos: number, _line?: number, _column?: number): void {
		// line/column args are ignored: they are now derived from pos on demand.
		this.pos = pos
	}

	next_token_fast(skip_whitespace: boolean = false): TokenType {
		const src = this._src
		const source = this.source
		const n = src.length

		while (true) {
			// Skip whitespace — no newline tracking needed; line/col resolved at
			// token boundaries via make_token's binary search.
			if (skip_whitespace) {
				while (this.pos < n) {
					const ch = src[this.pos]
					if (ch >= 128 || (char_types[ch] & (CHAR_WHITESPACE | CHAR_NEWLINE)) === 0) break
					this.pos++
				}
			}

			if (this.pos >= n) {
				return this.make_token(TOKEN_EOF, this.pos, this.pos)
			}

			const ch = src[this.pos]
			const start = this.pos

			switch (ch) {
				case CHAR_LEFT_BRACE:
					this.pos++
					return this.make_token(TOKEN_LEFT_BRACE, start, this.pos)
				case CHAR_RIGHT_BRACE:
					this.pos++
					return this.make_token(TOKEN_RIGHT_BRACE, start, this.pos)
				case CHAR_COLON:
					this.pos++
					return this.make_token(TOKEN_COLON, start, this.pos)
				case CHAR_SEMICOLON:
					this.pos++
					return this.make_token(TOKEN_SEMICOLON, start, this.pos)
				case CHAR_COMMA:
					this.pos++
					return this.make_token(TOKEN_COMMA, start, this.pos)
				case CHAR_LEFT_BRACKET:
					this.pos++
					return this.make_token(TOKEN_LEFT_BRACKET, start, this.pos)
				case CHAR_RIGHT_BRACKET:
					this.pos++
					return this.make_token(TOKEN_RIGHT_BRACKET, start, this.pos)
				case CHAR_LEFT_PAREN:
					this.pos++
					return this.make_token(TOKEN_LEFT_PAREN, start, this.pos)
				case CHAR_RIGHT_PAREN:
					this.pos++
					return this.make_token(TOKEN_RIGHT_PAREN, start, this.pos)
			}

			if (ch < 128 && (char_types[ch] & (CHAR_WHITESPACE | CHAR_NEWLINE)) !== 0) {
				return this.consume_whitespace(start)
			}

			// Comments — find */ with native string search (SIMD in V8), then
			// advance pos directly. No need to count newlines in the body;
			// make_token's binary search handles line/col for the next token.
			if (
				ch === CHAR_FORWARD_SLASH &&
				this.pos + 1 < n &&
				src[this.pos + 1] === CHAR_ASTERISK
			) {
				const comment_start = start
				this.pos += 2
				const end_idx = source.indexOf('*/', this.pos)
				this.pos = end_idx < 0 ? n : end_idx + 2
				if (this.on_comment) {
					this.on_comment({
						start: comment_start,
						end: this.pos,
						length: this.pos - comment_start,
						line: this._line_at(comment_start),
						column: this._col_at(comment_start),
					})
				}
				continue // loop instead of recurse
			}

			if (ch === CHAR_DOUBLE_QUOTE || ch === CHAR_SINGLE_QUOTE) {
				return this.consume_string(ch, start)
			}

			if (ch < 128 && (char_types[ch] & CHAR_DIGIT) !== 0) {
				return this.consume_number(start)
			}

			if (ch === CHAR_DOT) {
				const next = this.pos + 1 < n ? src[this.pos + 1] : 0
				if (next < 128 && (char_types[next] & CHAR_DIGIT) !== 0) {
					return this.consume_number(start)
				}
			}

			// CDO: <!--
			if (ch === CHAR_LESS_THAN && this.pos + 3 < n) {
				if (
					src[this.pos + 1] === CHAR_EXCLAMATION &&
					src[this.pos + 2] === CHAR_HYPHEN &&
					src[this.pos + 3] === CHAR_HYPHEN
				) {
					this.pos += 4
					return this.make_token(TOKEN_CDO, start, this.pos)
				}
			}

			// CDC: -->
			if (ch === CHAR_HYPHEN && this.pos + 2 < n) {
				if (src[this.pos + 1] === CHAR_HYPHEN && src[this.pos + 2] === CHAR_GREATER_THAN) {
					this.pos += 3
					return this.make_token(TOKEN_CDC, start, this.pos)
				}
			}

			if (ch === CHAR_AT_SIGN) {
				return this.consume_at_keyword(start)
			}

			if (ch === CHAR_HASH) {
				return this.consume_hash(start)
			}

			if (is_ident_start(ch)) {
				return this.consume_ident_or_function(start)
			}
			if (ch === CHAR_HYPHEN) {
				const next = this.pos + 1 < n ? src[this.pos + 1] : 0
				if (is_ident_start(next) || next === CHAR_HYPHEN) {
					return this.consume_ident_or_function(start)
				}
			}

			if (ch === CHAR_BACKSLASH) {
				const next = this.pos + 1 < n ? src[this.pos + 1] : 0
				if (next !== 0 && !is_newline(next)) {
					return this.consume_ident_or_function(start)
				}
			}

			if (ch === CHAR_HYPHEN || ch === CHAR_PLUS) {
				const next = this.pos + 1 < n ? src[this.pos + 1] : 0
				if (next < 128 && (char_types[next] & CHAR_DIGIT) !== 0) {
					return this.consume_number(start)
				}
				if (next === CHAR_DOT) {
					const next2 = this.pos + 2 < n ? src[this.pos + 2] : 0
					if (next2 < 128 && (char_types[next2] & CHAR_DIGIT) !== 0) {
						return this.consume_number(start)
					}
				}
			}

			this.pos++
			return this.make_token(TOKEN_DELIM, start, this.pos)
		}
	}

	consume_whitespace(start: number): TokenType {
		const src = this._src
		const n = src.length
		while (this.pos < n) {
			const ch = src[this.pos]
			if (ch >= 128 || (char_types[ch] & (CHAR_WHITESPACE | CHAR_NEWLINE)) === 0) break
			this.pos++
		}
		return this.make_token(TOKEN_WHITESPACE, start, this.pos)
	}

	consume_string(quote: number, start: number): TokenType {
		const src = this._src
		const n = src.length
		this.pos++ // skip opening quote

		while (this.pos < n) {
			const ch = src[this.pos]

			if (ch === quote) {
				this.pos++
				return this.make_token(TOKEN_STRING, start, this.pos)
			}

			if (ch < 128 && (char_types[ch] & CHAR_NEWLINE) !== 0) {
				return this.make_token(TOKEN_BAD_STRING, start, this.pos)
			}

			if (ch === CHAR_BACKSLASH) {
				this.pos++
				if (this.pos < n) {
					const next = src[this.pos]
					if (next < 128 && (char_types[next] & CHAR_HEX_MASK) !== 0) {
						this.consume_hex_escape()
					} else {
						// Escaped newline or any other char — just skip.
						// Newline tracking is not needed: make_token resolves
						// line/col from position via binary search.
						this.pos++
					}
				}
				continue
			}

			this.pos++
		}

		return this.make_token(TOKEN_BAD_STRING, start, this.pos)
	}

	consume_hex_escape(): void {
		const src = this._src
		const n = src.length
		let count = 0
		while (count < 6 && this.pos < n) {
			const ch = src[this.pos]
			if (ch >= 128 || (char_types[ch] & CHAR_HEX_MASK) === 0) break
			this.pos++
			count++
		}
		// Optional trailing whitespace (including newlines — no tracking needed)
		if (this.pos < n) {
			const ch = src[this.pos]
			if (ch < 128 && (char_types[ch] & (CHAR_WHITESPACE | CHAR_NEWLINE)) !== 0) {
				this.pos++
			}
		}
	}

	consume_number(start: number): TokenType {
		const src = this._src
		const n = src.length

		// Optional sign
		const first = src[this.pos]
		if (first === CHAR_PLUS || first === CHAR_HYPHEN) this.pos++

		// Integer digits
		while (this.pos < n) {
			const ch = src[this.pos]
			if (ch >= 128 || (char_types[ch] & CHAR_DIGIT) === 0) break
			this.pos++
		}

		// Decimal part
		if (this.pos < n && src[this.pos] === CHAR_DOT && this.pos + 1 < n) {
			const next = src[this.pos + 1]
			if (next < 128 && (char_types[next] & CHAR_DIGIT) !== 0) {
				this.pos++ // consume .
				while (this.pos < n) {
					const ch = src[this.pos]
					if (ch >= 128 || (char_types[ch] & CHAR_DIGIT) === 0) break
					this.pos++
				}
			}
		}

		// Exponent
		if (this.pos < n) {
			const ch = src[this.pos]
			if (ch === CHAR_LOWERCASE_E || ch === CHAR_UPPERCASE_E) {
				const next = this.pos + 1 < n ? src[this.pos + 1] : 0
				const next2 = this.pos + 2 < n ? src[this.pos + 2] : 0
				const next_digit = next < 128 && (char_types[next] & CHAR_DIGIT) !== 0
				const next2_digit = next2 < 128 && (char_types[next2] & CHAR_DIGIT) !== 0
				if (next_digit || ((next === CHAR_PLUS || next === CHAR_HYPHEN) && next2_digit)) {
					this.pos++ // e/E
					const sign = src[this.pos]
					if (sign === CHAR_PLUS || sign === CHAR_HYPHEN) this.pos++
					while (this.pos < n) {
						const ch = src[this.pos]
						if (ch >= 128 || (char_types[ch] & CHAR_DIGIT) === 0) break
						this.pos++
					}
				}
			}
		}

		// Percentage or dimension unit
		if (this.pos < n) {
			const ch = src[this.pos]
			if (ch === CHAR_PERCENT) {
				this.pos++
				return this.make_token(TOKEN_PERCENTAGE, start, this.pos)
			}
			const next = this.pos + 1 < n ? src[this.pos + 1] : 0
			if (is_ident_start(ch) || (ch === CHAR_HYPHEN && is_ident_start(next))) {
				while (this.pos < n) {
					const c = src[this.pos]
					if (c < 0x80 && (char_types[c] & CHAR_IDENT) === 0) break
					this.pos++
				}
				return this.make_token(TOKEN_DIMENSION, start, this.pos)
			}
		}

		return this.make_token(TOKEN_NUMBER, start, this.pos)
	}

	consume_ident_or_function(start: number): TokenType {
		const src = this._src
		const n = src.length

		while (this.pos < n) {
			const ch = src[this.pos]

			if (ch === CHAR_BACKSLASH) {
				if (this.pos + 1 >= n) break
				const next = src[this.pos + 1]
				if (is_newline(next)) break
				this.pos++ // consume \
				if (next < 128 && (char_types[next] & CHAR_HEX_MASK) !== 0) {
					this.pos++ // first hex digit
					for (let i = 0; i < 5 && this.pos < n; i++) {
						if ((src[this.pos] & 0x80) !== 0 || (char_types[src[this.pos]] & CHAR_HEX_MASK) === 0)
							break
						this.pos++
					}
					// Optional trailing whitespace
					if (this.pos < n) {
						const ws = src[this.pos]
						if (ws < 128 && (char_types[ws] & (CHAR_WHITESPACE | CHAR_NEWLINE)) !== 0) {
							this.pos++
						}
					}
				} else {
					this.pos++ // any non-newline char
				}
			} else if (ch >= 0x80 || (char_types[ch] & CHAR_IDENT) !== 0) {
				this.pos++
			} else {
				break
			}
		}

		// u+ or U+ → unicode-range
		if (this.pos - start === 1) {
			const first_ch = src[start]
			if (
				(first_ch === CHAR_LOWERCASE_U || first_ch === CHAR_UPPERCASE_U) &&
				this.pos < n &&
				src[this.pos] === CHAR_PLUS
			) {
				return this.consume_unicode_range(start)
			}
		}

		if (this.pos < n && src[this.pos] === CHAR_LEFT_PAREN) {
			this.pos++
			return this.make_token(TOKEN_FUNCTION, start, this.pos)
		}

		return this.make_token(TOKEN_IDENT, start, this.pos)
	}

	consume_unicode_range(start: number): TokenType {
		const src = this._src
		const n = src.length
		this.pos++ // consume +

		let hex_digits = 0
		let has_question = false

		while (this.pos < n && hex_digits < 6) {
			const ch = src[this.pos]
			if (ch < 128 && (char_types[ch] & CHAR_HEX_MASK) !== 0) {
				if (has_question) break
				this.pos++
				hex_digits++
			} else if (ch === CHAR_QUESTION_MARK) {
				this.pos++
				hex_digits++
				has_question = true
			} else {
				break
			}
		}

		if (has_question) {
			return this.make_token(TOKEN_UNICODE_RANGE, start, this.pos)
		}

		if (this.pos < n && src[this.pos] === CHAR_HYPHEN) {
			if (this.pos + 1 < n && (src[this.pos + 1] & 0x80) === 0 && (char_types[src[this.pos + 1]] & CHAR_HEX_MASK) !== 0) {
				this.pos++ // consume -
				let end_hex = 0
				while (this.pos < n && end_hex < 6) {
					const ch = src[this.pos]
					if (ch >= 128 || (char_types[ch] & CHAR_HEX_MASK) === 0) break
					this.pos++
					end_hex++
				}
			}
		}

		return this.make_token(TOKEN_UNICODE_RANGE, start, this.pos)
	}

	consume_at_keyword(start: number): TokenType {
		const src = this._src
		const n = src.length
		this.pos++ // skip @
		while (this.pos < n) {
			const ch = src[this.pos]
			if (ch < 0x80 && (char_types[ch] & CHAR_IDENT) === 0) break
			this.pos++
		}
		return this.make_token(TOKEN_AT_KEYWORD, start, this.pos)
	}

	consume_hash(start: number): TokenType {
		const src = this._src
		const n = src.length
		this.pos++ // skip #
		while (this.pos < n) {
			const ch = src[this.pos]
			if (ch < 0x80 && (char_types[ch] & CHAR_IDENT) === 0) break
			this.pos++
		}
		return this.make_token(TOKEN_HASH, start, this.pos)
	}

	advance(count: number = 1): void {
		// Line tracking is now handled by the pre-scanned _nl array and
		// binary search in make_token; advance() is a simple cursor move.
		this.pos = Math.min(this.pos + count, this._src.length)
	}

	peek(offset: number = 1): number {
		const i = this.pos + offset
		return i < this._src.length ? this._src[i] : 0
	}

	make_token(
		type: TokenType,
		start: number,
		end: number,
		_line?: number,
		_column?: number,
	): TokenType {
		this.token_type = type
		this.token_start = start
		this.token_end = end
		// Binary search with monotonic hint: amortized O(1) for sequential parsing.
		const lo = this._bsearch(start)
		this._nl_hint = lo
		this.token_line = lo + 1
		this.token_column = start - (lo > 0 ? this._nl[lo - 1] : 0) + 1
		return type
	}

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

	save_position(): LexerPosition {
		return {
			pos: this.pos,
			line: this._line_at(this.pos),
			column: this._col_at(this.pos),
			_line_offset: 0, // no longer maintained; kept for interface compat
			token_type: this.token_type,
			token_start: this.token_start,
			token_end: this.token_end,
			token_line: this.token_line,
			token_column: this.token_column,
		}
	}

	restore_position(saved: LexerPosition): void {
		this.pos = saved.pos
		this.token_type = saved.token_type
		this.token_start = saved.token_start
		this.token_end = saved.token_end
		this.token_line = saved.token_line
		this.token_column = saved.token_column
		// Reset hint: pos may have moved backwards (backtracking)
		this._nl_hint = 0
	}

	skip_whitespace_in_range(end: number): void {
		const src = this._src
		while (this.pos < end) {
			const ch = src[this.pos]
			if (ch < 128 && (char_types[ch] & (CHAR_WHITESPACE | CHAR_NEWLINE)) !== 0) {
				this.pos++
				continue
			}
			if (
				ch === CHAR_FORWARD_SLASH &&
				this.pos + 1 < end &&
				src[this.pos + 1] === CHAR_ASTERISK
			) {
				this.pos += 2
				while (this.pos < end) {
					if (
						src[this.pos] === CHAR_ASTERISK &&
						this.pos + 1 < end &&
						src[this.pos + 1] === CHAR_FORWARD_SLASH
					) {
						this.pos += 2
						break
					}
					this.pos++
				}
				continue
			}
			break
		}
	}
}

export function* tokenize(
	source: string,
	on_comment?: (info: CommentInfo) => void,
): Generator<Token, void, undefined> {
	const lexer = new Lexer(source, on_comment)
	while (true) {
		const token = lexer.next_token()
		if (!token || token.type === TOKEN_EOF) break
		yield token
	}
}
