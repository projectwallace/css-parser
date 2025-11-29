// Attribute Selector Node Class
// Represents CSS attribute selectors
import { CSSNode } from '../css-node-base'
import {
	ATTR_OPERATOR_NONE,
	ATTR_OPERATOR_EQUAL,
	ATTR_OPERATOR_TILDE_EQUAL,
	ATTR_OPERATOR_PIPE_EQUAL,
	ATTR_OPERATOR_CARET_EQUAL,
	ATTR_OPERATOR_DOLLAR_EQUAL,
	ATTR_OPERATOR_STAR_EQUAL,
} from '../arena'

// Mapping of operator constants to their string representation
const ATTR_OPERATOR_STRINGS: Record<number, string> = {
	[ATTR_OPERATOR_NONE]: '',
	[ATTR_OPERATOR_EQUAL]: '=',
	[ATTR_OPERATOR_TILDE_EQUAL]: '~=',
	[ATTR_OPERATOR_PIPE_EQUAL]: '|=',
	[ATTR_OPERATOR_CARET_EQUAL]: '^=',
	[ATTR_OPERATOR_DOLLAR_EQUAL]: '$=',
	[ATTR_OPERATOR_STAR_EQUAL]: '*=',
}

/**
 * SelectorAttributeNode - Attribute selector
 * Examples:
 * - [attr] - has attribute
 * - [attr=value] - exact match
 * - [attr~=value] - word match
 * - [attr|=value] - prefix match
 * - [attr^=value] - starts with
 * - [attr$=value] - ends with
 * - [attr*=value] - contains
 * - [attr=value i] - case-insensitive
 */
export class SelectorAttributeNode extends CSSNode {
	// Get the attribute name
	// For [data-id], returns "data-id"
	get attribute_name(): string {
		const text = this.text
		// Remove [ and ]
		const inner = text.slice(1, -1).trim()

		// Find where the operator starts (if any)
		const operator = this.operator
		if (operator) {
			const opIndex = inner.indexOf(operator)
			if (opIndex > 0) {
				return inner.slice(0, opIndex).trim()
			}
		}

		// No operator, return the whole thing (minus case sensitivity flag)
		// Check for 'i' or 's' flag at the end
		const parts = inner.split(/\s+/)
		if (parts.length > 1 && (parts[parts.length - 1] === 'i' || parts[parts.length - 1] === 's')) {
			return parts.slice(0, -1).join(' ')
		}

		return inner
	}

	// Get the operator as a string
	get operator(): string {
		return ATTR_OPERATOR_STRINGS[this.attr_operator] || ''
	}

	// Get the attribute value (if present)
	// For [attr=value], returns "value" (with quotes if present)
	// For [attr], returns null
	get attribute_value(): string | null {
		const text = this.text
		const inner = text.slice(1, -1).trim()
		const operator = this.operator

		if (!operator) {
			return null
		}

		const opIndex = inner.indexOf(operator)
		if (opIndex < 0) {
			return null
		}

		// Get everything after the operator
		let value = inner.slice(opIndex + operator.length).trim()

		// Remove case sensitivity flag if present
		if (value.endsWith(' i') || value.endsWith(' s')) {
			value = value.slice(0, -2).trim()
		}

		return value
	}

	// Check if the selector has a case sensitivity modifier
	get has_case_modifier(): boolean {
		const text = this.text
		return text.endsWith(' i]') || text.endsWith(' s]')
	}

	// Get the case sensitivity modifier ('i' for case-insensitive, 's' for case-sensitive)
	get case_modifier(): string | null {
		const text = this.text
		if (text.endsWith(' i]')) return 'i'
		if (text.endsWith(' s]')) return 's'
		return null
	}
}
