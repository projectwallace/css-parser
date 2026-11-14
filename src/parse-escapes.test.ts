import { test, expect } from 'vitest'
import { parse } from './parse'
import { parse_selector } from './parse-selector'
import { ID_SELECTOR, AT_RULE, DIMENSION, IDENTIFIER } from './constants'
import { parse_value } from './parse-value'
import type { Atrule, Declaration, Dimension, Rule } from './node-types'
import { css_unescape, str_equals } from './string-helpers'

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

test.each([
	['\\31 23', '123'],
	['\\:', ':'],
	['a\\:b', 'a:b'],
	['\\6d edia', 'media'],
	['\\00006dedia', 'media'],
	['\\6D edia', 'media'],
	['\\1F600 x', '😀x'],
	['\\0', '�'],
	['\\D800 ', '�'],
	['\\110000 ', '�'],
	['a\\\nb', 'a\\\nb'],
	['a\\', 'a\\'],
	['plain', 'plain'],
])('css_unescape(%j) is %j', (input, expected) => {
	expect(css_unescape(input)).toBe(expected)
})

test('str_equals decodes escapes', () => {
	expect(str_equals('media', '\\6d edia')).toBe(true)
	expect(str_equals('media', '\\4d edia')).toBe(true)
	expect(str_equals('media', 'm\\65 dia')).toBe(true)
	expect(str_equals('media', '\\6d edia2')).toBe(false)
	expect(str_equals('media', '\\6d ed')).toBe(false)
	expect(str_equals('a-b', 'a\\-b')).toBe(true)
	expect(str_equals('media', 'screen')).toBe(false)
})

test.each([
	['@\\6d edia (min-width:1px){}', 'MediaQuery'],
	['@\\6c ayer a,b;', 'Layer'],
	['@\\73 upports (display:grid){}', 'SupportsQuery'],
	['@\\63 ontainer (min-width:1px){}', 'ContainerQuery'],
	['@\\6b eyframes a{}', 'Identifier'],
	['@\\73 cope (.a) to (.b){}', 'PreludeSelectorList'],
	['@\\69 mport "a";', 'Url'],
	['@-webkit-\\6b eyframes a{}', 'Identifier'],
])('escaped at-rule name in %s dispatches to the right prelude parser', (css, type_name) => {
	const atrule = parse(css).first_child as Atrule
	expect(atrule.prelude?.first_child?.type_name ?? atrule.prelude?.type_name).toBe(type_name)
})

test('escaped at-rule name keeps declarations in the block', () => {
	const atrule = parse('@\\66 ont-face{color:red}').first_child as Atrule
	expect(atrule.block?.first_child?.type_name).toBe('Declaration')
})

test.each([
	[':\\6e ot(.a)', 'SelectorList'],
	[':\\69 s(.a)', 'SelectorList'],
	[':\\68 as(> a)', 'SelectorList'],
	[':\\6e th-child(2n+1)', 'Nth'],
	[':\\6c ang(en)', 'Lang'],
])('escaped pseudo-class name in %s is parsed like the plain name', (selector, type_name) => {
	const pseudo = parse_selector(selector).first_child!
	expect(pseudo.first_child!.type_name).toBe(type_name)
})

test('escaped function names in values', () => {
	expect(parse_value('\\75 rl(a.png)').first_child!.type_name).toBe('Url')
	expect(parse_value('\\76 ar(--a)').first_child!.first_child!.type_name).toBe('Identifier')
})

test('escaped !important is flagged', () => {
	const rule = parse('a{color:red !\\69 mportant}').first_child as Rule
	const decl = rule.block!.first_child as Declaration
	expect(decl.is_important).toBe(true)
})
