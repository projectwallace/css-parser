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
	IDENTIFIER,
	PRELUDE_OPERATOR,
	URL,
	DIMENSION,
	FEATURE_RANGE,
} from './arena'

describe('At-Rule Prelude Nodes', () => {
	describe('Locations', () => {
		describe('MEDIA_QUERY', () => {
			test('offset and length for simple media type', () => {
				const css = '@media screen { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const prelude = atRule.prelude!
				const mediaQuery = prelude.first_child!

				expect(mediaQuery.type).toBe(MEDIA_QUERY)
				expect(mediaQuery.start).toBe(7)
				expect(mediaQuery.length).toBe(6)
				expect(mediaQuery.end).toBe(13)
			})

			test('offset and length for media feature', () => {
				const css = '@media (min-width: 768px) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const mediaQuery = atRule.prelude!.first_child!

				expect(mediaQuery.type).toBe(MEDIA_QUERY)
				expect(mediaQuery.start).toBe(7)
				expect(mediaQuery.length).toBe(18)
				expect(mediaQuery.end).toBe(25)
			})

			test('offset and length for complex query', () => {
				const css = '@media screen and (min-width: 768px) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const mediaQuery = atRule.prelude!.first_child!

				expect(mediaQuery.type).toBe(MEDIA_QUERY)
				expect(mediaQuery.start).toBe(7)
				expect(mediaQuery.length).toBe(29)
				expect(mediaQuery.end).toBe(36)
			})
		})

		describe('MEDIA_TYPE', () => {
			test('offset and length', () => {
				const css = '@media screen { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const mediaQuery = atRule.prelude!.first_child!
				const mediaType = mediaQuery.first_child!

				expect(mediaType.type).toBe(MEDIA_TYPE)
				expect(mediaType.start).toBe(7)
				expect(mediaType.length).toBe(6)
				expect(mediaType.end).toBe(13)
			})
		})

		describe('MEDIA_FEATURE', () => {
			test('offset and length', () => {
				const css = '@media (min-width: 768px) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const mediaQuery = atRule.prelude!.first_child!
				const mediaFeature = mediaQuery.first_child!

				expect(mediaFeature.type).toBe(MEDIA_FEATURE)
				expect(mediaFeature.start).toBe(7)
				expect(mediaFeature.length).toBe(18)
				expect(mediaFeature.end).toBe(25)
			})
		})

		describe('CONTAINER_QUERY', () => {
			test('offset and length for unnamed query', () => {
				const css = '@container (min-width: 400px) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const containerQuery = atRule.prelude!.first_child!

				expect(containerQuery.type).toBe(CONTAINER_QUERY)
				expect(containerQuery.start).toBe(11)
				expect(containerQuery.length).toBe(18)
				expect(containerQuery.end).toBe(29)
			})

			test('offset and length for named query', () => {
				const css = '@container sidebar (min-width: 400px) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const containerQuery = atRule.prelude!.first_child!

				expect(containerQuery.type).toBe(CONTAINER_QUERY)
				expect(containerQuery.start).toBe(11)
				expect(containerQuery.length).toBe(26)
				expect(containerQuery.end).toBe(37)
			})
		})

		describe('SUPPORTS_QUERY', () => {
			test('offset and length', () => {
				const css = '@supports (display: flex) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const supportsQuery = atRule.prelude!.first_child!

				expect(supportsQuery.type).toBe(SUPPORTS_QUERY)
				expect(supportsQuery.start).toBe(10)
				expect(supportsQuery.length).toBe(15)
				expect(supportsQuery.end).toBe(25)
			})
		})

		describe('LAYER_NAME', () => {
			test('offset and length', () => {
				const css = '@layer utilities { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const layerName = atRule.prelude!.first_child!

				expect(layerName.type).toBe(LAYER_NAME)
				expect(layerName.start).toBe(7)
				expect(layerName.length).toBe(9)
				expect(layerName.end).toBe(16)
			})
		})

		describe('IDENTIFIER', () => {
			test('offset and length in @keyframes', () => {
				const css = '@keyframes slidein { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const identifier = atRule.prelude!.first_child!

				expect(identifier.type).toBe(IDENTIFIER)
				expect(identifier.start).toBe(11)
				expect(identifier.length).toBe(7)
				expect(identifier.end).toBe(18)
			})

			test('offset and length in @property', () => {
				const css = '@property --my-color { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const identifier = atRule.prelude!.first_child!

				expect(identifier.type).toBe(IDENTIFIER)
				expect(identifier.start).toBe(10)
				expect(identifier.length).toBe(10)
				expect(identifier.end).toBe(20)
			})
		})

		describe('PRELUDE_OPERATOR', () => {
			test('offset and length in @media', () => {
				const css = '@media screen and (min-width: 768px) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const mediaQuery = atRule.prelude!.first_child!
				const operator = mediaQuery.children[1]

				expect(operator.type).toBe(PRELUDE_OPERATOR)
				expect(operator.start).toBe(14)
				expect(operator.length).toBe(3)
				expect(operator.end).toBe(17)
			})
		})

		describe('URL', () => {
			test('offset and length with url() function', () => {
				const css = '@import url("styles.css");'
				const ast = parse(css)
				const atRule = ast.first_child!
				const url = atRule.prelude!.first_child!

				expect(url.type).toBe(URL)
				expect(url.start).toBe(8)
				expect(url.length).toBe(17)
				expect(url.end).toBe(25)
			})

			test('offset and length with string', () => {
				const css = '@import "styles.css";'
				const ast = parse(css)
				const atRule = ast.first_child!
				const url = atRule.prelude!.first_child!

				expect(url.type).toBe(URL)
				expect(url.start).toBe(8)
				expect(url.length).toBe(12)
				expect(url.end).toBe(20)
			})
		})
	})

	describe('Types', () => {
		test('MEDIA_QUERY type constant', () => {
			const css = '@media screen { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const mediaQuery = atRule.prelude!.first_child!

			expect(mediaQuery.type).toBe(MEDIA_QUERY)
		})

		test('MEDIA_TYPE type constant', () => {
			const css = '@media screen { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const mediaQuery = atRule.prelude!.first_child!
			const mediaType = mediaQuery.first_child!

			expect(mediaType.type).toBe(MEDIA_TYPE)
		})

		test('MEDIA_FEATURE type constant', () => {
			const css = '@media (min-width: 768px) { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const mediaQuery = atRule.prelude!.first_child!
			const mediaFeature = mediaQuery.first_child!

			expect(mediaFeature.type).toBe(MEDIA_FEATURE)
		})

		test('CONTAINER_QUERY type constant', () => {
			const css = '@container (min-width: 400px) { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const containerQuery = atRule.prelude!.first_child!

			expect(containerQuery.type).toBe(CONTAINER_QUERY)
		})

		test('SUPPORTS_QUERY type constant', () => {
			const css = '@supports (display: flex) { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const supportsQuery = atRule.prelude!.first_child!

			expect(supportsQuery.type).toBe(SUPPORTS_QUERY)
		})

		test('LAYER_NAME type constant', () => {
			const css = '@layer utilities { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const layerName = atRule.prelude!.first_child!

			expect(layerName.type).toBe(LAYER_NAME)
		})

		test('IDENTIFIER type constant in @keyframes', () => {
			const css = '@keyframes slidein { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const identifier = atRule.prelude!.first_child!

			expect(identifier.type).toBe(IDENTIFIER)
		})

		test('IDENTIFIER type constant in @property', () => {
			const css = '@property --my-color { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const identifier = atRule.prelude!.first_child!

			expect(identifier.type).toBe(IDENTIFIER)
		})

		test('PRELUDE_OPERATOR type constant', () => {
			const css = '@media screen and (min-width: 768px) { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const mediaQuery = atRule.prelude!.first_child!
			const operator = mediaQuery.children[1]

			expect(operator.type).toBe(PRELUDE_OPERATOR)
		})

		test('URL type constant', () => {
			const css = '@import url("styles.css");'
			const ast = parse(css)
			const atRule = ast.first_child!
			const url = atRule.prelude!.first_child!

			expect(url.type).toBe(URL)
		})
	})

	describe('Type Names', () => {
		test('MEDIA_QUERY type_name', () => {
			const css = '@media screen { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const mediaQuery = atRule.prelude!.first_child!

			expect(mediaQuery.type_name).toBe('MediaQuery')
		})

		test('MEDIA_TYPE type_name', () => {
			const css = '@media screen { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const mediaQuery = atRule.prelude!.first_child!
			const mediaType = mediaQuery.first_child!

			expect(mediaType.type_name).toBe('MediaType')
		})

		test('MEDIA_FEATURE type_name', () => {
			const css = '@media (min-width: 768px) { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const mediaQuery = atRule.prelude!.first_child!
			const mediaFeature = mediaQuery.first_child!

			expect(mediaFeature.type_name).toBe('Feature')
		})

		test('CONTAINER_QUERY type_name', () => {
			const css = '@container (min-width: 400px) { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const containerQuery = atRule.prelude!.first_child!

			expect(containerQuery.type_name).toBe('ContainerQuery')
		})

		test('SUPPORTS_QUERY type_name', () => {
			const css = '@supports (display: flex) { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const supportsQuery = atRule.prelude!.first_child!

			expect(supportsQuery.type_name).toBe('SupportsQuery')
		})

		test('LAYER_NAME type_name', () => {
			const css = '@layer utilities { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const layerName = atRule.prelude!.first_child!

			expect(layerName.type_name).toBe('Layer')
		})

		test('IDENTIFIER type_name', () => {
			const css = '@keyframes slidein { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const identifier = atRule.prelude!.first_child!

			expect(identifier.type_name).toBe('Identifier')
		})

		test('PRELUDE_OPERATOR type_name', () => {
			const css = '@media screen and (min-width: 768px) { }'
			const ast = parse(css)
			const atRule = ast.first_child!
			const mediaQuery = atRule.prelude!.first_child!
			const operator = mediaQuery.children[1]

			expect(operator.type_name).toBe('Operator')
		})

		test('URL type_name', () => {
			const css = '@import url("styles.css");'
			const ast = parse(css)
			const atRule = ast.first_child!
			const url = atRule.prelude!.first_child!

			expect(url.type_name).toBe('Url')
		})
	})

	describe('Prelude Properties', () => {
		describe('@media', () => {
			it('should parse media type', () => {
				const css = '@media screen { }'
				const ast = parse(css)
				const atRule = ast.first_child!

				expect(atRule?.type).toBe(AT_RULE)
				expect(atRule?.name).toBe('media')

				// Should have prelude children
				const children = atRule.prelude?.children || []
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
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children[0].type).toBe(MEDIA_QUERY)

				// Query should have a media feature child
				const queryChildren = children[0].children
				expect(queryChildren.some((c) => c.type === MEDIA_FEATURE)).toBe(true)

				// Feature should have content
				const feature = queryChildren.find((c) => c.type === MEDIA_FEATURE)
				expect(feature?.name).toBe('min-width')
			})

			it('should trim whitespace and comments from media features', () => {
				const css = '@media (/* comment */   min-width: 768px   /* test */) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []
				const queryChildren = children[0].children
				const feature = queryChildren.find((c) => c.type === MEDIA_FEATURE)

				expect(feature?.name).toBe('min-width')
			})

			it('should parse complex media query with and operator', () => {
				const css = '@media screen and (min-width: 768px) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

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
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				const queryChildren = children[0].children
				const features = queryChildren.filter((c) => c.type === MEDIA_FEATURE)
				expect(features.length).toBe(2)
			})

			it('should extract feature name from standard feature', () => {
				const css = '@media (orientation: portrait) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const queryChildren = atRule.prelude?.children[0].children || []
				const feature = queryChildren.find((c) => c.type === MEDIA_FEATURE)

				expect(feature?.name).toBe('orientation')
				expect(feature?.children.length).toBe(1)
				expect(feature?.children[0].type).toBe(IDENTIFIER)
			})

			it('should extract feature name from boolean feature', () => {
				const css = '@media (hover) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const queryChildren = atRule.prelude?.children[0].children || []
				const feature = queryChildren.find((c) => c.type === MEDIA_FEATURE)

				expect(feature?.name).toBe('hover')
			})

			it('should parse feature values as typed children', () => {
				const css = '@media (min-width: 768px) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const queryChildren = atRule.prelude?.children[0].children || []
				const feature = queryChildren.find((c) => c.type === MEDIA_FEATURE)

				expect(feature?.name).toBe('min-width')
				expect(feature?.children.length).toBe(1)
				expect(feature?.children[0].type).toBe(DIMENSION)
			})

			it('should parse identifier value as child', () => {
				const css = '@media (orientation: portrait) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const queryChildren = atRule.prelude?.children[0].children || []
				const feature = queryChildren.find((c) => c.type === MEDIA_FEATURE)

				expect(feature?.children.length).toBe(1)
				expect(feature?.children[0].type).toBe(IDENTIFIER)
				expect(feature?.children[0].text).toBe('portrait')
			})

			it('should have no children for boolean features', () => {
				const css = '@media (hover) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const queryChildren = atRule.prelude?.children[0].children || []
				const feature = queryChildren.find((c) => c.type === MEDIA_FEATURE)

				expect(feature?.children.length).toBe(0)
			})

			it('should parse range syntax with single comparison', () => {
				const css = '@media (width >= 400px) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const queryChildren = atRule.prelude?.children[0].children || []
				const range = queryChildren.find((c) => c.type === FEATURE_RANGE)

				expect(range?.type).toBe(FEATURE_RANGE)
				expect(range?.name).toBe('width')
				expect(range?.children.length).toBe(2) // dimension + operator

				// Verify child types
				expect(range?.children[0].type).toBe(PRELUDE_OPERATOR) // >=
				expect(range?.children[1].type).toBe(DIMENSION) // 400px
			})

			it('should parse range syntax with double comparison', () => {
				const css = '@media (50px <= width <= 100px) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const queryChildren = atRule.prelude?.children[0].children || []
				const range = queryChildren.find((c) => c.type === FEATURE_RANGE)

				expect(range?.type).toBe(FEATURE_RANGE)
				expect(range?.name).toBe('width')
				expect(range?.children.length).toBe(4) // dim, op, op, dim

				// Verify child types
				expect(range?.children[0].type).toBe(DIMENSION) // 50px
				expect(range?.children[1].type).toBe(PRELUDE_OPERATOR) // <=
				expect(range?.children[2].type).toBe(PRELUDE_OPERATOR) // <=
				expect(range?.children[3].type).toBe(DIMENSION) // 100px
			})

			it('should parse range syntax with less-than', () => {
				const css = '@media (400px < width) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const queryChildren = atRule.prelude?.children[0].children || []
				const range = queryChildren.find((c) => c.type === FEATURE_RANGE)

				expect(range?.type).toBe(FEATURE_RANGE)
				expect(range?.name).toBe('width')
				expect(range?.children.length).toBe(2)

				// Verify child types
				expect(range?.children[0].type).toBe(DIMENSION) // 400px
				expect(range?.children[1].type).toBe(PRELUDE_OPERATOR) // <
			})

			it('should parse range syntax with equals', () => {
				const css = '@media (width = 500px) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const queryChildren = atRule.prelude?.children[0].children || []
				const range = queryChildren.find((c) => c.type === FEATURE_RANGE)

				expect(range?.type).toBe(FEATURE_RANGE)
				expect(range?.name).toBe('width')
				expect(range?.children.length).toBe(2)

				// Verify child types
				expect(range?.children[0].type).toBe(PRELUDE_OPERATOR) // =
				expect(range?.children[1].type).toBe(DIMENSION) // 500px
			})

			it('should parse comma-separated media queries', () => {
				const css = '@media screen, print { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				// Should have 2 media query nodes
				const queries = children.filter((c) => c.type === MEDIA_QUERY)
				expect(queries.length).toBe(2)
				const [screen, print] = queries
				expect(screen.type_name).toBe('MediaQuery')
				expect(screen.text).toBe('screen')
				expect(print.type_name).toBe('MediaQuery')
				expect(print.text).toBe('print')
			})
		})

		describe('@container', () => {
			it('should parse unnamed container query', () => {
				const css = '@container (min-width: 400px) { }'
				const ast = parse(css)
				const atRule = ast.first_child!

				expect(atRule?.type).toBe(AT_RULE)
				expect(atRule?.name).toBe('container')

				const children = atRule.prelude?.children || []
				expect(children.length).toBeGreaterThan(0)
				expect(children[0].type).toBe(CONTAINER_QUERY)
			})

			it('should parse named container query', () => {
				const css = '@container sidebar (min-width: 400px) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children[0].type).toBe(CONTAINER_QUERY)

				const [ident, media_feature] = children[0].children
				// Should have name and feature
				expect(ident.type).toBe(IDENTIFIER)
				expect(media_feature.type).toBe(MEDIA_FEATURE)
			})

			it('should parse style container query', () => {
				const css = '@container style(--custom: 1) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children[0].type).toBe(CONTAINER_QUERY)

				const [fn] = children[0].children
				expect(fn.type_name).toBe('Function')
				expect(fn.text).toBe('style(--custom: 1)')
				expect(fn.value).toBe('--custom: 1')
			})

			it('should parse named style container query', () => {
				const css = '@container mytest style(--custom: 1) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children[0].type).toBe(CONTAINER_QUERY)

				const [ident, fn] = children[0].children
				expect(ident.type_name).toBe('Identifier')
				expect(ident.text).toBe('mytest')
				expect(fn.type_name).toBe('Function')
				expect(fn.text).toBe('style(--custom: 1)')
				expect(fn.value).toBe('--custom: 1')
			})

			it('should handle a very complex container query', () => {
				const css = `@container style(--themeBackground),
						not style(background-color: red),
						style(color: green) and style(background-color: transparent),
						style(--themeColor: blue) or style(--themeColor: purple) {
					/* <stylesheet> */
				}`
				const ast = parse(css)
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []
				expect(children[0].type).toBe(CONTAINER_QUERY)

				const container = children[0]
				const [style1, not1, style2, style3, and, style4, style5, or, style6] = container.children
				expect(style1.type_name).toBe('Function')
				expect(style1.name).toBe('style')
				expect(not1.type_name).toBe('Operator')
				expect(not1.text).toBe('not')
				expect(style2.type_name).toBe('Function')
				expect(style2.name).toBe('style')
				expect(style3.type_name).toBe('Function')
				expect(style3.name).toBe('style')
				expect(and.type_name).toBe('Operator')
				expect(and.text).toBe('and')
				expect(style4.type_name).toBe('Function')
				expect(style4.name).toBe('style')
				expect(style5.type_name).toBe('Function')
				expect(style5.name).toBe('style')
				expect(or.type_name).toBe('Operator')
				expect(or.text).toBe('or')
				expect(style6.type_name).toBe('Function')
				expect(style6.name).toBe('style')
			})
		})

		describe('@supports', () => {
			it('should parse single feature query', () => {
				const css = '@supports (display: flex) { }'
				const ast = parse(css)
				const atRule = ast.first_child!

				expect(atRule?.type).toBe(AT_RULE)
				expect(atRule?.name).toBe('supports')

				const children = atRule.prelude?.children || []
				expect(children.some((c) => c.type === SUPPORTS_QUERY)).toBe(true)

				const query = children.find((c) => c.type === SUPPORTS_QUERY)
				expect(query?.value).toContain('display: flex')
			})

			it('should trim whitespace and comments from supports queries', () => {
				const css = '@supports (/* comment */   display: flex   /* test */) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []
				const query = children.find((c) => c.type === SUPPORTS_QUERY)

				expect(query?.value).toBe('display: flex')
			})

			it('should parse complex supports query with operators', () => {
				const css = '@supports (display: flex) and (gap: 1rem) { }'
				const ast = parse(css)
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

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
				const atRule = ast.first_child!

				expect(atRule?.type).toBe(AT_RULE)
				expect(atRule?.name).toBe('layer')

				// Filter out block node to get only prelude children
				const children = atRule.prelude?.children.filter((c) => c.type !== BLOCK) || []
				expect(children.length).toBe(1)
				expect(children[0].type).toBe(LAYER_NAME)
				expect(children[0].type_name).toBe('Layer')
				expect(children[0].text).toBe('base')
				expect(children[0].value).toBe('base')
			})

			it('should parse comma-separated layer names', () => {
				const css = '@layer base, components, utilities;'
				const ast = parse(css)
				const atRule = ast.first_child!

				const children = atRule.prelude?.children || []
				expect(children.length).toBe(3)

				expect(children[0].type).toBe(LAYER_NAME)
				expect(children[0].text).toBe('base')
				expect(children[0].value).toBe('base')

				expect(children[1].type).toBe(LAYER_NAME)
				expect(children[1].text).toBe('components')
				expect(children[1].value).toBe('components')

				expect(children[2].type).toBe(LAYER_NAME)
				expect(children[2].text).toBe('utilities')
				expect(children[2].value).toBe('utilities')
			})
		})

		describe('@keyframes', () => {
			it('should parse keyframe name', () => {
				const css = '@keyframes slidein { }'
				const ast = parse(css)
				const atRule = ast.first_child!

				expect(atRule?.type).toBe(AT_RULE)
				expect(atRule?.name).toBe('keyframes')

				// Filter out block node to get only prelude children
				const children = atRule.prelude?.children.filter((c) => c.type !== BLOCK) || []
				expect(children.length).toBe(1)
				expect(children[0].type).toBe(IDENTIFIER)
				expect(children[0].text).toBe('slidein')
			})
		})

		describe('@property', () => {
			it('should parse custom property name', () => {
				const css = '@property --my-color { }'
				const ast = parse(css)
				const atRule = ast.first_child!

				expect(atRule?.type).toBe(AT_RULE)
				expect(atRule?.name).toBe('property')

				// Filter out block node to get only prelude children
				const children = atRule.prelude?.children.filter((c) => c.type !== BLOCK) || []
				expect(children.length).toBe(1)
				expect(children[0].type).toBe(IDENTIFIER)
				expect(children[0].text).toBe('--my-color')
			})
		})

		describe('vendor-prefixed at-rules', () => {
			it('should parse @-webkit-keyframes same as @keyframes', () => {
				const css = '@-webkit-keyframes slidein { }'
				const ast = parse(css)
				const atRule = ast.first_child!

				expect(atRule?.type).toBe(AT_RULE)
				expect(atRule?.name).toBe('-webkit-keyframes')
				expect(atRule?.is_vendor_prefixed).toBe(true)

				// Should have identifier prelude like @keyframes
				const children = atRule.prelude?.children.filter((c) => c.type !== BLOCK) || []
				expect(children.length).toBe(1)
				expect(children[0].type).toBe(IDENTIFIER)
				expect(children[0].text).toBe('slidein')
			})

			it('should parse @-moz-keyframes same as @keyframes', () => {
				const css = '@-moz-keyframes fadein { }'
				const ast = parse(css)
				const atRule = ast.first_child!

				expect(atRule?.type).toBe(AT_RULE)
				expect(atRule?.name).toBe('-moz-keyframes')
				expect(atRule?.is_vendor_prefixed).toBe(true)

				const children = atRule.prelude?.children.filter((c) => c.type !== BLOCK) || []
				expect(children.length).toBe(1)
				expect(children[0].type).toBe(IDENTIFIER)
				expect(children[0].text).toBe('fadein')
			})

			it('should parse @-o-keyframes same as @keyframes', () => {
				const css = '@-o-keyframes rotate { }'
				const ast = parse(css)
				const atRule = ast.first_child!

				expect(atRule?.type).toBe(AT_RULE)
				expect(atRule?.name).toBe('-o-keyframes')
				expect(atRule?.is_vendor_prefixed).toBe(true)

				const children = atRule.prelude?.children.filter((c) => c.type !== BLOCK) || []
				expect(children.length).toBe(1)
				expect(children[0].type).toBe(IDENTIFIER)
				expect(children[0].text).toBe('rotate')
			})

			it('should parse @-webkit-supports same as @supports', () => {
				const css = '@-webkit-supports (display: flex) { }'
				const ast = parse(css)
				const atRule = ast.first_child!

				expect(atRule?.type).toBe(AT_RULE)
				expect(atRule?.name).toBe('-webkit-supports')
				expect(atRule?.is_vendor_prefixed).toBe(true)

				const children = atRule.prelude?.children || []
				expect(children.length).toBeGreaterThan(0)
				expect(children[0].type).toBe(SUPPORTS_QUERY)
			})

			it('should parse @-moz-supports same as @supports', () => {
				const css = '@-moz-supports (display: grid) { }'
				const ast = parse(css)
				const atRule = ast.first_child!

				expect(atRule?.type).toBe(AT_RULE)
				expect(atRule?.name).toBe('-moz-supports')
				expect(atRule?.is_vendor_prefixed).toBe(true)

				const children = atRule.prelude?.children || []
				expect(children.length).toBeGreaterThan(0)
				expect(children[0].type).toBe(SUPPORTS_QUERY)
			})
		})

		describe('@font-face', () => {
			it('should have no prelude children', () => {
				const css = '@font-face { font-family: "MyFont"; }'
				const ast = parse(css)
				const atRule = ast.first_child!

				expect(atRule?.type).toBe(AT_RULE)
				expect(atRule?.name).toBe('font-face')

				// @font-face has no prelude, children should be declarations
				const children = atRule.prelude?.children || []
				if (children.length > 0) {
					// If parse_values is enabled, there might be declaration children
					expect(children[0].type).not.toBe(IDENTIFIER)
				}
			})
		})

		describe('parse_atrule_preludes option', () => {
			it('should parse preludes when enabled (default)', () => {
				const css = '@media screen { }'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.some((c) => c.type === MEDIA_QUERY)).toBe(true)
			})

			it('should not parse preludes when disabled', () => {
				const css = '@media screen { }'
				const ast = parse(css, { parse_atrule_preludes: false })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.some((c) => c.type === MEDIA_QUERY)).toBe(false)
			})
		})

		describe('Prelude text access', () => {
			it('should preserve prelude text in at-rule node', () => {
				const css = '@media screen and (min-width: 768px) { }'
				const ast = parse(css)
				const atRule = ast.first_child!

				// The prelude text should still be accessible
				expect(atRule?.prelude?.text).toBe('screen and (min-width: 768px)')
			})
		})

		describe('@import', () => {
			it('should parse URL with url() function', () => {
				const css = '@import url("styles.css");'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.length).toBeGreaterThan(0)
				expect(children[0].type).toBe(URL)
				expect(children[0].text).toBe('url("styles.css")')
			})

			it('should parse URL with string', () => {
				const css = '@import "styles.css";'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.length).toBeGreaterThan(0)
				expect(children[0].type).toBe(URL)
				expect(children[0].text).toBe('"styles.css"')
			})

			it('should have .value property for URL with quoted url() function', () => {
				const css = '@import url("example.com");'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const url = atRule.prelude?.children[0]

				expect(url?.type).toBe(URL)
				expect(url?.text).toBe('url("example.com")')
				// URL node in @import returns the content with quotes
				expect(url?.value).toBe('"example.com"')
			})

			it('should have .value property for URL with quoted string', () => {
				const css = '@import "example.com";'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const url = atRule.prelude?.children[0]

				expect(url?.type).toBe(URL)
				expect(url?.text).toBe('"example.com"')
				// URL node in @import returns the string with quotes
				expect(url?.value).toBe('"example.com"')
			})

			it('should parse with anonymous layer', () => {
				const css = '@import url("styles.css") layer;'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.length).toBe(2)
				expect(children[0].type).toBe(URL)
				expect(children[1].type).toBe(LAYER_NAME)
				expect(children[1].text).toBe('layer')
				expect(children[1].name).toBe('')
			})

			it('should parse with anonymous LAYER', () => {
				const css = '@import url("styles.css") LAYER;'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.length).toBe(2)
				expect(children[0].type).toBe(URL)
				expect(children[1].type).toBe(LAYER_NAME)
				expect(children[1].text).toBe('LAYER')
				expect(children[1].name).toBe('')
			})

			it('should parse with named layer', () => {
				const css = '@import url("styles.css") layer(utilities);'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.length).toBe(2)
				expect(children[0].type).toBe(URL)
				expect(children[1].type).toBe(LAYER_NAME)
				expect(children[1].text).toBe('layer(utilities)')
				expect(children[1].name).toBe('utilities')
			})

			it('should trim whitespace from layer names', () => {
				const css = '@import url("styles.css") layer(   utilities   );'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children[1].type).toBe(LAYER_NAME)
				expect(children[1].name).toBe('utilities')
			})

			it('should trim comments from layer names', () => {
				const css = '@import url("styles.css") layer(/* comment */utilities/* test */);'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children[1].type).toBe(LAYER_NAME)
				expect(children[1].name).toBe('utilities')
			})

			it('should trim whitespace and comments from dotted layer names', () => {
				const css = '@import url("foo.css") layer(/* test */named.nested     );'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children[1].type).toBe(LAYER_NAME)
				expect(children[1].name).toBe('named.nested')
			})

			it('should parse with supports query', () => {
				const css = '@import url("styles.css") supports(display: grid);'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.length).toBe(2)
				expect(children[0].type).toBe(URL)
				expect(children[1].type).toBe(SUPPORTS_QUERY)
				expect(children[1].text).toBe('supports(display: grid)')
			})

			it('should parse with media query', () => {
				const css = '@import url("styles.css") screen;'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.length).toBe(2)
				expect(children[0].type).toBe(URL)
				expect(children[1].type).toBe(MEDIA_QUERY)
			})

			it('should parse with media feature', () => {
				const css = '@import url("styles.css") (min-width: 768px);'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.length).toBe(2)
				expect(children[0].type).toBe(URL)
				expect(children[1].type).toBe(MEDIA_QUERY)
				expect(children[1].text).toBe('(min-width: 768px)')
			})

			it('should parse with combined media query', () => {
				const css = '@import url("styles.css") screen and (min-width: 768px);'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.length).toBe(2)
				expect(children[0].type).toBe(URL)
				expect(children[1].type).toBe(MEDIA_QUERY)
			})

			it('should parse with layer and media query', () => {
				const css = '@import url("styles.css") layer(base) screen;'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.length).toBe(3)
				expect(children[0].type).toBe(URL)
				expect(children[1].type).toBe(LAYER_NAME)
				expect(children[1].text).toBe('layer(base)')
				expect(children[1].value).toBe('base')
				expect(children[1].name).toBe('base')
				expect(children[2].type).toBe(MEDIA_QUERY)
			})

			it('should parse with layer and supports', () => {
				const css = '@import url("styles.css") layer(base) supports(display: grid);'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.length).toBe(3)
				expect(children[0].type).toBe(URL)
				expect(children[0].value).toBe('"styles.css"')
				expect(children[1].type).toBe(LAYER_NAME)
				expect(children[1].value).toBe('base')
				expect(children[1].name).toBe('base')
				expect(children[2].type).toBe(SUPPORTS_QUERY)
				expect(children[2].value).toBe('display: grid')
				expect(children[2].text).toBe('supports(display: grid)')
			})

			it('should parse with supports and media query', () => {
				const css = '@import url("styles.css") supports(display: grid) screen;'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.length).toBe(3)
				expect(children[0].type).toBe(URL)
				expect(children[1].type).toBe(SUPPORTS_QUERY)
				expect(children[2].type).toBe(MEDIA_QUERY)
			})

			it('should parse with all features combined', () => {
				const css = '@import url("styles.css") layer(base) supports(display: grid) screen and (min-width: 768px);'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.length).toBe(4)
				expect(children[0].type).toBe(URL)
				expect(children[1].type).toBe(LAYER_NAME)
				expect(children[2].type).toBe(SUPPORTS_QUERY)
				expect(children[3].type).toBe(MEDIA_QUERY)
			})

			it('should parse with complex supports condition', () => {
				const css = '@import url("styles.css") supports((display: grid) and (gap: 1rem));'
				const ast = parse(css, { parse_atrule_preludes: true })
				const atRule = ast.first_child!
				const children = atRule.prelude?.children || []

				expect(children.length).toBe(2)
				expect(children[0].type).toBe(URL)
				expect(children[1].type).toBe(SUPPORTS_QUERY)
				expect(children[1].text).toBe('supports((display: grid) and (gap: 1rem))')
				expect(children[1].value).toBe('(display: grid) and (gap: 1rem)')
			})

			it('should preserve prelude text', () => {
				const css = '@import url("styles.css") layer(base) screen;'
				const ast = parse(css)
				const atRule = ast.first_child!

				expect(atRule?.prelude?.text).toBe('url("styles.css") layer(base) screen')
			})

			it('should parse unquoted URL that contains ;', () => {
				const url = `https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,800;0,900;1,800&family=Roboto+Condensed:ital,wght@0,400;0,500;0,700;1,700&family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,300;1,400;1,500;1,700;1,900&display=swap`
				const css = `@import url(${url});`
				const ast = parse(css)
				const atRule = ast.first_child!

				// Prelude text should not include trailing semicolon
				expect.soft(atRule.prelude?.text).toBe(`url(${url})`)
				const url_node = atRule.prelude?.first_child
				expect(url_node).not.toBeNull()
				expect.soft(url_node?.type_name).toBe('Url')
				expect.soft(url_node?.value).toBe(url)
			})
		})

		describe('Length property correctness (regression tests for commit 5c6e2cd)', () => {
			describe('At-rule prelude length', () => {
				test('@media prelude length should match text', () => {
					const css = '@media screen { }'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('screen')
					expect(atRule?.prelude?.length).toBe(6)
				})

				test('@media with feature prelude length', () => {
					const css = '@media (min-width: 768px) { }'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('(min-width: 768px)')
					expect(atRule?.prelude?.length).toBe(18)
				})

				test('@media complex prelude length', () => {
					const css = '@media screen and (min-width: 768px) { }'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('screen and (min-width: 768px)')
					expect(atRule?.prelude?.length).toBe(29)
				})

				test('@container prelude length', () => {
					const css = '@container (min-width: 768px) { }'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('(min-width: 768px)')
					expect(atRule?.prelude?.length).toBe(18)
				})

				test('@container with name prelude length', () => {
					const css = '@container sidebar (min-width: 400px) { }'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('sidebar (min-width: 400px)')
					expect(atRule?.prelude?.length).toBe(26)
				})

				test('@supports prelude length', () => {
					const css = '@supports (display: flex) { }'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('(display: flex)')
					expect(atRule?.prelude?.length).toBe(15)
				})

				test('@supports complex prelude length', () => {
					const css = '@supports (display: flex) and (color: red) { }'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('(display: flex) and (color: red)')
					expect(atRule?.prelude?.length).toBe(32)
				})

				test('@layer single name prelude length', () => {
					const css = '@layer utilities { }'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('utilities')
					expect(atRule?.prelude?.length).toBe(9)
				})

				test('@layer multiple names prelude length', () => {
					const css = '@layer base, components, utilities { }'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('base, components, utilities')
					expect(atRule?.prelude?.length).toBe(27)
				})

				test('@import url prelude length', () => {
					const css = '@import url("styles.css") screen;'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('url("styles.css") screen')
					expect(atRule?.prelude?.length).toBe(24)
				})

				test('@import with layer prelude length', () => {
					const css = '@import "styles.css" layer(utilities);'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('"styles.css" layer(utilities)')
					expect(atRule?.prelude?.length).toBe(29)
				})

				test('@import with supports prelude length', () => {
					const css = '@import url("styles.css") supports(display: flex);'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('url("styles.css") supports(display: flex)')
					expect(atRule?.prelude?.length).toBe(41)
				})

				test('@import complex prelude length', () => {
					const css = '@import url("a.css") layer(utilities) supports(display: flex) screen;'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('url("a.css") layer(utilities) supports(display: flex) screen')
					expect(atRule?.prelude?.length).toBe(60)
				})
			})

			describe('Prelude child node text length', () => {
				test('media query node text length', () => {
					const css = '@media screen and (min-width: 768px) { }'
					const ast = parse(css)
					const atRule = ast.first_child!
					const children = atRule.prelude?.children || []

					// First child should be media query
					const mediaQuery = children[0]
					expect(mediaQuery.type).toBe(MEDIA_QUERY)
					expect(mediaQuery.text).toBe('screen and (min-width: 768px)')
					expect(mediaQuery.text.length).toBe(29)
				})

				test('media type node text length', () => {
					const css = '@media screen { }'
					const ast = parse(css)
					const atRule = ast.first_child!
					const children = atRule.prelude?.children || []
					const mediaQuery = children[0]
					const queryChildren = mediaQuery?.children || []

					const mediaType = queryChildren.find((c) => c.type === MEDIA_TYPE)
					expect(mediaType?.text).toBe('screen')
					expect(mediaType?.text.length).toBe(6)
				})

				test('media feature node text length', () => {
					const css = '@media (min-width: 768px) { }'
					const ast = parse(css)
					const atRule = ast.first_child!
					const children = atRule.prelude?.children || []
					const mediaQuery = children[0]
					const queryChildren = mediaQuery?.children || []

					const mediaFeature = queryChildren.find((c) => c.type === MEDIA_FEATURE)
					expect(mediaFeature?.text).toBe('(min-width: 768px)')
					expect(mediaFeature?.text.length).toBe(18)
				})

				test('container query node text length', () => {
					const css = '@container sidebar (min-width: 400px) { }'
					const ast = parse(css)
					const atRule = ast.first_child!
					const children = atRule.prelude?.children || []

					const containerQuery = children.find((c) => c.type === CONTAINER_QUERY)
					expect(containerQuery?.text).toBe('sidebar (min-width: 400px)')
					expect(containerQuery?.text.length).toBe(26)
				})

				test('supports query node text length', () => {
					const css = '@supports (display: flex) { }'
					const ast = parse(css)
					const atRule = ast.first_child!
					const children = atRule.prelude?.children || []

					const supportsQuery = children.find((c) => c.type === SUPPORTS_QUERY)
					expect(supportsQuery?.text).toBe('(display: flex)')
					expect(supportsQuery?.text.length).toBe(15)
				})

				test('layer name node text length', () => {
					const css = '@layer utilities { }'
					const ast = parse(css)
					const atRule = ast.first_child!
					const children = atRule.prelude?.children || []

					const layerName = children.find((c) => c.type === LAYER_NAME)
					expect(layerName?.text).toBe('utilities')
					expect(layerName?.text.length).toBe(9)
				})

				test('import url node text length', () => {
					const css = '@import url("styles.css") screen;'
					const ast = parse(css)
					const atRule = ast.first_child!
					const children = atRule.prelude?.children || []

					const importUrl = children.find((c) => c.type === URL)
					expect(importUrl?.text).toBe('url("styles.css")')
					expect(importUrl?.text.length).toBe(17)
				})

				test('import layer node text length', () => {
					const css = '@import "styles.css" layer(utilities);'
					const ast = parse(css)
					const atRule = ast.first_child!
					const children = atRule.prelude?.children || []

					const importLayer = children.find((c) => c.type === LAYER_NAME)
					expect(importLayer?.text).toBe('layer(utilities)')
					expect(importLayer?.text.length).toBe(16)
				})

				test('import supports node text length', () => {
					const css = '@import url("a.css") supports(display: flex);'
					const ast = parse(css)
					const atRule = ast.first_child!
					const children = atRule.prelude?.children || []

					const importSupports = children.find((c) => c.type === SUPPORTS_QUERY)
					expect(importSupports?.text).toBe('supports(display: flex)')
					expect(importSupports?.text.length).toBe(23)
				})

				test('operator node text length', () => {
					const css = '@media screen and (min-width: 768px) { }'
					const ast = parse(css)
					const atRule = ast.first_child!
					const children = atRule.prelude?.children || []
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
					const atRule = ast.first_child!

					// Whitespace is trimmed from start/end but preserved internally
					expect(atRule?.prelude?.text).toBe('screen   and   (min-width: 768px)')
					expect(atRule?.prelude?.length).toBe(33)
				})

				test('@layer with whitespace around commas', () => {
					const css = '@layer base , components , utilities { }'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('base , components , utilities')
					expect(atRule?.prelude?.length).toBe(29)
				})

				test('@import with newlines prelude length', () => {
					const css = '@import url("styles.css")\n  screen;'
					const ast = parse(css)
					const atRule = ast.first_child!

					expect(atRule?.prelude?.text).toBe('url("styles.css")\n  screen')
					expect(atRule?.prelude?.length).toBe(26)
				})
			})
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
			expect(result[0].type).toBe(IDENTIFIER)
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
			expect(result[0].type).toBe(IDENTIFIER)
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
})

