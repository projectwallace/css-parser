import { test, expect } from 'vitest'
import { parse } from './parse'
import { parse_selector } from './parse-selector'
import { ID_SELECTOR } from './constants'

test('escaped quote in selector', () => {
	expect(parse('.a{color:red} .x-\\"{color:red} .b{color:blue}').children.length).toBe(3)
	expect(parse(".a{color:red} .x-\\'{color:red} .b{color:blue}").children.length).toBe(3)
})
test('escaped quote in declaration value', () => {
	expect(parse('.a{content:\\"} .b{color:blue} .c{color:green}').children.length).toBe(3)
})
test('tailwind arbitrary value', () => {
	expect(
		parse(
			'.a{color:red}.x\\:before\\:content-\\[\\"\\#\\"\\]{&:before{content:"#"}}.b{color:blue}.c{color:green}',
		).children.length,
	).toBe(4)
})

test.each([
	['#md\\:hidden', '#md\\:hidden'],
	['#\\31 23', '#\\31 23'],
	['#a\\.b', '#a\\.b'],
])('escape in ID selector %s is a single IdSelector', (selector, text) => {
	const root = parse_selector(selector)
	expect(root.children.length).toBe(1)
	expect(root.first_child!.type).toBe(ID_SELECTOR)
	expect(root.first_child!.text).toBe(text)
})
