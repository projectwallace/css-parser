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
export const CHAR_LESS_THAN = 0x3c // <
export const CHAR_LEFT_BRACE = 0x7b // {
export const CHAR_SEMICOLON = 0x3b // ;
export const CHAR_RIGHT_BRACE = 0x7d // }
export const CHAR_LEFT_PAREN = 0x28 // (
export const CHAR_RIGHT_PAREN = 0x29 // )
export const CHAR_EXCLAMATION = 0x21 // !

/** True if the character code is whitespace (space, tab, newline, CR, or FF). */
export function is_whitespace(ch: number): boolean {
	return (
		ch === CHAR_SPACE ||
		ch === CHAR_TAB ||
		ch === CHAR_NEWLINE ||
		ch === CHAR_CARRIAGE_RETURN ||
		ch === CHAR_FORM_FEED
	)
}

/** @internal */
export function is_combinator(ch: number): boolean {
	return ch === CHAR_GREATER_THAN || ch === CHAR_PLUS || ch === CHAR_TILDE
}

export function is_digit(ch: number): boolean {
	return ch >= 0x30 && ch <= 0x39 // 0-9
}

/** Case-insensitive ASCII equality without allocations. `a` MUST be lowercase. */
export function str_equals(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false
	}

	for (let i = 0; i < a.length; i++) {
		const ca = a.charCodeAt(i)
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
 * Case-insensitive equality between `source[start, end)` and `literal`, without allocating a substring first.
 * Same semantics as `str_equals(literal, source.substring(start, end))`. `literal` MUST be lowercase.
 */
export function str_equals_range(
	source: string,
	start: number,
	end: number,
	literal: string,
): boolean {
	if (end - start !== literal.length) {
		return false
	}

	for (let i = 0; i < literal.length; i++) {
		let ch = source.charCodeAt(start + i)
		// normalize ASCII uppercase A-Z → a-z
		ch |= 32

		if (ch !== literal.charCodeAt(i)) {
			return false
		}
	}

	return true
}

/** True if `source[start, end)` is and/or/not (case-insensitive). */
export function is_and_or_not_range(source: string, start: number, end: number): boolean {
	const length = end - start
	if (length === 3) {
		return (
			str_equals_range(source, start, end, 'and') || str_equals_range(source, start, end, 'not')
		)
	}
	return length === 2 && str_equals_range(source, start, end, 'or')
}

/** Case-insensitive ASCII prefix check without allocations. `prefix` MUST be lowercase. */
export function str_starts_with(prefix: string, str: string): boolean {
	if (str.length < prefix.length) {
		return false
	}

	for (let i = 0; i < prefix.length; i++) {
		let ca = str.charCodeAt(i)
		const cb = prefix.charCodeAt(i)

		// normalize only the string char (prefix is already lowercase)
		if (ca >= 65 && ca <= 90) ca |= 32 // A-Z → a-z

		if (ca !== cb) {
			return false
		}
	}

	return true
}

/** Case-insensitive substring search without allocations, or -1 if not found. `search_char` MUST be lowercase. */
export function str_index_of(search_char: string, str: string): number {
	if (search_char.length === 0) {
		return -1
	}

	// Optimize for single character search
	if (search_char.length === 1) {
		const search_code = search_char.charCodeAt(0)
		for (let i = 0; i < str.length; i++) {
			let ca = str.charCodeAt(i)
			// normalize only the string char (search_char is already lowercase)
			if (ca >= 65 && ca <= 90) ca |= 32 // A-Z → a-z
			if (ca === search_code) {
				return i
			}
		}
		return -1
	}

	// Multi-character search
	for (let i = 0; i <= str.length - search_char.length; i++) {
		let match = true
		for (let j = 0; j < search_char.length; j++) {
			let ca = str.charCodeAt(i + j)
			const cb = search_char.charCodeAt(j)
			if (ca >= 65 && ca <= 90) ca |= 32 // A-Z → a-z
			if (ca !== cb) {
				match = false
				break
			}
		}
		if (match) {
			return i
		}
	}
	return -1
}

/** True if the string/range is vendor-prefixed (-webkit-, -moz-, -ms-, -o-). `--custom-property` is not. */
// Overload signatures
export function is_vendor_prefixed(text: string): boolean
export function is_vendor_prefixed(source: string, start: number, end: number): boolean
// Implementation
export function is_vendor_prefixed(source: string, start?: number, end?: number): boolean {
	// Handle string-only overload
	if (start === undefined || end === undefined) {
		start = 0
		end = source.length
	}

	// Must start with a hyphen
	if (source.charCodeAt(start) !== CHAR_MINUS_HYPHEN) {
		return false
	}

	// Second char must not be a hyphen (to exclude CSS custom properties like --var)
	if (source.charCodeAt(start + 1) === CHAR_MINUS_HYPHEN) {
		return false
	}

	// Must be at least 3 chars (-o- is shortest vendor prefix)
	const length = end - start
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

/** True if the string is a CSS custom property (starts with `--`). */
export function is_custom(str: string): boolean {
	// Must start with two hyphens and have at least one character after
	if (str.length < 3) return false
	return str.charCodeAt(0) === CHAR_MINUS_HYPHEN && str.charCodeAt(1) === CHAR_MINUS_HYPHEN
}

/** Strip a vendor prefix, e.g. `-webkit-keyframes` → `keyframes`. Returns the input unchanged if it has no prefix. */
export function strip_vendor_prefix(str: string): string {
	if (!is_vendor_prefixed(str)) {
		return str
	}

	// Find the second hyphen (after the vendor name)
	for (let i = 2; i < str.length; i++) {
		if (str.charCodeAt(i) === CHAR_MINUS_HYPHEN) {
			return str.substring(i + 1)
		}
	}

	// Should never reach here if is_vendor_prefixed returned true
	return str
}

/**
 * Normalized property name: browser hack prefix (`*`, `_`, `#`, …) and vendor prefix removed,
 * lowercased. Custom properties (`--Foo`) keep their case. `*Color` → `color`, `-WEBKIT-Transform` → `transform`.
 */
export function property_basename(str: string): string {
	let start = 0
	const length = str.length
	// Skip hack prefix characters until something that can start a property name
	while (start < length) {
		const ch = str.charCodeAt(start)
		if (
			(ch >= 0x61 && ch <= 0x7a) || // a-z
			(ch >= 0x41 && ch <= 0x5a) || // A-Z
			ch === CHAR_MINUS_HYPHEN ||
			ch === 0x5c || // escape
			ch > 0x7f
		) {
			break
		}
		start++
	}
	if (str.charCodeAt(start) === CHAR_MINUS_HYPHEN) {
		if (str.charCodeAt(start + 1) === CHAR_MINUS_HYPHEN) {
			return start === 0 ? str : str.substring(start)
		}
		// `-webkit-foo` → `foo`; a lone `-` (`-color`) is a browser hack
		const name = start === 0 ? str : str.substring(start)
		if (is_vendor_prefixed(name)) return strip_vendor_prefix(name).toLowerCase()
		return name.substring(1).toLowerCase()
	}
	return (start === 0 ? str : str.substring(start)).toLowerCase()
}

const CHAR_BACKSLASH = 0x5c // \
const CHAR_ZERO = 0x30 // 0
const CHAR_SEVEN = 0x37 // 7
const CHAR_NINE = 0x39 // 9

/**
 * Remove an old-IE value hack postfix: `\9`, `\7`, `\0`, `\0/` and combinations such as `\9\0`.
 * `10px\9` → `10px`, `red \0/` → `red`. Values without a hack are returned unchanged.
 */
export function strip_value_hack(str: string): string {
	let end = str.length
	// `\0/` hack: the slash only counts together with the `\0` before it
	if (
		str.charCodeAt(end - 1) === CHAR_FORWARD_SLASH &&
		str.charCodeAt(end - 2) === CHAR_ZERO &&
		str.charCodeAt(end - 3) === CHAR_BACKSLASH
	) {
		end--
	}
	// One or more `\9` / `\7` / `\0` escapes. An escaped backslash (`\\9`) is not a hack.
	while (end >= 2) {
		const digit = str.charCodeAt(end - 1)
		if (
			(digit === CHAR_ZERO || digit === CHAR_SEVEN || digit === CHAR_NINE) &&
			str.charCodeAt(end - 2) === CHAR_BACKSLASH &&
			str.charCodeAt(end - 3) !== CHAR_BACKSLASH
		) {
			end -= 2
		} else {
			break
		}
	}
	if (end === str.length) return str
	while (end > 0 && is_whitespace(str.charCodeAt(end - 1))) end--
	return str.substring(0, end)
}

function is_hex_digit(ch: number): boolean {
	return (ch >= 0x30 && ch <= 0x39) || (ch >= 0x41 && ch <= 0x46) || (ch >= 0x61 && ch <= 0x66)
}

/**
 * Resolve CSS escape sequences: `\31 23` → `123`, `\:` → `:`, `\\` → `\`.
 * Hex escapes take 1-6 digits plus one optional trailing whitespace; invalid code points
 * (0, surrogates, > 10FFFF) become U+FFFD. An escaped newline (string line continuation) is removed.
 */
export function unescape_css(str: string): string {
	let i = str.indexOf('\\')
	if (i === -1) return str
	let out = str.substring(0, i)
	const len = str.length
	while (i < len) {
		const ch = str.charCodeAt(i)
		if (ch !== CHAR_BACKSLASH) {
			let next = str.indexOf('\\', i)
			if (next === -1) next = len
			out += str.substring(i, next)
			i = next
			continue
		}
		i++
		if (i >= len) {
			out += '\uFFFD'
			break
		}
		const c = str.charCodeAt(i)
		if (is_hex_digit(c)) {
			let end = i
			while (end < len && end - i < 6 && is_hex_digit(str.charCodeAt(end))) end++
			const code = parseInt(str.substring(i, end), 16)
			out += code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? '\uFFFD' : String.fromCodePoint(code)
			i = end
			// One optional whitespace after a hex escape (CRLF counts as one)
			if (i < len && is_whitespace(str.charCodeAt(i))) {
				i += str.charCodeAt(i) === 0x0d && str.charCodeAt(i + 1) === 0x0a ? 2 : 1
			}
		} else if (c === 0x0a || c === 0x0c) {
			i++
		} else if (c === 0x0d) {
			i += str.charCodeAt(i + 1) === 0x0a ? 2 : 1
		} else {
			const cp = str.codePointAt(i)!
			const s = String.fromCodePoint(cp)
			out += s
			i += s.length
		}
	}
	return out
}
