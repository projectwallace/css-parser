import {
	CHAR_ASTERISK,
	CHAR_BACKSLASH,
	CHAR_CARRIAGE_RETURN,
	CHAR_DOUBLE_QUOTE,
	CHAR_FORWARD_SLASH,
	CHAR_LEFT_BRACE,
	CHAR_LEFT_PAREN,
	CHAR_NEWLINE,
	CHAR_RIGHT_PAREN,
	CHAR_SEMICOLON,
	CHAR_SINGLE_QUOTE,
	is_whitespace,
} from './string-utils'

/**
 * Skip whitespace forward from a position
 *
 * @param source - The source string
 * @param pos - Starting position
 * @param end - End boundary (exclusive)
 * @returns New position after skipping whitespace
 * @internal
 */
export function skip_whitespace_forward(source: string, pos: number, end: number): number {
	while (pos < end && is_whitespace(source.charCodeAt(pos))) {
		pos++
	}
	return pos
}

/**
 * Skip whitespace and comments forward from a position
 *
 * @param source - The source string
 * @param pos - Starting position
 * @param end - End boundary (exclusive)
 * @returns New position after skipping whitespace/comments
 * @internal
 */
export function skip_whitespace_and_comments_forward(
	source: string,
	pos: number,
	end: number,
): number {
	while (pos < end) {
		let ch = source.charCodeAt(pos)

		// Skip whitespace
		if (is_whitespace(ch)) {
			pos++
			continue
		}

		// Skip comments /*...*/
		if (
			ch === CHAR_FORWARD_SLASH &&
			pos + 1 < end &&
			source.charCodeAt(pos + 1) === CHAR_ASTERISK
		) {
			pos += 2 // Skip /*
			while (pos < end) {
				if (
					source.charCodeAt(pos) === CHAR_ASTERISK &&
					pos + 1 < end &&
					source.charCodeAt(pos + 1) === CHAR_FORWARD_SLASH
				) {
					pos += 2 // Skip */
					break
				}
				pos++
			}
			continue
		}

		break // Found non-whitespace, non-comment
	}
	return pos
}

/**
 * Skip whitespace and comments backward from a position
 *
 * @param source - The source string
 * @param pos - Starting position (exclusive, scanning backward from pos-1)
 * @param start - Start boundary (inclusive, won't go before this)
 * @returns New position after skipping whitespace/comments backward
 * @internal
 */
export function skip_whitespace_and_comments_backward(
	source: string,
	pos: number,
	start: number,
): number {
	while (pos > start) {
		let ch = source.charCodeAt(pos - 1)

		// Skip whitespace
		if (is_whitespace(ch)) {
			pos--
			continue
		}

		// Skip comments /*...*/ (work backwards from */)
		if (pos >= 2 && ch === CHAR_FORWARD_SLASH && source.charCodeAt(pos - 2) === CHAR_ASTERISK) {
			pos -= 2 // Skip */
			while (pos > start) {
				if (
					pos >= 2 &&
					source.charCodeAt(pos - 2) === CHAR_FORWARD_SLASH &&
					source.charCodeAt(pos - 1) === CHAR_ASTERISK
				) {
					pos -= 2 // Skip /*
					break
				}
				pos--
			}
			continue
		}

		break // Found non-whitespace, non-comment
	}
	return pos
}

/**
 * Trim whitespace and comments from both ends of a string range
 *
 * @param source - The source string
 * @param start - Start offset in source
 * @param end - End offset in source
 * @returns [trimmed_start, trimmed_end] or null if all whitespace/comments
 * @internal
 *
 * Skips whitespace (space, tab, newline, CR, FF) and CSS comments from both ends
 * of the specified range. Returns the trimmed boundaries or null if the range
 * contains only whitespace and comments.
 */
export function trim_boundaries(
	source: string,
	start: number,
	end: number,
): [number, number] | null {
	start = skip_whitespace_and_comments_forward(source, start, end)
	end = skip_whitespace_and_comments_backward(source, end, start)

	if (start >= end) return null
	return [start, end]
}

/**
 * Raw character scan to locate the opening `{` of a CSS block, without full
 * tokenization. Handles strings and comments to avoid false matches, and
 * tracks newlines so the caller can reposition a Lexer accurately afterward.
 *
 * Returns `[pos, line, line_offset]` where `pos` is the position of `{`
 * (or `source.length` if not found), and `line`/`line_offset` are the
 * line-tracking state at that position.
 * @internal
 */
