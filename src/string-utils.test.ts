import { describe, it, expect } from 'vitest'
import {
	is_whitespace,
	str_equals,
	str_starts_with,
	str_index_of,
	is_vendor_prefixed,
	is_custom,
	CHAR_SPACE,
	CHAR_TAB,
	CHAR_NEWLINE,
	CHAR_CARRIAGE_RETURN,
	CHAR_FORM_FEED,
} from './string-utils'
import { trim_boundaries } from './parse-utils'

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

	describe('str_starts_with', () => {
		it('should match identical prefix', () => {
			expect(str_starts_with('url(', 'url(')).toBe(true)
		})

		it('should match longer string with lowercase prefix', () => {
			expect(str_starts_with('url(image.png)', 'url(')).toBe(true)
		})

		it('should match uppercase string with lowercase prefix', () => {
			expect(str_starts_with('URL(image.png)', 'url(')).toBe(true)
		})

		it('should match mixed case string with lowercase prefix', () => {
			expect(str_starts_with('Url(image.png)', 'url(')).toBe(true)
			expect(str_starts_with('uRL(image.png)', 'url(')).toBe(true)
		})

		it('should not match when string is shorter than prefix', () => {
			expect(str_starts_with('url', 'url(')).toBe(false)
		})

		it('should not match different prefix', () => {
			expect(str_starts_with('src(image.png)', 'url(')).toBe(false)
		})

		it('should not match when prefix does not start string', () => {
			expect(str_starts_with('image url()', 'url(')).toBe(false)
		})

		it('should work with function names for CSS parsing', () => {
			expect(str_starts_with('CALC(1px + 2px)', 'calc')).toBe(true)
			expect(str_starts_with('RGB(255, 0, 0)', 'rgb')).toBe(true)
			expect(str_starts_with('RGBA(255, 0, 0, 0.5)', 'rgba')).toBe(true)
		})

		it('should work with pseudo-class functions', () => {
			expect(str_starts_with('NTH-CHILD(2n)', 'nth-child')).toBe(true)
			expect(str_starts_with('LANG(en, fr)', 'lang')).toBe(true)
			expect(str_starts_with('HAS(> article)', 'has')).toBe(true)
		})

		it('should handle empty prefix', () => {
			expect(str_starts_with('anything', '')).toBe(true)
		})

		it('should handle empty string', () => {
			expect(str_starts_with('', 'url(')).toBe(false)
		})

		it('should handle empty both', () => {
			expect(str_starts_with('', '')).toBe(true)
		})

		it('should be case-insensitive only on string side', () => {
			// Prefix MUST be lowercase
			expect(str_starts_with('URL(', 'url(')).toBe(true)
			expect(str_starts_with('url(', 'url(')).toBe(true)
			// The function doesn't normalize the prefix, so uppercase prefix won't match
			expect(str_starts_with('url(', 'URL(')).toBe(false)
		})
	})

	describe('is_vendor_prefixed', () => {
		it('should detect -webkit- vendor prefix', () => {
			const source = '-webkit-transform'
			expect(is_vendor_prefixed(source, 0, source.length)).toBe(true)
		})

		it('should detect -moz- vendor prefix', () => {
			const source = '-moz-appearance'
			expect(is_vendor_prefixed(source, 0, source.length)).toBe(true)
		})

		it('should detect -ms- vendor prefix', () => {
			const source = '-ms-filter'
			expect(is_vendor_prefixed(source, 0, source.length)).toBe(true)
		})

		it('should detect -o- vendor prefix', () => {
			const source = '-o-transform'
			expect(is_vendor_prefixed(source, 0, source.length)).toBe(true)
		})

		it('should detect vendor prefix with complex property names', () => {
			const source = '-webkit-border-top-left-radius'
			expect(is_vendor_prefixed(source, 0, source.length)).toBe(true)
		})

		it('should detect vendor prefix in substring', () => {
			const source = 'div { -webkit-transform: scale(1); }'
			expect(is_vendor_prefixed(source, 6, 23)).toBe(true)
		})

		it('should not detect vendor prefix for CSS custom properties', () => {
			const source = '--custom-property'
			expect(is_vendor_prefixed(source, 0, source.length)).toBe(false)
		})

		it('should not detect vendor prefix for standard properties', () => {
			const source = 'transform'
			expect(is_vendor_prefixed(source, 0, source.length)).toBe(false)
		})

		it('should not detect vendor prefix for properties with hyphens', () => {
			const source = 'border-radius'
			expect(is_vendor_prefixed(source, 0, source.length)).toBe(false)
		})

		it('should not detect vendor prefix for properties starting with hyphen but too short', () => {
			const source = '-x'
			expect(is_vendor_prefixed(source, 0, source.length)).toBe(false)
		})

		it('should not detect vendor prefix without second hyphen', () => {
			const source = '-webkit'
			expect(is_vendor_prefixed(source, 0, source.length)).toBe(false)
		})

		it('should not detect vendor prefix when second hyphen is outside range', () => {
			const source = '-webkit-transform'
			// Only check "-webkit" without the trailing hyphen
			expect(is_vendor_prefixed(source, 0, 7)).toBe(false)
		})

		it('should detect vendor prefix for pseudo-classes', () => {
			const source = '-webkit-autofill'
			expect(is_vendor_prefixed(source, 0, source.length)).toBe(true)
		})

		it('should detect vendor prefix for pseudo-elements', () => {
			const source = '-webkit-scrollbar'
			expect(is_vendor_prefixed(source, 0, source.length)).toBe(true)
		})

		it('should detect vendor prefix with minimal length (-o-)', () => {
			const source = '-o-'
			expect(is_vendor_prefixed(source, 0, source.length)).toBe(true)
		})

		it('should work with various offsets', () => {
			const source = 'prefix-webkit-suffix-rest'
			expect(is_vendor_prefixed(source, 6, 20)).toBe(true) // "-webkit-suffix"
		})
	})

	describe('is_custom', () => {
		it('should detect custom property with --', () => {
			expect(is_custom('--primary-color')).toBe(true)
		})

		it('should detect another custom property', () => {
			expect(is_custom('--my-var')).toBe(true)
		})

		it('should detect shortest valid custom property', () => {
			expect(is_custom('--x')).toBe(true)
		})

		it('should not detect exactly two hyphens', () => {
			expect(is_custom('--')).toBe(false)
		})

		it('should not detect vendor prefix as custom', () => {
			expect(is_custom('-webkit-transform')).toBe(false)
		})

		it('should not detect -moz- vendor prefix as custom', () => {
			expect(is_custom('-moz-appearance')).toBe(false)
		})

		it('should not detect standard property with hyphen as custom', () => {
			expect(is_custom('border-radius')).toBe(false)
		})

		it('should not detect standard property as custom', () => {
			expect(is_custom('color')).toBe(false)
		})

		it('should not detect single hyphen as custom', () => {
			expect(is_custom('-')).toBe(false)
		})

		it('should not detect empty string as custom', () => {
			expect(is_custom('')).toBe(false)
		})

		it('should not detect single character as custom', () => {
			expect(is_custom('a')).toBe(false)
		})
	})
})

	describe('str_index_of', () => {
		it('should find single character in string', () => {
			expect(str_index_of('hello', 'e')).toBe(1)
		})

		it('should find character case-insensitively', () => {
			expect(str_index_of('HELLO', 'e')).toBe(1)
			expect(str_index_of('Hello', 'e')).toBe(1)
		})

		it('should return -1 for character not found', () => {
			expect(str_index_of('hello', 'x')).toBe(-1)
		})

		it('should find first occurrence', () => {
			expect(str_index_of('hello', 'l')).toBe(2)
		})

		it('should find multi-character substring', () => {
			expect(str_index_of('2n+1', 'n')).toBe(1)
			expect(str_index_of('2N+1', 'n')).toBe(1)
		})

		it('should find multi-character substring case-insensitively', () => {
			expect(str_index_of('HELLO', 'lo')).toBe(3)
			expect(str_index_of('Hello', 'lo')).toBe(3)
		})

		it('should return -1 for substring not found', () => {
			expect(str_index_of('hello', 'xyz')).toBe(-1)
		})

		it('should work with An+B patterns', () => {
			expect(str_index_of('2n', 'n')).toBe(1)
			expect(str_index_of('2N', 'n')).toBe(1)
			expect(str_index_of('-5n-2', 'n')).toBe(2)
			expect(str_index_of('-5N-2', 'n')).toBe(2)
		})

		it('should handle empty search string', () => {
			expect(str_index_of('hello', '')).toBe(-1)
		})

		it('should find at string start', () => {
			expect(str_index_of('hello', 'h')).toBe(0)
			expect(str_index_of('HELLO', 'h')).toBe(0)
		})

		it('should find at string end', () => {
			expect(str_index_of('hello', 'o')).toBe(4)
			expect(str_index_of('HELLO', 'o')).toBe(4)
		})

		it('should find exact match', () => {
			expect(str_index_of('n', 'n')).toBe(0)
			expect(str_index_of('N', 'n')).toBe(0)
		})
	})
