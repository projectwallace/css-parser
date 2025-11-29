// Pseudo Selector Node Classes
// Represents pseudo-classes and pseudo-elements
import { CSSNode as CSSNodeBase } from '../css-node-base'
import { CSSNode } from '../css-node'
import { FLAG_VENDOR_PREFIXED } from '../arena'
import type { AnyNode } from '../types'

// Forward declaration for child types
export type SelectorComponentNode = AnyNode

/**
 * SelectorPseudoClassNode - Pseudo-class selector
 * Examples:
 * - :hover, :focus, :active
 * - :first-child, :last-child
 * - :nth-child(2n+1), :nth-of-type(3)
 * - :is(selector), :where(selector), :has(selector), :not(selector)
 */
export class SelectorPseudoClassNode extends CSSNodeBase {
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

	// Check if this has a vendor prefix (flag-based for performance)
	get isVendorPrefixed(): boolean {
		return this.arena.has_flag(this.index, FLAG_VENDOR_PREFIXED)
	}

	// Snake_case alias for isVendorPrefixed
	get is_vendor_prefixed(): boolean {
		return this.isVendorPrefixed
	}

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
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
export class SelectorPseudoElementNode extends CSSNodeBase {
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

	// Check if this has a vendor prefix (flag-based for performance)
	get isVendorPrefixed(): boolean {
		return this.arena.has_flag(this.index, FLAG_VENDOR_PREFIXED)
	}

	// Snake_case alias for isVendorPrefixed
	get is_vendor_prefixed(): boolean {
		return this.isVendorPrefixed
	}

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}
