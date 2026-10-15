// Fast character classification using lookup table
//
// HOW IT WORKS:
//
// Construction:
// - We use bit flags (powers of 2) so a single byte can represent multiple properties
// - Each flag is a different bit: ALPHA=1, DIGIT=2, HEX=4, WHITESPACE=8, NEWLINE=16
// - Characters can have multiple properties combined with bitwise OR (|)
// - Example: '5' is both DIGIT and HEX, so char_types[0x35] = DIGIT | HEX = 2 | 4 = 6
// - When adding properties to chars that may already have flags, use |= operator
//
// Reading:
// - Use bitwise AND (&) to check if a specific flag is set
// - Example: (char_types[0x35] & CHAR_DIGIT) !== 0
//   → (6 & 2) = 2, which is !== 0, so returns true
// - Example: (char_types[0x35] & CHAR_ALPHA) !== 0
//   → (6 & 1) = 0, which is === 0, so returns false
//
// Benefits:
// - Single array lookup instead of multiple conditionals
// - Cache-friendly (128 bytes fits in L1 cache)
// - Supports overlapping categories (e.g., '5' is both digit and hex)

// `const` (not `let`): these never change after init, so bundlers/V8 can treat
// them as true constants and fold combined masks like CHAR_WHITESPACE | CHAR_NEWLINE
// into a literal instead of re-reading two module bindings on every hot-loop char.
const CHAR_ALPHA = 1 << 0 // 1
export const CHAR_DIGIT = 1 << 1 // 2
const CHAR_HEX = 1 << 2 // 4
const CHAR_WHITESPACE = 1 << 3 // 8
export const CHAR_NEWLINE = 1 << 4 // 16
export const CHAR_IDENT = 1 << 5 // 32
export const CHAR_IDENT_START = 1 << 6 // 64: ASCII letters and underscore (non-ASCII handled by callers via ch >= 0x80)
// Precomputed so the whitespace-skip hot loops do a single mask compare
// instead of OR-ing two constants on every character.
export const CHAR_WHITESPACE_OR_NEWLINE = CHAR_WHITESPACE | CHAR_NEWLINE

// Lookup table for ASCII characters (0-127)
export const char_types = new Uint8Array(128)

// Initialize digit characters (0-9)
for (let i = 0x30; i <= 0x39; i++) {
	char_types[i] = CHAR_DIGIT
}

// Initialize hex characters (0-9, a-f, A-F)
for (let i = 0x30; i <= 0x39; i++) {
	char_types[i] |= CHAR_HEX
}
for (let i = 0x41; i <= 0x46; i++) {
	char_types[i] = CHAR_HEX
}
for (let i = 0x61; i <= 0x66; i++) {
	char_types[i] = CHAR_HEX
}

// Initialize alpha characters (a-z, A-Z)
for (let i = 0x41; i <= 0x5a; i++) {
	char_types[i] |= CHAR_ALPHA
}
for (let i = 0x61; i <= 0x7a; i++) {
	char_types[i] |= CHAR_ALPHA
}

// Whitespace: space, tab
char_types[0x20] = CHAR_WHITESPACE // space
char_types[0x09] = CHAR_WHITESPACE // tab

// Newlines: \n, \r, \f
char_types[0x0a] = CHAR_NEWLINE // \n
char_types[0x0d] = CHAR_NEWLINE // \r
char_types[0x0c] = CHAR_NEWLINE // \f

// Initialize ident characters: letters, digits, hyphen (-), underscore (_)
// Derived from already-populated table so it stays consistent with CHAR_ALPHA/CHAR_DIGIT
for (let i = 0; i < 128; i++) {
	if (char_types[i] & (CHAR_ALPHA | CHAR_DIGIT)) {
		char_types[i] |= CHAR_IDENT
	}
}
char_types[0x2d] |= CHAR_IDENT // hyphen -
char_types[0x5f] |= CHAR_IDENT // underscore _

// Ident-start: letters and underscore. Single-bit test replaces is_alpha() + '_' compare.
for (let i = 0; i < 128; i++) {
	if (char_types[i] & CHAR_ALPHA) {
		char_types[i] |= CHAR_IDENT_START
	}
}
char_types[0x5f] |= CHAR_IDENT_START // underscore _

export function is_hex_digit(ch: number): boolean {
	return ch < 128 && (char_types[ch] & CHAR_HEX) !== 0
}

// CSS ident start: letter, underscore, or non-ASCII (>= 0x80)
export function is_ident_start(ch: number): boolean {
	return ch >= 0x80 || (char_types[ch] & CHAR_IDENT_START) !== 0
}
