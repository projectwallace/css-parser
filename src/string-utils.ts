// String utility functions for CSS parsing

// Character constants (exported for use in parsers)
export const CHAR_SPACE = 0x20 // ' '
export const CHAR_TAB = 0x09 // '\t'
export const CHAR_NEWLINE = 0x0a // '\n'
export const CHAR_CARRIAGE_RETURN = 0x0d // '\r'
export const CHAR_FORM_FEED = 0x0c // '\f'
export const CHAR_FORWARD_SLASH = 0x2f // '/'
export const CHAR_ASTERISK = 0x2a // '*'
export const CHAR_MINUS_HYPHEN = 0x2d // '-'

/**
 * Check if a character code is whitespace (space, tab, newline, CR, or FF)
 */
export function is_whitespace(ch: number): boolean {
	return ch === CHAR_SPACE || ch === CHAR_TAB || ch === CHAR_NEWLINE || ch === CHAR_CARRIAGE_RETURN || ch === CHAR_FORM_FEED
}

/**
 * Trim whitespace and comments from both ends of a string range
 *
 * @param source - The source string
 * @param start - Start offset in source
 * @param end - End offset in source
 * @returns [trimmed_start, trimmed_end] or null if all whitespace/comments
 *
 * Skips whitespace (space, tab, newline, CR, FF) and CSS comments from both ends
 * of the specified range. Returns the trimmed boundaries or null if the range
 * contains only whitespace and comments.
 */
export function trim_boundaries(source: string, start: number, end: number): [number, number] | null {
	// Trim from start
	while (start < end) {
		let ch = source.charCodeAt(start)

		// Skip whitespace
		if (is_whitespace(ch)) {
			start++
			continue
		}

		// Skip comments
		if (ch === CHAR_FORWARD_SLASH && start + 1 < end && source.charCodeAt(start + 1) === CHAR_ASTERISK) {
			// Find end of comment
			start += 2 // Skip /*
			while (start < end) {
				if (source.charCodeAt(start) === CHAR_ASTERISK && start + 1 < end && source.charCodeAt(start + 1) === CHAR_FORWARD_SLASH) {
					start += 2 // Skip */
					break
				}
				start++
			}
			continue
		}

		// Found non-whitespace, non-comment
		break
	}

	// Trim from end
	while (end > start) {
		let ch = source.charCodeAt(end - 1)

		// Skip whitespace
		if (is_whitespace(ch)) {
			end--
			continue
		}

		// Skip comments (work backwards)
		if (end >= 2 && ch === CHAR_FORWARD_SLASH && source.charCodeAt(end - 2) === CHAR_ASTERISK) {
			// Find start of comment
			end -= 2 // Skip */
			while (end > start) {
				if (end >= 2 && source.charCodeAt(end - 2) === CHAR_FORWARD_SLASH && source.charCodeAt(end - 1) === CHAR_ASTERISK) {
					end -= 2 // Skip /*
					break
				}
				end--
			}
			continue
		}

		// Found non-whitespace, non-comment
		break
	}

	if (start >= end) return null
	return [start, end]
}

/**
 * @param a Base string, MUST be lowercase!
 * @param b Compare string
 */
export function str_equals(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false
	}

	for (let i = 0; i < a.length; i++) {
		let ca = a.charCodeAt(i)
		let cb = b.charCodeAt(i)

		// normalize ASCII uppercase A-Z → a-z
		if (cb >= 65 && cb <= 90) cb |= 32

		if (ca !== cb) {
			return false
		}
	}

	return true
}

/**
 * Check if a string range has a vendor prefix
 *
 * @param source - The source string
 * @param start - Start offset in source
 * @param end - End offset in source
 * @returns true if the range starts with a vendor prefix (-webkit-, -moz-, -ms-, -o-)
 *
 * Detects vendor prefixes by checking:
 * 1. Starts with a single hyphen (not --)
 * 2. Contains at least 3 characters (shortest is -o-)
 * 3. Has a second hyphen after the vendor name
 *
 * Examples:
 * - `-webkit-transform` → true
 * - `-moz-appearance` → true
 * - `-ms-filter` → true
 * - `-o-border-image` → true
 * - `--custom-property` → false (CSS custom property)
 * - `border-radius` → false (doesn't start with hyphen)
 */
export function is_vendor_prefixed(source: string, start: number, end: number): boolean {
	// Must start with a hyphen
	if (source.charCodeAt(start) !== CHAR_MINUS_HYPHEN) {
		return false
	}

	// Second char must not be a hyphen (to exclude CSS custom properties like --var)
	if (source.charCodeAt(start + 1) === CHAR_MINUS_HYPHEN) {
		return false
	}

	// Must be at least 3 chars (-o- is shortest vendor prefix)
	let length = end - start
	if (length < 3) {
		return false
	}

	// Must have another hyphen after the vendor name
	// This identifies: -webkit-, -moz-, -ms-, -o-
	let secondHyphenPos = source.indexOf('-', start + 2)
	return secondHyphenPos !== -1 && secondHyphenPos < end
}
