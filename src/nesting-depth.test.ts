import { describe, test, expect } from 'vitest'
import { parse } from './parse'
import { parse_value } from './parse-value'
import { parse_selector } from './parse-selector'
import { parse_atrule_prelude } from './parse-atrule-prelude'
import { walk, traverse } from './walk'
import { MAX_NESTING_DEPTH } from './arena'

// Far beyond MAX_NESTING_DEPTH, and past the ~2,800 levels where unguarded recursion overflowed the stack
const TOO_DEEP = 5000

const nest = (open: string, inner: string, close: string, depth: number) =>
	open.repeat(depth) + inner + close.repeat(depth)

const NESTED: Record<string, (depth: number) => string> = {
	'nested rules': (n) => nest('a{', 'b:c', '}', n),
	'unclosed nested rules': (n) => 'a{'.repeat(n),
	'nested at-rules': (n) => nest('@media screen{', 'a{b:c}', '}', n),
	'nested value parentheses': (n) => `a{b:${nest('(', '1', ')', n)}}`,
	'nested value functions': (n) => `a{b:${nest('calc(', '1', ')', n)}}`,
	'nested if()': (n) => `a{b:${nest('if(style(a:b):', 'c', ')', n)}}`,
	'nested selector arguments': (n) => `${nest(':is(', 'a', ')', n)}{}`,
	'nested :nth-child(of)': (n) => `${nest(':nth-child(2n of ', 'a', ')', n)}{}`,
	'nested @supports conditions': (n) => `@supports ${nest('(', 'a:b', ')', n)}{}`,
	'nested @import supports()': (n) => `@import "a" supports(${nest('(', 'a:b', ')', n)});`,
	'nested @function values': (n) => `@function --f(--a){result:${nest('f(', '1', ')', n)}}`,
}

describe('maximum nesting depth', () => {
	describe.each(Object.entries(NESTED))('%s', (_name, build) => {
		test('parses, walks, traverses and clones realistic depth', () => {
			const ast = parse(build(MAX_NESTING_DEPTH - 6))
			let count = 0
			walk(ast, () => {
				count++
			})
			traverse(ast, { enter() {}, leave() {} })
			expect(count).toBeGreaterThan(MAX_NESTING_DEPTH - 6)
			expect(ast.clone().type_name).toBe('StyleSheet')
		})

		test('throws a clear error instead of overflowing the call stack', () => {
			expect(() => parse(build(TOO_DEEP))).toThrow(RangeError)
			expect(() => parse(build(TOO_DEEP))).toThrow(/Maximum CSS nesting depth/)
		})
	})

	test('standalone parsers are guarded too', () => {
		expect(() => parse_value('('.repeat(TOO_DEEP))).toThrow(/Maximum CSS nesting depth/)
		expect(() => parse_selector(nest(':is(', 'a', ')', TOO_DEEP))).toThrow(
			/Maximum CSS nesting depth/,
		)
		expect(() => parse_atrule_prelude('supports', nest('(', 'a:b', ')', TOO_DEEP))).toThrow(
			/Maximum CSS nesting depth/,
		)
	})

	test('depth is released after each construct, so flat input is never limited', () => {
		// Closed constructs only: repeating an unclosed `a{` genuinely nests
		const flat = Object.entries(NESTED)
			.filter(([name]) => !name.startsWith('unclosed'))
			.map(([, build]) => build(3))
			.join('\n')
		// Many more siblings than MAX_NESTING_DEPTH: a leaked counter would eventually throw
		const css = `${flat}\n`.repeat(MAX_NESTING_DEPTH * 4)
		expect(() => parse(css)).not.toThrow()
	})
})
