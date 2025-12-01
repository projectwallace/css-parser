import { describe, it, expect } from 'vitest'
import { Parser } from './parse'
import {
	NODE_VALUE_KEYWORD,
	NODE_VALUE_NUMBER,
	NODE_VALUE_DIMENSION,
	NODE_VALUE_STRING,
	NODE_VALUE_COLOR,
	NODE_VALUE_FUNCTION,
	NODE_VALUE_OPERATOR,
} from './arena'

describe('ValueParser', () => {
	describe('Simple values', () => {
		it('should parse keyword values', () => {
			const parser = new Parser('body { color: red; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child // selector → block → declaration

			expect(decl?.value).toBe('red')
			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_KEYWORD)
			expect(decl?.values[0].text).toBe('red')
		})

		it('should parse number values', () => {
			const parser = new Parser('body { opacity: 0.5; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.value).toBe('0.5')
			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_NUMBER)
			expect(decl?.values[0].text).toBe('0.5')
		})

		it('should parse px dimension values', () => {
			const parser = new Parser('body { width: 100px; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.value).toBe('100px')
			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_DIMENSION)
			expect(decl?.values[0].text).toBe('100px')
			expect(decl?.values[0].value).toBe(100)
			expect(decl?.values[0].unit).toBe('px')
		})

		it('should parse px dimension values', () => {
			const parser = new Parser('body { font-size: 3em; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.value).toBe('3em')
			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_DIMENSION)
			expect(decl?.values[0].text).toBe('3em')
			expect(decl?.values[0].value).toBe(3)
			expect(decl?.values[0].unit).toBe('em')
		})

		it('should parse percentage values', () => {
			const parser = new Parser('body { width: 50%; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.value).toBe('50%')
			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_DIMENSION)
			expect(decl?.values[0].text).toBe('50%')
		})

		it('should parse string values', () => {
			const parser = new Parser('body { content: "hello"; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.value).toBe('"hello"')
			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_STRING)
			expect(decl?.values[0].text).toBe('"hello"')
		})

		it('should parse color values', () => {
			const parser = new Parser('body { color: #ff0000; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.value).toBe('#ff0000')
			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_COLOR)
			expect(decl?.values[0].text).toBe('#ff0000')
		})
	})

	describe('Space-separated values', () => {
		it('should parse multiple keywords', () => {
			const parser = new Parser('body { font-family: Arial, sans-serif; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.values).toHaveLength(3)
			expect(decl?.values[0].type).toBe(NODE_VALUE_KEYWORD)
			expect(decl?.values[0].text).toBe('Arial')
			expect(decl?.values[1].type).toBe(NODE_VALUE_OPERATOR)
			expect(decl?.values[1].text).toBe(',')
			expect(decl?.values[2].type).toBe(NODE_VALUE_KEYWORD)
			expect(decl?.values[2].text).toBe('sans-serif')
		})

		it('should parse margin shorthand', () => {
			const parser = new Parser('body { margin: 10px 20px 30px 40px; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.values).toHaveLength(4)
			expect(decl?.values[0].type).toBe(NODE_VALUE_DIMENSION)
			expect(decl?.values[0].text).toBe('10px')
			expect(decl?.values[1].type).toBe(NODE_VALUE_DIMENSION)
			expect(decl?.values[1].text).toBe('20px')
			expect(decl?.values[2].type).toBe(NODE_VALUE_DIMENSION)
			expect(decl?.values[2].text).toBe('30px')
			expect(decl?.values[3].type).toBe(NODE_VALUE_DIMENSION)
			expect(decl?.values[3].text).toBe('40px')
		})

		it('should parse mixed value types', () => {
			const parser = new Parser('body { border: 1px solid red; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.values).toHaveLength(3)
			expect(decl?.values[0].type).toBe(NODE_VALUE_DIMENSION)
			expect(decl?.values[0].text).toBe('1px')
			expect(decl?.values[1].type).toBe(NODE_VALUE_KEYWORD)
			expect(decl?.values[1].text).toBe('solid')
			expect(decl?.values[2].type).toBe(NODE_VALUE_KEYWORD)
			expect(decl?.values[2].text).toBe('red')
		})
	})

	describe('Function values', () => {
		it('should parse simple function', () => {
			const parser = new Parser('body { color: rgb(255, 0, 0); }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_FUNCTION)
			expect(decl?.values[0].name).toBe('rgb')
			expect(decl?.values[0].text).toBe('rgb(255, 0, 0)')
		})

		it('should parse function arguments', () => {
			const parser = new Parser('body { color: rgb(255, 0, 0); }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child
			const func = decl?.values[0]

			expect(func?.children).toHaveLength(5)
			expect(func?.children[0].type).toBe(NODE_VALUE_NUMBER)
			expect(func?.children[0].text).toBe('255')
			expect(func?.children[1].type).toBe(NODE_VALUE_OPERATOR)
			expect(func?.children[1].text).toBe(',')
			expect(func?.children[2].type).toBe(NODE_VALUE_NUMBER)
			expect(func?.children[2].text).toBe('0')
			expect(func?.children[3].type).toBe(NODE_VALUE_OPERATOR)
			expect(func?.children[3].text).toBe(',')
			expect(func?.children[4].type).toBe(NODE_VALUE_NUMBER)
			expect(func?.children[4].text).toBe('0')
		})

		it('should parse nested functions', () => {
			const parser = new Parser('body { width: calc(100% - 20px); }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_FUNCTION)
			expect(decl?.values[0].name).toBe('calc')
			expect(decl?.values[0].children).toHaveLength(3)
			expect(decl?.values[0].children[0].type).toBe(NODE_VALUE_DIMENSION)
			expect(decl?.values[0].children[0].text).toBe('100%')
			expect(decl?.values[0].children[1].type).toBe(NODE_VALUE_OPERATOR)
			expect(decl?.values[0].children[1].text).toBe('-')
			expect(decl?.values[0].children[2].type).toBe(NODE_VALUE_DIMENSION)
			expect(decl?.values[0].children[2].text).toBe('20px')
		})

		it('should parse var() function', () => {
			const parser = new Parser('body { color: var(--primary-color); }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_FUNCTION)
			expect(decl?.values[0].name).toBe('var')
			expect(decl?.values[0].children).toHaveLength(1)
			expect(decl?.values[0].children[0].type).toBe(NODE_VALUE_KEYWORD)
			expect(decl?.values[0].children[0].text).toBe('--primary-color')
		})

		it('should parse url() function', () => {
			const parser = new Parser('body { background: url("image.png"); }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_FUNCTION)
			expect(decl?.values[0].name).toBe('url')
			expect(decl?.values[0].children).toHaveLength(1)
			expect(decl?.values[0].children[0].type).toBe(NODE_VALUE_STRING)
			expect(decl?.values[0].children[0].text).toBe('"image.png"')
		})
	})

	describe('Complex values', () => {
		it('should parse complex background value', () => {
			const parser = new Parser('body { background: url("bg.png") no-repeat center center / cover; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.values.length).toBeGreaterThan(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_FUNCTION)
			expect(decl?.values[0].name).toBe('url')
			expect(decl?.values[1].type).toBe(NODE_VALUE_KEYWORD)
			expect(decl?.values[1].text).toBe('no-repeat')
		})

		it('should parse transform value', () => {
			const parser = new Parser('body { transform: translateX(10px) rotate(45deg); }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.values).toHaveLength(2)
			expect(decl?.values[0].type).toBe(NODE_VALUE_FUNCTION)
			expect(decl?.values[0].name).toBe('translateX')
			expect(decl?.values[1].type).toBe(NODE_VALUE_FUNCTION)
			expect(decl?.values[1].name).toBe('rotate')
		})

		it('should parse filter value', () => {
			const parser = new Parser('body { filter: blur(5px) brightness(1.2); }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.values).toHaveLength(2)
			expect(decl?.values[0].type).toBe(NODE_VALUE_FUNCTION)
			expect(decl?.values[0].name).toBe('blur')
			expect(decl?.values[0].children[0].text).toBe('5px')
			expect(decl?.values[1].type).toBe(NODE_VALUE_FUNCTION)
			expect(decl?.values[1].name).toBe('brightness')
			expect(decl?.values[1].children[0].text).toBe('1.2')
		})
	})

	describe('Edge cases', () => {
		it('should handle empty value', () => {
			const parser = new Parser('body { color: ; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.value).toBeNull()
			expect(decl?.values).toHaveLength(0)
		})

		it('should handle value with !important', () => {
			const parser = new Parser('body { color: red !important; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.value).toBe('red')
			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_KEYWORD)
			expect(decl?.values[0].text).toBe('red')
			expect(decl?.is_important).toBe(true)
		})

		it('should handle negative numbers', () => {
			const parser = new Parser('body { margin: -10px; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_DIMENSION)
			expect(decl?.values[0].text).toBe('-10px')
		})

		it('should handle zero with unit', () => {
			const parser = new Parser('body { margin: 0px; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_DIMENSION)
			expect(decl?.values[0].text).toBe('0px')
		})

		it('should handle zero without unit', () => {
			const parser = new Parser('body { margin: 0; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.values).toHaveLength(1)
			expect(decl?.values[0].type).toBe(NODE_VALUE_NUMBER)
			expect(decl?.values[0].text).toBe('0')
		})
	})

	describe('Operators', () => {
		it('should parse comma operator', () => {
			const parser = new Parser('body { font-family: Arial, sans-serif; }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child

			expect(decl?.values[1].type).toBe(NODE_VALUE_OPERATOR)
			expect(decl?.values[1].text).toBe(',')
		})

		it('should parse calc operators', () => {
			const parser = new Parser('body { width: calc(100% - 20px); }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child
			const func = decl?.values[0]

			expect(func?.children[1].type).toBe(NODE_VALUE_OPERATOR)
			expect(func?.children[1].text).toBe('-')
		})

		it('should parse all calc operators', () => {
			const parser = new Parser('body { width: calc(1px + 2px * 3px / 4px - 5px); }')
			const root = parser.parse()
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child
			const func = decl?.values[0]

			const operators = func?.children.filter((n) => n.type === NODE_VALUE_OPERATOR)
			expect(operators).toHaveLength(4)
			expect(operators?.[0].text).toBe('+')
			expect(operators?.[1].text).toBe('*')
			expect(operators?.[2].text).toBe('/')
			expect(operators?.[3].text).toBe('-')
		})
	})
})
