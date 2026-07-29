import {
	is_hex_digit,
	is_ident_start,
	char_types,
	CHAR_DIGIT,
	CHAR_WHITESPACE,
	CHAR_NEWLINE,
	CHAR_IDENT,
} from './char-types'

// Local inline version for hot paths that still need it
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
const CHAR_FORM_FEED = 0x0c // \f

// Characters skip_to_unquoted() needs to stop and inspect: quotes (start a string), '/'
// (might start a comment), and newlines (need line/column tracking). Built once and shared
// across all skip_to_unquoted calls regardless of the (dynamic) target character being
// searched for, so the ordinary-character fast path is one table lookup, same cost as
// consume_ident_or_function's inner loop.
const SKIP_SCAN_INTERESTING = new Uint8Array(128)
SKIP_SCAN_INTERESTING[CHAR_DOUBLE_QUOTE] = 1
SKIP_SCAN_INTERESTING[CHAR_SINGLE_QUOTE] = 1
SKIP_SCAN_INTERESTING[CHAR_FORWARD_SLASH] = 1
SKIP_SCAN_INTERESTING[CHAR_LINE_FEED] = 1
SKIP_SCAN_INTERESTING[CHAR_CARRIAGE_RETURN] = 1
SKIP_SCAN_INTERESTING[CHAR_FORM_FEED] = 1