describe('Case-insensitive at-rule keywords', () => {
	it('should parse @MEDIA with uppercase', () => {
		const root = parse('@MEDIA (min-width: 768px) { body { color: red; } }')
		const atrule = root.first_child
		expect(atrule?.name).toBe('MEDIA')
	})

	it('should parse @Media with mixed case', () => {
		const root = parse('@Media (min-width: 768px) { body { color: red; } }')
		const atrule = root.first_child
		expect(atrule?.name).toBe('Media')
	})

	it('should parse @IMPORT with uppercase', () => {
		const root = parse('@IMPORT url("style.css");')
		const atrule = root.first_child
		expect(atrule?.name).toBe('IMPORT')
	})

	it('should parse @SUPPORTS with uppercase', () => {
		const root = parse('@SUPPORTS (display: grid) { body { display: grid; } }')
		const atrule = root.first_child
		expect(atrule?.name).toBe('SUPPORTS')
	})

	it('should parse @LAYER with uppercase', () => {
		const root = parse('@LAYER base { }')
		const atrule = root.first_child
		expect(atrule?.name).toBe('LAYER')
	})

	it('should parse @CONTAINER with uppercase', () => {
		const root = parse('@CONTAINER (min-width: 400px) { }')
		const atrule = root.first_child
		expect(atrule?.name).toBe('CONTAINER')
	})

	it('should parse media query operators in uppercase', () => {
		const root = parse('@media (min-width: 768px) AND (max-width: 1024px) { }')
		const atrule = root.first_child
		expect(atrule?.name).toBe('media')
		// Verify the prelude was parsed (operators are case-insensitive)
		expect(atrule?.children.length).toBeGreaterThan(0)
	})

	it('should parse OR operator in uppercase', () => {
		const root = parse('@supports (display: grid) OR (display: flex) { }')
		const atrule = root.first_child
		expect(atrule?.name).toBe('supports')
		expect(atrule?.children.length).toBeGreaterThan(0)
	})

	it('should parse NOT operator in uppercase', () => {
		const root = parse('@supports NOT (display: grid) { }')
		const atrule = root.first_child
		expect(atrule?.name).toBe('supports')
		expect(atrule?.children.length).toBeGreaterThan(0)
	})
})

