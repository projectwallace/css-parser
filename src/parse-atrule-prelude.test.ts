import { describe, it, test, expect } from 'vitest'
import { parse } from './parse'
import { parse_atrule_prelude } from './parse-atrule-prelude'
import {
	AT_RULE,
	BLOCK,
	MEDIA_QUERY,
	MEDIA_FEATURE,
	MEDIA_TYPE,
	CONTAINER_QUERY,
	SUPPORTS_QUERY,
	LAYER_NAME,
	PRELUDE_IDENTIFIER,
	PRELUDE_OPERATOR,
	URL,
} from './arena'

describe('At-Rule Prelude Parser', () => {
	describe('@media', () => {
		it('should parse media type', () => {
			const css = '@media screen { }'
			const ast = parse(css)
			const atRule = ast.first_child

			expect(atRule?.type).toBe(AT_RULE)
			expect(atRule?.name).toBe('media')

			// Should have prelude children
			const children = atRule?.children || []
			expect(children.length).toBeGreaterThan(0)

			// First child should be a media query
			expect(children[0].type).toBe(MEDIA_QUERY)

			// Query should have a media type child
			const queryChildren = children[0].children
			expect(queryChildren.some((c) => c.type === MEDIA_TYPE)).toBe(true)
		})

		it('should parse media feature', () => {
			const css = '@media (min-width: 768px) { }'
			const ast = parse(css)
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children[0].type).toBe(MEDIA_QUERY)

			// Query should have a media feature child
			const queryChildren = children[0].children
			expect(queryChildren.some((c) => c.type === MEDIA_FEATURE)).toBe(true)

			// Feature should have content
			const feature = queryChildren.find((c) => c.type === MEDIA_FEATURE)
			expect(feature?.value).toContain('min-width')
		})

		it('should trim whitespace and comments from media features', () => {
			const css = '@media (/* comment */   min-width: 768px   /* test */) { }'
			const ast = parse(css)
			const atRule = ast.first_child
			const children = atRule?.children || []
			const queryChildren = children[0].children
			const feature = queryChildren.find((c) => c.type === MEDIA_FEATURE)

			expect(feature?.value).toBe('min-width: 768px')
		})

		it('should parse complex media query with and operator', () => {
			const css = '@media screen and (min-width: 768px) { }'
			const ast = parse(css)
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children[0].type).toBe(MEDIA_QUERY)

			const queryChildren = children[0].children
			// Should have: media type, operator, media feature
			expect(queryChildren.some((c) => c.type === MEDIA_TYPE)).toBe(true)
			expect(queryChildren.some((c) => c.type === PRELUDE_OPERATOR)).toBe(true)
			expect(queryChildren.some((c) => c.type === MEDIA_FEATURE)).toBe(true)
		})

		it('should parse multiple media features', () => {
			const css = '@media (min-width: 768px) and (max-width: 1024px) { }'
			const ast = parse(css)
			const atRule = ast.first_child
			const children = atRule?.children || []

			const queryChildren = children[0].children
			const features = queryChildren.filter((c) => c.type === MEDIA_FEATURE)
			expect(features.length).toBe(2)
		})

		it('should parse comma-separated media queries', () => {
			const css = '@media screen, print { }'
			const ast = parse(css)
			const atRule = ast.first_child
			const children = atRule?.children || []

			// Should have 2 media query nodes
			const queries = children.filter((c) => c.type === MEDIA_QUERY)
			expect(queries.length).toBe(2)
		})
	})

	describe('@container', () => {
		it('should parse unnamed container query', () => {
			const css = '@container (min-width: 400px) { }'
			const ast = parse(css)
			const atRule = ast.first_child

			expect(atRule?.type).toBe(AT_RULE)
			expect(atRule?.name).toBe('container')

			const children = atRule?.children || []
			expect(children.length).toBeGreaterThan(0)
			expect(children[0].type).toBe(CONTAINER_QUERY)
		})

		it('should parse named container query', () => {
			const css = '@container sidebar (min-width: 400px) { }'
			const ast = parse(css)
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children[0].type).toBe(CONTAINER_QUERY)

			const queryChildren = children[0].children
			// Should have name and feature
			expect(queryChildren.some((c) => c.type === PRELUDE_IDENTIFIER)).toBe(true)
			expect(queryChildren.some((c) => c.type === MEDIA_FEATURE)).toBe(true)
		})
	})

	describe('@supports', () => {
		it('should parse single feature query', () => {
			const css = '@supports (display: flex) { }'
			const ast = parse(css)
			const atRule = ast.first_child

			expect(atRule?.type).toBe(AT_RULE)
			expect(atRule?.name).toBe('supports')

			const children = atRule?.children || []
			expect(children.some((c) => c.type === SUPPORTS_QUERY)).toBe(true)

			const query = children.find((c) => c.type === SUPPORTS_QUERY)
			expect(query?.value).toContain('display')
			expect(query?.value).toContain('flex')
		})

		it('should trim whitespace and comments from supports queries', () => {
			const css = '@supports (/* comment */   display: flex   /* test */) { }'
			const ast = parse(css)
			const atRule = ast.first_child
			const children = atRule?.children || []
			const query = children.find((c) => c.type === SUPPORTS_QUERY)

			expect(query?.value).toBe('display: flex')
		})

		it('should parse complex supports query with operators', () => {
			const css = '@supports (display: flex) and (gap: 1rem) { }'
			const ast = parse(css)
			const atRule = ast.first_child
			const children = atRule?.children || []

			// Should have 2 queries and 1 operator
			const queries = children.filter((c) => c.type === SUPPORTS_QUERY)
			const operators = children.filter((c) => c.type === PRELUDE_OPERATOR)

			expect(queries.length).toBe(2)
			expect(operators.length).toBe(1)
		})
	})

	describe('@layer', () => {
		it('should parse single layer name', () => {
			const css = '@layer base { }'
			const ast = parse(css)
			const atRule = ast.first_child

			expect(atRule?.type).toBe(AT_RULE)
			expect(atRule?.name).toBe('layer')

			// Filter out block node to get only prelude children
			const children = atRule?.children.filter((c) => c.type !== BLOCK) || []
			expect(children.length).toBe(1)
			expect(children[0].type).toBe(LAYER_NAME)
			expect(children[0].text).toBe('base')
		})

		it('should parse comma-separated layer names', () => {
			const css = '@layer base, components, utilities;'
			const ast = parse(css)
			const atRule = ast.first_child

			const children = atRule?.children || []
			expect(children.length).toBe(3)

			expect(children[0].type).toBe(LAYER_NAME)
			expect(children[0].text).toBe('base')

			expect(children[1].type).toBe(LAYER_NAME)
			expect(children[1].text).toBe('components')

			expect(children[2].type).toBe(LAYER_NAME)
			expect(children[2].text).toBe('utilities')
		})
	})

	describe('@keyframes', () => {
		it('should parse keyframe name', () => {
			const css = '@keyframes slidein { }'
			const ast = parse(css)
			const atRule = ast.first_child

			expect(atRule?.type).toBe(AT_RULE)
			expect(atRule?.name).toBe('keyframes')

			// Filter out block node to get only prelude children
			const children = atRule?.children.filter((c) => c.type !== BLOCK) || []
			expect(children.length).toBe(1)
			expect(children[0].type).toBe(PRELUDE_IDENTIFIER)
			expect(children[0].text).toBe('slidein')
		})
	})

	describe('@property', () => {
		it('should parse custom property name', () => {
			const css = '@property --my-color { }'
			const ast = parse(css)
			const atRule = ast.first_child

			expect(atRule?.type).toBe(AT_RULE)
			expect(atRule?.name).toBe('property')

			// Filter out block node to get only prelude children
			const children = atRule?.children.filter((c) => c.type !== BLOCK) || []
			expect(children.length).toBe(1)
			expect(children[0].type).toBe(PRELUDE_IDENTIFIER)
			expect(children[0].text).toBe('--my-color')
		})
	})

	describe('@font-face', () => {
		it('should have no prelude children', () => {
			const css = '@font-face { font-family: "MyFont"; }'
			const ast = parse(css)
			const atRule = ast.first_child

			expect(atRule?.type).toBe(AT_RULE)
			expect(atRule?.name).toBe('font-face')

			// @font-face has no prelude, children should be declarations
			const children = atRule?.children || []
			if (children.length > 0) {
				// If parse_values is enabled, there might be declaration children
				expect(children[0].type).not.toBe(PRELUDE_IDENTIFIER)
			}
		})
	})

	describe('parse_atrule_preludes option', () => {
		it('should parse preludes when enabled (default)', () => {
			const css = '@media screen { }'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.some((c) => c.type === MEDIA_QUERY)).toBe(true)
		})

		it('should not parse preludes when disabled', () => {
			const css = '@media screen { }'
			const ast = parse(css, { parse_atrule_preludes: false })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.some((c) => c.type === MEDIA_QUERY)).toBe(false)
		})
	})

	describe('Prelude text access', () => {
		it('should preserve prelude text in at-rule node', () => {
			const css = '@media screen and (min-width: 768px) { }'
			const ast = parse(css)
			const atRule = ast.first_child

			// The prelude text should still be accessible
			expect(atRule?.prelude).toBe('screen and (min-width: 768px)')
		})
	})

	describe('@import', () => {
		it('should parse URL with url() function', () => {
			const css = '@import url("styles.css");'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.length).toBeGreaterThan(0)
			expect(children[0].type).toBe(URL)
			expect(children[0].text).toBe('url("styles.css")')
		})

		it('should parse URL with string', () => {
			const css = '@import "styles.css";'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.length).toBeGreaterThan(0)
			expect(children[0].type).toBe(URL)
			expect(children[0].text).toBe('"styles.css"')
		})

		it('should parse with anonymous layer', () => {
			const css = '@import url("styles.css") layer;'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.length).toBe(2)
			expect(children[0].type).toBe(URL)
			expect(children[1].type).toBe(LAYER_NAME)
			expect(children[1].text).toBe('layer')
			expect(children[1].name).toBe('')
		})

		it('should parse with anonymous LAYER', () => {
			const css = '@import url("styles.css") LAYER;'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.length).toBe(2)
			expect(children[0].type).toBe(URL)
			expect(children[1].type).toBe(LAYER_NAME)
			expect(children[1].text).toBe('LAYER')
			expect(children[1].name).toBe('')
		})

		it('should parse with named layer', () => {
			const css = '@import url("styles.css") layer(utilities);'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.length).toBe(2)
			expect(children[0].type).toBe(URL)
			expect(children[1].type).toBe(LAYER_NAME)
			expect(children[1].text).toBe('layer(utilities)')
			expect(children[1].name).toBe('utilities')
		})

		it('should trim whitespace from layer names', () => {
			const css = '@import url("styles.css") layer(   utilities   );'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children[1].type).toBe(LAYER_NAME)
			expect(children[1].name).toBe('utilities')
		})

		it('should trim comments from layer names', () => {
			const css = '@import url("styles.css") layer(/* comment */utilities/* test */);'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children[1].type).toBe(LAYER_NAME)
			expect(children[1].name).toBe('utilities')
		})

		it('should trim whitespace and comments from dotted layer names', () => {
			const css = '@import url("foo.css") layer(/* test */named.nested     );'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children[1].type).toBe(LAYER_NAME)
			expect(children[1].name).toBe('named.nested')
		})

		it('should parse with supports query', () => {
			const css = '@import url("styles.css") supports(display: grid);'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.length).toBe(2)
			expect(children[0].type).toBe(URL)
			expect(children[1].type).toBe(SUPPORTS_QUERY)
			expect(children[1].text).toBe('supports(display: grid)')
		})

		it('should parse with media query', () => {
			const css = '@import url("styles.css") screen;'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.length).toBe(2)
			expect(children[0].type).toBe(URL)
			expect(children[1].type).toBe(MEDIA_QUERY)
		})

		it('should parse with media feature', () => {
			const css = '@import url("styles.css") (min-width: 768px);'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.length).toBe(2)
			expect(children[0].type).toBe(URL)
			expect(children[1].type).toBe(MEDIA_QUERY)
		})

		it('should parse with combined media query', () => {
			const css = '@import url("styles.css") screen and (min-width: 768px);'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.length).toBe(2)
			expect(children[0].type).toBe(URL)
			expect(children[1].type).toBe(MEDIA_QUERY)
		})

		it('should parse with layer and media query', () => {
			const css = '@import url("styles.css") layer(base) screen;'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.length).toBe(3)
			expect(children[0].type).toBe(URL)
			expect(children[1].type).toBe(LAYER_NAME)
			expect(children[2].type).toBe(MEDIA_QUERY)
		})

		it('should parse with layer and supports', () => {
			const css = '@import url("styles.css") layer(base) supports(display: grid);'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.length).toBe(3)
			expect(children[0].type).toBe(URL)
			expect(children[1].type).toBe(LAYER_NAME)
			expect(children[2].type).toBe(SUPPORTS_QUERY)
		})

		it('should parse with supports and media query', () => {
			const css = '@import url("styles.css") supports(display: grid) screen;'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.length).toBe(3)
			expect(children[0].type).toBe(URL)
			expect(children[1].type).toBe(SUPPORTS_QUERY)
			expect(children[2].type).toBe(MEDIA_QUERY)
		})

		it('should parse with all features combined', () => {
			const css = '@import url("styles.css") layer(base) supports(display: grid) screen and (min-width: 768px);'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.length).toBe(4)
			expect(children[0].type).toBe(URL)
			expect(children[1].type).toBe(LAYER_NAME)
			expect(children[2].type).toBe(SUPPORTS_QUERY)
			expect(children[3].type).toBe(MEDIA_QUERY)
		})

		it('should parse with complex supports condition', () => {
			const css = '@import url("styles.css") supports((display: grid) and (gap: 1rem));'
			const ast = parse(css, { parse_atrule_preludes: true })
			const atRule = ast.first_child
			const children = atRule?.children || []

			expect(children.length).toBe(2)
			expect(children[0].type).toBe(URL)
			expect(children[1].type).toBe(SUPPORTS_QUERY)
			expect(children[1].text).toContain('supports(')
		})

		it('should preserve prelude text', () => {
			const css = '@import url("styles.css") layer(base) screen;'
			const ast = parse(css)
			const atRule = ast.first_child

			expect(atRule?.prelude).toBe('url("styles.css") layer(base) screen')
		})
	})
})