export function scan_to_open_brace(
	source: string,
	pos: number,
	line: number,
	line_offset: number,
): [number, number, number] {
	const len = source.length
	let i = pos

	while (i < len) {
		const ch = source.charCodeAt(i)

		if (ch === CHAR_LEFT_BRACE) return [i, line, line_offset]

		// Comments: /* ... */
		if (ch === CHAR_FORWARD_SLASH && i + 1 < len && source.charCodeAt(i + 1) === CHAR_ASTERISK) {
			i += 2
			while (i < len) {
				const c = source.charCodeAt(i)
				if (c === CHAR_ASTERISK && i + 1 < len && source.charCodeAt(i + 1) === CHAR_FORWARD_SLASH) {
					i += 2
					break
				}
				if (c === CHAR_NEWLINE) {
					line++
					line_offset = i + 1
				} else if (c === CHAR_CARRIAGE_RETURN) {
					line++
					if (i + 1 < len && source.charCodeAt(i + 1) === CHAR_NEWLINE) i++
					line_offset = i + 1
				}
				i++
			}
			continue
		}

		// Strings: '...' or "..."
		if (ch === CHAR_SINGLE_QUOTE || ch === CHAR_DOUBLE_QUOTE) {
			const quote = ch
			i++
			while (i < len) {
				const c = source.charCodeAt(i)
				if (c === quote) {
					i++
					break
				}
				if (c === CHAR_BACKSLASH) {
					i++ // skip escaped char
				} else if (c === CHAR_NEWLINE) {
					line++
					line_offset = i + 1
				} else if (c === CHAR_CARRIAGE_RETURN) {
					line++
					if (i + 1 < len && source.charCodeAt(i + 1) === CHAR_NEWLINE) i++
					line_offset = i + 1
				}
				i++
			}
			continue
		}

		// Backslash escape outside strings (e.g. \{ in a selector)
		if (ch === CHAR_BACKSLASH && i + 1 < len) {
			i++
			const next = source.charCodeAt(i)
			if (next === CHAR_NEWLINE) {
				line++
				line_offset = i + 1
			} else if (next === CHAR_CARRIAGE_RETURN) {
				line++
				if (i + 1 < len && source.charCodeAt(i + 1) === CHAR_NEWLINE) i++
				line_offset = i + 1
			}
			i++
			continue
		}

		if (ch === CHAR_NEWLINE) {
			line++
			line_offset = i + 1
		} else if (ch === CHAR_CARRIAGE_RETURN) {
			line++
			if (i + 1 < len && source.charCodeAt(i + 1) === CHAR_NEWLINE) i++
			line_offset = i + 1
		}

		i++
	}

	return [i, line, line_offset]
}

/**
 * Raw character scan to locate the end of an at-rule prelude: `{` or `;`
 * (whichever comes first at parenthesis depth 0). Handles strings, comments,
 * paren depth (so semicolons inside `url(data:...;...)` are skipped), and
 * tracks newlines so the caller can reposition a Lexer accurately afterward.
 *
 * Returns `[pos, line, line_offset]` at the position of the boundary character.
 * @internal
 */
export function scan_to_block_or_semi(
	source: string,
	pos: number,
	line: number,
	line_offset: number,
): [number, number, number] {
	const len = source.length
	let i = pos
	let depth = 0

	while (i < len) {
		const ch = source.charCodeAt(i)

		if (depth === 0 && (ch === CHAR_LEFT_BRACE || ch === CHAR_SEMICOLON)) {
			return [i, line, line_offset]
		}

		if (ch === CHAR_LEFT_PAREN) {
			depth++
			i++
			continue
		}
		if (ch === CHAR_RIGHT_PAREN) {
			if (depth > 0) depth--
			i++
			continue
		}

		// Comments
		if (ch === CHAR_FORWARD_SLASH && i + 1 < len && source.charCodeAt(i + 1) === CHAR_ASTERISK) {
			i += 2
			while (i < len) {
				const c = source.charCodeAt(i)
				if (c === CHAR_ASTERISK && i + 1 < len && source.charCodeAt(i + 1) === CHAR_FORWARD_SLASH) {
					i += 2
					break
				}
				if (c === CHAR_NEWLINE) {
					line++
					line_offset = i + 1
				} else if (c === CHAR_CARRIAGE_RETURN) {
					line++
					if (i + 1 < len && source.charCodeAt(i + 1) === CHAR_NEWLINE) i++
					line_offset = i + 1
				}
				i++
			}
			continue
		}

		// Strings
		if (ch === CHAR_SINGLE_QUOTE || ch === CHAR_DOUBLE_QUOTE) {
			const quote = ch
			i++
			while (i < len) {
				const c = source.charCodeAt(i)
				if (c === quote) {
					i++
					break
				}
				if (c === CHAR_BACKSLASH) {
					i++
				} else if (c === CHAR_NEWLINE) {
					line++
					line_offset = i + 1
				} else if (c === CHAR_CARRIAGE_RETURN) {
					line++
					if (i + 1 < len && source.charCodeAt(i + 1) === CHAR_NEWLINE) i++
					line_offset = i + 1
				}
				i++
			}
			continue
		}

		// Backslash escape
		if (ch === CHAR_BACKSLASH && i + 1 < len) {
			i++
			const next = source.charCodeAt(i)
			if (next === CHAR_NEWLINE) {
				line++
				line_offset = i + 1
			} else if (next === CHAR_CARRIAGE_RETURN) {
				line++
				if (i + 1 < len && source.charCodeAt(i + 1) === CHAR_NEWLINE) i++
				line_offset = i + 1
			}
			i++
			continue
		}

		if (ch === CHAR_NEWLINE) {
			line++
			line_offset = i + 1
		} else if (ch === CHAR_CARRIAGE_RETURN) {
			line++
			if (i + 1 < len && source.charCodeAt(i + 1) === CHAR_NEWLINE) i++
			line_offset = i + 1
		}

		i++
	}

	return [i, line, line_offset]
}
