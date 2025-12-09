// String utility functions for CSS parsing

// Character constants (exported for use in parsers)
export const CHAR_SPACE = 0x20 // ' '
export const CHAR_TAB = 0x09 // \t
export const CHAR_NEWLINE = 0x0a // \n
export const CHAR_CARRIAGE_RETURN = 0x0d // \r
export const CHAR_FORM_FEED = 0x0c // \f
export const CHAR_FORWARD_SLASH = 0x2f // '/'
export const CHAR_ASTERISK = 0x2a // *
export const CHAR_MINUS_HYPHEN = 0x2d // -
export const CHAR_SINGLE_QUOTE = 0x27 // '
export const CHAR_DOUBLE_QUOTE = 0x22 // "
export const CHAR_PLUS = 0x2b // +
export const CHAR_PERIOD = 0x2e // .
export const CHAR_TILDE = 0x7e // ~
export const CHAR_GREATER_THAN = 0x3e // >
export const CHAR_AMPERSAND = 0x26 // &
export const CHAR_EQUALS = 0x3d // =
export const CHAR_PIPE = 0x7c // |
export const CHAR_DOLLAR = 0x24 // $
export const CHAR_CARET = 0x5e // ^
export const CHAR_COLON = 0x3a // :

/**
 * Check if a character code is whitespace (space, tab, newline, CR, or FF)
 */
export function is_whitespace(ch: number): boolean {
	return ch === CHAR_SPACE || ch === CHAR_TAB || ch === CHAR_NEWLINE || ch === CHAR_CARRIAGE_RETURN || ch === CHAR_FORM_FEED
}

export function is_combinator(ch: number): boolean {
	return ch === CHAR_GREATER_THAN || ch === CHAR_PLUS || ch === CHAR_TILDE
}

export function is_digit(ch: number): boolean {
	return ch >= 0x30 && ch <= 0x39 // 0-9
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
		cb |= 32

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
	// Use bounded loop instead of unbounded indexOf() to only search within the range
	for (let i = start + 2; i < end; i++) {
		if (source.charCodeAt(i) === CHAR_MINUS_HYPHEN) {
			return true
		}
	}
	return false
}
