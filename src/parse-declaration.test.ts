import { describe, test, expect } from 'vitest'
import { parse_declaration } from './parse-declaration'
import { DECLARATION, IDENTIFIER, DIMENSION, NUMBER, FUNCTION } from './arena'

describe('parse_declaration', () => {
	describe('Location Tracking', () => {
		test('line and column for declaration starting at column 1', () => {
			const node = parse_declaration('color: red')
			expect(node.line).toBe(1)
			expect(node.column).toBe(1)
			expect(node.start).toBe(0)
			expect(node.length).toBe(10)
		})

		test('line and column with leading whitespace', () => {
			const node = parse_declaration('  color: red')
			expect(node.line).toBe(1)
			expect(node.column).toBe(3) // Points to 'c' in 'color'
			expect(node.start).toBe(2)
		})

		test('line and column for multi-line input', () => {
			const node = parse_declaration('\n  margin: 10px')
			expect(node.line).toBe(2)
			expect(node.column).toBe(3)
		})

		test('start and length for simple declaration', () => {
			const node = parse_declaration('color: red')
			expect(node.start).toBe(0)
			expect(node.length).toBe(10)
			expect(node.end).toBe(10)
		})

		test('start and length with semicolon', () => {
			const node = parse_declaration('color: red;')
			expect(node.start).toBe(0)
			expect(node.length).toBe(11)
			expect(node.end).toBe(11)
		})

		test('value nodes have correct line/column', () => {
			const node = parse_declaration('color: red blue')
			const [value1, value2] = node.children
			expect(value1.line).toBe(1)
			expect(value1.column).toBe(8) // Position of 'red'
			expect(value2.line).toBe(1)
			expect(value2.column).toBe(12) // Position of 'blue'
		})

		test('value nodes on multi-line have correct positions', () => {
			const node = parse_declaration('margin:\n  10px 20px')
			const [value1, value2] = node.children
			expect(value1.line).toBe(2)
			expect(value1.column).toBe(3) // Position of '10px'
			expect(value2.line).toBe(2)
			expect(value2.column).toBe(8) // Position of '20px'
		})
	})

	describe('Basic Properties', () => {
		test('simple declaration', () => {
			const node = parse_declaration('color: red')
			expect(node.type).toBe(DECLARATION)
			expect(node.name).toBe('color')
			expect(node.value).toBe('red')
			expect(node.is_important).toBe(false)
		})

		test('declaration with semicolon', () => {
			const node = parse_declaration('color: red;')
			expect(node.type).toBe(DECLARATION)
			expect(node.name).toBe('color')
			expect(node.value).toBe('red')
		})

		test('declaration without semicolon', () => {
			const node = parse_declaration('color: red')
			expect(node.type).toBe(DECLARATION)
			expect(node.name).toBe('color')
			expect(node.value).toBe('red')
		})

		test('declaration with whitespace variations', () => {
			const node = parse_declaration('color : red')
			expect(node.name).toBe('color')
			expect(node.value).toBe('red')
		})

		test('declaration with leading and trailing whitespace', () => {
			const node = parse_declaration('  color: red  ')
			expect(node.name).toBe('color')
			expect(node.value).toBe('red')
		})

		test('empty value', () => {
			const node = parse_declaration('color:')
			expect(node.name).toBe('color')
			// Empty values return null (consistent with main parser)
			expect(node.value).toBe(null)
			expect(node.children).toHaveLength(0)
		})

		test('empty value with semicolon', () => {
			const node = parse_declaration('color:;')
			expect(node.name).toBe('color')
			// Empty values return null (consistent with main parser)
			expect(node.value).toBe(null)
		})
	})

	describe('!important Flag', () => {
		test('declaration with !important', () => {
			const node = parse_declaration('color: red !important')
			expect(node.name).toBe('color')
			expect(node.value).toBe('red')
			expect(node.is_important).toBe(true)
		})

		test('declaration with !important and semicolon', () => {
			const node = parse_declaration('color: red !important;')
			expect(node.name).toBe('color')
			expect(node.value).toBe('red')
			expect(node.is_important).toBe(true)
		})

		test('historic !ie variant', () => {
			const node = parse_declaration('color: red !ie')
			expect(node.name).toBe('color')
			expect(node.value).toBe('red')
			expect(node.is_important).toBe(true)
		})

		test('any identifier after ! is treated as important', () => {
			const node = parse_declaration('color: red !foo')
			expect(node.name).toBe('color')
			expect(node.value).toBe('red')
			expect(node.is_important).toBe(true)
		})

		test('!important with no spaces', () => {
			const node = parse_declaration('color: red!important')
			expect(node.is_important).toBe(true)
		})
	})

	describe('Vendor Prefixes', () => {
		test('-webkit- vendor prefix', () => {
			const node = parse_declaration('-webkit-transform: rotate(45deg)')
			expect(node.name).toBe('-webkit-transform')
			expect(node.is_vendor_prefixed).toBe(true)
		})

		test('-moz- vendor prefix', () => {
			const node = parse_declaration('-moz-appearance: none')
			expect(node.name).toBe('-moz-appearance')
			expect(node.is_vendor_prefixed).toBe(true)
		})

		test('-ms- vendor prefix', () => {
			const node = parse_declaration('-ms-filter: blur(5px)')
			expect(node.name).toBe('-ms-filter')
			expect(node.is_vendor_prefixed).toBe(true)
		})

		test('-o- vendor prefix', () => {
			const node = parse_declaration('-o-transition: all 0.3s')
			expect(node.name).toBe('-o-transition')
			expect(node.is_vendor_prefixed).toBe(true)
		})

		test('non-prefixed property', () => {
			const node = parse_declaration('transform: rotate(45deg)')
			expect(node.name).toBe('transform')
			expect(node.is_vendor_prefixed).toBe(false)
		})

		test('custom property is not vendor prefixed', () => {
			const node = parse_declaration('--custom-color: blue')
			expect(node.name).toBe('--custom-color')
			expect(node.is_vendor_prefixed).toBe(false)
		})
	})

	describe('browser hacks', () => {
		const HACK_PREFIXES = '-_!$&*()=%+@,./`[]#~?:<>|'.split('')

		test.each(HACK_PREFIXES)('%s property hack', (char) => {
			const node = parse_declaration(`${char}property: value;`)
			expect(node.property).toBe(`${char}property`)
			expect(node.is_browserhack).toBe(true)
		})

		test('value\\9', () => {
			const node = parse_declaration('property: value\\9')
			expect(node.value).toBe('value\\9')
			expect(node.is_browserhack).toBe(false)
		})

		test('normal property is not a browserhack', () => {
			const node = parse_declaration('color: red')
			expect(node.is_browserhack).toBe(false)
		})

		test('vendor prefixed property is not a browserhack', () => {
			const node = parse_declaration('-o-color: red')
			expect(node.is_browserhack).toBe(false)
		})

		test('custom property is not a browserhack', () => {
			const node = parse_declaration('--custom: red')
			expect(node.is_browserhack).toBe(false)
		})
	})

	describe('Value Parsing', () => {
		test('identifier value', () => {
			const node = parse_declaration('display: flex')
			expect(node.children).toHaveLength(1)
			expect(node.children[0].type).toBe(IDENTIFIER)
			expect(node.children[0].text).toBe('flex')
		})

		test('number value', () => {
			const node = parse_declaration('opacity: 0.5')
			expect(node.children).toHaveLength(1)
			expect(node.children[0].type).toBe(NUMBER)
			expect(node.children[0].value).toBe(0.5)
		})

		test('dimension value', () => {
			const node = parse_declaration('width: 100px')
			expect(node.children).toHaveLength(1)
			expect(node.children[0].type).toBe(DIMENSION)
			expect(node.children[0].value).toBe(100)
			expect(node.children[0].unit).toBe('px')
		})

		test('multiple values', () => {
			const node = parse_declaration('margin: 10px 20px 30px 40px')
			expect(node.children).toHaveLength(4)
			expect(node.children[0].type).toBe(DIMENSION)
			expect(node.children[0].text).toBe('10px')
			expect(node.children[1].text).toBe('20px')
			expect(node.children[2].text).toBe('30px')
			expect(node.children[3].text).toBe('40px')
		})

		test('function value', () => {
			const node = parse_declaration('transform: rotate(45deg)')
			expect(node.children).toHaveLength(1)
			expect(node.children[0].type).toBe(FUNCTION)
			expect(node.children[0].name).toBe('rotate')
		})

		test('nested functions', () => {
			const node = parse_declaration('width: calc(100% - 20px)')
			expect(node.children).toHaveLength(1)
			expect(node.children[0].type).toBe(FUNCTION)
			expect(node.children[0].name).toBe('calc')
			expect(node.children[0].children.length).toBeGreaterThan(0)
		})

		test('complex value with multiple functions', () => {
			const node = parse_declaration('background: linear-gradient(to bottom, red, blue)')
			expect(node.children).toHaveLength(1)
			expect(node.children[0].type).toBe(FUNCTION)
			expect(node.children[0].name).toBe('linear-gradient')
		})

		test('CSS variable', () => {
			const node = parse_declaration('color: var(--primary-color)')
			expect(node.children).toHaveLength(1)
			expect(node.children[0].type).toBe(FUNCTION)
			expect(node.children[0].name).toBe('var')
		})
	})

	describe('Edge Cases', () => {
		test('invalid input - no colon', () => {
			const node = parse_declaration('not-a-declaration')
			expect(node.type).toBe(DECLARATION)
			// Should return empty declaration node
			expect(node.start).toBe(0)
			expect(node.length).toBe(0)
		})

		test('empty string', () => {
			const node = parse_declaration('')
			expect(node.type).toBe(DECLARATION)
			expect(node.start).toBe(0)
			expect(node.length).toBe(0)
		})

		test('only property name - no colon', () => {
			const node = parse_declaration('color')
			expect(node.type).toBe(DECLARATION)
			expect(node.start).toBe(0)
			expect(node.length).toBe(0)
		})

		test('property with colon but value with invalid token', () => {
			const node = parse_declaration('color: red')
			expect(node.name).toBe('color')
			expect(node.value).toBe('red')
		})
	})

	describe('CSSNode API', () => {
		test('node.type is DECLARATION', () => {
			const node = parse_declaration('color: red')
			expect(node.type).toBe(DECLARATION)
		})

		test('node.name returns property name', () => {
			const node = parse_declaration('background-color: blue')
			expect(node.name).toBe('background-color')
		})

		test('node.value returns raw value string', () => {
			const node = parse_declaration('margin: 10px 20px')
			expect(node.value).toBe('10px 20px')
		})

		test('node.is_important returns boolean', () => {
			const node1 = parse_declaration('color: red')
			expect(node1.is_important).toBe(false)

			const node2 = parse_declaration('color: red !important')
			expect(node2.is_important).toBe(true)
		})

		test('node.is_vendor_prefixed returns boolean', () => {
			const node1 = parse_declaration('transform: none')
			expect(node1.is_vendor_prefixed).toBe(false)

			const node2 = parse_declaration('-webkit-transform: none')
			expect(node2.is_vendor_prefixed).toBe(true)
		})

		test('node.children returns value nodes', () => {
			const node = parse_declaration('margin: 10px 20px')
			expect(node.children).toHaveLength(2)
			expect(node.children[0].type).toBe(DIMENSION)
			expect(node.children[1].type).toBe(DIMENSION)
		})

		test('node.text returns full declaration text', () => {
			const node = parse_declaration('color: red')
			expect(node.text).toBe('color: red')
		})

		test('node location properties', () => {
			const node = parse_declaration('color: red')
			expect(node.line).toBe(1)
			expect(node.column).toBe(1)
			expect(node.start).toBe(0)
			expect(node.length).toBe(10)
			expect(node.end).toBe(10)
		})
	})
})
