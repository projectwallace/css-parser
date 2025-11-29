import { CSSNode } from './css-node'
import { CSSDataArena } from './arena'
import { ANplusBParser } from './anplusb-parser'

export function parse_anplusb(expr: string): CSSNode | null {
	const arena = new CSSDataArena(64)
	const parser = new ANplusBParser(arena, expr)
	const nodeIndex = parser.parse_anplusb(0, expr.length)

	if (nodeIndex === null) return null
	return new CSSNode(arena, expr, nodeIndex)
}
