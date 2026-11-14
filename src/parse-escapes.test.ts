import { test, expect, describe } from 'vitest'
import { unescape_css } from './string-utils'
import { parse } from './parse'
import { parse_selector } from './parse-selector'
import { ID_SELECTOR, AT_RULE, DIMENSION, IDENTIFIER } from './constants'
import { parse_value } from './parse-value'
import type { Atrule, Dimension } from './node-types'

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

test.each([
	['1\\70x', '1', '\\70x'],
	['-1\\70x', '-1', '\\70x'],
	['.5\\70x', '.5', '\\70x'],
	['1e\\33', '1', 'e\\33'],
	['100px\\9', '100', 'px\\9'],
	['0\\9', '0', '\\9'],
])('escape in dimension unit %s is part of the unit', (css, value, unit) => {
	const children = [...parse_value(css).children] as Dimension[]
	expect(children.length).toBe(1)
	expect(children[0].type).toBe(DIMENSION)
	expect(children[0].value).toBe(Number(value))
	expect(children[0].unit).toBe(unit)
})

test.each(['-\\31 x', '-\\31', '-\\3a b'])('ident %s starting with hyphen and escape', (css) => {
	const children = [...parse_value(css).children]
	expect(children.length).toBe(1)
	expect(children[0].type).toBe(IDENTIFIER)
	expect(children[0].text).toBe(css)
})

test.each(['.-\\31 x', '.-\\31', '#-\\31 x'])('selector %s with hyphen and escape', (selector) => {
	const root = parse_selector(selector)
	expect(root.children.length).toBe(1)
	expect(root.first_child!.text).toBe(selector)
})

describe('unescape_css', () => {
	test('hex escapes', () => {
		expect(unescape_css('\\31 23')).toBe('123')
		expect(unescape_css('\\000041')).toBe('A')
		expect(unescape_css('\\41\nb')).toBe('Ab')
		expect(unescape_css('\\0 \\110000 \\d800')).toBe('\uFFFD\uFFFD\uFFFD')
		expect(unescape_css('\\1F600')).toBe('😀')
	})
	test('character escapes and edge cases', () => {
		expect(unescape_css('plain')).toBe('plain')
		expect(unescape_css('a\\:b\\\\c')).toBe('a:b\\c')
		expect(unescape_css('a\\\nb')).toBe('ab')
		expect(unescape_css('a\\')).toBe('a\uFFFD')
	})
	test('selectors', () => {
		const cls = parse_selector('.md\\:hidden').first_child!
		expect(unescape_css(cls.text)).toBe('.md:hidden')
		const id = parse_selector('#\\31 23').first_child!
		expect(unescape_css(id.text)).toBe('#123')
	})
	test('values', () => {
		const ident = parse_value('\\46oo\\ Bar').first_child!
		expect(unescape_css(ident.text)).toBe('Foo Bar')
		const str = parse_value('"a\\"b"').first_child!
		expect(unescape_css(str.text)).toBe('"a"b"')
	})
	test('atrules', () => {
		const rule = parse('@media (min-width:1px){} @layer a\\.b{}').children[1] as Atrule
		expect(unescape_css(rule.prelude!.text)).toBe('a.b')
		const kf = parse('@keyframes \\66 oo{}').first_child as Atrule
		expect(unescape_css(kf.prelude!.text)).toBe('foo')
	})
})
