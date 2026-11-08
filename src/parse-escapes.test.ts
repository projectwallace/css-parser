import { test, expect } from 'vitest'
import { parse } from './parse'

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
