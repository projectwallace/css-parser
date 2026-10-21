import { describe, test, expect } from 'vitest'
import { parse } from './parse'
import { walk } from './walk'
import { parse_selector_list } from './parse-selector'
import {
	is_atrule,
	is_function,
	is_identifier,
	is_parenthesis,
	is_url,
	type AnyNode,
	type Atrule,
} from './node-types'

// Generic-mode children are plain value nodes, wider than the (deep-mode) union the AtrulePrelude type lists
const kids = (node: object | null | undefined) => (node as { children?: AnyNode[] })?.children ?? []

const generic = (css: string) => parse(css, { parse_atrule_preludes: 'generic' })

describe('parse_atrule_preludes: "generic"', () => {
	test('produces flat, at-rule agnostic nodes', () => {
		const ast = generic('@media screen and (min-width: 768px), print {}')
		const prelude = (ast.first_child as Atrule).prelude!
		expect(prelude.type_name).toBe('AtrulePrelude')
		expect(kids(prelude).map((c) => [c.type_name, c.text])).toEqual([
			['Identifier', 'screen'],
			['Identifier', 'and'],
			['Parentheses', '(min-width: 768px)'],
			['Operator', ','],
			['Identifier', 'print'],
		])
	})

	test('falls back to Raw for an empty-token prelude', () => {
		expect((generic('@foo ; ').first_child as Atrule).prelude).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// What analysis looks like on top of the generic nodes. Everything below is
// what a consumer like css-analyzer or a stylelint rule would write: a walk(),
// a check on `at_rule.name`, and a look at the prelude's children or text.
// ---------------------------------------------------------------------------

const at_rules = (css: string, name: string) => {
	const found: Atrule[] = []
	walk(generic(css), (node) => {
		if (is_atrule(node) && node.name.toLowerCase() === name) found.push(node)
	})
	return found
}

/** Every layer name: `@layer a, b.c;`, `@layer d {}`, `@layer {}` ('') and `@import url() layer(e)` / `layer` ('') */
function collect_layer_names(css: string): string[] {
	const names: string[] = []
	walk(generic(css), (node) => {
		if (!is_atrule(node)) return
		const name = node.name.toLowerCase()
		const prelude = node.prelude

		if (name === 'layer') {
			if (prelude) {
				// A dotted name is Identifier "." Identifier, so use the text rather than the children
				for (const part of prelude.text.split(',')) names.push(part.trim())
			} else {
				names.push('')
			}
		} else if (name === 'import' && prelude) {
			for (const child of kids(prelude)) {
				if (is_identifier(child) && child.text.toLowerCase() === 'layer') names.push('')
				if (is_function(child) && child.name.toLowerCase() === 'layer')
					names.push(child.text.slice(child.name.length + 1, -1).trim())
			}
		}
	})
	return names
}

/**
 * Feature names in any condition prelude: @media, @container, @import's media list, @custom-media.
 * `(min-width: 1px)` → min-width, `(hover)` → hover, `(400px <= width <= 800px)` → width
 */
function collect_feature_names(css: string): string[] {
	const names: string[] = []
	for (const name of ['media', 'container', 'import', 'custom-media']) {
		for (const at_rule of at_rules(css, name)) {
			if (!at_rule.prelude) continue
			walk(at_rule.prelude as AnyNode, (node) => {
				if (!is_parenthesis(node)) return
				const inner = kids(node)
				// A grouping paren like `(not (hover))` or `((a) or (b))` has no features of its own
				if (inner.some((k) => is_parenthesis(k) || is_function(k))) return
				if (inner[1]?.text === ':') names.push(inner[0].text)
				else for (const k of inner) if (is_identifier(k)) names.push(k.text)
			})
		}
	}
	return names
}

describe('analysis on generic nodes', () => {
	test('collect all layer names, from @layer and @import', () => {
		const css = `
			@import url("a.css") layer(framework.base);
			@import "b.css" layer;
			@import "c.css" layer( spaced ) supports(display: grid) screen;
			@layer reset, base.normal , ui;
			@layer components { @layer nested {} }
			@layer {}
		`
		expect(collect_layer_names(css)).toEqual([
			'framework.base',
			'',
			'spaced',
			'reset',
			'base.normal',
			'ui',
			'components',
			'nested',
			'',
		])
	})

	test('collect media/container feature names', () => {
		const css = `
			@media screen and (min-width: 768px) and (hover), print and (400px <= width <= 800px) {}
			@media not ((orientation: portrait) or (hover: none)) {}
			@container card (inline-size > 30em) and style(--theme: dark) {}
			@import "x.css" (prefers-color-scheme: dark);
			@custom-media --narrow (max-width: 30em);
		`
		expect(collect_feature_names(css)).toEqual([
			'min-width',
			'hover',
			'width',
			'orientation',
			'hover',
			'inline-size',
			'prefers-color-scheme',
			'max-width',
		])
	})

	test('collect @container names', () => {
		const names = at_rules(
			'@container sidebar (min-width: 10px) {} @container (width > 1px) {}',
			'container',
		)
			.map((r) => r.prelude!.first_child!)
			.filter((c) => c.type_name === 'Identifier' && !/^(and|or|not)$/i.test(c.text))
			.map((c) => c.text)
		expect(names).toEqual(['sidebar'])
	})

	test('collect @supports property usage and selector() tests', () => {
		const props: string[] = []
		const selectors: string[] = []
		for (const rule of at_rules(
			'@supports (display: grid) and (not (gap: 1px)) and selector(a > b) {}',
			'supports',
		)) {
			walk(rule.prelude as AnyNode, (node) => {
				if (
					node.type_name === 'Parentheses' &&
					node.first_child?.type_name === 'Identifier' &&
					node.first_child.next_sibling?.text === ':'
				)
					props.push(node.first_child.text)
				if (node.type_name === 'Function' && node.name === 'selector')
					selectors.push(node.text.slice('selector('.length, -1))
			})
		}
		expect(props).toEqual(['display', 'gap'])
		expect(selectors).toEqual(['a > b'])
	})

	test('collect @import urls and import conditions', () => {
		const urls: string[] = []
		for (const rule of at_rules(
			'@import url(a.css); @import "b.css" layer(x); @import url("c.css") screen;',
			'import',
		)) {
			const first = kids(rule.prelude)[0]
			// url("x") keeps its quotes in .value (unquoted url(x) does not), so strip them
			urls.push((is_url(first) ? String(first.value) : first.text).replace(/^(["'])(.*)\1$/, '$2'))
		}
		expect(urls).toEqual(['a.css', 'b.css', 'c.css'])
	})

	test('collect names defined by @keyframes, @property, @custom-media, @font-palette-values', () => {
		const defined = (css: string, name: string) =>
			at_rules(css, name).map((r) => r.prelude!.first_child!.text)
		const css =
			'@keyframes spin {} @-webkit-keyframes spin {} @property --x {} @custom-media --small (max-width: 1px);'
		expect(defined(css, 'keyframes')).toEqual(['spin'])
		expect(defined(css, '-webkit-keyframes')).toEqual(['spin'])
		expect(defined(css, 'property')).toEqual(['--x'])
		expect(defined(css, 'custom-media')).toEqual(['--small'])
	})

	test('@scope: parse selectors on demand instead of eagerly', () => {
		const [rule] = at_rules('@scope (.card > .body) to (.nested, .other) {}', 'scope')
		const lists = kids(rule.prelude)
			.filter((c) => is_parenthesis(c))
			.map((p) => parse_selector_list(p.text.slice(1, -1)).text)
		expect(lists).toEqual(['.card > .body', '.nested, .other'])
	})
})