describe('parse_atrule_prelude()', () => {
	describe('media queries', () => {
		test('should parse simple media feature', () => {
			const result = parse_atrule_prelude('media', '(min-width: 768px)')

			expect(result.length).toBeGreaterThan(0)
			expect(result[0].text).toBe('(min-width: 768px)')
		})

		test('should parse media type', () => {
			const result = parse_atrule_prelude('media', 'screen')

			expect(result.length).toBeGreaterThan(0)
			expect(result[0].text).toBe('screen')
		})

		test('should parse complex media query', () => {
			const result = parse_atrule_prelude('media', 'screen and (min-width: 768px)')

			expect(result.length).toBeGreaterThan(0)
			// Should have parsed the media query
			expect(result[0].text).toContain('screen')
		})

		test('should parse multiple media queries', () => {
			const result = parse_atrule_prelude('media', 'screen, print')

			expect(result.length).toBeGreaterThanOrEqual(1)
		})

		test('should parse media query with and', () => {
			const result = parse_atrule_prelude('media', '(min-width: 768px) and (max-width: 1024px)')

			expect(result.length).toBeGreaterThan(0)
		})
	})

	describe('supports queries', () => {
		test('should parse supports condition', () => {
			const result = parse_atrule_prelude('supports', '(display: grid)')

			expect(result.length).toBeGreaterThan(0)
			expect(result[0].text).toBe('(display: grid)')
		})

		test('should parse supports with and', () => {
			const result = parse_atrule_prelude('supports', '(display: grid) and (gap: 1rem)')

			expect(result.length).toBeGreaterThan(0)
		})
	})

	describe('container queries', () => {
		test('should parse container query', () => {
			const result = parse_atrule_prelude('container', '(min-width: 400px)')

			expect(result.length).toBeGreaterThan(0)
			expect(result[0].text).toBe('(min-width: 400px)')
		})

		test('should parse container query with name', () => {
			const result = parse_atrule_prelude('container', 'sidebar (min-width: 400px)')

			expect(result.length).toBeGreaterThan(0)
		})
	})

	describe('layer', () => {
		test('should parse layer name', () => {
			const result = parse_atrule_prelude('layer', 'utilities')

			expect(result.length).toBe(1)
			expect(result[0].type).toBe(LAYER_NAME)
			expect(result[0].text).toBe('utilities')
		})

		test('should parse multiple layer names', () => {
			const result = parse_atrule_prelude('layer', 'base, components, utilities')

			expect(result.length).toBeGreaterThanOrEqual(3)
		})

		test('should parse dotted layer name', () => {
			const result = parse_atrule_prelude('layer', 'framework.base')

			expect(result.length).toBeGreaterThan(0)
		})
	})

	describe('keyframes', () => {
		test('should parse keyframes name', () => {
			const result = parse_atrule_prelude('keyframes', 'slide-in')

			expect(result.length).toBe(1)
			expect(result[0].type).toBe(PRELUDE_IDENTIFIER)
			expect(result[0].text).toBe('slide-in')
		})

		test('should parse keyframes name with underscores', () => {
			const result = parse_atrule_prelude('keyframes', 'fade_out')

			expect(result.length).toBe(1)
			expect(result[0].text).toBe('fade_out')
		})
	})

	describe('property', () => {
		test('should parse custom property name', () => {
			const result = parse_atrule_prelude('property', '--my-color')

			expect(result.length).toBe(1)
			expect(result[0].type).toBe(PRELUDE_IDENTIFIER)
			expect(result[0].text).toBe('--my-color')
		})
	})

	describe('@import', () => {
		test('should parse import with URL string', () => {
			const result = parse_atrule_prelude('import', 'url("styles.css")')

			expect(result.length).toBeGreaterThan(0)
			expect(result[0].type).toBe(URL)
			expect(result[0].text).toBe('url("styles.css")')
		})

		test('should parse import with string', () => {
			const result = parse_atrule_prelude('import', '"styles.css"')

			expect(result.length).toBeGreaterThan(0)
			expect(result[0].type).toBe(URL)
			expect(result[0].text).toBe('"styles.css"')
		})

		test('should parse import with layer', () => {
			const result = parse_atrule_prelude('import', 'url("base.css") layer(framework)')

			expect(result.length).toBeGreaterThanOrEqual(2)
			expect(result[0].type).toBe(URL)
			expect(result[1].type).toBe(LAYER_NAME)
		})

		test('should parse import with supports', () => {
			const result = parse_atrule_prelude('import', 'url("modern.css") supports(display: grid)')

			expect(result.length).toBeGreaterThanOrEqual(2)
			expect(result[0].type).toBe(URL)
			expect(result[1].type).toBe(SUPPORTS_QUERY)
		})
	})

	describe('empty and unsupported', () => {
		test('should handle empty prelude', () => {
			const result = parse_atrule_prelude('media', '')

			expect(result).toEqual([])
		})

		test('should handle whitespace-only prelude', () => {
			const result = parse_atrule_prelude('media', '   ')

			expect(result).toEqual([])
		})
	})

	describe('return value properties', () => {
		test('should return array of CSSNode objects', () => {
			const result = parse_atrule_prelude('layer', 'utilities')

			expect(Array.isArray(result)).toBe(true)
			expect(result.length).toBeGreaterThan(0)
			expect(result[0]).toHaveProperty('type')
			expect(result[0]).toHaveProperty('text')
		})

		test('should have iterable nodes', () => {
			const result = parse_atrule_prelude('media', '(min-width: 768px)')

			for (const node of result) {
				expect(node).toHaveProperty('type')
				expect(node).toHaveProperty('text')
			}
		})

		test('should preserve prelude text', () => {
			const prelude = '(min-width: 768px) and (max-width: 1024px)'
			const result = parse_atrule_prelude('media', prelude)

			// At least one node should have part of the original text
			expect(result.length).toBeGreaterThan(0)
		})
	})

	describe('case insensitivity', () => {
		test('should handle uppercase at-rule name', () => {
			const result = parse_atrule_prelude('MEDIA', '(min-width: 768px)')

			expect(result.length).toBeGreaterThan(0)
		})

		test('should handle mixed case at-rule name', () => {
			const result = parse_atrule_prelude('Media', '(min-width: 768px)')

			expect(result.length).toBeGreaterThan(0)
		})
	})

	describe('length property correctness (regression tests for commit 5c6e2cd)', () => {
		describe('At-rule prelude length', () => {
			test('@media prelude length should match text', () => {
				const css = '@media screen { }'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('screen')
				expect(atRule?.prelude?.length).toBe(6)
			})

			test('@media with feature prelude length', () => {
				const css = '@media (min-width: 768px) { }'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('(min-width: 768px)')
				expect(atRule?.prelude?.length).toBe(18)
			})

			test('@media complex prelude length', () => {
				const css = '@media screen and (min-width: 768px) { }'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('screen and (min-width: 768px)')
				expect(atRule?.prelude?.length).toBe(29)
			})

			test('@container prelude length', () => {
				const css = '@container (min-width: 768px) { }'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('(min-width: 768px)')
				expect(atRule?.prelude?.length).toBe(18)
			})

			test('@container with name prelude length', () => {
				const css = '@container sidebar (min-width: 400px) { }'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('sidebar (min-width: 400px)')
				expect(atRule?.prelude?.length).toBe(26)
			})

			test('@supports prelude length', () => {
				const css = '@supports (display: flex) { }'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('(display: flex)')
				expect(atRule?.prelude?.length).toBe(15)
			})

			test('@supports complex prelude length', () => {
				const css = '@supports (display: flex) and (color: red) { }'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('(display: flex) and (color: red)')
				expect(atRule?.prelude?.length).toBe(32)
			})

			test('@layer single name prelude length', () => {
				const css = '@layer utilities { }'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('utilities')
				expect(atRule?.prelude?.length).toBe(9)
			})

			test('@layer multiple names prelude length', () => {
				const css = '@layer base, components, utilities { }'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('base, components, utilities')
				expect(atRule?.prelude?.length).toBe(27)
			})

			test('@import url prelude length', () => {
				const css = '@import url("styles.css") screen;'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('url("styles.css") screen')
				expect(atRule?.prelude?.length).toBe(24)
			})

			test('@import with layer prelude length', () => {
				const css = '@import "styles.css" layer(utilities);'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('"styles.css" layer(utilities)')
				expect(atRule?.prelude?.length).toBe(29)
			})

			test('@import with supports prelude length', () => {
				const css = '@import url("styles.css") supports(display: flex);'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('url("styles.css") supports(display: flex)')
				expect(atRule?.prelude?.length).toBe(41)
			})

			test('@import complex prelude length', () => {
				const css = '@import url("a.css") layer(utilities) supports(display: flex) screen;'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('url("a.css") layer(utilities) supports(display: flex) screen')
				expect(atRule?.prelude?.length).toBe(60)
			})
		})

		describe('Prelude child node text length', () => {
			test('media query node text length', () => {
				const css = '@media screen and (min-width: 768px) { }'
				const ast = parse(css)
				const atRule = ast.first_child
				const children = atRule?.children || []

				// First child should be media query
				const mediaQuery = children[0]
				expect(mediaQuery.type).toBe(MEDIA_QUERY)
				expect(mediaQuery.text).toBe('screen and (min-width: 768px)')
				expect(mediaQuery.text.length).toBe(29)
			})

			test('media type node text length', () => {
				const css = '@media screen { }'
				const ast = parse(css)
				const atRule = ast.first_child
				const children = atRule?.children || []
				const mediaQuery = children[0]
				const queryChildren = mediaQuery?.children || []

				const mediaType = queryChildren.find((c) => c.type === MEDIA_TYPE)
				expect(mediaType?.text).toBe('screen')
				expect(mediaType?.text.length).toBe(6)
			})

			test('media feature node text length', () => {
				const css = '@media (min-width: 768px) { }'
				const ast = parse(css)
				const atRule = ast.first_child
				const children = atRule?.children || []
				const mediaQuery = children[0]
				const queryChildren = mediaQuery?.children || []

				const mediaFeature = queryChildren.find((c) => c.type === MEDIA_FEATURE)
				expect(mediaFeature?.text).toBe('(min-width: 768px)')
				expect(mediaFeature?.text.length).toBe(18)
			})

			test('container query node text length', () => {
				const css = '@container sidebar (min-width: 400px) { }'
				const ast = parse(css)
				const atRule = ast.first_child
				const children = atRule?.children || []

				const containerQuery = children.find((c) => c.type === CONTAINER_QUERY)
				expect(containerQuery?.text).toBe('sidebar (min-width: 400px)')
				expect(containerQuery?.text.length).toBe(26)
			})

			test('supports query node text length', () => {
				const css = '@supports (display: flex) { }'
				const ast = parse(css)
				const atRule = ast.first_child
				const children = atRule?.children || []

				const supportsQuery = children.find((c) => c.type === SUPPORTS_QUERY)
				expect(supportsQuery?.text).toBe('(display: flex)')
				expect(supportsQuery?.text.length).toBe(15)
			})

			test('layer name node text length', () => {
				const css = '@layer utilities { }'
				const ast = parse(css)
				const atRule = ast.first_child
				const children = atRule?.children || []

				const layerName = children.find((c) => c.type === LAYER_NAME)
				expect(layerName?.text).toBe('utilities')
				expect(layerName?.text.length).toBe(9)
			})

			test('import url node text length', () => {
				const css = '@import url("styles.css") screen;'
				const ast = parse(css)
				const atRule = ast.first_child
				const children = atRule?.children || []

				const importUrl = children.find((c) => c.type === URL)
				expect(importUrl?.text).toBe('url("styles.css")')
				expect(importUrl?.text.length).toBe(17)
			})

			test('import layer node text length', () => {
				const css = '@import "styles.css" layer(utilities);'
				const ast = parse(css)
				const atRule = ast.first_child
				const children = atRule?.children || []

				const importLayer = children.find((c) => c.type === LAYER_NAME)
				expect(importLayer?.text).toBe('layer(utilities)')
				expect(importLayer?.text.length).toBe(16)
			})

			test('import supports node text length', () => {
				const css = '@import url("a.css") supports(display: flex);'
				const ast = parse(css)
				const atRule = ast.first_child
				const children = atRule?.children || []

				const importSupports = children.find((c) => c.type === SUPPORTS_QUERY)
				expect(importSupports?.text).toBe('supports(display: flex)')
				expect(importSupports?.text.length).toBe(23)
			})

			test('operator node text length', () => {
				const css = '@media screen and (min-width: 768px) { }'
				const ast = parse(css)
				const atRule = ast.first_child
				const children = atRule?.children || []
				const mediaQuery = children[0]
				const queryChildren = mediaQuery?.children || []

				const operator = queryChildren.find((c) => c.type === PRELUDE_OPERATOR)
				expect(operator?.text).toBe('and')
				expect(operator?.text.length).toBe(3)
			})
		})

		describe('Edge cases and whitespace handling', () => {
			test('@media with extra whitespace prelude length', () => {
				const css = '@media  screen   and   (min-width: 768px)  { }'
				const ast = parse(css)
				const atRule = ast.first_child

				// Whitespace is trimmed from start/end but preserved internally
				expect(atRule?.prelude).toBe('screen   and   (min-width: 768px)')
				expect(atRule?.prelude?.length).toBe(33)
			})

			test('@layer with whitespace around commas', () => {
				const css = '@layer base , components , utilities { }'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('base , components , utilities')
				expect(atRule?.prelude?.length).toBe(29)
			})

			test('@import with newlines prelude length', () => {
				const css = '@import url("styles.css")\n  screen;'
				const ast = parse(css)
				const atRule = ast.first_child

				expect(atRule?.prelude).toBe('url("styles.css")\n  screen')
				expect(atRule?.prelude?.length).toBe(26)
			})
		})
	})
})
