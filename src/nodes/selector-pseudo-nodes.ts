// Pseudo Selector Node Classes
// Represents pseudo-classes and pseudo-elements
import { CSSNode } from '../css-node-base'

// Forward declaration for child types
export type SelectorComponentNode = CSSNode

/**
 * SelectorPseudoClassNode - Pseudo-class selector
 * Examples:
 * - :hover, :focus, :active
 * - :first-child, :last-child
 * - :nth-child(2n+1), :nth-of-type(3)
 * - :is(selector), :where(selector), :has(selector), :not(selector)
 */
export class SelectorPseudoClassNode extends CSSNode {
	// Get the pseudo-class name (without the leading colon)
	// For :hover, returns "hover"
	// For :nth-child(2n+1), returns "nth-child"
	get name(): string {
		const text = this.text
		// Remove leading colon
		const withoutColon = text.startsWith(':') ? text.slice(1) : text

		// If it has parentheses, get name before the opening paren
		const parenIndex = withoutColon.indexOf('(')
		if (parenIndex > 0) {
			return withoutColon.slice(0, parenIndex)
		}

		return withoutColon
	}

	// Check if the pseudo-class has arguments
	get has_arguments(): boolean {
		return this.has_children || this.text.includes('(')
	}

	// Override children to return selector components
	// For functional pseudo-classes like :is(), :where(), :has(), :not()
	override get children(): SelectorComponentNode[] {
		return super.children as SelectorComponentNode[]
	}
}

/**
 * SelectorPseudoElementNode - Pseudo-element selector
 * Examples:
 * - ::before, ::after
 * - ::first-line, ::first-letter
 * - ::marker, ::placeholder
 * - ::selection
 */
export class SelectorPseudoElementNode extends CSSNode {
	// Get the pseudo-element name (without the leading double colon)
	// For ::before, returns "before"
	// Also handles single colon syntax (:before) for backwards compatibility
	get name(): string {
		const text = this.text
		// Remove leading :: or :
		if (text.startsWith('::')) {
			return text.slice(2)
		} else if (text.startsWith(':')) {
			return text.slice(1)
		}
		return text
	}
}
