import { describe, test, expect } from 'vitest'
import { parse_atrule_prelude } from './parse-atrule-prelude'
import {
	NODE_PRELUDE_MEDIA_QUERY,
	NODE_PRELUDE_MEDIA_FEATURE,
	NODE_PRELUDE_IDENTIFIER,
	NODE_PRELUDE_SUPPORTS_QUERY,
	NODE_PRELUDE_LAYER_NAME,
} from './arena'

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
			expect(result[0].type).toBe(NODE_PRELUDE_LAYER_NAME)
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
			expect(result[0].type).toBe(NODE_PRELUDE_IDENTIFIER)
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
			expect(result[0].type).toBe(NODE_PRELUDE_IDENTIFIER)
			expect(result[0].text).toBe('--my-color')
		})
	})

	describe('empty and unsupported', () => {
		test('should handle empty prelude', () => {
			const result = parse_atrule_prelude('media', '')

			expect(result).toEqual([])
		})

		test('should handle unsupported at-rule', () => {
			const result = parse_atrule_prelude('import', 'url("styles.css")')

			// Currently not parsed, should return empty array
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
