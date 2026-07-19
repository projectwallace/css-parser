// Value Parser - Parses CSS declaration values into structured AST nodes
import { CSSDataArena, VALUE } from './arena'
import { CSSNode } from './css-node'
import type { Value } from './node-types'
import { ValueNodeParser } from './value-node-parser'

/** @internal */
export class ValueParser {
	private nodes: ValueNodeParser
	private arena: CSSDataArena

	constructor(arena: CSSDataArena, source: string) {
		this.arena = arena
		this.nodes = new ValueNodeParser(arena, source)
	}

	// Parse a declaration value range into a VALUE wrapper node
	// Returns single VALUE node index
	parse_value(start: number, end: number, start_line: number, start_column: number): number {
		let first_node = this.nodes.parse_chain(start, end, start_line, start_column)

		if (first_node === 0) {
			// Empty value - create VALUE node with no children
			return this.arena.create_node(VALUE, start, 0, start_line, start_column)
		}

		let last_node = this.nodes.last_chain_node

		// Create VALUE wrapper node spanning all value tokens
		let first_node_start = this.arena.get_start_offset(first_node)
		let last_node_end = this.arena.get_start_offset(last_node) + this.arena.get_length(last_node)

		let value_node = this.arena.create_node(
			VALUE,
			first_node_start,
			last_node_end - first_node_start,
			start_line,
			start_column,
		)

		// Link value tokens as children
		this.arena.set_first_child(value_node, first_node)

		return value_node
	}
}

/**
 * Parse a CSS declaration value string and return a VALUE node
 * @param value_string - The CSS value to parse (e.g., "1px solid red")
 * @returns A CSSNode VALUE wrapper containing the parsed value tokens as children
 */
export function parse_value(value_string: string): Value {
	// Create an arena for the value nodes
	const arena = new CSSDataArena(CSSDataArena.capacity_for_source(value_string.length))

	// Create value parser
	const value_parser = new ValueParser(arena, value_string)

	// Parse the entire source as a value (starting at line 1, column 1)
	// Returns single VALUE node index now
	const value_node_index = value_parser.parse_value(0, value_string.length, 1, 1)

	// Wrap the VALUE node in a CSSNode
	return new CSSNode(arena, value_string, value_node_index) as Value
}
