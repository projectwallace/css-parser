// Simple Selector Node Classes
// These are the basic building blocks of CSS selectors
import { CSSNode as CSSNodeBase } from '../css-node-base'
import { CSSNode } from '../css-node'
import type { AnyNode } from '../types'

// Forward declaration for selector component types
export type SelectorComponentNode = AnyNode

/**
 * SelectorListNode - Comma-separated list of selectors
 * Examples: "div, span", "h1, h2, h3", ".class1, .class2"
 * This is always the first child of a StyleRule
 */
export class SelectorListNode extends CSSNodeBase {
	// Override children to return selector components
	override get children(): SelectorComponentNode[] {
		return super.children as SelectorComponentNode[]
	}

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * SelectorTypeNode - Type/element selector
 * Examples: div, span, p, h1, article
 */
export class SelectorTypeNode extends CSSNodeBase {
	// Leaf node - no additional properties
	// The element name is available via 'text'

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * SelectorUniversalNode - Universal selector
 * Example: *
 */
export class SelectorUniversalNode extends CSSNodeBase {
	// Leaf node - always represents "*"
	// The text is available via 'text'

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * SelectorNestingNode - Nesting selector (CSS Nesting)
 * Example: &
 */
export class SelectorNestingNode extends CSSNodeBase {
	// Leaf node - always represents "&"
	// The text is available via 'text'

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * SelectorCombinatorNode - Combinator between selectors
 * Examples: " " (descendant), ">" (child), "+" (adjacent sibling), "~" (general sibling)
 */
export class SelectorCombinatorNode extends CSSNodeBase {
	// Leaf node - the combinator symbol
	// The combinator is available via 'text'

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}
