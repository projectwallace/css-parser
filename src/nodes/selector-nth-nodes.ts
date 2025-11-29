// Nth Selector Node Classes
// Represents An+B expressions in pseudo-class selectors
import { CSSNode } from '../css-node-base'

// Forward declaration for selector types
export type SelectorComponentNode = CSSNode

/**
 * SelectorNthNode - An+B expression
 * Examples:
 * - 2n+1 (odd positions)
 * - 2n (even positions)
 * - odd
 * - even
 * - 3n+2
 * - -n+5
 * - 5 (just a number)
 *
 * Used in :nth-child(), :nth-last-child(), :nth-of-type(), :nth-last-of-type()
 */
export class SelectorNthNode extends CSSNode {
	// Get the 'a' coefficient from An+B
	// For "2n+1", returns "2n"
	// For "odd", returns "odd"
	// For "5", returns null (no 'n' part)
	get a(): string | null {
		return this.nth_a
	}

	// Get the 'b' coefficient from An+B
	// For "2n+1", returns "+1"
	// For "2n-3", returns "-3"
	// For "5", returns "5"
	get b(): string | null {
		return this.nth_b
	}

	// Check if this is just a simple number (no 'n')
	get is_number_only(): boolean {
		return this.nth_a === null && this.nth_b !== null
	}

	// Check if this is "odd" or "even" keyword
	get is_keyword(): boolean {
		const a = this.nth_a
		return a === 'odd' || a === 'even'
	}
}

/**
 * SelectorNthOfNode - An+B expression with "of <selector>" syntax
 * Examples:
 * - 2n+1 of .class
 * - odd of [attr]
 * - 3 of li
 *
 * Used in :nth-child(An+B of selector) and :nth-last-child(An+B of selector)
 * The selector part is a child node
 */
export class SelectorNthOfNode extends CSSNode {
	// Get the 'a' coefficient from An+B
	get a(): string | null {
		return this.nth_a
	}

	// Get the 'b' coefficient from An+B
	get b(): string | null {
		return this.nth_b
	}

	// Check if this is just a simple number (no 'n')
	get is_number_only(): boolean {
		return this.nth_a === null && this.nth_b !== null
	}

	// Check if this is "odd" or "even" keyword
	get is_keyword(): boolean {
		const a = this.nth_a
		return a === 'odd' || a === 'even'
	}

	// Override children to return the selector after "of"
	// For "2n+1 of .class", children would contain the selector nodes
	override get children(): SelectorComponentNode[] {
		return super.children as SelectorComponentNode[]
	}
}
