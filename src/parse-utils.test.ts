import { describe, it, expect } from 'vitest'
import {
	skip_whitespace_forward,
	skip_whitespace_and_comments_forward,
	skip_whitespace_and_comments_backward,
	trim_boundaries,
	parse_dimension,
} from './parse-utils'

describe('skip_whitespace_forward', () => {
	it('should skip single space', () => {
		const source = ' abc'
		expect(skip_whitespace_forward(source, 0, source.length)).toBe(1)
	})

	it('should skip multiple spaces', () => {
		const source = '    abc'
		expect(skip_whitespace_forward(source, 0, source.length)).toBe(4)
	})

	it('should skip tabs', () => {
		const source = '\t\tabc'
		expect(skip_whitespace_forward(source, 0, source.length)).toBe(2)
	})

	it('should skip newlines', () => {
		const source = '\n\nabc'
		expect(skip_whitespace_forward(source, 0, source.length)).toBe(2)
	})

	it('should skip mixed whitespace', () => {
		const source = ' \t\n\r\fabc'
		expect(skip_whitespace_forward(source, 0, source.length)).toBe(5)
	})

	it('should return same position if no whitespace', () => {
		const source = 'abc'
		expect(skip_whitespace_forward(source, 0, source.length)).toBe(0)
	})

	it('should respect end boundary', () => {
		const source = '    abc    def'
		expect(skip_whitespace_forward(source, 0, 5)).toBe(4)
	})

	it('should not skip comments (whitespace only)', () => {
		const source = ' /* comment */ abc'
		expect(skip_whitespace_forward(source, 0, source.length)).toBe(1)
	})

	it('should skip from middle position', () => {
		const source = 'abc   def'
		expect(skip_whitespace_forward(source, 3, source.length)).toBe(6)
	})
})

describe('skip_whitespace_and_comments_forward', () => {
	it('should skip whitespace only', () => {
		const source = '   abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(3)
	})

	it('should skip single comment', () => {
		const source = '/* comment */abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(13)
	})

	it('should skip whitespace and comment', () => {
		const source = '  /* comment */  abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(17)
	})

	it('should skip multiple comments', () => {
		const source = '/* a *//* b */abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(14)
	})

	it('should skip comments with whitespace between', () => {
		const source = '/* a */  /* b */  abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(18)
	})

	it('should handle comment at end boundary', () => {
		const source = '/* comment */abc'
		expect(skip_whitespace_and_comments_forward(source, 0, 13)).toBe(13)
	})

	it('should handle unterminated comment at boundary', () => {
		const source = '/* comment'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(10)
	})

	it('should handle comment with asterisks', () => {
		const source = '/* ** *** */abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(12)
	})

	it('should handle comment with slashes', () => {
		const source = '/* // /* */abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(11)
	})

	it('should not skip incomplete comment start', () => {
		const source = '/ abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(0)
	})

	it('should skip from middle position', () => {
		const source = 'abc  /* x */  def'
		expect(skip_whitespace_and_comments_forward(source, 3, source.length)).toBe(14)
	})

	it('should handle nested comment markers (CSS comments dont nest)', () => {
		const source = '/* /* inner */ outer */abc'
		// CSS comments don't nest, so first */ ends the comment
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(15)
	})
})

describe('skip_whitespace_and_comments_backward', () => {
	it('should skip whitespace only', () => {
		const source = 'abc   '
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(3)
	})

	it('should skip single comment', () => {
		const source = 'abc/* comment */'
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(3)
	})

	it('should skip whitespace and comment', () => {
		const source = 'abc  /* comment */  '
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(3)
	})

	it('should skip multiple comments', () => {
		const source = 'abc/* a *//* b */'
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(3)
	})

	it('should skip comments with whitespace between', () => {
		const source = 'abc  /* a */  /* b */  '
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(3)
	})

	it('should handle comment at start boundary', () => {
		const source = '/* comment */abc'
		// When skipping backward from end, it skips 'abc', not the comment at position 13
		expect(skip_whitespace_and_comments_backward(source, source.length, 13)).toBe(16)
	})

	it('should handle unterminated comment at boundary', () => {
		const source = 'comment */'
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(0)
	})

	it('should handle comment with asterisks', () => {
		const source = 'abc/* ** *** */'
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(3)
	})

	it('should not skip incomplete comment end', () => {
		const source = 'abc /'
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(5)
	})

	it('should skip from middle position', () => {
		const source = 'abc  /* x */  def'
		expect(skip_whitespace_and_comments_backward(source, 13, 0)).toBe(3)
	})

	it('should respect start boundary', () => {
		const source = '   /* x */   abc   '
		expect(skip_whitespace_and_comments_backward(source, source.length, 13)).toBe(16)
	})
})

