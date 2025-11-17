import { describe, it, expect } from 'vitest'
import { is_whitespace, trim_boundaries, str_equals, CHAR_SPACE, CHAR_TAB, CHAR_NEWLINE, CHAR_CARRIAGE_RETURN, CHAR_FORM_FEED } from './string-utils'

describe('string-utils', () => {
	describe('is_whitespace', () => {
		it('should identify space as whitespace', () => {
			expect(is_whitespace(CHAR_SPACE)).toBe(true)
		})

		it('should identify tab as whitespace', () => {
			expect(is_whitespace(CHAR_TAB)).toBe(true)
		})

		it('should identify newline as whitespace', () => {
			expect(is_whitespace(CHAR_NEWLINE)).toBe(true)
		})

		it('should identify carriage return as whitespace', () => {
			expect(is_whitespace(CHAR_CARRIAGE_RETURN)).toBe(true)
		})

		it('should identify form feed as whitespace', () => {
			expect(is_whitespace(CHAR_FORM_FEED)).toBe(true)
		})

		it('should not identify letters as whitespace', () => {
			expect(is_whitespace('a'.charCodeAt(0))).toBe(false)
			expect(is_whitespace('Z'.charCodeAt(0))).toBe(false)
		})

		it('should not identify digits as whitespace', () => {
			expect(is_whitespace('0'.charCodeAt(0))).toBe(false)
			expect(is_whitespace('9'.charCodeAt(0))).toBe(false)
		})

		it('should not identify special characters as whitespace', () => {
			expect(is_whitespace('.'.charCodeAt(0))).toBe(false)
			expect(is_whitespace(','.charCodeAt(0))).toBe(false)
			expect(is_whitespace(':'.charCodeAt(0))).toBe(false)
		})
	})

	describe('trim_boundaries', () => {
		it('should trim leading whitespace', () => {
			const source = '   content'
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toEqual([3, 10])
			expect(source.substring(result![0], result![1])).toBe('content')
		})

		it('should trim trailing whitespace', () => {
			const source = 'content   '
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toEqual([0, 7])
			expect(source.substring(result![0], result![1])).toBe('content')
		})

		it('should trim whitespace from both ends', () => {
			const source = '   content   '
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toEqual([3, 10])
			expect(source.substring(result![0], result![1])).toBe('content')
		})

		it('should trim leading comments', () => {
			const source = '/* comment */content'
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toEqual([13, 20])
			expect(source.substring(result![0], result![1])).toBe('content')
		})

		it('should trim trailing comments', () => {
			const source = 'content/* comment */'
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toEqual([0, 7])
			expect(source.substring(result![0], result![1])).toBe('content')
		})

		it('should trim comments from both ends', () => {
			const source = '/* start */content/* end */'
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toEqual([11, 18])
			expect(source.substring(result![0], result![1])).toBe('content')
		})

		it('should trim mixed whitespace and comments', () => {
			const source = '  /* comment */   content   /* test */  '
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toEqual([18, 25])
			expect(source.substring(result![0], result![1])).toBe('content')
		})

		it('should trim multiple comments', () => {
			const source = '/* a *//* b */content/* c *//* d */'
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toEqual([14, 21])
			expect(source.substring(result![0], result![1])).toBe('content')
		})

		it('should handle all types of whitespace', () => {
			const source = ' \t\n\r\fcontent \t\n\r\f'
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toEqual([5, 12])
			expect(source.substring(result![0], result![1])).toBe('content')
		})

		it('should return null for empty string', () => {
			const result = trim_boundaries('', 0, 0)
			expect(result).toBeNull()
		})

		it('should return null for only whitespace', () => {
			const source = '   \t\n   '
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toBeNull()
		})

		it('should return null for only comments', () => {
			const source = '/* comment *//* another */'
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toBeNull()
		})

		it('should return null for only whitespace and comments', () => {
			const source = '  /* comment */   /* test */  '
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toBeNull()
		})

		it('should work with partial ranges', () => {
			const source = 'before(  content  )after'
			const result = trim_boundaries(source, 7, 17)
			expect(result).toEqual([9, 16])
			expect(source.substring(result![0], result![1])).toBe('content')
		})

		it('should preserve internal whitespace', () => {
			const source = 'min-width: 768px'
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toEqual([0, 16])
			expect(source.substring(result![0], result![1])).toBe('min-width: 768px')
		})

		it('should preserve internal comments', () => {
			const source = 'min-/* comment */width'
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toEqual([0, 22])
			expect(source.substring(result![0], result![1])).toBe('min-/* comment */width')
		})

		it('should handle layer name case from issue', () => {
			const source = '/* test */named.nested     '
			const result = trim_boundaries(source, 0, source.length)
			expect(result).toEqual([10, 22])
			expect(source.substring(result![0], result![1])).toBe('named.nested')
		})
	})

	describe('str_equals', () => {
		it('should match identical strings', () => {
			expect(str_equals('media', 'media')).toBe(true)
		})

		it('should match with different case', () => {
			expect(str_equals('media', 'MEDIA')).toBe(true)
			expect(str_equals('media', 'Media')).toBe(true)
			expect(str_equals('media', 'MeDiA')).toBe(true)
		})

		it('should not match different strings', () => {
			expect(str_equals('media', 'layer')).toBe(false)
		})

		it('should not match different lengths', () => {
			expect(str_equals('media', 'medias')).toBe(false)
			expect(str_equals('media', 'med')).toBe(false)
		})

		it('should work with common at-rule names', () => {
			expect(str_equals('layer', 'LAYER')).toBe(true)
			expect(str_equals('supports', 'SUPPORTS')).toBe(true)
			expect(str_equals('container', 'CONTAINER')).toBe(true)
		})

		it('should work with operators', () => {
			expect(str_equals('and', 'AND')).toBe(true)
			expect(str_equals('or', 'OR')).toBe(true)
			expect(str_equals('not', 'NOT')).toBe(true)
		})

		it('should handle empty strings', () => {
			expect(str_equals('', '')).toBe(true)
		})
	})
})
