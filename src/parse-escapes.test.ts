import { test, expect } from 'vitest'
import { parse } from './parse'
import { parse_selector } from './parse-selector'
import { ID_SELECTOR, AT_RULE } from './constants'
import { parse_value } from './parse-value'
import type { Atrule } from './node-types'

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

test.each([
	['@\\6dedia screen{}', '@\\6dedia'],
	['@m\\:x a{}', '@m\\:x'],
])('escape in at-rule name %s is part of the name', (css, name) => {
	const atrule = parse(css).first_child as Atrule
	expect(atrule.type).toBe(AT_RULE)
	expect(atrule.name).toBe(name.slice(1))
	expect(atrule.prelude?.text).toBe(css.includes('screen') ? 'screen' : 'a')
})

test('escape-like hack after a number stays a separate node', () => {
	// Legacy hacks like `0\9` and `100px\9` must not become escaped units
	const value = parse_value('100px\\9')
	expect([...value.children].map((c) => c.type_name)).toEqual(['Dimension', 'Identifier'])
})
