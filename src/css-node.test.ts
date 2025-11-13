import { describe, test, expect } from 'vitest'
import { Parser } from './parser'
import { NODE_DECLARATION, NODE_SELECTOR, NODE_STYLE_RULE } from './arena'

describe('CSSNode', () => {
	describe('iteration', () => {
		test('should be iterable with for-of', () => {
			const source = 'body { color: red; margin: 0; padding: 10px; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.first_child!
			const types: number[] = []

			for (const child of rule) {
				types.push(child.type)
			}

			expect(types).toEqual([NODE_SELECTOR, NODE_DECLARATION, NODE_DECLARATION, NODE_DECLARATION])
		})

		test('should work with spread operator', () => {
			const source = 'body { color: red; } div { margin: 0; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rules = [...root]
			expect(rules).toHaveLength(2)
			expect(rules[0].type).toBe(NODE_STYLE_RULE)
			expect(rules[1].type).toBe(NODE_STYLE_RULE)
		})

		test('should work with Array.from', () => {
			const source = '@media print { body { color: black; } }'
			const parser = new Parser(source)
			const root = parser.parse()

			const media = root.first_child!
			const children = Array.from(media)

			expect(children).toHaveLength(1)
			expect(children[0].type).toBe(NODE_STYLE_RULE)
		})

		test('should iterate over empty children', () => {
			const source = '@import url("style.css");'
			const parser = new Parser(source)
			const root = parser.parse()

			const importRule = root.first_child!
			const children = [...importRule]

			expect(children).toHaveLength(0)
		})
	})
})
