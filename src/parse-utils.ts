import { CHAR_ASTERISK, CHAR_FORWARD_SLASH, is_whitespace, is_digit, CHAR_MINUS_HYPHEN, CHAR_PLUS, CHAR_PERIOD } from './string-utils'

/**
 * Parse a dimension string into numeric value and unit
 *
 * @param text - Dimension text like "100px", "50%", "1.5em"
 * @returns Object with value (number) and unit (string)
 *
 * Examples:
 * - "100px" → { value: 100, unit: "px" }
 * - "50%" → { value: 50, unit: "%" }
 * - "1.5em" → { value: 1.5, unit: "em" }
 * - "-10rem" → { value: -10, unit: "rem" }
 */
export function parse_dimension(text: string): { value: number; unit: string } {
	// Find where the numeric part ends
	let num_end = 0
	for (let i = 0; i < text.length; i++) {
		let ch = text.charCodeAt(i)

		// Check for e/E (scientific notation)
		if (ch === 0x65 || ch === 0x45) {
			// e or E
			// Only allow e/E if followed by digit or sign+digit
			if (i + 1 < text.length) {
				let next_ch = text.charCodeAt(i + 1)
				// Check if next is digit
				if (is_digit(next_ch)) {
					num_end = i + 1
					continue
				}
				// Check if next is sign followed by digit
				if ((next_ch === 0x2b || next_ch === 0x2d) && i + 2 < text.length) {
					let afterSign = text.charCodeAt(i + 2)
					if (is_digit(afterSign)) {
						num_end = i + 1
						continue
					}
				}
			}
			// e/E not followed by valid scientific notation, stop
			break
		}

		// Allow digits, dot, minus, plus
		if (is_digit(ch) || ch === CHAR_PERIOD || ch === CHAR_MINUS_HYPHEN || ch === CHAR_PLUS) {
			num_end = i + 1
		} else {
			break
		}
	}

	let num_str = text.substring(0, num_end)
	let unit = text.substring(num_end)
	let value = num_str ? parseFloat(num_str) : 0

	return { value, unit }
}

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
export function skip_whitespace_and_comments_forward(source: string, pos: number, end: number): number {
	while (pos < end) {
		let ch = source.charCodeAt(pos)

		// Skip whitespace
		if (is_whitespace(ch)) {
			pos++
			continue
		}

		// Skip comments /*...*/
		if (ch === CHAR_FORWARD_SLASH && pos + 1 < end && source.charCodeAt(pos + 1) === CHAR_ASTERISK) {
			pos += 2 // Skip /*
			while (pos < end) {
				if (source.charCodeAt(pos) === CHAR_ASTERISK && pos + 1 < end && source.charCodeAt(pos + 1) === CHAR_FORWARD_SLASH) {
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
export function skip_whitespace_and_comments_backward(source: string, pos: number, start: number): number {
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
				if (pos >= 2 && source.charCodeAt(pos - 2) === CHAR_FORWARD_SLASH && source.charCodeAt(pos - 1) === CHAR_ASTERISK) {
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
export function trim_boundaries(source: string, start: number, end: number): [number, number] | null {
	start = skip_whitespace_and_comments_forward(source, start, end)
	end = skip_whitespace_and_comments_backward(source, end, start)

	if (start >= end) return null
	return [start, end]
}
