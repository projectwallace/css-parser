import { CSSDataArena, NODE_SELECTOR_LIST } from './arena'
import { SelectorParser } from './selector-parser'
import { CSSNode } from './css-node'

/**
 * Parse a CSS selector string and return an AST
 * @param source - The CSS selector to parse (e.g., "div.class > p#id")
 * @returns The root CSSNode of the selector AST
 */
export function parse_selector(source: string): CSSNode {
	// Create an arena for the selector nodes
	const arena = new CSSDataArena(CSSDataArena.capacity_for_source(source.length))

	// Create selector parser
	const selector_parser = new SelectorParser(arena, source)

	// Parse the entire source as a selector
	const selector_index = selector_parser.parse_selector(0, source.length)

	if (selector_index === null) {
		// Return empty selector list node if parsing failed
		const empty = arena.create_node()
		arena.set_type(empty, NODE_SELECTOR_LIST)
		arena.set_start_offset(empty, 0)
		arena.set_length(empty, 0)
		arena.set_start_line(empty, 1)
		return new CSSNode(arena, source, empty)
	}

	// Wrap in CSSNode
	return new CSSNode(arena, source, selector_index)
}
