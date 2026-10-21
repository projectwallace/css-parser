import {
	CHAR_ASTERISK,
	CHAR_COLON,
	CHAR_FORWARD_SLASH,
	CHAR_LEFT_PAREN,
	CHAR_RIGHT_PAREN,
	is_whitespace,
} from './string-utils'
import { TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN, TOKEN_FUNCTION, TOKEN_EOF } from './token-types'
import type { Lexer } from './tokenize'

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

// Results of the last scan_matching_paren() call: the positions right before/after the closing ')'.
export const paren_scan = { content_end: 0, close_end: 0 }

// Scan tokens from just after an already-open '(' or function-call (depth 1) to its matching
// ')', never reading past `end`. Returns false if EOF was hit first, in which case
// paren_scan is left at the position scanning started from, so callers that don't check the
// result still get sane fallback spans.
export function scan_matching_paren(lexer: Lexer, end: number): boolean {
	let depth = 1
	let content_end = lexer.pos
	let close_end = lexer.token_end

	while (lexer.pos < end && depth > 0) {
		const token_type = lexer.next_token(false)
		if (token_type === TOKEN_LEFT_PAREN || token_type === TOKEN_FUNCTION) {
			depth++
		} else if (token_type === TOKEN_RIGHT_PAREN) {
			depth--
			if (depth === 0) {
				content_end = lexer.token_start
				close_end = lexer.token_end
			}
		} else if (token_type === TOKEN_EOF) {
			break
		}
	}

	paren_scan.content_end = content_end
	paren_scan.close_end = close_end
	return depth === 0
}
