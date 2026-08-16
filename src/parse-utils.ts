import {
	CHAR_ASTERISK,
	CHAR_COLON,
	CHAR_FORWARD_SLASH,
	CHAR_LEFT_PAREN,
	CHAR_RIGHT_PAREN,
	is_whitespace,
} from './string-utils'

/** @internal */
export function skip_whitespace_forward(source: string, pos: number, end: number): number {
	while (pos < end && is_whitespace(source.charCodeAt(pos))) {
		pos++
	}
	return pos
}

/** @internal */
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

/** @internal */
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
 * Trims whitespace and CSS comments from both ends; returns null if the range is only whitespace/comments.
 * @internal
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

/** Find the position of the first ':' at parenthesis depth 0 in [start, end). Returns -1 if not found. @internal */
export function find_colon_at_depth_zero(source: string, start: number, end: number): number {
	let depth = 0
	for (let i = start; i < end; i++) {
		let ch = source.charCodeAt(i)
		if (ch === CHAR_LEFT_PAREN) depth++
		else if (ch === CHAR_RIGHT_PAREN) depth--
		else if (ch === CHAR_COLON && depth === 0) return i
	}
	return -1
}
