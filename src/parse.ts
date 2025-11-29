import { Parser } from './parser'
import type { ParserOptions } from './parser'
import type { StylesheetNode } from './css-node'

/**
 * Parse CSS and return an AST
 * @param source - The CSS source code to parse
 * @param options - Parser options
 * @returns The root StylesheetNode of the AST
 */
export function parse(source: string, options?: ParserOptions): StylesheetNode {
	const parser = new Parser(source, options)
	return parser.parse() as StylesheetNode
}
