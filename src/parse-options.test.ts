import { describe, it, expect } from 'vitest'
import { parse } from './parse'
import { SELECTOR_LIST, STYLE_RULE, DECLARATION, VALUE, AT_RULE, RAW } from './arena'
import { PlainCSSNode } from './css-node'
import type { RuleNode, AtruleNode, DeclarationNode } from './node-types'

describe('Parser Options', () => {
	const css = 'body { color: red; }'

	describe('Default behavior (all parsing enabled)', () => {
		it('should parse values and selectors by default', () => {
			const root = parse(css)
			const rule = root.first_child

			// Check selector is parsed with detailed structure
			// All selectors wrapped in NODE_SELECTOR_LIST
			const selector = rule?.first_child
			expect(selector).not.toBeNull()
			expect(selector?.type).toBe(SELECTOR_LIST)

			// Check value is parsed with detailed structure
			const block = selector?.next_sibling
			const declaration = block?.first_child
			expect(declaration).not.toBeNull()
			expect(declaration?.type).toBe(DECLARATION)
			expect(declaration?.has_children).toBe(true)
			expect(declaration?.first_child?.type).toBe(VALUE)
		})

		it('should parse values and selectors with explicit options', () => {
			const root = parse(css, { parse_values: true, parse_selectors: true })
			const rule = root.first_child

			// Check selector is parsed
			// Simple selector (just "body") returns NODE_SELECTOR_LIST directly
			const selector = rule?.first_child
			expect(selector?.type).toBe(SELECTOR_LIST)

			// Check value is parsed
			const block = selector?.next_sibling
			const declaration = block?.first_child
			expect(declaration?.has_children).toBe(true)
			expect(declaration?.first_child?.type).toBe(VALUE)
		})
	})

	describe('parse_values disabled', () => {
		it('should not parse value details when parse_values is false', () => {
			const root = parse(css, { parse_values: false })
			const rule = root.first_child

			// Selector should still be parsed
			// Simple selector (just "body") returns NODE_SELECTOR_LIST directly
			const selector = rule?.first_child
			expect(selector).not.toBeNull()
			expect(selector?.type).toBe(SELECTOR_LIST)

			// Declaration should exist but have no value children
			const block = selector?.next_sibling
			const declaration = block?.first_child as DeclarationNode | null | undefined
			expect(declaration).not.toBeNull()
			expect(declaration?.type).toBe(DECLARATION)
			expect(declaration?.property).toBe('color')
			expect((declaration?.value as PlainCSSNode)?.text).toBe('red') // Raw value text still available
			expect(declaration?.has_children).toBe(true) // RAW value node exists
			expect(declaration?.first_child?.type).toBe(RAW)
			expect(declaration?.first_child?.text).toBe('red')
			expect(declaration?.children).toHaveLength(1)
		})

		it('should handle complex values without parsing', () => {
			const root = parse('div { margin: 10px 20px; }', { parse_values: false })
			const rule = root.first_child
			const selector = rule?.first_child
			const block = selector?.next_sibling
			const declaration = block?.first_child as DeclarationNode | null | undefined

			expect(declaration?.property).toBe('margin')
			expect((declaration?.value as PlainCSSNode)?.text).toBe('10px 20px')
			expect(declaration?.has_children).toBe(true)
		})

		it('should handle function values without parsing', () => {
			const root = parse('div { color: rgb(255, 0, 0); }', { parse_values: false })
			const rule = root.first_child
			const selector = rule?.first_child
			const block = selector?.next_sibling
			const declaration = block?.first_child as DeclarationNode | null | undefined

			expect(declaration?.property).toBe('color')
			expect((declaration?.value as PlainCSSNode)?.text).toBe('rgb(255, 0, 0)')
			expect(declaration?.has_children).toBe(true)
		})
	})

	describe('parseSelectors disabled', () => {
		it('should not parse selector details when parseSelectors is false', () => {
			const root = parse(css, { parse_selectors: false })
			const rule = root.first_child

			// Selector should exist but be simple (just RAW, no detailed structure)
			const selector = rule?.first_child
			expect(selector).not.toBeNull()
			expect(selector?.type).toBe(RAW)
			expect(selector?.text).toBe('body')
			expect(selector?.has_children).toBe(false) // No detailed selector nodes

			// Values should still be parsed
			const block = selector?.next_sibling
			const declaration = block?.first_child
			expect(declaration?.has_children).toBe(true)
			expect(declaration?.first_child?.type).toBe(VALUE)
		})

		it('RAW node is attached as first child of STYLE_RULE', () => {
			const root = parse(css, { parse_selectors: false })
			const rule = root.first_child
			expect(rule?.type).toBe(STYLE_RULE)
			const raw = rule?.first_child
			expect(raw?.type).toBe(RAW)
			expect(raw?.text).toBe('body')
		})

		it('rule.prelude returns the RAW node', () => {
			const root = parse(css, { parse_selectors: false })
			const rule = root.first_child as RuleNode | null
			const prelude = rule?.prelude
			expect(prelude).not.toBeNull()
			expect(prelude?.type).toBe(RAW)
			expect(prelude?.text).toBe('body')
		})

		it('should handle complex selectors without parsing', () => {
			const root = parse('div.container#app { color: red; }', { parse_selectors: false })
			const rule = root.first_child
			const selector = rule?.first_child

			expect(selector?.type).toBe(RAW)
			expect(selector?.text).toBe('div.container#app')
			expect(selector?.has_children).toBe(false)
		})

		it('should handle selector lists without parsing', () => {
			const root = parse('div, p, span { color: red; }', { parse_selectors: false })
			const rule = root.first_child
			const selector = rule?.first_child

			expect(selector?.type).toBe(RAW)
			expect(selector?.text).toBe('div, p, span')
			expect(selector?.has_children).toBe(false)
		})
	})

	describe('Both parse_values and parseSelectors disabled', () => {
		it('should not parse details for values or selectors', () => {
			const root = parse(css, { parse_values: false, parse_selectors: false })
			const rule = root.first_child

			// Selector should be simple
			const selector = rule?.first_child
			expect(selector?.type).toBe(RAW)
			expect(selector?.text).toBe('body')
			expect(selector?.has_children).toBe(false)

			// Declaration should have a RAW value child
			const block = selector?.next_sibling
			const declaration = block?.first_child as DeclarationNode | null | undefined
			expect(declaration?.type).toBe(DECLARATION)
			expect(declaration?.property).toBe('color')
			expect((declaration?.value as PlainCSSNode)?.text).toBe('red')
			expect(declaration?.has_children).toBe(true)
		})

		it('should handle complex CSS without detailed parsing', () => {
			const css = `
				div.container > p:hover {
					margin: 10px 20px;
					color: rgb(255, 0, 0);
				}
			`
			const root = parse(css, { parse_values: false, parse_selectors: false })
			const rule = root.first_child

			const selector = rule?.first_child
			expect(selector?.type).toBe(RAW)
			expect(selector?.has_children).toBe(false)

			const block = selector?.next_sibling
			const decl1 = block?.first_child as DeclarationNode | null | undefined
			expect(decl1?.property).toBe('margin')
			expect((decl1?.value as PlainCSSNode)?.text).toBe('10px 20px')
			expect(decl1?.has_children).toBe(true)

			const decl2 = decl1?.next_sibling as DeclarationNode | null | undefined
			expect(decl2?.property).toBe('color')
			expect((decl2?.value as PlainCSSNode)?.text).toBe('rgb(255, 0, 0)')
			expect(decl2?.has_children).toBe(true)
		})
	})

	describe('Performance optimization use cases', () => {
		it('should skip value parsing for fast property name extraction', () => {
			const css = `
				div {
					color: red;
					background: url(image.png) no-repeat center;
					margin: 10px 20px 30px 40px;
				}
			`
			const root = parse(css, { parse_values: false })
			const rule = root.first_child
			const selector = rule?.first_child

			// Can quickly iterate through declarations without parsing complex values
			const block = selector?.next_sibling
			let decl = block?.first_child as DeclarationNode | null | undefined
			const properties: string[] = []
			while (decl) {
				if (decl.property) {
					properties.push(decl.property)
				}
				decl = decl.next_sibling as DeclarationNode | null | undefined
			}

			expect(properties).toEqual(['color', 'background', 'margin'])
		})

		it('should skip selector parsing for fast rule counting', () => {
			const css = `
				div.complex > p:nth-child(2n+1)::before { color: red; }
				.another-complex[data-attr~="value"] { margin: 0; }
				#very-specific-id:not(.excluded) { padding: 10px; }
			`
			const root = parse(css, { parse_selectors: false })

			// Can quickly count rules without parsing complex selectors
			let count = 0
			let node = root.first_child
			while (node) {
				count++
				node = node.next_sibling
			}

			expect(count).toBe(3)
		})
	})

	describe('Options validation', () => {
		it('should accept empty options object', () => {
			const root = parse(css, {})
			const rule = root.first_child
			const selector = rule?.first_child
			const block = selector?.next_sibling
			const declaration = block?.first_child

			// Should use defaults (both enabled)
			expect(selector?.type).toBe(SELECTOR_LIST)
			expect(declaration?.has_children).toBe(true)
		})

		it('should accept partial options', () => {
			const root = parse(css, { parse_values: false })
			const rule = root.first_child
			const selector = rule?.first_child
			const block = selector?.next_sibling
			const declaration = block?.first_child

			// Selector should still be parsed (default true)
			expect(selector?.type).toBe(SELECTOR_LIST)
			// Values should not be parsed as VALUE nodes (explicitly false), but RAW child exists
			expect(declaration?.has_children).toBe(true)
		})
	})

	describe('parse_atrule_preludes disabled', () => {
		it('should return a RAW prelude node when parse_atrule_preludes is false', () => {
			const root = parse('@media screen { }', { parse_atrule_preludes: false })
			const atrule = root.first_child! as AtruleNode
			expect(atrule.type).toBe(AT_RULE)
			const prelude = atrule.prelude
			expect(prelude).not.toBeNull()
			expect(prelude?.type).toBe(RAW)
			expect(prelude?.text).toBe('screen')
			expect(prelude?.has_children).toBe(false)
		})

		it('should return RAW for various at-rule types', () => {
			const cases: Array<[string, string]> = [
				['@keyframes slidein { }', 'slidein'],
				['@layer base, components;', 'base, components'],
				['@supports (display: flex) { }', '(display: flex)'],
			]
			for (let [css, expectedText] of cases) {
				const root = parse(css, { parse_atrule_preludes: false })
				const atrule = root.first_child! as AtruleNode
				expect(atrule.prelude?.type).toBe(RAW)
				expect(atrule.prelude?.text).toBe(expectedText)
			}
		})

		it('should return null prelude for at-rules without a prelude', () => {
			const root = parse('@font-face { }', { parse_atrule_preludes: false })
			const atrule = root.first_child! as AtruleNode
			expect(atrule.prelude).toBeNull()
		})
	})

	describe('on_comment callback', () => {
		it('should call on_comment for each comment in the CSS', () => {
			const comments: Array<{
				start: number
				end: number
				length: number
				line: number
				column: number
			}> = []
			const css = '/* first */ body { /* second */ color: red; /* third */ }'

			parse(css, {
				on_comment: (info) => {
					comments.push(info)
				},
			})

			expect(comments).toHaveLength(3)
			expect(comments[0].start).toBe(0)
			expect(comments[0].length).toBe(11)
			expect(comments[0].line).toBe(1)
			expect(comments[0].column).toBe(1)
		})

		it('should provide correct start, end, and length for comments', () => {
			const comments: Array<{ start: number; end: number; length: number }> = []
			const css = '/* comment */ body { color: red; }'

			parse(css, {
				on_comment: (info) => {
					comments.push(info)
				},
			})

			expect(comments).toHaveLength(1)
			expect(comments[0].start).toBe(0)
			expect(comments[0].end).toBe(13)
			expect(comments[0].length).toBe(13)
		})

		it('should provide correct line and column for multiline comments', () => {
			const comments: Array<{ start: number; end: number; line: number; column: number }> = []
			const css = `body {
	/* comment on line 2 */
	color: red;
}`

			parse(css, {
				on_comment: (info) => {
					comments.push(info)
				},
			})

			expect(comments).toHaveLength(1)
			expect(comments[0].line).toBe(2)
			expect(comments[0].column).toBe(2)
		})

		it('should not call on_comment when no comments present', () => {
			let called = false
			const css = 'body { color: red; }'

			parse(css, {
				on_comment: () => {
					called = true
				},
			})

			expect(called).toBe(false)
		})

		it('should allow extracting comment text using start and end', () => {
			const css = '/* first comment */ body { /* second comment */ color: red; }'
			const commentTexts: string[] = []

			parse(css, {
				on_comment: (info) => {
					commentTexts.push(css.substring(info.start, info.end))
				},
			})

			expect(commentTexts).toEqual(['/* first comment */', '/* second comment */'])
		})

		it('should work with other parsing options', () => {
			const comments: Array<{ start: number; length: number }> = []
			const css = '/* test */ body { color: red; }'

			const root = parse(css, {
				parse_values: false,
				on_comment: (info) => {
					comments.push(info)
				},
			})

			expect(comments).toHaveLength(1)
			expect(comments[0].start).toBe(0)
			expect(comments[0].length).toBe(10)

			// Ensure other options still work
			const rule = root.first_child
			const selector = rule?.first_child
			const block = selector?.next_sibling
			const declaration = block?.first_child
			expect(declaration?.has_children).toBe(true) // RAW value node present even with parse_values: false
		})
	})
})
