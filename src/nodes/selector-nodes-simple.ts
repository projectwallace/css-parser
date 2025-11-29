// Simple Selector Node Classes
// These are the basic building blocks of CSS selectors
import { CSSNode } from '../css-node-base'

// Forward declaration for selector component types
export type SelectorComponentNode = CSSNode

/**
 * SelectorListNode - Comma-separated list of selectors
 * Examples: "div, span", "h1, h2, h3", ".class1, .class2"
 * This is always the first child of a StyleRule
 */
export class SelectorListNode extends CSSNode {
	// Override children to return selector components
	override get children(): SelectorComponentNode[] {
		return super.children as SelectorComponentNode[]
	}
}

/**
 * SelectorTypeNode - Type/element selector
 * Examples: div, span, p, h1, article
 */
export class SelectorTypeNode extends CSSNode {
	// Leaf node - no additional properties
	// The element name is available via 'text'
}

/**
 * SelectorUniversalNode - Universal selector
 * Example: *
 */
export class SelectorUniversalNode extends CSSNode {
	// Leaf node - always represents "*"
	// The text is available via 'text'
}

/**
 * SelectorNestingNode - Nesting selector (CSS Nesting)
 * Example: &
 */
export class SelectorNestingNode extends CSSNode {
	// Leaf node - always represents "&"
	// The text is available via 'text'
}

/**
 * SelectorCombinatorNode - Combinator between selectors
 * Examples: " " (descendant), ">" (child), "+" (adjacent sibling), "~" (general sibling)
 */
export class SelectorCombinatorNode extends CSSNode {
	// Leaf node - the combinator symbol
	// The combinator is available via 'text'
}