describe('Comment Handling in At-Rule Preludes', () => {
	describe('@media queries with comments', () => {
		it('should parse media query with comment before screen', () => {
			const root = parse('@media /* comment */ screen { }')
			const atrule = root.first_child
			expect(atrule?.name).toBe('media')
			const mediaQuery = atrule?.prelude?.first_child
			expect(mediaQuery?.type).toBe(MEDIA_QUERY)
			// Should find the media type
			const mediaType = mediaQuery?.first_child
			expect(mediaType?.type).toBe(MEDIA_TYPE)
			expect(mediaType?.text).toBe('screen')
		})

		it('should parse media query with comment in media feature', () => {
			const root = parse('@media (/* comment */ min-width: 768px) { }')
			const atrule = root.first_child
			expect(atrule?.name).toBe('media')
			const mediaQuery = atrule?.prelude?.first_child
			expect(mediaQuery?.type).toBe(MEDIA_QUERY)
			const mediaFeature = mediaQuery?.first_child
			expect(mediaFeature?.type).toBe(MEDIA_FEATURE)
			expect(mediaFeature?.property).toBe('min-width')
		})

		it('should parse media feature with comment around colon', () => {
			const root = parse('@media (min-width /* comment */ : /* comment */ 768px) { }')
			const atrule = root.first_child
			const mediaFeature = atrule?.prelude?.first_child?.first_child
			expect(mediaFeature?.type).toBe(MEDIA_FEATURE)
			expect(mediaFeature?.property).toBe('min-width')
		})

		it('should parse media query list with comments between queries', () => {
			const root = parse('@media screen /* comment */ , /* comment */ print { }')
			const atrule = root.first_child
			expect(atrule?.name).toBe('media')
			const prelude = atrule?.prelude
			expect(prelude?.children.length).toBe(2)
		})

		it('should parse media feature range with comments around operators', () => {
			const root = parse('@media (/* comment */ 400px /* comment */ <= /* comment */ width) { }')
			const atrule = root.first_child
			const mediaQuery = atrule?.prelude?.first_child
			const featureRange = mediaQuery?.first_child
			expect(featureRange?.type).toBe(FEATURE_RANGE)
		})

		it('should not match operators inside comments in media features', () => {
			const root = parse('@media (/* < */ width: 400px) { }')
			const atrule = root.first_child
			const mediaFeature = atrule?.prelude?.first_child?.first_child
			expect(mediaFeature?.type).toBe(MEDIA_FEATURE) // Should be MEDIA_FEATURE, not FEATURE_RANGE
			expect(mediaFeature?.property).toBe('width')
		})
	})

	describe('@container queries with comments', () => {
		it('should parse container query with comment before feature', () => {
			const root = parse('@container /* comment */ (min-width: 400px) { }')
			const atrule = root.first_child
			expect(atrule?.name).toBe('container')
			const containerQuery = atrule?.prelude?.first_child
			expect(containerQuery?.type).toBe(CONTAINER_QUERY)
		})
	})

	describe('@supports queries with comments', () => {
		it('should parse supports query with comment in feature', () => {
			const root = parse('@supports (/* comment */ display: grid) { }')
			const atrule = root.first_child
			expect(atrule?.name).toBe('supports')
			const supportsQuery = atrule?.prelude?.first_child
			expect(supportsQuery?.type).toBe(SUPPORTS_QUERY)
		})

		it('should parse supports with comments between queries', () => {
			const root = parse('@supports (display: grid) /* comment */ or /* comment */ (display: flex) { }')
			const atrule = root.first_child
			expect(atrule?.name).toBe('supports')
			expect(atrule?.prelude?.children.length).toBeGreaterThan(0)
		})
	})

	describe('@layer with comments', () => {
		it('should parse layer names with comments between them', () => {
			const root = parse('@layer foo /* comment */ , /* comment */ bar { }')
			const atrule = root.first_child
			expect(atrule?.name).toBe('layer')
			const prelude = atrule?.prelude
			expect(prelude?.children.length).toBe(2)
			const [layer1, layer2] = prelude?.children || []
			expect(layer1?.type).toBe(LAYER_NAME)
			expect(layer1?.value).toBe('foo')
			expect(layer2?.type).toBe(LAYER_NAME)
			expect(layer2?.value).toBe('bar')
		})
	})

	describe('@import with comments', () => {
		it('should parse import with comment before URL', () => {
			const root = parse('@import /* comment */ "styles.css";')
			const atrule = root.first_child
			expect(atrule?.name).toBe('import')
			expect(atrule?.prelude?.children.length).toBeGreaterThan(0)
		})

		it('should parse import with comment before layer', () => {
			const root = parse('@import "styles.css" /* comment */ layer(base);')
			const atrule = root.first_child
			expect(atrule?.name).toBe('import')
			expect(atrule?.prelude?.children.length).toBeGreaterThan(0)
		})
	})

	describe('@keyframes with comments', () => {
		it('should parse keyframes name with comment before it', () => {
			const root = parse('@keyframes /* comment */ slidein { }')
			const atrule = root.first_child
			expect(atrule?.name).toBe('keyframes')
			const identifier = atrule?.prelude?.first_child
			expect(identifier?.type).toBe(IDENTIFIER)
			expect(identifier?.text).toBe('slidein')
		})
	})

	describe('Multiline comments', () => {
		it('should handle multiline comments in @media queries', () => {
			const root = parse(`@media screen
/* comment
with
newlines */
and (min-width: 768px) { }`)
			const atrule = root.first_child
			expect(atrule?.name).toBe('media')
			const mediaQuery = atrule?.prelude?.first_child
			expect(mediaQuery?.type).toBe(MEDIA_QUERY)
			// Should still parse the media feature after the multiline comment
			expect(mediaQuery?.children.length).toBeGreaterThan(0)
		})
	})
})
