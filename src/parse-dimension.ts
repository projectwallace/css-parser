import { is_digit, CHAR_MINUS_HYPHEN, CHAR_PLUS, CHAR_PERIOD } from './string-utils'

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