// Extra characters skip_to_declaration_stop() reports back to its caller (on top of the
// string/comment/newline handling shared with skip_to_unquoted above): statement/block/
// paren delimiters and '!' (for !important detection). parse-declaration.ts decides what
// each one means (paren depth, !important, "actually a nested rule") - this table only
// flags which characters are worth stopping for.
const DECL_VALUE_STOP = new Uint8Array(128)
DECL_VALUE_STOP[CHAR_SEMICOLON] = 1
DECL_VALUE_STOP[CHAR_LEFT_BRACE] = 1
DECL_VALUE_STOP[CHAR_RIGHT_BRACE] = 1
DECL_VALUE_STOP[CHAR_LEFT_PAREN] = 1
DECL_VALUE_STOP[CHAR_RIGHT_PAREN] = 1
DECL_VALUE_STOP[CHAR_EXCLAMATION] = 1

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
	pos: number
	private _line: number
	private _line_offset: number
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
		this._line = 1
		this._line_offset = 0
		this.on_comment = on_comment
		this.token_type = TOKEN_EOF
		this.token_start = 0
		this.token_end = 0
		this.token_line = 1
		this.token_column = 1
	}

	get line(): number {
		return this._line
	}

	get column(): number {
		return this.pos - this._line_offset + 1
	}

	seek(pos: number, line: number, column: number = 1): void {
		this.pos = pos
		this._line = line
		this._line_offset = pos - column + 1
	}

	// Fast token advancing without object allocation (for internal parser use)
	next_token_fast(skip_whitespace: boolean = false): TokenType {
		const source = this.source
		const source_length = source.length

		// Outer loop replaces comment recursion: after consuming a comment, continue
		// to find the actual next token instead of making a recursive call.
		while (true) {
			// Inline whitespace skip — avoids method call + duplicate charCodeAt per char.
			// Hoisted to locals (synced back once) instead of touching this.pos/_line/_line_offset
			// on every character — most runs are plain spaces that never hit the newline branch.
			if (skip_whitespace) {
				let pos = this.pos
				let line = this._line
				let line_offset = this._line_offset
				while (pos < source_length) {
					let ch = source.charCodeAt(pos)
					if (ch >= 128 || (char_types[ch] & (CHAR_WHITESPACE | CHAR_NEWLINE)) === 0) break
					pos++
					if ((char_types[ch] & CHAR_NEWLINE) !== 0) {
						if (
							ch === CHAR_CARRIAGE_RETURN &&
							pos < source_length &&
							source.charCodeAt(pos) === CHAR_LINE_FEED
						) {
							pos++
						}
						line++
						line_offset = pos
					}
				}
				this.pos = pos
				this._line = line
				this._line_offset = line_offset
			}

			if (this.pos >= source_length) {
				return this.make_token(TOKEN_EOF, this.pos, this.pos)
			}

			let ch = source.charCodeAt(this.pos)
			let start = this.pos
			let start_line = this._line
			let start_column = this.pos - this._line_offset + 1

			// Fast path for single-character tokens — pos++ safe (none are newlines)
			switch (ch) {
				case CHAR_LEFT_BRACE:
					this.pos++
					return this.make_token(TOKEN_LEFT_BRACE, start, this.pos, start_line, start_column)
				case CHAR_RIGHT_BRACE:
					this.pos++
					return this.make_token(TOKEN_RIGHT_BRACE, start, this.pos, start_line, start_column)
				case CHAR_COLON:
					this.pos++
					return this.make_token(TOKEN_COLON, start, this.pos, start_line, start_column)
				case CHAR_SEMICOLON:
					this.pos++
					return this.make_token(TOKEN_SEMICOLON, start, this.pos, start_line, start_column)
				case CHAR_COMMA:
					this.pos++
					return this.make_token(TOKEN_COMMA, start, this.pos, start_line, start_column)
				case CHAR_LEFT_BRACKET:
					this.pos++
					return this.make_token(TOKEN_LEFT_BRACKET, start, this.pos, start_line, start_column)
				case CHAR_RIGHT_BRACKET:
					this.pos++
					return this.make_token(TOKEN_RIGHT_BRACKET, start, this.pos, start_line, start_column)
				case CHAR_LEFT_PAREN:
					this.pos++
					return this.make_token(TOKEN_LEFT_PAREN, start, this.pos, start_line, start_column)
				case CHAR_RIGHT_PAREN:
					this.pos++
					return this.make_token(TOKEN_RIGHT_PAREN, start, this.pos, start_line, start_column)
			}

			// Whitespace
			if (ch < 128 && (char_types[ch] & (CHAR_WHITESPACE | CHAR_NEWLINE)) !== 0) {
				return this.consume_whitespace(start_line, start_column)
			}

			// Comments: /* */
			// Inline peek(1) check avoids an extra method call on the hot path
			if (
				ch === CHAR_FORWARD_SLASH &&
				this.pos + 1 < source_length &&
				source.charCodeAt(this.pos + 1) === CHAR_ASTERISK
			) {
				this._skip_comment()
				// Loop instead of recursing — eliminates stack frame overhead
				continue
			}

			// Identifier or function — checked early: across real-world CSS this is the single
			// most common non-whitespace token (~15-20%+ of all tokens), well ahead of numbers,
			// hashes, at-keywords, strings, and the (essentially extinct in modern CSS) CDO/CDC
			// tokens that used to precede it here. Measured via profiling + token frequency
			// analysis on bootstrap.css/tailwind.css — see PR discussion for numbers.
			if (is_ident_start(ch)) {
				return this.consume_ident_or_function(start_line, start_column)
			}

			// Hyphen-led tokens: --custom-property/-webkit-prefix (identifier), -5px (signed
			// number), or the legacy --> CDC token. Consolidated into one block (single charCodeAt
			// for the lookahead char) instead of three separate `ch === CHAR_HYPHEN` checks.
			// NOTE: CDC must be checked first — "-->" would otherwise be misread as identifier "--"
			// followed by a stray ">" delimiter, since -- is itself valid identifier-start (custom
			// properties).
			if (ch === CHAR_HYPHEN) {
				let next = this.pos + 1 < source_length ? source.charCodeAt(this.pos + 1) : 0

				if (
					next === CHAR_HYPHEN &&
					this.pos + 2 < source_length &&
					source.charCodeAt(this.pos + 2) === CHAR_GREATER_THAN
				) {
					// CDC: --> (contains no newlines)
					this.pos += 3
					return this.make_token(TOKEN_CDC, start, this.pos, start_line, start_column)
				}

				if (is_ident_start(next) || next === CHAR_HYPHEN) {
					return this.consume_ident_or_function(start_line, start_column)
				}

				if (next < 128 && (char_types[next] & CHAR_DIGIT) !== 0) {
					return this.consume_number(start_line, start_column)
				}
				if (next === CHAR_DOT) {
					let next2 = this.pos + 2 < source_length ? source.charCodeAt(this.pos + 2) : 0
					if (next2 < 128 && (char_types[next2] & CHAR_DIGIT) !== 0) {
						return this.consume_number(start_line, start_column)
					}
				}
			}

			// Backslash: escape sequence starting an identifier
			if (ch === CHAR_BACKSLASH) {
				let next = this.pos + 1 < source_length ? source.charCodeAt(this.pos + 1) : 0
				if (next !== 0 && !is_newline(next)) {
					return this.consume_ident_or_function(start_line, start_column)
				}
			}

			// Numbers: digit or . followed by digit
			if (ch < 128 && (char_types[ch] & CHAR_DIGIT) !== 0) {
				return this.consume_number(start_line, start_column)
			}

			if (ch === CHAR_DOT) {
				let next = this.pos + 1 < source_length ? source.charCodeAt(this.pos + 1) : 0
				if (next < 128 && (char_types[next] & CHAR_DIGIT) !== 0) {
					return this.consume_number(start_line, start_column)
				}
			}

			// Plus: could be a signed number like +5 (the hyphen-led case is handled above)
			if (ch === CHAR_PLUS) {
				let next = this.pos + 1 < source_length ? source.charCodeAt(this.pos + 1) : 0
				if (next < 128 && (char_types[next] & CHAR_DIGIT) !== 0) {
					return this.consume_number(start_line, start_column)
				}
				if (next === CHAR_DOT) {
					let next2 = this.pos + 2 < source_length ? source.charCodeAt(this.pos + 2) : 0
					if (next2 < 128 && (char_types[next2] & CHAR_DIGIT) !== 0) {
						return this.consume_number(start_line, start_column)
					}
				}
			}

			// Strings: " or '
			if (ch === CHAR_DOUBLE_QUOTE || ch === CHAR_SINGLE_QUOTE) {
				return this.consume_string(ch, start_line, start_column)
			}

			// At-keyword: @media, @keyframes, etc
			if (ch === CHAR_AT_SIGN) {
				return this.consume_at_keyword(start_line, start_column)
			}

			// Hash: #id or #fff
			if (ch === CHAR_HASH) {
				return this.consume_hash(start_line, start_column)
			}

			// CDO: <!-- (essentially extinct in modern CSS — checked last, right before the
			// default delimiter fallback; a lone "<" that isn't CDO just falls through to DELIM)
			if (ch === CHAR_LESS_THAN && this.pos + 3 < source_length) {
				if (
					source.charCodeAt(this.pos + 1) === CHAR_EXCLAMATION &&
					source.charCodeAt(this.pos + 2) === CHAR_HYPHEN &&
					source.charCodeAt(this.pos + 3) === CHAR_HYPHEN
				) {
					// <!-- contains no newlines
					this.pos += 4
					return this.make_token(TOKEN_CDO, start, this.pos, start_line, start_column)
				}
			}

			// Default: delimiter
			this.pos++
			return this.make_token(TOKEN_DELIM, start, this.pos, start_line, start_column)
		}
	}

	// Count newlines in source[from..to) and update _line/_line_offset.
	// Used only for comment body scanning; kept private.
	private _scan_newlines(from: number, to: number): void {
		const source = this.source
		for (let i = from; i < to; i++) {
			let c = source.charCodeAt(i)
			if (c === CHAR_LINE_FEED) {
				this._line++
				this._line_offset = i + 1
			} else if (c === CHAR_CARRIAGE_RETURN) {
				this._line++
				if (i + 1 < to && source.charCodeAt(i + 1) === CHAR_LINE_FEED) {
					i++ // treat \r\n as one newline
				}
				this._line_offset = i + 1
			} else if (c === CHAR_FORM_FEED) {
				this._line++
				this._line_offset = i + 1
			}
		}
	}

	// Skip a comment (/* ... */), firing on_comment if set. Caller must have already
	// verified this.pos points at '/' immediately followed by '*'. Shared by
	// next_token_fast's hot loop and skip_to_unquoted, so both stay in sync by construction.
	private _skip_comment(): void {
		const source = this.source
		const source_length = source.length
		let comment_start = this.pos
		let comment_line = this._line
		let comment_column = this.pos - this._line_offset + 1

		// Neither / nor * are newlines — safe to skip without newline tracking
		this.pos += 2

		// Use native string search to find */ — dramatically faster than a JS loop
		// for typical comment bodies (SIMD-accelerated in V8).
		let end_idx = source.indexOf('*/', this.pos)
		if (end_idx < 0) {
			// Unterminated comment: scan tail for newlines, advance to EOF
			this._scan_newlines(this.pos, source_length)
			this.pos = source_length
		} else {
			this._scan_newlines(this.pos, end_idx)
			this.pos = end_idx + 2
		}

		if (this.on_comment) {
			this.on_comment({
				start: comment_start,
				end: this.pos,
				length: this.pos - comment_start,
				line: comment_line,
				column: comment_column,
			})
		}
	}

	/**
	 * Fast-forward to the next occurrence of `target` (a char code) that isn't inside a
	 * string or comment, WITHOUT fully tokenizing everything in between — unlike
	 * next_token_fast, this never dispatches through consume_ident_or_function/consume_number/
	 * etc. for ordinary characters. Used by callers that only need to know *where a
	 * construct ends* (a selector's `{`, a value's `;`), not the tokens inside it — the
	 * detailed sub-parser for that construct re-tokenizes the span properly afterward.
	 *
	 * Strings are skipped via consume_string itself (not reimplemented here), so escape
	 * sequences, hex escapes, escaped newlines, and bad/unterminated strings are handled
	 * identically to real tokenization. Comments are skipped via the same _skip_comment
	 * used by next_token_fast, so on_comment still fires for comments encountered here.
	 *
	 * The ordinary-character fast path is a single table lookup (SKIP_SCAN_INTERESTING),
	 * same shape as consume_ident_or_function's inner loop, so this doesn't cost more per
	 * character than the full tokenizer would for a run of identifier/delimiter chars —
	 * the savings come from skipping token classification and make_token entirely for them.
	 *
	 * Leaves this.pos at target's position (returns true) or at source_length (returns
	 * false); this._line/_line_offset stay accurate for a subsequent seek/next_token_fast.
	 */
	skip_to_unquoted(target: number): boolean {
		const source = this.source
		const source_length = source.length
		let pos = this.pos

		while (pos < source_length) {
			let ch = source.charCodeAt(pos)

			if (ch === target) {
				this.pos = pos
				return true
			}

			if (ch >= 128 || SKIP_SCAN_INTERESTING[ch] === 0) {
				pos++
				continue
			}

			if (ch === CHAR_DOUBLE_QUOTE || ch === CHAR_SINGLE_QUOTE) {
				// start_line/start_column are only used for the token this returns, which we
				// discard - consume_string's side effects on this.pos/_line/_line_offset are
				// what we actually want, and those are correct regardless of what we pass here.
				this.pos = pos
				this.consume_string(ch, this._line, 1)
				pos = this.pos
				continue
			}

			if (ch === CHAR_FORWARD_SLASH) {
				if (pos + 1 < source_length && source.charCodeAt(pos + 1) === CHAR_ASTERISK) {
					this.pos = pos
					this._skip_comment()
					pos = this.pos
				} else {
					pos++
				}
				continue
			}

			// Newline (LF, CR, or FF) - track line/column even though we're not building tokens
			pos++
			if (
				ch === CHAR_CARRIAGE_RETURN &&
				pos < source_length &&
				source.charCodeAt(pos) === CHAR_LINE_FEED
			) {
				pos++
			}
			this._line++
			this._line_offset = pos
		}

		this.pos = pos
		return false
	}

	/**
	 * Fast-forward to the next occurrence of one of `; { } ( ) !` that isn't inside a
	 * string or comment, WITHOUT fully tokenizing the ordinary content in between - same
	 * approach as skip_to_unquoted, specialized for the declaration-value boundary scan in
	 * parse-declaration.ts (which needs several different stop characters: paren depth
	 * tracking needs both `(` and `)`, statement end is `;`/`}`, and `!` flags a possible
	 * !important). That caller decides what each returned character means; this method only
	 * locates the next one.
	 *
	 * Returns the stop character's code, leaving this.pos at its position. Returns 0 (and
	 * leaves this.pos at `end`) if none is found first.
	 */
	skip_to_declaration_stop(end: number): number {
		const source = this.source
		let pos = this.pos

		while (pos < end) {
			let ch = source.charCodeAt(pos)

			if (ch < 128 && DECL_VALUE_STOP[ch] !== 0) {
				this.pos = pos
				return ch
			}

			if (ch >= 128 || SKIP_SCAN_INTERESTING[ch] === 0) {
				pos++
				continue
			}

			if (ch === CHAR_DOUBLE_QUOTE || ch === CHAR_SINGLE_QUOTE) {
				this.pos = pos
				this.consume_string(ch, this._line, 1)
				pos = this.pos
				continue
			}

			if (ch === CHAR_FORWARD_SLASH) {
				if (pos + 1 < end && source.charCodeAt(pos + 1) === CHAR_ASTERISK) {
					this.pos = pos
					this._skip_comment()
					pos = this.pos
				} else {
					pos++
				}
				continue
			}

			// Newline (LF, CR, or FF) - track line/column even though we're not building tokens
			pos++
			if (ch === CHAR_CARRIAGE_RETURN && pos < end && source.charCodeAt(pos) === CHAR_LINE_FEED) {
				pos++
			}
			this._line++
			this._line_offset = pos
		}

		this.pos = pos
		return 0
	}

	consume_whitespace(start_line: number, start_column: number): TokenType {
		const source = this.source
		const source_length = source.length
		let start = this.pos
		// Hoisted to locals (synced back once), same as next_token_fast's inline skip.
		let pos = start
		let line = this._line
		let line_offset = this._line_offset
		// Inline advance: read ch once, pos++, then track newlines with already-read value
		while (pos < source_length) {
			let ch = source.charCodeAt(pos)
			if (ch >= 128 || (char_types[ch] & (CHAR_WHITESPACE | CHAR_NEWLINE)) === 0) break
			pos++
			if ((char_types[ch] & CHAR_NEWLINE) !== 0) {
				if (
					ch === CHAR_CARRIAGE_RETURN &&
					pos < source_length &&
					source.charCodeAt(pos) === CHAR_LINE_FEED
				) {
					pos++
				}
				line++
				line_offset = pos
			}
		}
		this.pos = pos
		this._line = line
		this._line_offset = line_offset
		return this.make_token(TOKEN_WHITESPACE, start, pos, start_line, start_column)
	}

	consume_string(quote: number, start_line: number, start_column: number): TokenType {
		const source = this.source
		const source_length = source.length
		let start = this.pos
		this.pos++ // Skip opening quote — quote chars are never newlines

		while (this.pos < source_length) {
			let ch = source.charCodeAt(this.pos)

			// Closing quote
			if (ch === quote) {
				this.pos++
				return this.make_token(TOKEN_STRING, start, this.pos, start_line, start_column)
			}

			// Newline: unclosed string
			if (ch < 128 && (char_types[ch] & CHAR_NEWLINE) !== 0) {
				return this.make_token(TOKEN_BAD_STRING, start, this.pos, start_line, start_column)
			}

			// Escape sequence
			if (ch === CHAR_BACKSLASH) {
				this.pos++ // \ is never a newline
				if (this.pos < source_length) {
					let next = source.charCodeAt(this.pos)
					if (is_hex_digit(next)) {
						this.consume_hex_escape()
					} else if (next < 128 && (char_types[next] & CHAR_NEWLINE) !== 0) {
						// Escaped newline: track line but continue string
						this.pos++
						if (
							next === CHAR_CARRIAGE_RETURN &&
							this.pos < source_length &&
							source.charCodeAt(this.pos) === CHAR_LINE_FEED
						) {
							this.pos++
						}
						this._line++
						this._line_offset = this.pos
					} else {
						// Any other char (including non-ASCII) — not a newline
						this.pos++
					}
				}
				continue
			}

			// Regular string character — not a newline (handled above), safe to pos++
			this.pos++
		}

		// EOF: unclosed string
		return this.make_token(TOKEN_BAD_STRING, start, this.pos, start_line, start_column)
	}

	consume_hex_escape(): void {
		const source = this.source
		const source_length = source.length
		// Consume up to 6 hex digits — hex digits are never newlines, use pos++
		let count = 0
		while (count < 6 && this.pos < source_length) {
			let ch = source.charCodeAt(this.pos)
			if (!is_hex_digit(ch)) break
			this.pos++ // hex digits: 0-9, a-f, A-F — never newlines
			count++
		}
		// Optional whitespace after hex escape (may be a newline — inline advance)
		if (this.pos < source_length) {
			let ch = source.charCodeAt(this.pos)
			if (ch < 128 && (char_types[ch] & (CHAR_WHITESPACE | CHAR_NEWLINE)) !== 0) {
				this.pos++
				if ((char_types[ch] & CHAR_NEWLINE) !== 0) {
					if (
						ch === CHAR_CARRIAGE_RETURN &&
						this.pos < source_length &&
						source.charCodeAt(this.pos) === CHAR_LINE_FEED
					) {
						this.pos++
					}
					this._line++
					this._line_offset = this.pos
				}
			}
		}
	}

	consume_number(start_line: number, start_column: number): TokenType {
		const source = this.source
		const source_length = source.length
		let start = this.pos
		// Numbers never contain newlines, so the whole scan can run on a local var —
		// no line/column bookkeeping to keep in sync with this.pos along the way.
		let pos = start

		// Optional sign — + and - are never newlines
		let ch = source.charCodeAt(pos)
		if (ch === CHAR_PLUS || ch === CHAR_HYPHEN) {
			pos++
		}

		// Integer part — digits are never newlines, use pos++
		while (pos < source_length) {
			let ch = source.charCodeAt(pos)
			if (ch >= 128 || (char_types[ch] & CHAR_DIGIT) === 0) break
			pos++
		}

		// Decimal part
		if (pos < source_length && source.charCodeAt(pos) === CHAR_DOT && pos + 1 < source_length) {
			let next = source.charCodeAt(pos + 1)
			if (next < 128 && (char_types[next] & CHAR_DIGIT) !== 0) {
				pos++ // . is never a newline
				while (pos < source_length) {
					let ch = source.charCodeAt(pos)
					if (ch >= 128 || (char_types[ch] & CHAR_DIGIT) === 0) break
					pos++ // digits: never newlines
				}
			}
		}

		// Exponent: e or E
		if (pos < source_length) {
			let ch = source.charCodeAt(pos)
			if (ch === CHAR_LOWERCASE_E || ch === CHAR_UPPERCASE_E) {
				let next = pos + 1 < source_length ? source.charCodeAt(pos + 1) : 0
				let is_next_digit = next < 128 && (char_types[next] & CHAR_DIGIT) !== 0
				let next2 = pos + 2 < source_length ? source.charCodeAt(pos + 2) : 0
				let is_next2_digit = next2 < 128 && (char_types[next2] & CHAR_DIGIT) !== 0
				if (is_next_digit || ((next === CHAR_PLUS || next === CHAR_HYPHEN) && is_next2_digit)) {
					pos++ // e/E — never a newline
					if (pos < source_length) {
						let sign = source.charCodeAt(pos)
						if (sign === CHAR_PLUS || sign === CHAR_HYPHEN) {
							pos++ // +/- — never a newline
						}
					}
					while (pos < source_length) {
						let ch = source.charCodeAt(pos)
						if (ch >= 128 || (char_types[ch] & CHAR_DIGIT) === 0) break
						pos++ // digits: never newlines
					}
				}
			}
		}

		// Check for unit (dimension) or percentage
		if (pos < source_length) {
			let ch = source.charCodeAt(pos)
			if (ch === CHAR_PERCENT) {
				pos++ // % is never a newline
				this.pos = pos
				return this.make_token(TOKEN_PERCENTAGE, start, pos, start_line, start_column)
			}
			if (
				is_ident_start(ch) ||
				(ch === CHAR_HYPHEN &&
					is_ident_start(pos + 1 < source_length ? source.charCodeAt(pos + 1) : 0))
			) {
				// Unit: px, em, rem, etc — ident chars and non-ASCII are never newlines
				while (pos < source_length) {
					let ch = source.charCodeAt(pos)
					if (ch < 0x80 && (char_types[ch] & CHAR_IDENT) === 0) break
					pos++
				}
				this.pos = pos
				return this.make_token(TOKEN_DIMENSION, start, pos, start_line, start_column)
			}
		}

		this.pos = pos
		return this.make_token(TOKEN_NUMBER, start, pos, start_line, start_column)
	}

	consume_ident_or_function(start_line: number, start_column: number): TokenType {
		const source = this.source
		const source_length = source.length
		let start = this.pos
		// Hoisted to a local: the common case below (plain ident chars, no escapes) never
		// touches line/column, so it can advance a local var instead of this.pos on every
		// char, syncing back only when the rare backslash-escape path needs this.pos (which
		// it reads/writes directly, including via this.advance() for line tracking).
		let pos = start

		// Consume identifier (with escape sequence support)
		while (pos < source_length) {
			let ch = source.charCodeAt(pos)

			// Handle escape sequences: \ followed by hex digits or any character
			if (ch === CHAR_BACKSLASH) {
				this.pos = pos
				if (this.pos + 1 >= source_length) break

				let next = source.charCodeAt(this.pos + 1)

				if (is_newline(next)) break

				this.pos++ // consume \ — backslash is never a newline

				if (is_hex_digit(next)) {
					this.pos++ // consume first hex digit — hex digits: never newlines
					// Consume up to 5 more hex digits (total 6)
					for (let i = 0; i < 5 && this.pos < source_length; i++) {
						if (!is_hex_digit(source.charCodeAt(this.pos))) break
						this.pos++ // hex digits: never newlines
					}
					// Consume optional whitespace after hex escape (may be newline)
					if (this.pos < source_length) {
						let ws = source.charCodeAt(this.pos)
						if (ws < 128 && (char_types[ws] & (CHAR_WHITESPACE | CHAR_NEWLINE)) !== 0) {
							this.advance()
						}
					}
				} else {
					// Escape any other character (not newline, already checked)
					// Non-newline chars: safe to pos++
					this.pos++
				}
				pos = this.pos
			} else if (ch >= 0x80 || (char_types[ch] & CHAR_IDENT) !== 0) {
				// Normal identifier character — ident chars (a-z,A-Z,0-9,-,_) and
				// non-ASCII code units are never newlines (newlines are 0x0A/0x0D/0x0C)
				pos++
			} else {
				break
			}
		}
		this.pos = pos

		// Check for unicode-range: u+ or U+
		if (this.pos - start === 1) {
			let first_ch = source.charCodeAt(start)
			if (
				(first_ch === CHAR_LOWERCASE_U || first_ch === CHAR_UPPERCASE_U) &&
				this.pos < source_length &&
				source.charCodeAt(this.pos) === CHAR_PLUS
			) {
				return this.consume_unicode_range(start, start_line, start_column)
			}
		}

		// Check for function: ident(
		if (this.pos < source_length && source.charCodeAt(this.pos) === CHAR_LEFT_PAREN) {
			this.pos++ // ( is never a newline
			return this.make_token(TOKEN_FUNCTION, start, this.pos, start_line, start_column)
		}

		return this.make_token(TOKEN_IDENT, start, this.pos, start_line, start_column)
	}

	consume_unicode_range(start: number, start_line: number, start_column: number): TokenType {
		const source = this.source
		const source_length = source.length
		// We're positioned after 'u' or 'U', at the '+'
		this.pos++ // consume '+' — never a newline

		let hex_digits = 0
		let has_question = false

		// Consume hex digits and/or question marks (up to 6 total)
		// Hex digits and ? are never newlines — use pos++
		while (this.pos < source_length && hex_digits < 6) {
			let ch = source.charCodeAt(this.pos)
			if (is_hex_digit(ch)) {
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
			return this.make_token(TOKEN_UNICODE_RANGE, start, this.pos, start_line, start_column)
		}

		// Check for range syntax: -HHHHHH
		if (this.pos < source_length && source.charCodeAt(this.pos) === CHAR_HYPHEN) {
			if (this.pos + 1 < source_length && is_hex_digit(source.charCodeAt(this.pos + 1))) {
				this.pos++ // consume '-' — never a newline

				let end_hex_digits = 0
				while (this.pos < source_length && end_hex_digits < 6) {
					let ch = source.charCodeAt(this.pos)
					if (is_hex_digit(ch)) {
						this.pos++ // hex digits: never newlines
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
		const source = this.source
		const source_length = source.length
		let start = this.pos
		let pos = start + 1 // Skip @ — never a newline

		// Ident chars (a-z,A-Z,0-9,-,_) and non-ASCII are never newlines — use pos++
		while (pos < source_length) {
			let ch = source.charCodeAt(pos)
			if (ch < 0x80 && (char_types[ch] & CHAR_IDENT) === 0) break
			pos++
		}

		this.pos = pos
		return this.make_token(TOKEN_AT_KEYWORD, start, pos, start_line, start_column)
	}

	consume_hash(start_line: number, start_column: number): TokenType {
		const source = this.source
		const source_length = source.length
		let start = this.pos
		let pos = start + 1 // Skip # — never a newline

		// Ident chars and non-ASCII are never newlines — use pos++
		while (pos < source_length) {
			let ch = source.charCodeAt(pos)
			if (ch < 0x80 && (char_types[ch] & CHAR_IDENT) === 0) break
			pos++
		}

		this.pos = pos
		return this.make_token(TOKEN_HASH, start, pos, start_line, start_column)
	}

	advance(count: number = 1): void {
		// Fast path for advance(1) - most common case
		if (count === 1) {
			if (this.pos >= this.source.length) return

			let ch = this.source.charCodeAt(this.pos)
			this.pos++

			// Inline newline check - only update on newline
			if (ch < 128 && (char_types[ch] & CHAR_NEWLINE) !== 0) {
				// Handle \r\n as single newline
				if (
					ch === CHAR_CARRIAGE_RETURN &&
					this.pos < this.source.length &&
					this.source.charCodeAt(this.pos) === CHAR_LINE_FEED
				) {
					this.pos++
				}
				this._line++
				this._line_offset = this.pos
			}
			return
		}

		// General case for count > 1
		for (let i = 0; i < count; i++) {
			if (this.pos >= this.source.length) break

			let ch = this.source.charCodeAt(this.pos)
			this.pos++

			// Inline newline check - only update on newline
			if (ch < 128 && (char_types[ch] & CHAR_NEWLINE) !== 0) {
				// Handle \r\n as single newline
				if (
					ch === CHAR_CARRIAGE_RETURN &&
					this.pos < this.source.length &&
					this.source.charCodeAt(this.pos) === CHAR_LINE_FEED
				) {
					this.pos++
					i++ // Count \r\n as 2 characters for advance(count)
				}
				this._line++
				this._line_offset = this.pos
			}
		}
	}

	peek(offset: number = 1): number {
		let index = this.pos + offset
		if (index >= this.source.length) return 0
		return this.source.charCodeAt(index)
	}

	make_token(
		type: TokenType,
		start: number,
		end: number,
		line: number = this._line,
		column: number = this.pos - this._line_offset + 1,
	): TokenType {
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
			line: this._line,
			column: this.pos - this._line_offset + 1,
			_line_offset: this._line_offset,
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
		this._line = saved.line
		this._line_offset = saved._line_offset
		this.token_type = saved.token_type
		this.token_start = saved.token_start
		this.token_end = saved.token_end
		this.token_line = saved.token_line
		this.token_column = saved.token_column
	}

	/**
	 * Skip whitespace and comments within a range, maintaining line/column tracking
	 * @param end The end boundary (exclusive)
	 */
	skip_whitespace_in_range(end: number): void {
		while (this.pos < end) {
			let ch = this.source.charCodeAt(this.pos)

			// Skip whitespace (space, tab, and newlines — is_whitespace() from string-utils
			// covers newlines too, but here we go straight to char_types to avoid the import)
			if (ch < 128 && (char_types[ch] & (CHAR_WHITESPACE | CHAR_NEWLINE)) !== 0) {
				this.advance()
				continue
			}

			// Skip comments /*...*/
			if (
				ch === CHAR_FORWARD_SLASH &&
				this.pos + 1 < end &&
				this.source.charCodeAt(this.pos + 1) === CHAR_ASTERISK
			) {
				this.advance() // skip /
				this.advance() // skip *
				while (this.pos < end) {
					if (
						this.source.charCodeAt(this.pos) === CHAR_ASTERISK &&
						this.pos + 1 < end &&
						this.source.charCodeAt(this.pos + 1) === CHAR_FORWARD_SLASH
					) {
						this.advance() // skip *
						this.advance() // skip /
						break
					}
					this.advance()
				}
				continue
			}

			break // Found non-whitespace, non-comment
		}
	}
}

/**
 * Tokenize CSS source code
 * @param source - The CSS source code to tokenize
 * @param on_comment - Optional callback for comment tokens
 * @yields CSS tokens
 */
export function* tokenize(
	source: string,
	on_comment?: (info: CommentInfo) => void,
): Generator<Token, void, undefined> {
	const lexer = new Lexer(source, on_comment)

	while (true) {
		const token = lexer.next_token()
		if (!token || token.type === TOKEN_EOF) {
			break
		}
		yield token
	}
}
