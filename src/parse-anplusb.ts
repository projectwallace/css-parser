// ANplusB Parser - Parses An+B microsyntax for nth-* pseudo-classes
// Spec: https://www.w3.org/TR/css-syntax-3/#anb

// Much inspiration taken from CSSTree (Roman Dvornov) - MIT License
// https://github.com/csstree/csstree/blob/56afb6dd761149099cd3cdfb0a38e15e8cc0a71a/lib/syntax/node/AnPlusB.js#L106-L271

import { Lexer } from './tokenize'
import { NTH_SELECTOR, CSSDataArena } from './arena'
import { TOKEN_IDENT, TOKEN_NUMBER, TOKEN_DIMENSION, TOKEN_DELIM, type TokenType } from './token-types'
import { CHAR_MINUS_HYPHEN, CHAR_PLUS, str_equals_at, str_index_of_at } from './string-utils'
import { skip_whitespace_and_comments_forward } from './parse-utils'
import { CSSNode } from './css-node'

/** @internal */
export class ANplusBParser {
	private lexer: Lexer
	private arena: CSSDataArena
	private source: string
	private expr_end: number

	constructor(arena: CSSDataArena, source: string) {
		this.arena = arena
		this.source = source
		this.lexer = new Lexer(source)
		this.expr_end = 0
	}

	/**
	 * Parse An+B expression
	 * Examples: odd, even, 3, n, -n, 2n, 2n+1, -3n-5
	 */
	parse_anplusb(start: number, end: number, line: number = 1): number | null {
		this.expr_end = end
		this.lexer.pos = start
		this.lexer.line = line

		let a_start = start
		let a_end = start
		let b_start = start
		let b_end = start
		const node_start = start

		// Skip leading whitespace
		this.skip_whitespace()

		if (this.lexer.pos >= this.expr_end) {
			return null
		}

		// Get first token
		this.lexer.next_token_fast(true)

		// Handle special keywords: odd, even
		if (this.lexer.token_type === TOKEN_IDENT) {
			if (
				str_equals_at(this.source, this.lexer.token_start, this.lexer.token_end, 'odd') ||
				str_equals_at(this.source, this.lexer.token_start, this.lexer.token_end, 'even')
			) {
				a_start = this.lexer.token_start
				a_end = this.lexer.token_end
				return this.create_anplusb_node(node_start, a_start, a_end, 0, 0)
			}

			// Check if it's 'n', '-n', or starts with 'n'
			const first_char = this.source.charCodeAt(this.lexer.token_start)
			const second_char = this.lexer.token_end > this.lexer.token_start + 1 ? this.source.charCodeAt(this.lexer.token_start + 1) : 0

			// -n, -n+3, -n-5
			if (first_char === CHAR_MINUS_HYPHEN /* - */ && second_char === 0x6e /* n */) {
				// Check for attached -n-digit pattern
				if (this.lexer.token_end > this.lexer.token_start + 2) {
					const third_char = this.source.charCodeAt(this.lexer.token_start + 2)
					if (third_char === CHAR_MINUS_HYPHEN /* - */) {
						// -n-5 pattern
						a_start = this.lexer.token_start
						a_end = this.lexer.token_start + 2
						b_start = this.lexer.token_start + 2
						b_end = this.lexer.token_end
						return this.create_anplusb_node(node_start, a_start, a_end, b_start, b_end)
					}
				}

				a_start = this.lexer.token_start
				a_end = this.lexer.token_start + 2

				// Check for separate b part after whitespace
				const b_result = this.parse_b_part()
				if (b_result !== null) {
					b_start = b_result.start
					b_end = b_result.end
				}
				return this.create_anplusb_node(node_start, a_start, a_end, b_start, b_end)
			}

			// n, n+3, n-5
			if (first_char === 0x6e /* n */) {
				// Check for attached n-digit pattern
				if (this.lexer.token_end > this.lexer.token_start + 1) {
					const second_char_at_1 = this.source.charCodeAt(this.lexer.token_start + 1)
					if (second_char_at_1 === CHAR_MINUS_HYPHEN /* - */) {
						// n-5 pattern
						// a = 'n'
						a_start = this.lexer.token_start
						a_end = this.lexer.token_start + 1
						b_start = this.lexer.token_start + 1
						b_end = this.lexer.token_end
						return this.create_anplusb_node(node_start, a_start, a_end, b_start, b_end)
					}
				}

				a_start = this.lexer.token_start
				a_end = this.lexer.token_start + 1

				// Check for separate b part
				const b_result = this.parse_b_part()
				if (b_result !== null) {
					b_start = b_result.start
					b_end = b_result.end
				}
				return this.create_anplusb_node(node_start, a_start, a_end, b_start, b_end)
			}

			// Not a valid An+B pattern
			return null
		}

		// Handle +n pattern
		if (this.lexer.token_type === TOKEN_DELIM && this.source.charCodeAt(this.lexer.token_start) === CHAR_PLUS) {
			// Look ahead for 'n'
			const saved = this.lexer.save_position()
			this.lexer.next_token_fast(true)

			if ((this.lexer.token_type as TokenType) === TOKEN_IDENT) {
				const first_char = this.source.charCodeAt(this.lexer.token_start)

				if (first_char === 0x6e /* n */) {
					a_start = saved.pos - 1 // Position of the + delim
					a_end = this.lexer.token_start + 1

					// Check for attached n-digit pattern
					if (this.lexer.token_end > this.lexer.token_start + 1) {
						const second_char = this.source.charCodeAt(this.lexer.token_start + 1)
						if (second_char === CHAR_MINUS_HYPHEN) {
							// +n-5 pattern
							b_start = this.lexer.token_start + 1
							b_end = this.lexer.token_end
							return this.create_anplusb_node(node_start, a_start, a_end, b_start, b_end)
						}
					}

					// Check for separate b part
					const b_result = this.parse_b_part()
					if (b_result !== null) {
						b_start = b_result.start
						b_end = b_result.end
					}
					return this.create_anplusb_node(node_start, a_start, a_end, b_start, b_end)
				}
			}

			this.lexer.restore_position(saved)
		}

		// Handle dimension tokens: 2n, 3n+1, -5n-2
		if (this.lexer.token_type === TOKEN_DIMENSION) {
			const n_index = str_index_of_at(this.source, this.lexer.token_start, this.lexer.token_end, 'n')

			if (n_index !== -1) {
				a_start = this.lexer.token_start
				a_end = this.lexer.token_start + n_index + 1

				// Check for b part after 'n'
				const remainder_start = this.lexer.token_start + n_index + 1
				if (remainder_start < this.lexer.token_end) {
					// n-5 or n+5 pattern in dimension
					const remainder_ch = this.source.charCodeAt(remainder_start)
					if (remainder_ch === CHAR_MINUS_HYPHEN /* - */) {
						b_start = remainder_start
						b_end = this.lexer.token_end
						return this.create_anplusb_node(node_start, a_start, a_end, b_start, b_end)
					}
				}

				// Check for separate b part after dimension
				const b_result = this.parse_b_part()
				if (b_result !== null) {
					b_start = b_result.start
					b_end = b_result.end
				}
				return this.create_anplusb_node(node_start, a_start, a_end, b_start, b_end)
			}
		}

		// Handle simple integer (b only, no 'a')
		if (this.lexer.token_type === TOKEN_NUMBER) {
			b_start = this.lexer.token_start
			b_end = this.lexer.token_end
			return this.create_anplusb_node(node_start, 0, 0, b_start, b_end)
		}

		return null
	}

