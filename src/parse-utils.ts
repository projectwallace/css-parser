import {
	CHAR_ASTERISK,
	CHAR_COLON,
	CHAR_FORWARD_SLASH,
	CHAR_LEFT_PAREN,
	CHAR_RIGHT_PAREN,
	CHAR_CARRIAGE_RETURN,
	CHAR_FORM_FEED,
	is_whitespace,
} from './string-utils'

/**
 * Maps source offsets to 1-based line/column, counting newlines the way the lexer does
 * (`\n`, `\r`, `\r\n` and `\f`). Sub-parsers that scan ranges by offset use it to give nodes
 * the position of their *start*, instead of wherever their lexer happens to be afterwards.
 * Anchor it once with `reset()` at a known offset/line/column, then query offsets at or after
 * the anchor; queries mostly move forward, so each one only scans the gap since the last.
 */
export class PositionTracker {
	private source: string
	private anchor_offset = 0
	private anchor_line = 1
	private anchor_column = 1
	private offset = 0
	line = 1
	column = 1

	constructor(source: string) {
		this.source = source
	}

	reset(offset: number, line: number, column: number): void {
		this.anchor_offset = this.offset = offset
		this.anchor_line = this.line = line
		this.anchor_column = this.column = column
	}

	// Move to `target` (clamped to the anchor); the result is in `line`/`column`
	seek(target: number): void {
		if (target < this.offset) {
			this.offset = this.anchor_offset
			this.line = this.anchor_line
			this.column = this.anchor_column
		}
		const source = this.source
		let line = this.line
		let column = this.column
		let i = this.offset
		while (i < target) {
			const c = source.charCodeAt(i++)
			if (c === 0x0a || c === CHAR_FORM_FEED) {
				line++
				column = 1
			} else if (c === CHAR_CARRIAGE_RETURN) {
				if (i < target && source.charCodeAt(i) === 0x0a) i++
				line++
				column = 1
			} else {
				column++
			}
		}
		this.offset = i
		this.line = line
		this.column = column
	}

	line_at(offset: number): number {
		this.seek(offset)
		return this.line
	}

	column_at(offset: number): number {
		this.seek(offset)
		return this.column
	}
}

export function skip_whitespace_forward(source: string, pos: number, end: number): number {
	while (pos < end && is_whitespace(source.charCodeAt(pos))) {
		pos++
	}
	return pos
}

export function skip_whitespace_and_comments_forward(
	source: string,
	pos: number,
	end: number,
): number {
	while (pos < end) {
		const ch = source.charCodeAt(pos)

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

export function skip_whitespace_and_comments_backward(
	source: string,
	pos: number,
	start: number,
): number {
	while (pos > start) {
		const ch = source.charCodeAt(pos - 1)

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

// Trims whitespace and CSS comments from both ends; returns null if the range is only whitespace/comments.
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

// Find the position of the first ':' at parenthesis depth 0 in [start, end). Returns -1 if not found.
export function find_colon_at_depth_zero(source: string, start: number, end: number): number {
	let depth = 0
	for (let i = start; i < end; i++) {
		const ch = source.charCodeAt(i)
		if (ch === CHAR_LEFT_PAREN) depth++
		else if (ch === CHAR_RIGHT_PAREN) depth--
		else if (ch === CHAR_COLON && depth === 0) return i
	}
	return -1
}
