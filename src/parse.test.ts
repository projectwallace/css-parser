import { describe, test, expect } from 'vitest'
import { parse } from './parse'
import {
	STYLESHEET,
	STYLE_RULE,
	AT_RULE,
	DECLARATION,
	BLOCK,
	SELECTOR_LIST,
	SELECTOR,
	PSEUDO_CLASS_SELECTOR,
	TYPE_SELECTOR,
	ATTRIBUTE_SELECTOR,
	NESTING_SELECTOR,
	URL,
} from './constants'
import { ATTR_OPERATOR_PIPE_EQUAL } from './arena'

describe('Core Nodes', () => {
	describe('Locations', () => {
		describe('STYLESHEET', () => {
			test('offset and length for empty stylesheet', () => {
				const ast = parse('')
				expect(ast.start).toBe(0)
				expect(ast.length).toBe(0)
				expect(ast.end).toBe(0)
			})

			test('offset and length for stylesheet with rules', () => {
				const css = 'body { color: red; }'
				const ast = parse(css)
				expect(ast.start).toBe(0)
				expect(ast.length).toBe(css.length)
				expect(ast.end).toBe(css.length)
			})

			test('line and column for stylesheet', () => {
				const ast = parse('body { color: red; }')
				expect(ast.line).toBe(1)
				expect(ast.column).toBe(1)
			})
		})

		describe('STYLE_RULE', () => {
			test('offset and length for simple rule', () => {
				const source = 'body { color: red; }'
				const ast = parse(source)
				const rule = ast.first_child!
				expect(rule.start).toBe(0)
				expect(rule.length).toBe(source.length)
				expect(rule.end).toBe(source.length)
			})

			test('offset and length for multiple rules', () => {
				const css = 'body { } div { }'
				const ast = parse(css)
				const [rule1, rule2] = ast.children
				expect(rule1.start).toBe(0)
				expect(rule1.length).toBe(8) // 'body { }'
				expect(rule1.end).toBe(8)

				expect(rule2.start).toBe(9)
				expect(rule2.length).toBe(7) // 'div { }'
				expect(rule2.end).toBe(16)
			})

			test('line and column for rules on single line', () => {
				const css = 'body { color: red; }'
				const ast = parse(css)
				const rule = ast.first_child!
				expect(rule.line).toBe(1)
				expect(rule.column).toBe(1)
			})

			test('line and column for rules on multiple lines', () => {
				const css = 'body { color: red; }\ndiv { margin: 0; }'
				const ast = parse(css)
				const [rule1, rule2] = ast.children
				expect(rule1.line).toBe(1)
				expect(rule1.column).toBe(1)
				expect(rule2.line).toBe(2)
				expect(rule2.column).toBe(1)
			})

			test('column for multiple rules on same line', () => {
				const css = 'a { color: red; } b { color: blue; }'
				const ast = parse(css)
				const [rule1, rule2] = ast.children
				expect(rule1.line).toBe(1)
				expect(rule1.column).toBe(1)
				expect(rule2.line).toBe(1)
				expect(rule2.column).toBe(19)
			})

			test('column with leading whitespace', () => {
				const css = '    body { color: red; }'
				const ast = parse(css)
				const rule = ast.first_child!
				expect(rule.line).toBe(1)
				expect(rule.column).toBe(5)
			})

			test('column for nested rule in at-rule', () => {
				const css = '@media screen { body { color: blue; } }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const block = atRule.block!
				const nestedRule = block.first_child!
				expect(nestedRule.line).toBe(1)
				expect(nestedRule.column).toBe(17)
			})
		})

		describe('AT_RULE', () => {
			test('offset and length for @import', () => {
				const source = '@import url("style.css");'
				const ast = parse(source, { parse_atrule_preludes: false })
				const atRule = ast.first_child!
				expect(atRule.start).toBe(0)
				expect(atRule.length).toBe(25)
				expect(atRule.end).toBe(25)
			})

			test('offset and length for @media', () => {
				const source = '@media (min-width: 768px) { body { color: red; } }'
				const ast = parse(source, { parse_atrule_preludes: false })
				const media = ast.first_child!
				expect(media.start).toBe(0)
				expect(media.length).toBe(50)
				expect(media.end).toBe(50)
			})

			test('line and column for at-rule', () => {
				const css = '@media screen { body { color: blue; } }'
				const ast = parse(css)
				const atRule = ast.first_child!
				expect(atRule.line).toBe(1)
				expect(atRule.column).toBe(1)
			})

			test('line for at-rule after rule', () => {
				const css = 'body { color: red; }\n\n@media screen { }'
				const ast = parse(css)
				const [_rule1, atRule] = ast.children
				expect(atRule.line).toBe(3)
			})
		})

		describe('DECLARATION', () => {
			test('offset and length for simple declaration', () => {
				const css = 'body { color: red; }'
				const ast = parse(css)
				const rule = ast.first_child!
				const block = rule.block!
				const decl = block.first_child!
				expect(decl.start).toBeGreaterThan(0)
				expect(decl.length).toBeGreaterThan(0)
			})

			test('column for single-line declaration', () => {
				const css = 'body { color: red; }'
				const ast = parse(css)
				const rule = ast.first_child!
				const block = rule.block!
				const decl = block.first_child!
				expect(decl.line).toBe(1)
				expect(decl.column).toBe(8)
			})

			test('column for multi-line declarations', () => {
				const css = `body {
  color: red;
  font-size: 16px;
}`
				const ast = parse(css)
				const rule = ast.first_child!
				const block = rule.block!
				const [decl1, decl2] = block.children
				expect(decl1.line).toBe(2)
				expect(decl1.column).toBe(3)
				expect(decl2.line).toBe(3)
				expect(decl2.column).toBe(3)
			})

			test('offset ordering for multiple declarations', () => {
				const css = 'body { color: red; margin: 0; }'
				const ast = parse(css)
				const rule = ast.first_child!
				const block = rule.block!
				const [decl1, decl2] = block.children
				expect(decl1.start).toBeLessThan(decl2.start)
			})
		})

		describe('BLOCK', () => {
			test('offset and length for block', () => {
				const css = 'body { color: red; }'
				const ast = parse(css)
				const rule = ast.first_child!
				const block = rule.block!
				expect(block.start).toBeGreaterThan(0)
				expect(block.length).toBeGreaterThan(0)
			})
		})

		describe('Column tracking after comments', () => {
			test('column after comment', () => {
				const css = '/* comment */ body { color: red; }'
				const ast = parse(css)
				const rule = ast.first_child!
				expect(rule.line).toBe(1)
				expect(rule.column).toBe(15)
			})
		})
	})

	describe('Types', () => {
		test('STYLESHEET type constant', () => {
			const ast = parse('body { }')
			expect(ast.type).toBe(STYLESHEET)
		})

		test('STYLE_RULE type constant', () => {
			const ast = parse('body { }')
			const rule = ast.first_child!
			expect(rule.type).toBe(STYLE_RULE)
		})

		test('AT_RULE type constant', () => {
			const ast = parse('@media screen { }')
			const atRule = ast.first_child!
			expect(atRule.type).toBe(AT_RULE)
		})

		test('DECLARATION type constant', () => {
			const ast = parse('body { color: red; }')
			const rule = ast.first_child!
			const block = rule.block!
			const decl = block.first_child!
			expect(decl.type).toBe(DECLARATION)
		})

		test('BLOCK type constant', () => {
			const ast = parse('body { color: red; }')
			const rule = ast.first_child!
			const block = rule.block!
			expect(block.type).toBe(BLOCK)
		})
	})

	describe('Type Names', () => {
		test('STYLESHEET type_name', () => {
			const ast = parse('body { }')
			expect(ast.type_name).toBe('StyleSheet')
		})

		test('STYLE_RULE type_name', () => {
			const ast = parse('body { }')
			const rule = ast.first_child!
			expect(rule.type_name).toBe('Rule')
		})

		test('AT_RULE type_name', () => {
			const ast = parse('@media screen { }')
			const atRule = ast.first_child!
			expect(atRule.type_name).toBe('Atrule')
		})

		test('DECLARATION type_name', () => {
			const ast = parse('body { color: red; }')
			const rule = ast.first_child!
			const block = rule.block!
			const decl = block.first_child!
			expect(decl.type_name).toBe('Declaration')
		})

		test('BLOCK type_name', () => {
			const ast = parse('body { color: red; }')
			const rule = ast.first_child!
			const block = rule.block!
			expect(block.type_name).toBe('Block')
		})
	})

	describe('Node Properties', () => {
		describe('STYLESHEET', () => {
			test('empty stylesheet has no children', () => {
				const root = parse('')

				expect(root.type).toBe(STYLESHEET)
				expect(root.has_children).toBe(false)
			})

			test('stylesheet with only whitespace has no children', () => {
				const root = parse('   \n\n   ')

				expect(root.type).toBe(STYLESHEET)
				expect(root.has_children).toBe(false)
			})
		})

		describe('STYLE_RULE', () => {
			describe('Basic structure', () => {
				test('should have selector list as first child', () => {
					const ast = parse('body { color: red; margin: 0; }')
					const rule = ast.first_child!
					expect(rule.type).toBe(STYLE_RULE)
					const firstChild = rule.first_child!
					expect(firstChild.type).toBe(SELECTOR_LIST)
				})

				test('should have block as second child', () => {
					const ast = parse('body { color: red; margin: 0; }')
					const rule = ast.first_child!
					const selectorList = rule.first_child!
					const block = selectorList.next_sibling!
					expect(block).not.toBeNull()
					expect(block.type).toBe(BLOCK)
				})

				test('declarations should be inside the block', () => {
					const ast = parse('body { color: red; margin: 0; }')
					const rule = ast.first_child!
					const selectorList = rule.first_child!
					const block = selectorList.next_sibling!
					const firstDecl = block.first_child!
					expect(firstDecl.type).toBe(DECLARATION)
					const secondDecl = firstDecl.next_sibling!
					expect(secondDecl).not.toBeNull()
					expect(secondDecl.type).toBe(DECLARATION)
					expect(secondDecl.next_sibling).toBeNull()
				})

				test('selector list should be first child, never in middle or end', () => {
					const testCases = [
						'body { color: red; }',
						'div { margin: 0; padding: 10px; }',
						'h1 { color: blue; .nested { margin: 0; } }',
						'p { font-size: 16px; @media print { display: none; } }',
					]

					testCases.forEach((source) => {
						const ast = parse(source)
						const rule = ast.first_child!
						expect(rule.first_child!.type).toBe(SELECTOR_LIST)

						// Walk through all children and verify no other selector lists
						let child = rule.first_child!.next_sibling
						while (child) {
							expect(child.type).not.toBe(SELECTOR_LIST)
							child = child.next_sibling
						}
					})
				})

				test('empty rule should still have selector list and block', () => {
					const ast = parse('body { }')
					const rule = ast.first_child!
					expect(rule.type).toBe(STYLE_RULE)
					expect(rule.first_child!.type).toBe(SELECTOR_LIST)
					const block = rule.first_child!.next_sibling
					expect(block).not.toBeNull()
					expect(block!.is_empty).toBe(true)
				})
			})

			describe('Selector list structure', () => {
				test('selector list children should have next_sibling links', () => {
					const ast = parse('h1, h2, h3 { color: red; }')
					const rule = ast.first_child!
					const selectorList = rule.first_child!
					expect(selectorList.type).toBe(SELECTOR_LIST)

					const children = []
					let child = selectorList.first_child
					while (child) {
						children.push(child)
						child = child.next_sibling
					}

					expect(children.length).toBe(3)

					for (let i = 0; i < children.length - 1; i++) {
						const nextSibling = children[i].next_sibling
						expect(nextSibling).not.toBeNull()
						expect(nextSibling!.start).toBe(children[i + 1].start)
					}

					expect(children[children.length - 1].next_sibling).toBeNull()
				})

				test('complex selectors should maintain component chains', () => {
					const ast = parse('div.class, span#id { margin: 0; }')
					const rule = ast.first_child!
					const selectorList = rule.first_child!
					expect(selectorList.type).toBe(SELECTOR_LIST)

					const selectors = []
					let selector = selectorList.first_child
					while (selector) {
						selectors.push(selector)
						selector = selector.next_sibling
					}

					expect(selectors.length).toBe(2)

					// First selector (div.class) should have 2 components
					const components1 = []
					let comp = selectors[0].first_child
					while (comp) {
						components1.push(comp)
						comp = comp.next_sibling
					}
					expect(components1.length).toBe(2) // div, .class

					// Second selector (span#id) should have 2 components
					const components2 = []
					comp = selectors[1].first_child
					while (comp) {
						components2.push(comp)
						comp = comp.next_sibling
					}
					expect(components2.length).toBe(2) // span, #id
				})

				test('selector list with combinators should chain all components', () => {
					const ast = parse('div > p, span + a { color: blue; }')
					const rule = ast.first_child!
					const selectorList = rule.first_child!

					const selectors = []
					let selector = selectorList.first_child
					while (selector) {
						selectors.push(selector)
						selector = selector.next_sibling
					}

					expect(selectors.length).toBe(2)

					// First selector (div > p) should have 3 components: div, >, p
					const components1 = []
					let comp = selectors[0].first_child
					while (comp) {
						components1.push(comp)
						comp = comp.next_sibling
					}
					expect(components1.length).toBe(3)

					// Second selector (span + a) should have 3 components: span, +, a
					const components2 = []
					comp = selectors[1].first_child
					while (comp) {
						components2.push(comp)
						comp = comp.next_sibling
					}
					expect(components2.length).toBe(3)
				})
			})

			describe('Block children structure', () => {
				test('block children should be linked via next_sibling with declarations only', () => {
					const ast = parse('body { color: red; margin: 0; padding: 10px; }')
					const rule = ast.first_child!
					const selectorList = rule.first_child!
					const block = selectorList.next_sibling!

					const children = []
					let child = block.first_child
					while (child) {
						children.push(child)
						child = child.next_sibling
					}

					expect(children.length).toBe(3)

					for (let i = 0; i < children.length; i++) {
						expect(children[i].type).toBe(DECLARATION)
					}

					for (let i = 0; i < children.length - 1; i++) {
						expect(children[i].next_sibling).not.toBeNull()
						expect(children[i].next_sibling!.start).toBe(children[i + 1].start)
					}

					expect(children[children.length - 1].next_sibling).toBeNull()
				})

				test('block children should be linked via next_sibling with mixed content', () => {
					const ast = parse(`
						.parent {
							color: red;
							.nested { margin: 0; }
							padding: 10px;
							@media print { display: none; }
							font-size: 16px;
						}
					`)
					const rule = ast.first_child!
					const selectorList = rule.first_child!
					const block = selectorList.next_sibling!

					const children = []
					let child = block.first_child
					while (child) {
						children.push(child)
						child = child.next_sibling
					}

					expect(children.length).toBe(5)

					expect(children[0].type).toBe(DECLARATION) // color: red
					expect(children[1].type).toBe(STYLE_RULE) // .nested { margin: 0; }
					expect(children[2].type).toBe(DECLARATION) // padding: 10px
					expect(children[3].type).toBe(AT_RULE) // @media print { display: none; }
					expect(children[4].type).toBe(DECLARATION) // font-size: 16px

					for (let i = 0; i < children.length - 1; i++) {
						const nextSibling = children[i].next_sibling
						expect(nextSibling).not.toBeNull()
						expect(nextSibling!.start).toBe(children[i + 1].start)
					}

					expect(children[children.length - 1].next_sibling).toBeNull()
				})

				test('block with only nested rules should have correct next_sibling chain', () => {
					const ast = parse(`
						.parent {
							.child1 { color: red; }
							.child2 { margin: 0; }
							.child3 { padding: 10px; }
						}
					`)
					const rule = ast.first_child!
					const selectorList = rule.first_child!
					const block = selectorList.next_sibling!

					const children = []
					let child = block.first_child
					while (child) {
						children.push(child)
						child = child.next_sibling
					}

					expect(children.length).toBe(3)

					for (const child of children) {
						expect(child.type).toBe(STYLE_RULE)
					}

					for (let i = 0; i < children.length - 1; i++) {
						expect(children[i].next_sibling).not.toBeNull()
						expect(children[i].next_sibling!.start).toBe(children[i + 1].start)
					}

					expect(children[children.length - 1].next_sibling).toBeNull()
				})

				test('block with only at-rules should have correct next_sibling chain', () => {
					const ast = parse(`
						.parent {
							@media screen { color: blue; }
							@media print { display: none; }
							@supports (display: flex) { display: flex; }
						}
					`)
					const rule = ast.first_child!
					const selectorList = rule.first_child!
					const block = selectorList.next_sibling!

					const children = []
					let child = block.first_child
					while (child) {
						children.push(child)
						child = child.next_sibling
					}

					expect(children.length).toBe(3)

					for (const child of children) {
						expect(child.type).toBe(AT_RULE)
					}

					for (let i = 0; i < children.length - 1; i++) {
						expect(children[i].next_sibling).not.toBeNull()
						expect(children[i].next_sibling!.start).toBe(children[i + 1].start)
					}

					expect(children[children.length - 1].next_sibling).toBeNull()
				})
			})

			describe('Nested rules', () => {
				test('nested style rules should have selector list as first child', () => {
					const ast = parse('div { .nested { color: red; } }')
					const outerRule = ast.first_child!

					expect(outerRule.type).toBe(STYLE_RULE)
					expect(outerRule.first_child!.type).toBe(SELECTOR_LIST)

					const block = outerRule.first_child!.next_sibling!
					const nestedRule = block.first_child!
					expect(nestedRule.type).toBe(STYLE_RULE)
					expect(nestedRule.first_child!.type).toBe(SELECTOR_LIST)

					const nestedBlock = nestedRule.first_child!.next_sibling!
					expect(nestedBlock.first_child!.type).toBe(DECLARATION)
				})

				test('& span should be parsed as ONE selector with 3 components', () => {
					const ast = parse('.parent { & span { color: red; } }')
					const outerRule = ast.first_child!

					const block = outerRule.first_child!.next_sibling!
					const nestedRule = block.first_child!
					expect(nestedRule.type).toBe(STYLE_RULE)

					const selectorList = nestedRule.first_child!
					expect(selectorList.type).toBe(SELECTOR_LIST)

					const selectors = []
					let selector = selectorList.first_child
					while (selector) {
						selectors.push(selector)
						selector = selector.next_sibling
					}

					expect(selectors.length).toBe(1)

					if (selectors.length === 1) {
						const components = []
						let component = selectors[0].first_child
						while (component) {
							components.push(component)
							component = component.next_sibling
						}
						expect(components.length).toBe(3)
					}
				})
			})

			describe('Selector parsing', () => {
				test('should parse simple selector', () => {
					const source = 'body { }'
					const root = parse(source)

					const rule = root.first_child!
					expect(rule.has_children).toBe(true)

					const selector = rule.first_child!
					expect(selector.text).toBe('body')
					expect(selector.line).toBe(1)
					expect(selector.start).toBe(0)
					expect(selector.length).toBe(4)
					expect(selector.end).toBe(4)
				})

				test('should parse complex selector', () => {
					const source = 'div.class > p#id { }'
					const root = parse(source)

					const rule = root.first_child!
					const selectorlist = rule.first_child!

					expect(selectorlist.start).toBe(0)
					expect(selectorlist.length).toBe(16)
					expect(selectorlist.end).toBe(16)
					expect(selectorlist.text).toBe('div.class > p#id')

					const selector = selectorlist.first_child!
					expect(selector.children[0].text).toBe('div')
					expect(selector.children[1].text).toBe('.class')
					expect(selector.children[2].text).toBe('>')
					expect(selector.children[3].text).toBe('p')
					expect(selector.children[4].text).toBe('#id')
				})

				test('should parse pseudo class selector', () => {
					const source = 'p:has(a) {}'
					const root = parse(source)
					const rule = root.first_child!
					const selectorlist = rule.first_child!
					const selector = selectorlist.first_child!

					expect(selector.type).toBe(SELECTOR)
					expect(selector.children[0].type).toBe(TYPE_SELECTOR)
					expect(selector.children[1].type).toBe(PSEUDO_CLASS_SELECTOR)
					expect(selector.children[2]).toBeUndefined()
					const pseudo = selector.children[1]
					expect(pseudo.text).toBe(':has(a)')
					expect(pseudo.children).toHaveLength(1)
				})

				test('attribute selector should have name, value and operator', () => {
					const source = '[root|="test"] {}'
					const root = parse(source)
					const rule = root.first_child!
					const selectorlist = rule.first_child!
					const selector = selectorlist.first_child!
					expect(selector.type).toBe(SELECTOR)
					const s = selector.children[0]
					expect(s.type).toBe(ATTRIBUTE_SELECTOR)
					expect(s.attr_operator).toEqual(ATTR_OPERATOR_PIPE_EQUAL)
					expect(s.name).toBe('root')
					expect(s.value).toBe('"test"')
				})
			})

			describe('Multiple rules', () => {
				test('should parse multiple style rules', () => {
					const root = parse('body { } div { }')

					const [rule1, rule2] = root.children
					expect(rule1.type).toBe(STYLE_RULE)
					expect(rule2.type).toBe(STYLE_RULE)
					expect(rule2.next_sibling).toBe(null)
				})
			})
		})

		describe('AT_RULE', () => {
			describe('Statement at-rules (no block)', () => {
				test('@import', () => {
					const source = '@import url("style.css");'
					const root = parse(source, { parse_atrule_preludes: false })

					const atRule = root.first_child!
					expect(atRule.type).toBe(AT_RULE)
					expect(atRule.name).toBe('import')
					expect(atRule.has_children).toBe(false)
				})

				test('@namespace', () => {
					const source = '@namespace url(http://www.w3.org/1999/xhtml);'
					const root = parse(source)

					const atRule = root.first_child!
					expect(atRule.type).toBe(AT_RULE)
					expect(atRule.name).toBe('namespace')
					expect(atRule.length).toBe(45)
				})
			})

			describe('Case-insensitive at-rule names', () => {
				test('should parse @MEDIA (uppercase)', () => {
					const source = '@MEDIA (min-width: 768px) { body { color: red; } }'
					const root = parse(source, { parse_atrule_preludes: false })

					const media = root.first_child!
					expect(media.type).toBe(AT_RULE)
					expect(media.name).toBe('MEDIA')
					expect(media.has_children).toBe(true)
					const block = media.block!
					const nestedRule = block.first_child!
					expect(nestedRule.type).toBe(STYLE_RULE)
				})

				test('should parse @Font-Face (mixed case)', () => {
					const source = '@Font-Face { font-family: "MyFont"; src: url("font.woff"); }'
					const root = parse(source)

					const fontFace = root.first_child!
					expect(fontFace.type).toBe(AT_RULE)
					expect(fontFace.name).toBe('Font-Face')
					expect(fontFace.length).toBe(60)
					expect(fontFace.has_children).toBe(true)
					const block = fontFace.block!
					const decl = block.first_child!
					expect(decl.type).toBe(DECLARATION)
				})

				test('should parse @SUPPORTS (uppercase)', () => {
					const source = '@SUPPORTS (display: grid) { .grid { display: grid; } }'
					const root = parse(source, { parse_atrule_preludes: false })

					const supports = root.first_child!
					expect(supports.type).toBe(AT_RULE)
					expect(supports.name).toBe('SUPPORTS')
					expect(supports.has_children).toBe(true)
				})
			})

			describe('Block at-rules with nested rules', () => {
				test('@media with nested rule', () => {
					const source = '@media (min-width: 768px) { body { color: red; } }'
					const root = parse(source, { parse_atrule_preludes: false })

					const media = root.first_child!
					expect(media.type).toBe(AT_RULE)
					expect(media.name).toBe('media')
					expect(media.has_children).toBe(true)
					expect(media.length).toBe(50)

					const block = media.block!
					const nestedRule = block.first_child!
					expect(nestedRule.type).toBe(STYLE_RULE)
					expect(nestedRule.length).toBe(20)
				})

				test('@layer with name', () => {
					const source = '@layer utilities { .text-center { text-align: center; } }'
					const root = parse(source)

					const layer = root.first_child!
					expect(layer.type).toBe(AT_RULE)
					expect(layer.name).toBe('layer')
					expect(layer.has_children).toBe(true)
				})

				test('anonymous @layer', () => {
					const source = '@layer { body { margin: 0; } }'
					const root = parse(source)

					const layer = root.first_child!
					expect(layer.type).toBe(AT_RULE)
					expect(layer.name).toBe('layer')
					expect(layer.has_children).toBe(true)
				})

				test('@supports', () => {
					const source = '@supports (display: grid) { .grid { display: grid; } }'
					const root = parse(source)

					const supports = root.first_child!
					expect(supports.type).toBe(AT_RULE)
					expect(supports.name).toBe('supports')
					expect(supports.has_children).toBe(true)
				})

				test('@container', () => {
					const source = '@container (min-width: 400px) { .card { padding: 2rem; } }'
					const root = parse(source)

					const container = root.first_child!
					expect(container.type).toBe(AT_RULE)
					expect(container.name).toBe('container')
					expect(container.has_children).toBe(true)
				})
			})

			describe('Descriptor at-rules (with declarations)', () => {
				test('@font-face', () => {
					const source = '@font-face { font-family: "Open Sans"; src: url(font.woff2); }'
					const root = parse(source)

					const fontFace = root.first_child!
					expect(fontFace.type).toBe(AT_RULE)
					expect(fontFace.name).toBe('font-face')
					expect(fontFace.has_children).toBe(true)

					const block = fontFace.block!
					const [decl1, decl2] = block.children
					expect(decl1.type).toBe(DECLARATION)
					expect(decl2.type).toBe(DECLARATION)
				})

				test('@page', () => {
					const source = '@page { margin: 1in; }'
					const root = parse(source)

					const page = root.first_child!
					expect(page.type).toBe(AT_RULE)
					expect(page.name).toBe('page')

					const block = page.block!
					const decl = block.first_child!
					expect(decl.type).toBe(DECLARATION)
				})

				test('@counter-style', () => {
					const source = '@counter-style thumbs { system: cyclic; symbols: "👍"; }'
					const root = parse(source)

					const counterStyle = root.first_child!
					expect(counterStyle.type).toBe(AT_RULE)
					expect(counterStyle.name).toBe('counter-style')

					const block = counterStyle.block!
					const decl = block.first_child!
					expect(decl.type).toBe(DECLARATION)
				})
			})

			describe('Nested at-rules', () => {
				test('@media inside @supports', () => {
					const source = '@supports (display: grid) { @media (min-width: 768px) { body { color: red; } } }'
					const root = parse(source, { parse_atrule_preludes: false })

					const supports = root.first_child!
					expect(supports.name).toBe('supports')
					expect(supports.length).toBe(80)

					const supports_block = supports.block!
					const media = supports_block.first_child!
					expect(media.type).toBe(AT_RULE)
					expect(media.name).toBe('media')
					expect(media.text).toBe('@media (min-width: 768px) { body { color: red; } }')
					expect(media.length).toBe(50)

					const media_block = media.block!
					const rule = media_block.first_child!
					expect(rule.type).toBe(STYLE_RULE)
					expect(rule.length).toBe(20)
				})
			})

			describe('Multiple at-rules', () => {
				test('multiple at-rules at top level', () => {
					const source = '@import url("a.css"); @layer base { body { margin: 0; } } @media print { body { color: black; } }'
					const root = parse(source)

					const [import1, layer, media] = root.children
					expect(import1.name).toBe('import')
					expect(import1.length).toBe(21)
					expect(layer.name).toBe('layer')
					expect(layer.length).toBe(35)
					expect(media.name).toBe('media')
					expect(media.length).toBe(39)
				})
			})

			describe('Special at-rules', () => {
				test('@charset', () => {
					let source = '@charset "UTF-8"; body { color: red; }'
					let root = parse(source)

					let [charset, _body] = root.children
					expect(charset.type).toBe(AT_RULE)
					expect(charset.name).toBe('charset')
				})

				test('@import with media query', () => {
					let source = '@import url("print.css") print;'
					let root = parse(source)

					let import_rule = root.first_child!
					expect(import_rule.type).toBe(AT_RULE)
					expect(import_rule.name).toBe('import')
				})

				test('@font-face with multiple descriptors', () => {
					let source = `
						@font-face {
							font-family: "Custom";
							src: url("font.woff2") format("woff2"),
							     url("font.woff") format("woff");
							font-weight: 400;
							font-style: normal;
							font-display: swap;
						}
					`
					let root = parse(source)

					let font_face = root.first_child!
					expect(font_face.name).toBe('font-face')
					let block = font_face.block!
					expect(block.children.length).toBeGreaterThan(3)
				})

				test('@counter-style', () => {
					let source = '@counter-style custom { system: cyclic; symbols: "⚫" "⚪"; suffix: " "; }'
					let root = parse(source)

					let counter = root.first_child!
					expect(counter.name).toBe('counter-style')
					let block = counter.block!
					expect(block.children.length).toBeGreaterThan(1)
				})

				test('@property', () => {
					let source = '@property --my-color { syntax: "<color>"; inherits: false; initial-value: #c0ffee; }'
					let root = parse(source)

					let property = root.first_child!
					expect(property.name).toBe('property')
				})
			})

			describe('At-rule preludes', () => {
				test('media query prelude', () => {
					let source = '@media (min-width: 768px) { }'
					let root = parse(source)

					let atrule = root.first_child!
					expect(atrule.type).toBe(AT_RULE)
					expect(atrule.name).toBe('media')
					expect(atrule.prelude).toBe('(min-width: 768px)')
				})

				test('complex media query prelude', () => {
					let source = '@media screen and (min-width: 768px) and (max-width: 1024px) { }'
					let root = parse(source)

					let atrule = root.first_child!
					expect(atrule.name).toBe('media')
					expect(atrule.prelude).toBe('screen and (min-width: 768px) and (max-width: 1024px)')
				})

				test('container query prelude', () => {
					let source = '@container (width >= 200px) { }'
					let root = parse(source)

					let atrule = root.first_child!
					expect(atrule.name).toBe('container')
					expect(atrule.prelude).toBe('(width >= 200px)')
				})

				test('supports query prelude', () => {
					let source = '@supports (display: grid) { }'
					let root = parse(source)

					let atrule = root.first_child!
					expect(atrule.name).toBe('supports')
					expect(atrule.prelude).toBe('(display: grid)')
				})

				test('import prelude', () => {
					let source = '@import url("styles.css");'
					let root = parse(source)

					let atrule = root.first_child!
					expect(atrule.name).toBe('import')
					expect(atrule.prelude).toBe('url("styles.css")')
				})

				test('at-rule without prelude', () => {
					let source = '@font-face { font-family: MyFont; }'
					let root = parse(source)

					let atrule = root.first_child!
					expect(atrule.name).toBe('font-face')
					expect(atrule.prelude).toBe(null)
				})

				test('layer prelude', () => {
					let source = '@layer utilities { }'
					let root = parse(source)

					let atrule = root.first_child!
					expect(atrule.name).toBe('layer')
					expect(atrule.prelude).toBe('utilities')
				})

				test('keyframes prelude', () => {
					let source = '@keyframes slide-in { }'
					let root = parse(source)

					let atrule = root.first_child!
					expect(atrule.name).toBe('keyframes')
					expect(atrule.prelude).toBe('slide-in')
				})

				test('prelude with extra whitespace', () => {
					let source = '@media   (min-width: 768px)   { }'
					let root = parse(source)

					let atrule = root.first_child!
					expect(atrule.name).toBe('media')
					expect(atrule.prelude).toBe('(min-width: 768px)')
				})

				test('charset prelude', () => {
					let source = '@charset "UTF-8";'
					let root = parse(source)

					let atrule = root.first_child!
					expect(atrule.name).toBe('charset')
					expect(atrule.prelude).toBe('"UTF-8"')
				})

				test('namespace prelude', () => {
					let source = '@namespace svg url(http://www.w3.org/2000/svg);'
					let root = parse(source)

					let atrule = root.first_child!
					expect(atrule.name).toBe('namespace')
					expect(atrule.prelude).toBe('svg url(http://www.w3.org/2000/svg)')
				})

				test('value and prelude should be aliases for at-rules', () => {
					let source = '@media (min-width: 768px) { }'
					let root = parse(source)

					let atrule = root.first_child!
					expect(atrule.value).toBe(atrule.prelude)
					expect(atrule.value).toBe('(min-width: 768px)')
				})

				test('at-rule prelude line tracking', () => {
					let source = 'body { color: red; }\n\n@media screen { }'
					let root = parse(source)

					let [_rule1, atRule] = root.children
					expect(atRule.line).toBe(3)

					// Check that prelude nodes inherit the correct line
					let preludeNode = atRule.first_child
					expect(preludeNode).toBeTruthy()
					expect(preludeNode!.line).toBe(3) // Should be line 3, not line 1
				})
			})

			describe('At-rule block children', () => {
				let css = `@layer test { a {} }`
				let sheet = parse(css)
				let atrule = sheet?.first_child
				let rule = atrule?.block?.first_child

				test('atrule should have block', () => {
					expect(sheet.type).toBe(STYLESHEET)
					expect(atrule!.type).toBe(AT_RULE)
					expect(atrule?.block?.type).toBe(BLOCK)
				})

				test('block children should be stylerule', () => {
					expect(atrule!.block).not.toBeNull()
					expect(rule!.type).toBe(STYLE_RULE)
					expect(rule!.text).toBe('a {}')
				})

				test('rule should have selectorlist + block', () => {
					expect(rule!.block).not.toBeNull()
					expect(rule?.has_block).toBeTruthy()
					expect(rule?.has_declarations).toBeFalsy()
					expect(rule?.first_child!.type).toBe(SELECTOR_LIST)
				})

				test('has correct nested selectors', () => {
					let list = rule?.first_child
					expect(list!.type).toBe(SELECTOR_LIST)
					expect(list!.children).toHaveLength(1)
					expect(list?.first_child?.type).toEqual(SELECTOR)
					expect(list?.first_child?.text).toEqual('a')
				})
			})
		})

		describe('DECLARATION', () => {
			describe('Basic declaration properties', () => {
				test('should parse property name', () => {
					const source = 'body { color: red; }'
					const root = parse(source)

					const rule = root.first_child!
					const [_selector, block] = rule.children
					const declaration = block.first_child!

					expect(declaration.name).toBe('color')
				})

				test('simple declaration without !important', () => {
					const source = 'body { color: red; }'
					const root = parse(source)

					const rule = root.first_child!
					const [_selector, block] = rule.children
					const declaration = block.first_child!

					expect(declaration.type).toBe(DECLARATION)
					expect(declaration.is_important).toBe(false)
				})

				test('declaration with !important', () => {
					const source = 'body { color: red !important; }'
					const root = parse(source)

					const rule = root.first_child!
					const [_selector, block] = rule.children
					const declaration = block.first_child!

					expect(declaration.type).toBe(DECLARATION)
					expect(declaration.is_important).toBe(true)
				})

				test('declaration with !ie (historic !important)', () => {
					const source = 'body { color: red !ie; }'
					const root = parse(source)

					const rule = root.first_child!
					const [_selector, block] = rule.children
					const declaration = block.first_child!

					expect(declaration.type).toBe(DECLARATION)
					expect(declaration.is_important).toBe(true)
				})

				test('declaration with ! followed by any identifier', () => {
					const source = 'body { color: red !foo; }'
					const root = parse(source)

					const rule = root.first_child!
					const [_selector, block] = rule.children
					const declaration = block.first_child!

					expect(declaration.type).toBe(DECLARATION)
					expect(declaration.is_important).toBe(true)
				})

				test('declaration without semicolon at end of block', () => {
					const source = 'body { color: red }'
					const root = parse(source)

					const rule = root.first_child!
					const [_selector, block] = rule.children
					const declaration = block.first_child!

					expect(declaration.type).toBe(DECLARATION)
				})

				test('complex declaration value', () => {
					const source = 'body { background: url(image.png) no-repeat center; }'
					const root = parse(source)

					const rule = root.first_child!
					const [_selector, block] = rule.children
					const declaration = block.first_child!

					expect(declaration.type).toBe(DECLARATION)
					expect(declaration.name).toBe('background')
				})
			})

			describe('Multiple declarations', () => {
				test('should parse multiple declarations', () => {
					const source = 'body { color: red; margin: 0; }'
					const root = parse(source)

					const rule = root.first_child!
					const [_selector, block] = rule.children
					const [decl1, decl2] = block.children

					expect(decl1.type).toBe(DECLARATION)
					expect(decl2.type).toBe(DECLARATION)
					expect(decl2.next_sibling).toBe(null)
				})
			})

			describe('Declaration values', () => {
				test('extract simple value', () => {
					let source = 'a { color: blue; }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!

					expect(decl.name).toBe('color')
					expect(decl.value).toBe('blue')
				})

				test('extract value with spaces', () => {
					let source = 'a { padding: 1rem 2rem 3rem 4rem; }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!

					expect(decl.name).toBe('padding')
					expect(decl.value).toBe('1rem 2rem 3rem 4rem')
				})

				test('extract function value', () => {
					let source = 'a { background: linear-gradient(to bottom, red, blue); }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!

					expect(decl.name).toBe('background')
					expect(decl.value).toBe('linear-gradient(to bottom, red, blue)')
				})

				test('extract calc value', () => {
					let source = 'a { width: calc(100% - 2rem); }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!

					expect(decl.name).toBe('width')
					expect(decl.value).toBe('calc(100% - 2rem)')
				})

				test('exclude !important from value', () => {
					let source = 'a { color: blue !important; }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!

					expect(decl.name).toBe('color')
					expect(decl.value).toBe('blue')
					expect(decl.is_important).toBe(true)
				})

				test('value with extra whitespace', () => {
					let source = 'a { color:    blue   ; }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!

					expect(decl.name).toBe('color')
					expect(decl.value).toBe('blue')
				})

				test('CSS custom property value', () => {
					let source = ':root { --brand-color: rgb(0% 10% 50% / 0.5); }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!

					expect(decl.name).toBe('--brand-color')
					expect(decl.value).toBe('rgb(0% 10% 50% / 0.5)')
				})

				test('var() reference value', () => {
					let source = 'a { color: var(--primary-color); }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!

					expect(decl.name).toBe('color')
					expect(decl.value).toBe('var(--primary-color)')
				})

				test('nested function value', () => {
					let source = 'a { transform: translate(calc(50% - 1rem), 0); }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!

					expect(decl.name).toBe('transform')
					expect(decl.value).toBe('translate(calc(50% - 1rem), 0)')
				})

				test('value without semicolon', () => {
					let source = 'a { color: blue }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!

					expect(decl.name).toBe('color')
					expect(decl.value).toBe('blue')
				})

				test('empty value', () => {
					let source = 'a { color: ; }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!

					expect(decl.name).toBe('color')
					expect(decl.value).toBe(null)
				})

				test('URL value', () => {
					let source = 'a { background: url("image.png"); }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!

					expect(decl.name).toBe('background')
					expect(decl.value).toBe('url("image.png")')
				})
			})

			describe('Vendor prefix detection', () => {
				test('-webkit- vendor prefix', () => {
					let source = '.box { -webkit-transform: scale(1); }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!
					expect(decl.name).toBe('-webkit-transform')
					expect(decl.is_vendor_prefixed).toBe(true)
				})

				test('-moz- vendor prefix', () => {
					let source = '.box { -moz-transform: scale(1); }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!
					expect(decl.name).toBe('-moz-transform')
					expect(decl.is_vendor_prefixed).toBe(true)
				})

				test('-ms- vendor prefix', () => {
					let source = '.box { -ms-transform: scale(1); }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!
					expect(decl.name).toBe('-ms-transform')
					expect(decl.is_vendor_prefixed).toBe(true)
				})

				test('-o- vendor prefix', () => {
					let source = '.box { -o-transform: scale(1); }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!
					expect(decl.name).toBe('-o-transform')
					expect(decl.is_vendor_prefixed).toBe(true)
				})

				test('no vendor prefix for standard properties', () => {
					let source = '.box { transform: scale(1); }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!
					expect(decl.name).toBe('transform')
					expect(decl.is_vendor_prefixed).toBe(false)
				})

				test('no vendor prefix for properties with hyphens', () => {
					let source = '.box { background-color: red; }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!
					expect(decl.name).toBe('background-color')
					expect(decl.is_vendor_prefixed).toBe(false)
				})

				test('no vendor prefix for custom properties', () => {
					let source = ':root { --primary-color: blue; }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!
					expect(decl.name).toBe('--primary-color')
					expect(decl.is_vendor_prefixed).toBe(false)
				})

				test('multiple vendor-prefixed properties', () => {
					let source = '.box { -webkit-transform: scale(1); -moz-transform: scale(1); transform: scale(1); }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let [webkit, moz, standard] = block.children

					expect(webkit.name).toBe('-webkit-transform')
					expect(webkit.is_vendor_prefixed).toBe(true)

					expect(moz.name).toBe('-moz-transform')
					expect(moz.is_vendor_prefixed).toBe(true)

					expect(standard.name).toBe('transform')
					expect(standard.is_vendor_prefixed).toBe(false)
				})

				test('complex property names with vendor prefix', () => {
					let source = '.box { -webkit-border-top-left-radius: 5px; }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!
					expect(decl.name).toBe('-webkit-border-top-left-radius')
					expect(decl.is_vendor_prefixed).toBe(true)
				})

				test('no vendor prefix for similar but non-vendor properties', () => {
					let source = '.box { border-radius: 5px; }'
					let root = parse(source)

					let rule = root.first_child!
					let [_selector, block] = rule.children
					let decl = block.first_child!
					expect(decl.name).toBe('border-radius')
					expect(decl.is_vendor_prefixed).toBe(false)
				})

				test('false for nodes without names', () => {
					let source = 'body { }'
					let root = parse(source)

					let rule = root.first_child!
					let selector = rule.first_child!
					expect(selector.is_vendor_prefixed).toBe(false)
				})
			})

			describe('Vendor prefix detection for selectors', () => {
				test('-webkit- vendor prefix in pseudo-class', () => {
					let source = 'input:-webkit-autofill { color: black; }'
					let root = parse(source)

					let rule = root.first_child!
					let selectorList = rule.first_child!
					let selector = selectorList.first_child!
					let typeSelector = selector.first_child!
					let pseudoClass = typeSelector.next_sibling!
					expect(pseudoClass.name).toBe('-webkit-autofill')
					expect(pseudoClass.is_vendor_prefixed).toBe(true)
				})

				test('-moz- vendor prefix in pseudo-class', () => {
					let source = 'button:-moz-focusring { outline: 2px solid blue; }'
					let root = parse(source)

					let rule = root.first_child!
					let selectorList = rule.first_child!
					let selector = selectorList.first_child!
					let typeSelector = selector.first_child!
					let pseudoClass = typeSelector.next_sibling!
					expect(pseudoClass.name).toBe('-moz-focusring')
					expect(pseudoClass.is_vendor_prefixed).toBe(true)
				})

				test('-ms- vendor prefix in pseudo-class', () => {
					let source = 'input:-ms-input-placeholder { color: gray; }'
					let root = parse(source)

					let rule = root.first_child!
					let selectorList = rule.first_child!
					let selector = selectorList.first_child!
					let typeSelector = selector.first_child!
					let pseudoClass = typeSelector.next_sibling!
					expect(pseudoClass.name).toBe('-ms-input-placeholder')
					expect(pseudoClass.is_vendor_prefixed).toBe(true)
				})

				test('-webkit- vendor prefix in pseudo-element', () => {
					let source = 'div::-webkit-scrollbar { width: 10px; }'
					let root = parse(source)

					let rule = root.first_child!
					let selectorList = rule.first_child!
					let selector = selectorList.first_child!
					let typeSelector = selector.first_child!
					let pseudoElement = typeSelector.next_sibling!
					expect(pseudoElement.name).toBe('-webkit-scrollbar')
					expect(pseudoElement.is_vendor_prefixed).toBe(true)
				})

				test('-moz- vendor prefix in pseudo-element', () => {
					let source = 'div::-moz-selection { background: yellow; }'
					let root = parse(source)

					let rule = root.first_child!
					let selectorList = rule.first_child!
					let selector = selectorList.first_child!
					let typeSelector = selector.first_child!
					let pseudoElement = typeSelector.next_sibling!
					expect(pseudoElement.name).toBe('-moz-selection')
					expect(pseudoElement.is_vendor_prefixed).toBe(true)
				})

				test('-webkit- vendor prefix in pseudo-element with multiple parts', () => {
					let source = 'input::-webkit-input-placeholder { color: gray; }'
					let root = parse(source)

					let rule = root.first_child!
					let selectorList = rule.first_child!
					let selector = selectorList.first_child!
					let typeSelector = selector.first_child!
					let pseudoElement = typeSelector.next_sibling!
					expect(pseudoElement.name).toBe('-webkit-input-placeholder')
					expect(pseudoElement.is_vendor_prefixed).toBe(true)
				})

				test('-webkit- vendor prefix in pseudo-class function', () => {
					let source = 'input:-webkit-any(input, button) { margin: 0; }'
					let root = parse(source)

					let rule = root.first_child!
					let selectorList = rule.first_child!
					let selector = selectorList.first_child!
					let typeSelector = selector.first_child!
					let pseudoClass = typeSelector.next_sibling!
					expect(pseudoClass.name).toBe('-webkit-any')
					expect(pseudoClass.is_vendor_prefixed).toBe(true)
				})

				test('no vendor prefix for standard pseudo-classes', () => {
					let source = 'a:hover { color: blue; }'
					let root = parse(source)

					let rule = root.first_child!
					let selectorList = rule.first_child!
					let selector = selectorList.first_child!
					let typeSelector = selector.first_child!
					let pseudoClass = typeSelector.next_sibling!
					expect(pseudoClass.name).toBe('hover')
					expect(pseudoClass.is_vendor_prefixed).toBe(false)
				})

				test('no vendor prefix for standard pseudo-elements', () => {
					let source = 'div::before { content: ""; }'
					let root = parse(source)

					let rule = root.first_child!
					let selectorList = rule.first_child!
					let selector = selectorList.first_child!
					let typeSelector = selector.first_child!
					let pseudoElement = typeSelector.next_sibling!
					expect(pseudoElement.name).toBe('before')
					expect(pseudoElement.is_vendor_prefixed).toBe(false)
				})

				test('multiple vendor-prefixed pseudo-elements', () => {
					let source = 'div::-webkit-scrollbar { } div::-webkit-scrollbar-thumb { } div::after { }'
					let root = parse(source)

					let [rule1, rule2, rule3] = root.children

					let selectorList1 = rule1.first_child!
					let selector1 = selectorList1.first_child!
					let typeSelector1 = selector1.first_child!
					let pseudo1 = typeSelector1.next_sibling!
					expect(pseudo1.name).toBe('-webkit-scrollbar')
					expect(pseudo1.is_vendor_prefixed).toBe(true)

					let selectorList2 = rule2.first_child!
					let selector2 = selectorList2.first_child!
					let typeSelector2 = selector2.first_child!
					let pseudo2 = typeSelector2.next_sibling!
					expect(pseudo2.name).toBe('-webkit-scrollbar-thumb')
					expect(pseudo2.is_vendor_prefixed).toBe(true)

					let selectorList3 = rule3.first_child!
					let selector3 = selectorList3.first_child!
					let typeSelector3 = selector3.first_child!
					let pseudo3 = typeSelector3.next_sibling!
					expect(pseudo3.name).toBe('after')
					expect(pseudo3.is_vendor_prefixed).toBe(false)
				})

				test('vendor prefix in complex selector', () => {
					let source = 'input:-webkit-autofill:focus { color: black; }'
					let root = parse(source)

					let rule = root.first_child!
					let selectorList = rule.first_child!
					let selector = selectorList.first_child!
					let typeSelector = selector.first_child!
					let webkitPseudo = typeSelector.next_sibling!
					expect(webkitPseudo.name).toBe('-webkit-autofill')
					expect(webkitPseudo.is_vendor_prefixed).toBe(true)

					let focusPseudo = webkitPseudo.next_sibling!
					expect(focusPseudo.name).toBe('focus')
					expect(focusPseudo.is_vendor_prefixed).toBe(false)
				})
			})
		})

		describe('BLOCK', () => {
			test('block text excludes braces for empty at-rule block', () => {
				const root = parse('@layer test {}')

				const atRule = root.first_child!

				expect(atRule.has_block).toBe(true)
				expect(atRule.block!.text).toBe('')
				expect(atRule.text).toBe('@layer test {}')
			})

			test('at-rule block with content excludes braces', () => {
				const root = parse('@layer test { .foo { color: red; } }')

				const atRule = root.first_child!

				expect(atRule.has_block).toBe(true)
				expect(atRule.block!.text).toBe(' .foo { color: red; } ')
				expect(atRule.text).toBe('@layer test { .foo { color: red; } }')
			})

			test('empty style rule block has empty text', () => {
				const root = parse('body {}')

				const styleRule = root.first_child!

				expect(styleRule.has_block).toBe(true)
				expect(styleRule.block!.text).toBe('')
				expect(styleRule.text).toBe('body {}')
			})

			test('style rule block with declaration excludes braces', () => {
				const root = parse('body { color: red; }')

				const styleRule = root.first_child!

				expect(styleRule.has_block).toBe(true)
				expect(styleRule.block!.text).toBe(' color: red; ')
				expect(styleRule.text).toBe('body { color: red; }')
			})

			test('nested style rule blocks exclude braces', () => {
				const root = parse('.parent { .child { margin: 0; } }')

				const parent = root.first_child!
				const parentBlock = parent.block!
				const child = parentBlock.first_child!
				const childBlock = child.block!

				expect(parentBlock.text).toBe(' .child { margin: 0; } ')
				expect(childBlock.text).toBe(' margin: 0; ')
			})

			test('at-rule with multiple declarations excludes braces', () => {
				const root = parse('@font-face { font-family: "Test"; src: url(test.woff); }')

				const atRule = root.first_child!

				expect(atRule.block!.text).toBe(' font-family: "Test"; src: url(test.woff); ')
			})

			test('media query with nested rules excludes braces', () => {
				const root = parse('@media screen { body { color: blue; } }')

				const mediaRule = root.first_child!

				expect(mediaRule.block!.text).toBe(' body { color: blue; } ')
			})

			test('block with no whitespace is empty', () => {
				const root = parse('div{}')

				const styleRule = root.first_child!

				expect(styleRule.block!.text).toBe('')
			})

			test('block with only whitespace preserves whitespace', () => {
				const root = parse('div{ \n\t }')

				const styleRule = root.first_child!

				expect(styleRule.block!.text).toBe(' \n\t ')
			})
		})

		describe('CSS Nesting', () => {
			test('nested rule with & selector', () => {
				let source = '.parent { color: red; & .child { color: blue; } }'
				let root = parse(source)

				let parent = root.first_child!
				expect(parent.type).toBe(STYLE_RULE)

				let [_selector, block] = parent.children
				let [decl, nested_rule] = block.children
				expect(decl.type).toBe(DECLARATION)
				expect(decl.name).toBe('color')

				expect(nested_rule.type).toBe(STYLE_RULE)
				let nested_selector = nested_rule.first_child!
				expect(nested_selector.text).toBe('& .child')
			})

			test('nested rule without & selector', () => {
				let source = '.parent { color: red; .child { color: blue; } }'
				let root = parse(source)

				let parent = root.first_child!
				let [_selector, block] = parent.children
				let [_decl, nested_rule] = block.children

				expect(nested_rule.type).toBe(STYLE_RULE)
				let nested_selector = nested_rule.first_child!
				expect(nested_selector.text).toBe('.child')
			})

			test('multiple nested rules', () => {
				let source = '.parent { .child1 { } .child2 { } }'
				let root = parse(source)

				let parent = root.first_child!
				let [_selector, block] = parent.children
				let [nested1, nested2] = block.children

				expect(nested1.type).toBe(STYLE_RULE)
				expect(nested2.type).toBe(STYLE_RULE)
			})

			test('deeply nested rules', () => {
				let source = '.a { .b { .c { color: red; } } }'
				let root = parse(source)

				let a = root.first_child!
				expect(a.length).toBe(32)
				let [_selector_a, block_a] = a.children
				let b = block_a.first_child!
				expect(b.type).toBe(STYLE_RULE)
				expect(b.length).toBe(25)

				let [_selector_b, block_b] = b.children
				let c = block_b.first_child!
				expect(c.type).toBe(STYLE_RULE)
				expect(c.length).toBe(18)

				let [_selector_c, block_c] = c.children
				let decl = block_c.first_child!
				expect(decl.type).toBe(DECLARATION)
				expect(decl.name).toBe('color')
			})

			test('nested @media inside rule', () => {
				let source = '.card { color: red; @media (min-width: 768px) { padding: 2rem; } }'
				let root = parse(source, { parse_atrule_preludes: false })

				let card = root.first_child!
				let [_selector, block] = card.children
				let [decl, media] = block.children

				expect(decl.type).toBe(DECLARATION)
				expect(media.type).toBe(AT_RULE)
				expect(media.name).toBe('media')

				let media_block = media.block!
				let nested_decl = media_block.first_child!
				expect(nested_decl.type).toBe(DECLARATION)
				expect(nested_decl.name).toBe('padding')
			})

			test(':is() pseudo-class', () => {
				let source = ':is(.a, .b) { color: red; }'
				let root = parse(source)

				let rule = root.first_child!
				let selector = rule.first_child!
				expect(selector.text).toBe(':is(.a, .b)')
			})

			test(':where() pseudo-class', () => {
				let source = ':where(h1, h2, h3) { margin: 0; }'
				let root = parse(source)

				let rule = root.first_child!
				let selector = rule.first_child!
				expect(selector.text).toBe(':where(h1, h2, h3)')
			})

			test(':has() pseudo-class', () => {
				let source = 'div:has(> img) { display: flex; }'
				let root = parse(source)

				let rule = root.first_child!
				let selector = rule.first_child!
				expect(selector.text).toBe('div:has(> img)')
			})

			test('complex nesting with mixed declarations and rules', () => {
				let source = `.card {
					color: red;
					.title { font-size: 2rem; }
					padding: 1rem;
					.body { line-height: 1.5; }
				}`
				let root = parse(source)

				let card = root.first_child!
				let [_selector, block] = card.children
				let [decl1, title, decl2, body] = block.children

				expect(decl1.type).toBe(DECLARATION)
				expect(decl1.name).toBe('color')

				expect(title.type).toBe(STYLE_RULE)

				expect(decl2.type).toBe(DECLARATION)
				expect(decl2.name).toBe('padding')

				expect(body.type).toBe(STYLE_RULE)
			})

			describe('Relaxed nesting (CSS Nesting Module Level 1)', () => {
				test('nested rule with leading child combinator', () => {
					let source = '.parent { > a { color: red; } }'
					let root = parse(source)

					let parent = root.first_child!
					expect(parent.type).toBe(STYLE_RULE)

					let [_selector, block] = parent.children
					let nested_rule = block.first_child!
					expect(nested_rule.type).toBe(STYLE_RULE)

					let nested_selector = nested_rule.first_child!
					expect(nested_selector.text).toBe('> a')
					expect(nested_selector.has_children).toBe(true)
				})

				test('nested rule with leading next-sibling combinator', () => {
					let source = '.parent { + span { color: blue; } }'
					let root = parse(source)

					let parent = root.first_child!
					let [_selector, block] = parent.children
					let nested_rule = block.first_child!
					expect(nested_rule.type).toBe(STYLE_RULE)

					let nested_selector = nested_rule.first_child!
					expect(nested_selector.text).toBe('+ span')
					expect(nested_selector.has_children).toBe(true)
				})

				test('nested rule with leading subsequent-sibling combinator', () => {
					let source = '.parent { ~ div { color: green; } }'
					let root = parse(source)

					let parent = root.first_child!
					let [_selector, block] = parent.children
					let nested_rule = block.first_child!
					expect(nested_rule.type).toBe(STYLE_RULE)

					let nested_selector = nested_rule.first_child!
					expect(nested_selector.text).toBe('~ div')
					expect(nested_selector.has_children).toBe(true)
				})

				test('multiple nested rules with different leading combinators', () => {
					let source = '.parent { > a { color: red; } ~ span { color: blue; } + div { color: green; } }'
					let root = parse(source)

					let parent = root.first_child!
					let [_selector, block] = parent.children
					let [rule1, rule2, rule3] = block.children

					expect(rule1.type).toBe(STYLE_RULE)
					expect(rule1.first_child!.text).toBe('> a')
					expect(rule1.first_child!.has_children).toBe(true)

					expect(rule2.type).toBe(STYLE_RULE)
					expect(rule2.first_child!.text).toBe('~ span')
					expect(rule2.first_child!.has_children).toBe(true)

					expect(rule3.type).toBe(STYLE_RULE)
					expect(rule3.first_child!.text).toBe('+ div')
					expect(rule3.first_child!.has_children).toBe(true)
				})

				test('complex selector after leading combinator', () => {
					let source = '.parent { > a.link#nav[href]:hover { color: red; } }'
					let root = parse(source)

					let parent = root.first_child!
					let [_selector, block] = parent.children
					let nested_rule = block.first_child!

					let nested_selector = nested_rule.first_child!
					expect(nested_selector.text).toBe('> a.link#nav[href]:hover')
					expect(nested_selector.has_children).toBe(true)
				})

				test('deeply nested rules with leading combinators', () => {
					let source = '.a { > .b { > .c { color: red; } } }'
					let root = parse(source)

					let a = root.first_child!
					let [_selector_a, block_a] = a.children
					let b = block_a.first_child!
					expect(b.type).toBe(STYLE_RULE)
					expect(b.first_child!.text).toBe('> .b')
					expect(b.first_child!.has_children).toBe(true)

					let [_selector_b, block_b] = b.children
					let c = block_b.first_child!
					expect(c.type).toBe(STYLE_RULE)
					expect(c.first_child!.text).toBe('> .c')
					expect(c.first_child!.has_children).toBe(true)
				})

				test('mixed nested rules with and without leading combinators', () => {
					let source = '.parent { .normal { } > .combinator { } }'
					let root = parse(source)

					let parent = root.first_child!
					let [_selector, block] = parent.children
					let [normal, combinator] = block.children

					expect(normal.type).toBe(STYLE_RULE)
					expect(normal.first_child!.text).toBe('.normal')

					expect(combinator.type).toBe(STYLE_RULE)
					expect(combinator.first_child!.text).toBe('> .combinator')
					expect(combinator.first_child!.has_children).toBe(true)
				})
			})
		})

		describe('@keyframes parsing', () => {
			test('@keyframes with from/to', () => {
				let source = '@keyframes fade { from { opacity: 0; } to { opacity: 1; } }'
				let root = parse(source, { parse_atrule_preludes: false })

				let keyframes = root.first_child!
				expect(keyframes.type).toBe(AT_RULE)
				expect(keyframes.name).toBe('keyframes')

				let block = keyframes.block!
				let [from_rule, to_rule] = block.children
				expect(from_rule.type).toBe(STYLE_RULE)
				expect(to_rule.type).toBe(STYLE_RULE)

				let from_selector = from_rule.first_child!
				expect(from_selector.text).toBe('from')

				let to_selector = to_rule.first_child!
				expect(to_selector.text).toBe('to')
			})

			test('@keyframes with percentages', () => {
				let source = '@keyframes slide { 0% { left: 0; } 50% { left: 50%; } 100% { left: 100%; } }'
				let root = parse(source, { parse_atrule_preludes: false })

				let keyframes = root.first_child!
				let block = keyframes.block!
				let [rule0, rule50, rule100] = block.children

				expect(rule0.type).toBe(STYLE_RULE)
				expect(rule50.type).toBe(STYLE_RULE)
				expect(rule100.type).toBe(STYLE_RULE)

				let selector0 = rule0.first_child!
				expect(selector0.text).toBe('0%')
			})

			test('@keyframes with multiple selectors', () => {
				let source = '@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }'
				let root = parse(source, { parse_atrule_preludes: false })

				let keyframes = root.first_child!
				let block = keyframes.block!
				let [rule1, _rule2] = block.children

				let selector1 = rule1.first_child!
				expect(selector1.text).toBe('0%, 100%')
			})

			test('@keyframes with mixed percentages and keywords', () => {
				let source = '@keyframes slide { from { left: 0; } 25%, 75% { left: 50%; } to { left: 100%; } }'
				let root = parse(source, { parse_atrule_preludes: false })

				let keyframes = root.first_child!
				let block = keyframes.block!
				expect(block.children.length).toBe(3)
			})
		})

		describe('@nest at-rule', () => {
			test('@nest with & selector', () => {
				let source = '.parent { @nest & .child { color: blue; } }'
				let root = parse(source)

				let parent = root.first_child!
				let [_selector, block] = parent.children
				let nest = block.first_child!

				expect(nest.type).toBe(AT_RULE)
				expect(nest.name).toBe('nest')
				expect(nest.has_children).toBe(true)

				let nest_block = nest.block!
				let decl = nest_block.first_child!
				expect(decl.type).toBe(DECLARATION)
				expect(decl.name).toBe('color')
			})

			test('@nest with complex selector', () => {
				let source = '.a { @nest :not(&) { color: red; } }'
				let root = parse(source)

				let a = root.first_child!
				let [_selector, block] = a.children
				let nest = block.first_child!

				expect(nest.type).toBe(AT_RULE)
				expect(nest.name).toBe('nest')
			})
		})

		describe('Error recovery and edge cases', () => {
			test('malformed rule without opening brace', () => {
				let source = 'body color: red; } div { margin: 0; }'
				let root = parse(source)

				expect(root.children.length).toBeGreaterThan(0)
			})

			test('rule without closing brace', () => {
				let source = 'body { color: red; div { margin: 0; }'
				let root = parse(source)

				expect(root.has_children).toBe(true)
			})

			test('empty rule block', () => {
				let source = '.empty { }'
				let root = parse(source)

				let rule = root.first_child!
				expect(rule.type).toBe(STYLE_RULE)
				expect(rule.children.length).toBe(2)
			})

			test('declaration without value', () => {
				let source = 'body { color: }'
				let root = parse(source)

				let rule = root.first_child!
				let [_selector, block] = rule.children
				let decl = block.first_child!
				expect(decl.type).toBe(DECLARATION)
			})

			test('multiple semicolons', () => {
				let source = 'body { color: red;;; margin: 0;; }'
				let root = parse(source)

				let rule = root.first_child!
				expect(rule.children.length).toBe(2)
			})

			test('invalid tokens in declaration block', () => {
				let source = 'body { color: red; @@@; margin: 0; }'
				let root = parse(source)

				let rule = root.first_child!
				expect(rule.children.length).toBe(2)
			})

			test('declaration without colon', () => {
				let source = 'body { color red; margin: 0; }'
				let root = parse(source)

				let rule = root.first_child!
				expect(rule.children.length).toBe(2)
			})

			test('at-rule without name', () => {
				let source = '@ { color: red; } body { margin: 0; }'
				let root = parse(source)

				expect(root.children.length).toBeGreaterThan(0)
			})

			test('nested empty blocks', () => {
				let source = '.a { .b { .c { } } }'
				let root = parse(source)

				let a = root.first_child!
				expect(a.type).toBe(STYLE_RULE)
			})

			test('trailing comma in selector', () => {
				let source = '.a, .b, { color: red; }'
				let root = parse(source)

				let rule = root.first_child!
				expect(rule.type).toBe(STYLE_RULE)
			})
		})

		describe('Comment handling', () => {
			test('skip comments at top level', () => {
				let source = '/* comment */ body { color: red; } /* another comment */'
				let root = parse(source)

				expect(root.children.length).toBe(1)
				let rule = root.first_child!
				expect(rule.type).toBe(STYLE_RULE)
			})

			test('skip comments in declaration block', () => {
				let source = 'body { color: red; /* comment */ margin: 0; }'
				let root = parse(source)

				let rule = root.first_child!
				expect(rule.type).toBe(STYLE_RULE)
				expect(rule.children.length).toBe(2)
			})

			test('skip comments in selector', () => {
				let source = 'body /* comment */ , /* comment */ div { color: red; }'
				let root = parse(source)

				let rule = root.first_child!
				expect(rule.type).toBe(STYLE_RULE)
			})

			test('comment between property and colon', () => {
				let source = 'body { color /* comment */ : red; }'
				let root = parse(source)

				expect(root.has_children).toBe(true)
			})

			test('multi-line comments', () => {
				let source = `
					/*
					 * Multi-line
					 * comment
					 */
					body { color: red; }
				`
				let root = parse(source)

				expect(root.children.length).toBe(1)
			})
		})

		describe('Whitespace handling', () => {
			test('excessive whitespace', () => {
				let source = '  body  {  color  :  red  ;  }  '
				let root = parse(source)

				let rule = root.first_child!
				expect(rule.type).toBe(STYLE_RULE)
			})

			test('tabs and newlines', () => {
				let source = 'body\t{\n\tcolor:\tred;\n}\n'
				let root = parse(source)

				let rule = root.first_child!
				expect(rule.type).toBe(STYLE_RULE)
			})

			test('no whitespace', () => {
				let source = 'body{color:red;margin:0}'
				let root = parse(source)

				let rule = root.first_child!
				let [_selector, block] = rule.children
				let [decl1, decl2] = block.children
				expect(decl1.name).toBe('color')
				expect(decl2.name).toBe('margin')
			})
		})

		describe('Complex real-world scenarios', () => {
			test('complex nested structure', () => {
				let source = `
					.card {
						display: flex;
						padding: 1rem;

						.header {
							font-size: 2rem;
							font-weight: bold;

							&:hover {
								color: blue;
							}
						}

						@media (min-width: 768px) {
							padding: 2rem;

							.header {
								font-size: 3rem;
							}
						}

						.footer {
							margin-top: auto;
						}
					}
				`
				let root = parse(source)

				let card = root.first_child!
				expect(card.type).toBe(STYLE_RULE)
				expect(card.children.length).toBe(2)
			})

			test('multiple at-rules with nesting', () => {
				let source = `
					@layer base {
						body { margin: 0; }
					}

					@layer components {
						.btn {
							padding: 0.5rem;

							@media (hover: hover) {
								&:hover { opacity: 0.8; }
							}
						}
					}
				`
				let root = parse(source)

				let [layer1, layer2] = root.children
				expect(layer1.type).toBe(AT_RULE)
				expect(layer2.type).toBe(AT_RULE)
			})

			test('vendor prefixed properties', () => {
				let source = '.box { -webkit-transform: scale(1); -moz-transform: scale(1); transform: scale(1); }'
				let root = parse(source)

				let rule = root.first_child!
				let [_selector, block] = rule.children
				let [decl1, decl2, decl3] = block.children
				expect(decl1.name).toBe('-webkit-transform')
				expect(decl2.name).toBe('-moz-transform')
				expect(decl3.name).toBe('transform')
			})

			test('complex selector list', () => {
				let source = 'h1, h2, h3, h4, h5, h6, .heading, [role="heading"] { font-family: sans-serif; }'
				let root = parse(source)

				let rule = root.first_child!
				let selector = rule.first_child!
				expect(selector.text).toContain('h1')
				expect(selector.text).toContain('[role="heading"]')
			})

			test('deeply nested at-rules', () => {
				let source = `
					@supports (display: grid) {
						@media (min-width: 768px) {
							@layer utilities {
								.grid { display: grid; }
							}
						}
					}
				`
				let root = parse(source, { parse_atrule_preludes: false })

				let supports = root.first_child!
				let supports_block = supports.block!
				let media = supports_block.first_child!
				let media_block = media.block!
				let layer = media_block.first_child!
				expect(supports.name).toBe('supports')
				expect(media.name).toBe('media')
				expect(layer.name).toBe('layer')
			})

			test('CSS with calc() and other functions', () => {
				let source = '.box { width: calc(100% - 2rem); background: linear-gradient(to right, red, blue); }'
				let root = parse(source)

				let rule = root.first_child!
				let [_selector, block] = rule.children
				let [width_decl, bg_decl] = block.children
				expect(width_decl.name).toBe('width')
				expect(bg_decl.name).toBe('background')
			})

			test('custom properties', () => {
				let source = ':root { --primary-color: #007bff; --spacing: 1rem; } body { color: var(--primary-color); }'
				let root = parse(source)

				expect(root.children.length).toBeGreaterThan(0)
				let first_rule = root.first_child!
				expect(first_rule.type).toBe(STYLE_RULE)
			})

			test('attribute selectors with operators', () => {
				let source = '[href^="https"][href$=".pdf"][class*="doc"] { color: red; }'
				let root = parse(source)

				let rule = root.first_child!
				let selector = rule.first_child!
				expect(selector.text).toContain('^=')
				expect(selector.text).toContain('$=')
				expect(selector.text).toContain('*=')
			})

			test('pseudo-elements', () => {
				let source = '.text::before { content: "→"; } .text::after { content: "←"; }'
				let root = parse(source)

				let [rule1, rule2] = root.children
				expect(rule1.type).toBe(STYLE_RULE)
				expect(rule2.type).toBe(STYLE_RULE)
			})

			test('multiple !important declarations', () => {
				let source = '.override { color: red !important; margin: 0 !important; padding: 0 !ie; }'
				let root = parse(source)

				let rule = root.first_child!
				let block = rule.block!
				expect(block.children.length).toBeGreaterThan(1)
				let declarations = block.children.filter((c) => c.type === DECLARATION)
				expect(declarations.length).toBeGreaterThan(0)
				expect(declarations[0].is_important).toBe(true)
			})
		})

		describe('Deeply nested modern CSS', () => {
			test('@container should parse nested style rules', () => {
				let css = `@container (width > 0) { div { color: red; } }`
				let ast = parse(css)

				const container = ast.first_child!
				expect(container.type).toBe(AT_RULE)
				expect(container.name).toBe('container')

				const containerBlock = container.block!
				const rule = containerBlock.first_child!
				expect(rule.type).toBe(STYLE_RULE)
			})

			test('@container should parse rules with :has() selector', () => {
				let css = `@container (width > 0) { ul:has(li) { color: red; } }`
				let ast = parse(css)

				const container = ast.first_child!
				const containerBlock = container.block!
				const rule = containerBlock.first_child!
				expect(rule.type).toBe(STYLE_RULE)
			})

			test('modern CSS example by Vadim Makeev', () => {
				let css = `
					@layer what {
						@container (width > 0) {
							ul:has(:nth-child(1 of li)) {
								@media (height > 0) {
									&:hover {
										--is: this;
									}
								}
							}
						}
					}`
				let ast = parse(css)

				expect(ast.type).toBe(STYLESHEET)
				expect(ast.has_children).toBe(true)

				const layer = ast.first_child!
				expect(layer.type).toBe(AT_RULE)
				expect(layer.name).toBe('layer')
				expect(layer.prelude).toBe('what')
				expect(layer.has_block).toBe(true)

				const container = layer.block!.first_child!
				expect(container.type).toBe(AT_RULE)
				expect(container.name).toBe('container')
				expect(container.prelude).toBe('(width > 0)')
				expect(container.has_block).toBe(true)

				const ulRule = container.block!.first_child!
				expect(ulRule.type).toBe(STYLE_RULE)
				expect(ulRule.has_block).toBe(true)

				const selectorList = ulRule.first_child!
				expect(selectorList.type).toBe(SELECTOR_LIST)
				const selector = selectorList.first_child!
				expect(selector.type).toBe(SELECTOR)
				const selectorParts = selector.children
				expect(selectorParts.length).toBeGreaterThan(0)
				expect(selectorParts[0].type).toBe(TYPE_SELECTOR)
				expect(selectorParts[0].text).toBe('ul')

				const media = ulRule.block!.first_child!
				expect(media.type).toBe(AT_RULE)
				expect(media.name).toBe('media')
				expect(media.prelude).toBe('(height > 0)')
				expect(media.has_block).toBe(true)

				const nestingRule = media.block!.first_child!
				expect(nestingRule.type).toBe(STYLE_RULE)
				expect(nestingRule.has_block).toBe(true)

				const nestingSelectorList = nestingRule.first_child!
				expect(nestingSelectorList.type).toBe(SELECTOR_LIST)
				const nestingSelector = nestingSelectorList.first_child!
				expect(nestingSelector.type).toBe(SELECTOR)
				const nestingParts = nestingSelector.children
				expect(nestingParts.length).toBeGreaterThan(0)
				expect(nestingParts[0].type).toBe(NESTING_SELECTOR)
				expect(nestingParts[0].text).toBe('&')

				const declaration = nestingRule.block!.first_child!
				expect(declaration.type).toBe(DECLARATION)
				expect(declaration.property).toBe('--is')
				expect(declaration.value).toBe('this')
			})
		})
	})

	describe('Large inline SVG', () => {
		test('should correctly parse declaration with huge inline SVG background-image', () => {
			// Generate a very long SVG string (> 65535 chars)
			const svgPart = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="red"/></svg>'
			const longSvg = svgPart.repeat(1000) // 89,000 chars
			// Add a second declaration after the huge SVG to test startColumn overflow
			const css = `.test { background-image: url("data:image/svg+xml,${longSvg}"); color: red; }`

			expect(longSvg.length).toBeGreaterThan(65535) // Verify SVG is long enough

			const ast = parse(css)
			const rule = ast.first_child!
			const block = rule.block!
			const declaration = block.first_child!

			// Verify declaration is parsed correctly
			expect(declaration.type).toBe(DECLARATION)
			expect(declaration.property).toBe('background-image')

			// Verify the full length is accessible (not truncated)
			const declText = `background-image: url("data:image/svg+xml,${longSvg}");`
			expect(declaration.length).toBe(declText.length)
			expect(declaration.length).toBeGreaterThan(65535)

			// Verify we can access the full declaration text
			expect(declaration.text).toBe(declText)
			expect(declaration.text).toContain('background-image:')
			expect(declaration.text).toContain(longSvg.substring(0, 100))
			expect(declaration.text).toContain(longSvg.substring(longSvg.length - 100))

			// Verify the value is parsed into nodes
			const urlNode = declaration.first_child!
			expect(urlNode.type).toBe(URL)
			expect(urlNode.name).toBe('url')

			// Verify the URL node text (full url(...) including function name and parens)
			const expectedUrlText = `url("data:image/svg+xml,${longSvg}")`
			expect(urlNode.text).toBe(expectedUrlText)
			expect(urlNode.text.length).toBe(expectedUrlText.length)

			// Verify the URL node length matches its text length
			expect(urlNode.length).toBe(urlNode.text.length)
			expect(urlNode.length).toBe(expectedUrlText.length)
			expect(urlNode.length).toBeGreaterThan(65535)

			// Test startColumn overflow: second declaration starts at column > 65535
			const secondDecl = declaration.next_sibling!
			expect(secondDecl).toBeTruthy()
			expect(secondDecl.type).toBe(DECLARATION)
			expect(secondDecl.property).toBe('color')
			expect(secondDecl.value).toBe('red')

			// Calculate expected column: '.test { ' + declaration.text + ' ' + 1 (columns are 1-indexed)
			const expectedColumn = '.test { '.length + declText.length + ' '.length + 1
			expect(expectedColumn).toBeGreaterThan(65535)

			// Verify column is correctly stored (Uint32, no overflow needed)
			expect(secondDecl.column).toBe(expectedColumn)
		})
	})
})
