import { CSSDataArena } from './arena'
import { AtRulePreludeParser } from './at-rule-prelude-parser'
import { CSSNode } from './css-node'

/**
 * Parse an at-rule prelude string and return an array of AST nodes
 * @param at_rule_name - The name of the at-rule (e.g., "media", "supports", "layer")
 * @param prelude - The at-rule prelude to parse (e.g., "(min-width: 768px)", "utilities")
 * @returns An array of CSSNode objects representing the parsed prelude
 */
export function parse_atrule_prelude(at_rule_name: string, prelude: string): CSSNode[] {
	// Create an arena for the prelude nodes
	const arena = new CSSDataArena(CSSDataArena.capacity_for_source(prelude.length))

	// Create prelude parser
	const prelude_parser = new AtRulePreludeParser(arena, prelude)

	// Parse the entire source as an at-rule prelude
	const node_indices = prelude_parser.parse_prelude(at_rule_name, 0, prelude.length)

	// Wrap each node index in a CSSNode
	return node_indices.map((index) => new CSSNode(arena, prelude, index))
}
