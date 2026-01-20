import { describe, it, expect } from 'vitest'
import { parse } from './parse'
import { IDENTIFIER, NUMBER, DIMENSION, STRING, HASH, FUNCTION, OPERATOR, PARENTHESIS, URL, UNICODE_RANGE, VALUE } from './arena'

describe('Value Node Types', () => {
	// Helper to get first value node from a declaration
	const getValue = (css: string) => {
		const root = parse(css)
		const rule = root.first_child
		const decl = rule?.first_child?.next_sibling?.first_child // selector → block → declaration
		return decl?.first_child!.children[0]
	}

	describe('Locations', () => {
		describe('IDENTIFIER', () => {
			it('should have correct offset and length', () => {
				const value = getValue('div { color: red; }')
				expect(value?.start).toBe(13)
				expect(value?.length).toBe(3)
				expect(value?.end).toBe(16)
				expect(value?.line).toBe(1)
				expect(value?.column).toBe(14)
			})

			it('should have correct line and column on line 2', () => {
				const value = getValue('div {\n  color: red;\n}')
				expect(value?.start).toBe(15)
				expect(value?.length).toBe(3)
				expect(value?.end).toBe(18)
				expect(value?.line).toBe(2)
				expect(value?.column).toBe(10)
			})
		})

		describe('NUMBER', () => {
			it('should have correct offset and length', () => {
				const value = getValue('div { opacity: 0.5; }')
				expect(value?.start).toBe(15)
				expect(value?.length).toBe(3)
				expect(value?.end).toBe(18)
				expect(value?.line).toBe(1)
				expect(value?.column).toBe(16)
			})

			it('should have correct line and column on line 3', () => {
				const value = getValue('div {\n  /* comment */\n  opacity: 0.5;\n}')
				expect(value?.start).toBe(33)
				expect(value?.length).toBe(3)
				expect(value?.end).toBe(36)
				expect(value?.line).toBe(3)
				expect(value?.column).toBe(12)
			})
		})

		describe('DIMENSION', () => {
			it('should have correct offset and length', () => {
				const value = getValue('div { width: 100px; }')
				expect(value?.start).toBe(13)
				expect(value?.length).toBe(5)
				expect(value?.end).toBe(18)
				expect(value?.line).toBe(1)
				expect(value?.column).toBe(14)
			})

			it('should have correct line and column on line 2', () => {
				const value = getValue('div {\n  width: 100px;\n}')
				expect(value?.start).toBe(15)
				expect(value?.length).toBe(5)
				expect(value?.end).toBe(20)
				expect(value?.line).toBe(2)
				expect(value?.column).toBe(10)
			})
		})

		describe('STRING', () => {
			it('should have correct offset and length', () => {
				const value = getValue('div { content: "hello"; }')
				expect(value?.start).toBe(15)
				expect(value?.length).toBe(7)
				expect(value?.end).toBe(22)
				expect(value?.line).toBe(1)
				expect(value?.column).toBe(16)
			})

			it('should have correct line and column on line 4', () => {
				const value = getValue('div {\n  /* line 2 */\n  /* line 3 */\n  content: "hello";\n}')
				expect(value?.start).toBe(47)
				expect(value?.length).toBe(7)
				expect(value?.end).toBe(54)
				expect(value?.line).toBe(4)
				expect(value?.column).toBe(12)
			})
		})

		describe('HASH', () => {
			it('should have correct offset and length', () => {
				const value = getValue('div { color: #ff0000; }')
				expect(value?.start).toBe(13)
				expect(value?.length).toBe(7)
				expect(value?.end).toBe(20)
				expect(value?.line).toBe(1)
				expect(value?.column).toBe(14)
			})

			it('should have correct line and column on line 2', () => {
				const value = getValue('div {\n  color: #ff0000;\n}')
				expect(value?.start).toBe(15)
				expect(value?.length).toBe(7)
				expect(value?.end).toBe(22)
				expect(value?.line).toBe(2)
				expect(value?.column).toBe(10)
			})
		})

		describe('FUNCTION', () => {
			it('should have correct offset and length', () => {
				const value = getValue('div { color: rgb(255, 0, 0); }')
				expect(value?.start).toBe(13)
				expect(value?.length).toBe(14)
				expect(value?.end).toBe(27)
				expect(value?.line).toBe(1)
				expect(value?.column).toBe(14)
			})

			it('should have correct line and column on line 3', () => {
				const value = getValue('div {\n  /* comment */\n  color: rgb(255, 0, 0);\n}')
				expect(value?.start).toBe(31)
				expect(value?.length).toBe(14)
				expect(value?.end).toBe(45)
				expect(value?.line).toBe(3)
				expect(value?.column).toBe(10)
			})

			it('should have correct offset and length for var()', () => {
				const value = getValue('div { color: var(--item); }')
				expect(value?.start).toBe(13)
				expect(value?.length).toBe(11)
				expect(value?.end).toBe(24)
				expect(value?.line).toBe(1)
				expect(value?.column).toBe(14)
			})

			it('should have correct offset and length for var() with fallback', () => {
				const value = getValue('div { color: var(--item1, var(--item2)); }')
				expect(value?.start).toBe(13)
				expect(value?.length).toBe(26)
				expect(value?.end).toBe(39)
				expect(value?.line).toBe(1)
				expect(value?.column).toBe(14)
			})
		})

		describe('OPERATOR', () => {
			it('should have correct offset and length', () => {
				const root = parse('div { font-family: Arial, sans-serif; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
				const comma = decl?.first_child!.children[1]
				expect(comma?.start).toBe(24)
				expect(comma?.length).toBe(1)
				expect(comma?.end).toBe(25)
				expect(comma?.line).toBe(1)
				expect(comma?.column).toBe(25)
			})

			it('should have correct line and column on line 2', () => {
				const root = parse('div {\n  font-family: Arial, sans-serif;\n}')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
				const comma = decl?.first_child!.children[1]
				expect(comma?.start).toBe(26)
				expect(comma?.length).toBe(1)
				expect(comma?.end).toBe(27)
				expect(comma?.line).toBe(2)
				expect(comma?.column).toBe(21)
			})
		})

		describe('PARENTHESIS', () => {
			it('should have correct offset and length', () => {
				const root = parse('div { width: calc((100% - 50px) / 2); }')
				const func = root.first_child?.first_child?.next_sibling?.first_child?.first_child!.children[0]
				const paren = func?.children[0]
				expect(paren?.start).toBe(18)
				expect(paren?.length).toBe(13)
				expect(paren?.end).toBe(31)
				expect(paren?.line).toBe(1)
				expect(paren?.column).toBe(19)
			})

			it('should have correct line and column on line 2', () => {
				const root = parse('div {\n  width: calc((100% - 50px) / 2);\n}')
				const func = root.first_child?.first_child?.next_sibling?.first_child?.first_child!.children[0]
				const paren = func?.children[0]
				expect(paren?.start).toBe(20)
				expect(paren?.length).toBe(13)
				expect(paren?.end).toBe(33)
				expect(paren?.line).toBe(2)
				expect(paren?.column).toBe(15)
			})
		})

		describe('URL', () => {
			it('should have correct offset and length', () => {
				const value = getValue('div { background: url("image.png"); }')
				expect(value?.start).toBe(18)
				expect(value?.length).toBe(16)
				expect(value?.end).toBe(34)
				expect(value?.line).toBe(1)
				expect(value?.column).toBe(19)
			})

			it('should have correct line and column on line 2', () => {
				const value = getValue('div {\n  background: url("image.png");\n}')
				expect(value?.start).toBe(20)
				expect(value?.length).toBe(16)
				expect(value?.end).toBe(36)
				expect(value?.line).toBe(2)
				expect(value?.column).toBe(15)
			})
		})

		describe('UNICODE_RANGE', () => {
			it('should have correct offset and length', () => {
				const root = parse('@font-face { unicode-range: u+0025-00ff; }')
				const declaration = root.first_child?.block?.first_child
				const value = declaration?.first_child?.children[0]
				expect(value?.start).toBe(28)
				expect(value?.length).toBe(11)
				expect(value?.end).toBe(39)
				expect(value?.line).toBe(1)
				expect(value?.column).toBe(29)
			})

			it('should have correct line and column on line 2', () => {
				const root = parse('@font-face {\n  unicode-range: u+4??;\n}')
				const declaration = root.first_child?.block?.first_child
				const value = declaration?.first_child?.children[0]
				expect(value?.start).toBe(30)
				expect(value?.length).toBe(5)
				expect(value?.end).toBe(35)
				expect(value?.line).toBe(2)
				expect(value?.column).toBe(18)
			})
		})
	})

	describe('Types', () => {
		it('IDENTIFIER type constant', () => {
			const value = getValue('div { color: red; }')
			expect(value?.type).toBe(IDENTIFIER)
		})

		it('NUMBER type constant', () => {
			const value = getValue('div { opacity: 0.5; }')
			expect(value?.type).toBe(NUMBER)
		})

		it('DIMENSION type constant', () => {
			const value = getValue('div { width: 100px; }')
			expect(value?.type).toBe(DIMENSION)
		})

		it('STRING type constant', () => {
			const value = getValue('div { content: "hello"; }')
			expect(value?.type).toBe(STRING)
		})

		it('HASH type constant', () => {
			const value = getValue('div { color: #ff0000; }')
			expect(value?.type).toBe(HASH)
		})

		it('FUNCTION type constant', () => {
			const value = getValue('div { color: rgb(255, 0, 0); }')
			expect(value?.type).toBe(FUNCTION)
		})

		it('OPERATOR type constant', () => {
			const root = parse('div { font-family: Arial, sans-serif; }')
			const comma = root.first_child?.first_child?.next_sibling?.first_child?.first_child!.children[1]
			expect(comma?.type).toBe(OPERATOR)
		})

		it('PARENTHESIS type constant', () => {
			const root = parse('div { width: calc((100% - 50px) / 2); }')
			const func = root.first_child?.first_child?.next_sibling?.first_child?.first_child!.children[0]
			const paren = func?.children[0]
			expect(paren?.type).toBe(PARENTHESIS)
		})

		it('URL type constant', () => {
			const value = getValue('div { background: url("image.png"); }')
			expect(value?.type).toBe(URL)
		})

		it('UNICODE_RANGE type constant', () => {
			const root = parse('@font-face { unicode-range: u+0460-052f, u+1c80-1c8a, u+20b4, u+2de0-2dff, u+a640-a69f, u+fe2e-fe2f; }')
			const atrule = root.first_child
			const declaration = atrule?.block?.first_child
			const unicode_range = declaration?.first_child?.children[0]
			expect(unicode_range?.type).toBe(UNICODE_RANGE)
		})
	})

	describe('Type Names', () => {
		it('IDENTIFIER type_name', () => {
			const value = getValue('div { color: red; }')
			expect(value?.type_name).toBe('Identifier')
		})

		it('NUMBER type_name', () => {
			const value = getValue('div { opacity: 0.5; }')
			expect(value?.type_name).toBe('Number')
		})

		it('DIMENSION type_name', () => {
			const value = getValue('div { width: 100px; }')
			expect(value?.type_name).toBe('Dimension')
		})

		it('STRING type_name', () => {
			const value = getValue('div { content: "hello"; }')
			expect(value?.type_name).toBe('String')
		})

		it('HASH type_name', () => {
			const value = getValue('div { color: #ff0000; }')
			expect(value?.type_name).toBe('Hash')
		})

		it('FUNCTION type_name', () => {
			const value = getValue('div { color: rgb(255, 0, 0); }')
			expect(value?.type_name).toBe('Function')
		})

		it('OPERATOR type_name', () => {
			const root = parse('div { font-family: Arial, sans-serif; }')
			const comma = root.first_child?.first_child?.next_sibling?.first_child?.first_child!.children[1]
			expect(comma?.type_name).toBe('Operator')
		})

		it('PARENTHESIS type_name', () => {
			const root = parse('div { width: calc((100% - 50px) / 2); }')
			const func = root.first_child?.first_child?.next_sibling?.first_child?.first_child!.children[0]
			const paren = func?.children[0]
			expect(paren?.type_name).toBe('Parentheses')
		})

		it('URL type_name', () => {
			const value = getValue('div { background: url("image.png"); }')
			expect(value?.type_name).toBe('Url')
		})

		it('UNICODE_RANGE type_name', () => {
			const root = parse('@font-face { unicode-range: u+0025-00ff; }')
			const unicode_range = root.first_child?.block?.first_child?.first_child?.children[0]
			expect(unicode_range?.type_name).toBe('UnicodeRange')
		})
	})

	describe('Value Properties', () => {
		describe('IDENTIFIER', () => {
			it('should parse keyword values', () => {
				const root = parse('body { color: red; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.text).toBe('red')
				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].text).toBe('red')
			})

			it('should parse multiple keywords', () => {
				const root = parse('body { font-family: Arial, sans-serif; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.children).toHaveLength(3)
				expect(decl?.first_child!.children[0].type).toBe(IDENTIFIER)
				expect(decl?.first_child!.children[0].text).toBe('Arial')
				expect(decl?.first_child!.children[2].type).toBe(IDENTIFIER)
				expect(decl?.first_child!.children[2].text).toBe('sans-serif')
			})
		})

		describe('NUMBER', () => {
			it('should parse number values', () => {
				const root = parse('body { opacity: 0.5; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.text).toBe('0.5')
				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].text).toBe('0.5')
			})

			it('should handle negative numbers', () => {
				const root = parse('body { margin: -10px; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].type).toBe(DIMENSION)
				expect(decl?.first_child!.children[0].text).toBe('-10px')
			})

			it('should handle zero without unit', () => {
				const root = parse('body { margin: 0; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].type).toBe(NUMBER)
				expect(decl?.first_child!.children[0].text).toBe('0')
			})
		})

		describe('DIMENSION', () => {
			it('should parse px dimension values', () => {
				const root = parse('body { width: 100px; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.text).toBe('100px')
				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].text).toBe('100px')
				expect(decl?.first_child!.children[0].value).toBe(100)
				expect(decl?.first_child!.children[0].unit).toBe('px')
			})

			it('should parse em dimension values', () => {
				const root = parse('body { font-size: 3em; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.text).toBe('3em')
				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].text).toBe('3em')
				expect(decl?.first_child!.children[0].value).toBe(3)
				expect(decl?.first_child!.children[0].unit).toBe('em')
			})

			it('should parse percentage values', () => {
				const root = parse('body { width: 50%; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.text).toBe('50%')
				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].text).toBe('50%')
			})

			it('should handle zero with unit', () => {
				const root = parse('body { margin: 0px; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].type).toBe(DIMENSION)
				expect(decl?.first_child!.children[0].text).toBe('0px')
			})

			it('should parse margin shorthand', () => {
				const root = parse('body { margin: 10px 20px 30px 40px; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.children).toHaveLength(4)
				expect(decl?.first_child!.children[0].type).toBe(DIMENSION)
				expect(decl?.first_child!.children[0].text).toBe('10px')
				expect(decl?.first_child!.children[1].type).toBe(DIMENSION)
				expect(decl?.first_child!.children[1].text).toBe('20px')
				expect(decl?.first_child!.children[2].type).toBe(DIMENSION)
				expect(decl?.first_child!.children[2].text).toBe('30px')
				expect(decl?.first_child!.children[3].type).toBe(DIMENSION)
				expect(decl?.first_child!.children[3].text).toBe('40px')
			})
		})

		describe('STRING', () => {
			it('should parse string values', () => {
				const root = parse('body { content: "hello"; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.text).toBe('"hello"')
				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].text).toBe('"hello"')
			})
		})

		describe('HASH', () => {
			it('should parse color values', () => {
				const root = parse('body { color: #ff0000; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.text).toBe('#ff0000')
				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].text).toBe('#ff0000')
			})
		})

		describe('FUNCTION', () => {
			it('should parse simple function', () => {
				const root = parse('body { color: rgb(255, 0, 0); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].type).toBe(FUNCTION)
				expect(decl?.first_child!.children[0].name).toBe('rgb')
				expect(decl?.first_child!.children[0].text).toBe('rgb(255, 0, 0)')
			})

			it('should parse function arguments', () => {
				const root = parse('body { color: rgb(255, 0, 0); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
				const func = decl?.first_child!.children[0]

				expect(func?.children).toHaveLength(5)
				expect(func?.children[0].type).toBe(NUMBER)
				expect(func?.children[0].text).toBe('255')
				expect(func?.children[1].type).toBe(OPERATOR)
				expect(func?.children[1].text).toBe(',')
				expect(func?.children[2].type).toBe(NUMBER)
				expect(func?.children[2].text).toBe('0')
				expect(func?.children[3].type).toBe(OPERATOR)
				expect(func?.children[3].text).toBe(',')
				expect(func?.children[4].type).toBe(NUMBER)
				expect(func?.children[4].text).toBe('0')
			})

			it('should parse nested functions', () => {
				const root = parse('body { width: calc(100% - 20px); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].type).toBe(FUNCTION)
				expect(decl?.first_child!.children[0].name).toBe('calc')
				expect(decl?.first_child!.children[0].children).toHaveLength(3)
				expect(decl?.first_child!.children[0].children[0].type).toBe(DIMENSION)
				expect(decl?.first_child!.children[0].children[0].text).toBe('100%')
				expect(decl?.first_child!.children[0].children[1].type).toBe(OPERATOR)
				expect(decl?.first_child!.children[0].children[1].text).toBe('-')
				expect(decl?.first_child!.children[0].children[2].type).toBe(DIMENSION)
				expect(decl?.first_child!.children[0].children[2].text).toBe('20px')
			})

			it('should parse var() function', () => {
				const root = parse('body { color: var(--primary-color); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].type).toBe(FUNCTION)
				expect(decl?.first_child!.children[0].name).toBe('var')
				expect(decl?.first_child!.children[0].children).toHaveLength(1)
				expect(decl?.first_child!.children[0].children[0].type).toBe(IDENTIFIER)
				expect(decl?.first_child!.children[0].children[0].text).toBe('--primary-color')
			})

			it('should provide node.value for calc()', () => {
				const root = parse('body { width: calc(100% - 20px); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
				const func = decl?.first_child!.children[0]

				expect(func?.type).toBe(FUNCTION)
				expect(func?.name).toBe('calc')
				expect(func?.text).toBe('calc(100% - 20px)')
				expect(func?.value).toBe('100% - 20px')
				expect(func?.has_children).toBe(true)
			})

			it('should provide node.value for var() function', () => {
				const root = parse('body { color: var(--primary-color); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
				const func = decl?.first_child!.children[0]

				expect(func?.type).toBe(FUNCTION)
				expect(func?.name).toBe('var')
				expect(func?.text).toBe('var(--primary-color)')
				expect(func?.value).toBe('--primary-color')
				expect(func?.has_children).toBe(true)
			})

			it('should provide node.value for var() function with fallback', () => {
				const root = parse('body { color: var(--primary-color, 1); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
				const func = decl?.first_child!.children[0]

				expect(func?.type).toBe(FUNCTION)
				expect(func?.name).toBe('var')
				expect(func?.text).toBe('var(--primary-color, 1)')
				expect(func?.value).toBe('--primary-color, 1')
				expect(func?.has_children).toBe(true)
			})

			it('should parse transform value', () => {
				const root = parse('body { transform: translateX(10px) rotate(45deg); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.children).toHaveLength(2)
				expect(decl?.first_child!.children[0].type).toBe(FUNCTION)
				expect(decl?.first_child!.children[0].name).toBe('translateX')
				expect(decl?.first_child!.children[1].type).toBe(FUNCTION)
				expect(decl?.first_child!.children[1].name).toBe('rotate')
			})

			it('should parse filter value', () => {
				const root = parse('body { filter: blur(5px) brightness(1.2); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.children).toHaveLength(2)
				expect(decl?.first_child!.children[0].type).toBe(FUNCTION)
				expect(decl?.first_child!.children[0].name).toBe('blur')
				expect(decl?.first_child!.children[0].children[0].text).toBe('5px')
				expect(decl?.first_child!.children[1].type).toBe(FUNCTION)
				expect(decl?.first_child!.children[1].name).toBe('brightness')
				expect(decl?.first_child!.children[1].children[0].text).toBe('1.2')
			})
		})

		describe('OPERATOR', () => {
			it('should parse comma operator', () => {
				const root = parse('body { font-family: Arial, sans-serif; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.children[1].type).toBe(OPERATOR)
				expect(decl?.first_child!.children[1].text).toBe(',')
			})

			it('should parse calc operators', () => {
				const root = parse('body { width: calc(100% - 20px); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
				const func = decl?.first_child!.children[0]

				expect(func?.children[1].type).toBe(OPERATOR)
				expect(func?.children[1].text).toBe('-')
			})

			it('should parse all calc operators', () => {
				const root = parse('body { width: calc(1px + 2px * 3px / 4px - 5px); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
				const func = decl?.first_child!.children[0]

				const operators = func?.children.filter((n) => n.type === OPERATOR)
				expect(operators).toHaveLength(4)
				expect(operators?.[0].text).toBe('+')
				expect(operators?.[1].text).toBe('*')
				expect(operators?.[2].text).toBe('/')
				expect(operators?.[3].text).toBe('-')
			})
		})

		describe('PARENTHESIS', () => {
			it('should parse parenthesized expressions in calc()', () => {
				const root = parse('body { width: calc((100% - 50px) / 2); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
				const func = decl?.first_child!.children[0]

				expect(func?.type).toBe(FUNCTION)
				expect(func?.name).toBe('calc')
				expect(func?.children).toHaveLength(3)

				// First child should be a parenthesis node
				expect(func?.children[0].type).toBe(PARENTHESIS)
				expect(func?.children[0].text).toBe('(100% - 50px)')

				// Check parenthesis content
				const parenNode = func?.children[0]
				expect(parenNode?.children).toHaveLength(3)
				expect(parenNode?.children[0].type).toBe(DIMENSION)
				expect(parenNode?.children[0].text).toBe('100%')
				expect(parenNode?.children[1].type).toBe(OPERATOR)
				expect(parenNode?.children[1].text).toBe('-')
				expect(parenNode?.children[2].type).toBe(DIMENSION)
				expect(parenNode?.children[2].text).toBe('50px')

				// Second child should be division operator
				expect(func?.children[1].type).toBe(OPERATOR)
				expect(func?.children[1].text).toBe('/')

				// Third child should be number
				expect(func?.children[2].type).toBe(NUMBER)
				expect(func?.children[2].text).toBe('2')
			})

			it('should parse complex nested parentheses', () => {
				const root = parse('body { width: calc(((100% - var(--x)) / 12 * 6) + (-1 * var(--y))); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
				const func = decl?.first_child!.children[0]

				expect(func?.type).toBe(FUNCTION)
				expect(func?.name).toBe('calc')

				// The calc function should have 3 children: parenthesis + operator + parenthesis
				expect(func?.children).toHaveLength(3)
				expect(func?.children[0].type).toBe(PARENTHESIS)
				expect(func?.children[0].text).toBe('((100% - var(--x)) / 12 * 6)')
				expect(func?.children[1].type).toBe(OPERATOR)
				expect(func?.children[1].text).toBe('+')
				expect(func?.children[2].type).toBe(PARENTHESIS)
				expect(func?.children[2].text).toBe('(-1 * var(--y))')

				// Check first parenthesis has nested parenthesis and preserves structure
				const firstParen = func?.children[0]
				expect(firstParen?.children).toHaveLength(5) // paren + / + 12 + * + 6
				expect(firstParen?.children[0].type).toBe(PARENTHESIS)
				expect(firstParen?.children[0].text).toBe('(100% - var(--x))')

				// Check nested parenthesis has function
				const nestedParen = firstParen?.children[0]
				expect(nestedParen?.children[2].type).toBe(FUNCTION)
				expect(nestedParen?.children[2].name).toBe('var')

				// Check second parenthesis has content
				const secondParen = func?.children[2]
				expect(secondParen?.children).toHaveLength(3) // -1 * var(--y)
				expect(secondParen?.children[0].type).toBe(NUMBER)
				expect(secondParen?.children[0].text).toBe('-1')
				expect(secondParen?.children[2].type).toBe(FUNCTION)
				expect(secondParen?.children[2].name).toBe('var')
			})
		})

		describe('URL', () => {
			it('should parse url() function with quoted string', () => {
				const root = parse('body { background: url("image.png"); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].type).toBe(URL)
				expect(decl?.first_child!.children[0].name).toBe('url')
				expect(decl?.first_child!.children[0].children).toHaveLength(1)
				expect(decl?.first_child!.children[0].children[0].type).toBe(STRING)
				expect(decl?.first_child!.children[0].children[0].text).toBe('"image.png"')
				// URL node with quoted string returns the string value with quotes
				expect(decl?.first_child!.children[0].value).toBe('"image.png"')
			})

			it('should parse url() function with unquoted URL containing dots', () => {
				const root = parse('body { cursor: url(mycursor.cur); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
				const func = decl?.first_child!.children[0]

				expect(func?.type).toBe(URL)
				expect(func?.name).toBe('url')

				// URL function should not parse children - content is available via node.value
				expect(func?.has_children).toBe(false)
				expect(func?.text).toBe('url(mycursor.cur)')
				expect(func?.value).toBe('mycursor.cur')
			})

			it('should parse src() function with unquoted URL', () => {
				const root = parse('body { content: src(myfont.woff2); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
				const func = decl?.first_child!.children[0]

				expect(func?.type).toBe(FUNCTION)
				expect(func?.name).toBe('src')
				expect(func?.has_children).toBe(false)
				expect(func?.text).toBe('src(myfont.woff2)')
				expect(func?.value).toBe('myfont.woff2')
			})

			it('should parse url() function with single-quoted string', () => {
				const root = parse("body { background: url('image.png'); }")
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].type).toBe(URL)
				expect(decl?.first_child!.children[0].name).toBe('url')
				expect(decl?.first_child!.children[0].children).toHaveLength(1)
				expect(decl?.first_child!.children[0].children[0].type).toBe(STRING)
				expect(decl?.first_child!.children[0].children[0].text).toBe("'image.png'")
				// URL node with single-quoted string returns the string value with quotes
				expect(decl?.first_child!.children[0].value).toBe("'image.png'")
			})

			it('should parse url() with base64 data URL', () => {
				const root = parse('body { background: url(data:image/png;base64,iVBORw0KGg); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
				const func = decl?.first_child!.children[0]

				expect(func?.type).toBe(URL)
				expect(func?.name).toBe('url')
				expect(func?.has_children).toBe(false)
				expect(func?.value).toBe('data:image/png;base64,iVBORw0KGg')
			})

			it('should parse url() with inline SVG', () => {
				const root = parse('body { background: url(data:image/svg+xml,<svg></svg>); }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
				const func = decl?.first_child!.children[0]

				expect(func?.type).toBe(URL)
				expect(func?.name).toBe('url')
				expect(func?.has_children).toBe(false)
				expect(func?.value).toBe('data:image/svg+xml,<svg></svg>')
			})

			it('should parse complex background value with url()', () => {
				const root = parse('body { background: url("bg.png") no-repeat center center / cover; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child
			expect(decl?.first_child!.children.length).toBeGreaterThan(1)
				expect(decl?.first_child!.children[0].type).toBe(URL)
				expect(decl?.first_child!.children[0].name).toBe('url')
				expect(decl?.first_child!.children[1].type).toBe(IDENTIFIER)
				expect(decl?.first_child!.children[1].text).toBe('no-repeat')
			})
		})

		describe('UNICODE_RANGE', () => {
			it('should parse simple unicode range', () => {
				const root = parse('@font-face { unicode-range: u+0025-00ff; }')
				const decl = root.first_child?.block?.first_child

				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].type).toBe(UNICODE_RANGE)
				expect(decl?.first_child!.children[0].text).toBe('u+0025-00ff')
			})

			it('should parse single codepoint', () => {
				const root = parse('@font-face { unicode-range: u+26; }')
				const decl = root.first_child?.block?.first_child

				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].type).toBe(UNICODE_RANGE)
				expect(decl?.first_child!.children[0].text).toBe('u+26')
			})

			it('should parse wildcard pattern with question marks', () => {
				const root = parse('@font-face { unicode-range: u+4??; }')
				const decl = root.first_child?.block?.first_child

				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].type).toBe(UNICODE_RANGE)
				expect(decl?.first_child!.children[0].text).toBe('u+4??')
			})

			it('should parse uppercase U+', () => {
				const root = parse('@font-face { unicode-range: U+0025-00FF; }')
				const decl = root.first_child?.block?.first_child

				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].type).toBe(UNICODE_RANGE)
				expect(decl?.first_child!.children[0].text).toBe('U+0025-00FF')
			})

			it('should parse multiple unicode ranges', () => {
				const root = parse('@font-face { unicode-range: u+0460-052f, u+1c80-1c8a, u+20b4; }')
				const decl = root.first_child?.block?.first_child

				expect(decl?.first_child!.children).toHaveLength(5) // 3 ranges + 2 commas
				expect(decl?.first_child!.children[0].type).toBe(UNICODE_RANGE)
				expect(decl?.first_child!.children[0].text).toBe('u+0460-052f')
				expect(decl?.first_child!.children[1].type).toBe(OPERATOR)
				expect(decl?.first_child!.children[1].text).toBe(',')
				expect(decl?.first_child!.children[2].type).toBe(UNICODE_RANGE)
				expect(decl?.first_child!.children[2].text).toBe('u+1c80-1c8a')
				expect(decl?.first_child!.children[3].type).toBe(OPERATOR)
				expect(decl?.first_child!.children[4].type).toBe(UNICODE_RANGE)
				expect(decl?.first_child!.children[4].text).toBe('u+20b4')
			})

			it('should parse short hex values', () => {
				const root = parse('@font-face { unicode-range: u+0; }')
				const decl = root.first_child?.block?.first_child

				expect(decl?.first_child!.children[0].type).toBe(UNICODE_RANGE)
				expect(decl?.first_child!.children[0].text).toBe('u+0')
			})

			it('should parse maximum valid unicode', () => {
				const root = parse('@font-face { unicode-range: u+10ffff; }')
				const decl = root.first_child?.block?.first_child

				expect(decl?.first_child!.children[0].type).toBe(UNICODE_RANGE)
				expect(decl?.first_child!.children[0].text).toBe('u+10ffff')
			})

			it('should parse wildcard variations', () => {
				const root = parse('@font-face { unicode-range: u+?, u+??, u+???, u+????, u+?????, u+??????; }')
				const decl = root.first_child?.block?.first_child

				expect(decl?.first_child!.children[0].type).toBe(UNICODE_RANGE)
				expect(decl?.first_child!.children[0].text).toBe('u+?')
				expect(decl?.first_child!.children[2].type).toBe(UNICODE_RANGE)
				expect(decl?.first_child!.children[2].text).toBe('u+??')
				expect(decl?.first_child!.children[4].type).toBe(UNICODE_RANGE)
				expect(decl?.first_child!.children[4].text).toBe('u+???')
				expect(decl?.first_child!.children[10].type).toBe(UNICODE_RANGE)
				expect(decl?.first_child!.children[10].text).toBe('u+??????')
			})
		})

		describe('Mixed values', () => {
			it('should parse mixed value types', () => {
				const root = parse('body { border: 1px solid red; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.children).toHaveLength(3)
				expect(decl?.first_child!.children[0].type).toBe(DIMENSION)
				expect(decl?.first_child!.children[0].text).toBe('1px')
				expect(decl?.first_child!.children[1].type).toBe(IDENTIFIER)
				expect(decl?.first_child!.children[1].text).toBe('solid')
				expect(decl?.first_child!.children[2].type).toBe(IDENTIFIER)
				expect(decl?.first_child!.children[2].text).toBe('red')
			})

			it('should handle empty value', () => {
				const root = parse('body { color: ; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

			expect(decl?.first_child!.type).toBe(VALUE)
				expect(decl?.first_child!.children).toHaveLength(0)
			})

			it('should handle value with !important', () => {
				const root = parse('body { color: red !important; }')
				const decl = root.first_child?.first_child?.next_sibling?.first_child

				expect(decl?.first_child!.text).toBe('red')
				expect(decl?.first_child!.children).toHaveLength(1)
				expect(decl?.first_child!.children[0].type).toBe(IDENTIFIER)
				expect(decl?.first_child!.children[0].text).toBe('red')
				expect(decl?.is_important).toBe(true)
			})
		})
	})

	describe('value_as_number getter', () => {
		it('should return number for NUMBER nodes', () => {
			const root = parse('div { opacity: 0.5; }')
			const decl = root.first_child?.first_child?.next_sibling?.first_child
			const numberNode = decl?.first_child!.children[0]

			expect(numberNode?.type).toBe(NUMBER)
			expect(numberNode?.value_as_number).toBe(0.5)
		})

		it('should return number for DIMENSION nodes', () => {
			const root = parse('div { width: 100px; }')
			const decl = root.first_child?.first_child?.next_sibling?.first_child
			const dimNode = decl?.first_child!.children[0]

			expect(dimNode?.type).toBe(DIMENSION)
			expect(dimNode?.value_as_number).toBe(100)
		})

		it('should handle negative numbers', () => {
			const root = parse('div { margin: -10px; }')
			const decl = root.first_child?.first_child?.next_sibling?.first_child
			const dimNode = decl?.first_child!.children[0]

			expect(dimNode?.type).toBe(DIMENSION)
			expect(dimNode?.value_as_number).toBe(-10)
		})

		it('should handle zero', () => {
			const root = parse('div { margin: 0; }')
			const decl = root.first_child?.first_child?.next_sibling?.first_child
			const numberNode = decl?.first_child!.children[0]

			expect(numberNode?.type).toBe(NUMBER)
			expect(numberNode?.value_as_number).toBe(0)
		})

		it('should handle decimal numbers', () => {
			const root = parse('div { line-height: 1.5; }')
			const decl = root.first_child?.first_child?.next_sibling?.first_child
			const numberNode = decl?.first_child!.children[0]

			expect(numberNode?.type).toBe(NUMBER)
			expect(numberNode?.value_as_number).toBe(1.5)
		})

		it('should handle percentage dimensions', () => {
			const root = parse('div { width: 50%; }')
			const decl = root.first_child?.first_child?.next_sibling?.first_child
			const dimNode = decl?.first_child!.children[0]

			expect(dimNode?.type).toBe(DIMENSION)
			expect(dimNode?.value_as_number).toBe(50)
			expect(dimNode?.unit).toBe('%')
		})

		it('should return null for IDENTIFIER nodes', () => {
			const root = parse('div { color: red; }')
			const decl = root.first_child?.first_child?.next_sibling?.first_child
			const identNode = decl?.first_child!.children[0]

			expect(identNode?.type).toBe(IDENTIFIER)
			expect(identNode?.value_as_number).toBeNull()
		})

		it('should return null for STRING nodes', () => {
			const root = parse('div { content: "hello"; }')
			const decl = root.first_child?.first_child?.next_sibling?.first_child
			const stringNode = decl?.first_child!.children[0]

			expect(stringNode?.type).toBe(STRING)
			expect(stringNode?.value_as_number).toBeNull()
		})

		it('should return null for FUNCTION nodes', () => {
			const root = parse('div { width: calc(100% - 20px); }')
			const decl = root.first_child?.first_child?.next_sibling?.first_child
			const funcNode = decl?.first_child!.children[0]

			expect(funcNode?.type).toBe(FUNCTION)
			expect(funcNode?.value_as_number).toBeNull()
		})
	})

	describe('Case-insensitive function names', () => {
		const getValue = (css: string) => {
			const root = parse(css)
			const rule = root.first_child
			const decl = rule?.first_child?.next_sibling?.first_child
			return decl?.first_child!.children[0]
		}

		it('should parse URL() with uppercase', () => {
			const value = getValue('div { background: URL("image.png"); }')
			expect(value?.type).toBe(URL)
			expect(value?.text).toBe('URL("image.png")')
		})

		it('should parse Url() with mixed case', () => {
			const value = getValue('div { background: Url("image.png"); }')
			expect(value?.type).toBe(URL)
			expect(value?.text).toBe('Url("image.png")')
		})

		it('should parse CALC() with uppercase', () => {
			const value = getValue('div { width: CALC(100% - 20px); }')
			expect(value?.type).toBe(FUNCTION)
			expect(value?.text).toBe('CALC(100% - 20px)')
		})

		it('should parse Calc() with mixed case', () => {
			const value = getValue('div { width: Calc(100% - 20px); }')
			expect(value?.type).toBe(FUNCTION)
			expect(value?.text).toBe('Calc(100% - 20px)')
		})

		it('should parse RGB() with uppercase', () => {
			const value = getValue('div { color: RGB(255, 0, 0); }')
			expect(value?.type).toBe(FUNCTION)
			expect(value?.text).toBe('RGB(255, 0, 0)')
		})

		it('should parse RGBA() with uppercase', () => {
			const value = getValue('div { color: RGBA(255, 0, 0, 0.5); }')
			expect(value?.type).toBe(FUNCTION)
			expect(value?.text).toBe('RGBA(255, 0, 0, 0.5)')
		})

		it('should parse unquoted URL() with uppercase', () => {
			const value = getValue('div { background: URL(image.png); }')
			expect(value?.type).toBe(URL)
			expect(value?.text).toBe('URL(image.png)')
			expect(value?.value).toBe('image.png')
		})

		it('should handle nested functions with uppercase', () => {
			const value = getValue('div { width: CALC(MAX(100%, 50px) - 20px); }')
			expect(value?.type).toBe(FUNCTION)
			expect(value?.children[0].type).toBe(FUNCTION)
		})
	})
})
