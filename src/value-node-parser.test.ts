import { describe, test, expect } from 'vitest'
import { CSSDataArena } from './arena'
import { ValueNodeParser } from './value-node-parser'

// Parse `source` as a value chain limited to [0, end) and return the text of each top-level node.
// Ranges that end inside trailing whitespace, with more source after them, are the case where
// skipping whitespace in the lexer could otherwise run into tokens that belong to the next range.
function chain(source: string, end: number = source.length) {
	const arena = new CSSDataArena(64)
	const parser = new ValueNodeParser(arena, source)
	const texts = (first: number) => {
		const out: string[] = []
		for (let node = first; node !== 0; node = arena.get_next_sibling(node)) {
			const start = arena.get_start_offset(node)
			out.push(source.substring(start, start + arena.get_length(node)))
		}
		return out
	}
	const first = parser.parse_chain(0, end, 1, 1)
	return { top: texts(first), children: texts(arena.get_first_child(first)) }
}

describe('ValueNodeParser range limits', () => {
	test('stops at the range end when only whitespace remains before the next token', () => {
		expect(chain('1px  2px', 5).top).toEqual(['1px'])
		expect(chain('1px  2px', 8).top).toEqual(['1px', '2px'])
	})

	test('does not read past the range end when whitespace is followed by a comment and a token', () => {
		expect(chain('1px  /* c */ 2px', 5).top).toEqual(['1px'])
	})

	test('stops function arguments at the range end', () => {
		// "f(1px  " is 7 characters; the 2px after it is outside the range
		const { top, children } = chain('f(1px  2px)', 7)
		expect(top).toEqual(['f('])
		expect(children).toEqual(['1px'])
	})

	test('stops parenthesis content at the range end', () => {
		// "(1px  " is 6 characters
		const { top, children } = chain('(1px  2px)', 6)
		expect(top).toEqual(['('])
		expect(children).toEqual(['1px'])
	})

	test('an empty or whitespace-only range yields no nodes', () => {
		expect(chain('   1px', 3).top).toEqual([])
		expect(chain('', 0).top).toEqual([])
	})
})