	/**
	 * Parse the b part after 'n'
	 * Handles: +5, -3, whitespace variations
	 * Returns offset range or null
	 */
	private parse_b_part(): { start: number; end: number } | null {
		this.skip_whitespace()

		if (this.lexer.pos >= this.expr_end) {
			return null
		}

		this.lexer.next_token_fast(true)

		// Check for + or - delim
		if (this.lexer.token_type === TOKEN_DELIM) {
			const ch = this.source.charCodeAt(this.lexer.token_start)

			if (ch === CHAR_PLUS || ch === CHAR_MINUS_HYPHEN) {
				this.skip_whitespace()

				this.lexer.next_token_fast(true)

				if ((this.lexer.token_type as TokenType) === TOKEN_NUMBER) {
					// Check if the number starts with + and skip it if so
					const num_start = this.lexer.token_start
					let num_actual_start = num_start
					if (this.source.charCodeAt(num_start) === CHAR_PLUS) {
						num_actual_start = num_start + 1
					}
					return { start: num_actual_start, end: this.lexer.token_end }
				}
			}
		}

		// Check for signed number
		if (this.lexer.token_type === TOKEN_NUMBER) {
			const num_start = this.lexer.token_start
			const first_char = this.source.charCodeAt(num_start)

			// If it starts with + or -, it's a signed number
			if (first_char === CHAR_PLUS || first_char === CHAR_MINUS_HYPHEN) {
				// Return with + stripped if present
				const actual_start = first_char === CHAR_PLUS ? num_start + 1 : num_start
				return { start: actual_start, end: this.lexer.token_end }
			}

			// Just return the whole number
			return { start: num_start, end: this.lexer.token_end }
		}

		return null
	}

	private skip_whitespace(): void {
		this.lexer.pos = skip_whitespace_and_comments_forward(this.source, this.lexer.pos, this.expr_end)
	}

	private create_anplusb_node(start: number, a_start: number, a_end: number, b_start: number, b_end: number): number {
		const node = this.arena.create_node(NTH_SELECTOR, start, this.lexer.pos - start, this.lexer.line, 1)

		// Store 'a' coefficient in content fields if it exists (length > 0)
		if (a_end > a_start) {
			this.arena.set_content_start_delta(node, a_start - start)
			this.arena.set_content_length(node, a_end - a_start)
		}

		// Store 'b' coefficient in value fields if it exists (length > 0)
		if (b_end > b_start) {
			this.arena.set_value_start_delta(node, b_start - start)
			this.arena.set_value_length(node, b_end - b_start)
		}

		return node
	}
}

export function parse_anplusb(expr: string): CSSNode | null {
	const arena = new CSSDataArena(64)
	const parser = new ANplusBParser(arena, expr)
	const nodeIndex = parser.parse_anplusb(0, expr.length)

	if (nodeIndex === null) return null
	return new CSSNode(arena, expr, nodeIndex)
}