describe('trim_boundaries', () => {
	it('should trim whitespace from both ends', () => {
		const source = '   abc   '
		const result = trim_boundaries(source, 0, source.length)
		expect(result).toEqual([3, 6])
	})

	it('should trim comments from both ends', () => {
		const source = '/* a */abc/* b */'
		const result = trim_boundaries(source, 0, source.length)
		expect(result).toEqual([7, 10])
	})

	it('should trim whitespace and comments', () => {
		const source = '  /* a */  abc  /* b */  '
		const result = trim_boundaries(source, 0, source.length)
		expect(result).toEqual([11, 14])
	})

	it('should return null for all whitespace', () => {
		const source = '     '
		expect(trim_boundaries(source, 0, source.length)).toBe(null)
	})

	it('should return null for all comments', () => {
		const source = '/* comment */'
		expect(trim_boundaries(source, 0, source.length)).toBe(null)
	})

	it('should return null for whitespace and comments', () => {
		const source = '  /* a */  /* b */  '
		expect(trim_boundaries(source, 0, source.length)).toBe(null)
	})

	it('should handle no trimming needed', () => {
		const source = 'abc'
		const result = trim_boundaries(source, 0, source.length)
		expect(result).toEqual([0, 3])
	})

	it('should work with substring range', () => {
		const source = 'xxx  abc  xxx'
		const result = trim_boundaries(source, 3, 10)
		expect(result).toEqual([5, 8])
	})

	it('should handle empty string', () => {
		const source = ''
		expect(trim_boundaries(source, 0, 0)).toBe(null)
	})
})

describe('parse_dimension', () => {
	it('should parse integer with unit', () => {
		expect(parse_dimension('100px')).toEqual({ value: 100, unit: 'px' })
	})

	it('should parse float with unit', () => {
		expect(parse_dimension('1.5em')).toEqual({ value: 1.5, unit: 'em' })
	})

	it('should parse percentage', () => {
		expect(parse_dimension('50%')).toEqual({ value: 50, unit: '%' })
	})

	it('should parse negative value', () => {
		expect(parse_dimension('-10rem')).toEqual({ value: -10, unit: 'rem' })
	})

	it('should parse positive value with sign', () => {
		expect(parse_dimension('+5px')).toEqual({ value: 5, unit: 'px' })
	})

	it('should parse value with decimal point', () => {
		expect(parse_dimension('0.5em')).toEqual({ value: 0.5, unit: 'em' })
	})

	it('should parse scientific notation', () => {
		expect(parse_dimension('1e2px')).toEqual({ value: 100, unit: 'px' })
	})

	it('should parse scientific notation with positive exponent', () => {
		expect(parse_dimension('1e+2px')).toEqual({ value: 100, unit: 'px' })
	})

	it('should parse scientific notation with negative exponent', () => {
		expect(parse_dimension('1e-2px')).toEqual({ value: 0.01, unit: 'px' })
	})

	it('should parse uppercase E scientific notation', () => {
		expect(parse_dimension('1E2px')).toEqual({ value: 100, unit: 'px' })
	})

	it('should handle no unit', () => {
		expect(parse_dimension('100')).toEqual({ value: 100, unit: '' })
	})

	it('should handle zero', () => {
		expect(parse_dimension('0')).toEqual({ value: 0, unit: '' })
	})

	it('should handle zero with unit', () => {
		expect(parse_dimension('0px')).toEqual({ value: 0, unit: 'px' })
	})

	it('should handle fractional value starting with dot', () => {
		expect(parse_dimension('.5em')).toEqual({ value: 0.5, unit: 'em' })
	})

	it('should handle long unit name', () => {
		expect(parse_dimension('100vmax')).toEqual({ value: 100, unit: 'vmax' })
	})

	it('should handle invalid scientific notation (e not followed by digit)', () => {
		expect(parse_dimension('1epx')).toEqual({ value: 1, unit: 'epx' })
	})

	it('should handle multiple decimal points', () => {
		// parseFloat stops after first complete number, so numEnd continues past the period
		expect(parse_dimension('1.2.3px')).toEqual({ value: 1.2, unit: 'px' })
	})

	it('should handle empty string', () => {
		expect(parse_dimension('')).toEqual({ value: 0, unit: '' })
	})
})
