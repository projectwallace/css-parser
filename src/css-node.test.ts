import { describe, it, expect } from 'vitest'
import { Parser } from './parser'

describe('CSSNode', () => {
	describe('iteration', () => {
		it('should be iterable with for-of', () => {
			const source = 'body { color: red; margin: 0; padding: 10px; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rule = root.firstChild!
			const types: string[] = []

			for (const child of rule) {
				types.push(child.type)
			}

			expect(types).toEqual(['selector', 'declaration', 'declaration', 'declaration'])
		})

		it('should work with spread operator', () => {
			const source = 'body { color: red; } div { margin: 0; }'
			const parser = new Parser(source)
			const root = parser.parse()

			const rules = [...root]
			expect(rules).toHaveLength(2)
			expect(rules[0].type).toBe('rule')
			expect(rules[1].type).toBe('rule')
		})

		it('should work with Array.from', () => {
			const source = '@media print { body { color: black; } }'
			const parser = new Parser(source)
			const root = parser.parse()

			const media = root.firstChild!
			const children = Array.from(media)

			expect(children).toHaveLength(1)
			expect(children[0].type).toBe('rule')
		})

		it('should iterate over empty children', () => {
			const source = '@import url("style.css");'
			const parser = new Parser(source)
			const root = parser.parse()

			const importRule = root.firstChild!
			const children = [...importRule]

			expect(children).toHaveLength(0)
		})
	})
})
