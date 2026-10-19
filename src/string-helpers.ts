// Public string helpers - the subset of string-utils that is part of the public API.
// Kept separate so the rest of string-utils (CHAR_* constants, range helpers) stays internal.
export {
	is_custom,
	is_vendor_prefixed,
	strip_vendor_prefix,
	str_equals,
	str_starts_with,
	str_index_of,
} from './string-utils'
