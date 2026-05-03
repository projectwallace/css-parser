import { describe, expect } from 'vitest'
import {
	skip_whitespace_forward,
	skip_whitespace_and_comments_forward,
	skip_whitespace_and_comments_backward,
	trim_boundaries,
} from './parse-utils'

describe('skip_whitespace_forward', () => {
	test('should skip single space', () => {
		const source = ' abc'
		expect(skip_whitespace_forward(source, 0, source.length)).toBe(1)
	})

	test('should skip multiple spaces', () => {
		const source = '    abc'
		expect(skip_whitespace_forward(source, 0, source.length)).toBe(4)
	})

	test('should skip tabs', () => {
		const source = '\t\tabc'
		expect(skip_whitespace_forward(source, 0, source.length)).toBe(2)
	})

	test('should skip newlines', () => {
		const source = '\n\nabc'
		expect(skip_whitespace_forward(source, 0, source.length)).toBe(2)
	})

	test('should skip mixed whitespace', () => {
		const source = ' \t\n\r\fabc'
		expect(skip_whitespace_forward(source, 0, source.length)).toBe(5)
	})

	test('should return same position if no whitespace', () => {
		const source = 'abc'
		expect(skip_whitespace_forward(source, 0, source.length)).toBe(0)
	})

	test('should respect end boundary', () => {
		const source = '    abc    def'
		expect(skip_whitespace_forward(source, 0, 5)).toBe(4)
	})

	test('should not skip comments (whitespace only)', () => {
		const source = ' /* comment */ abc'
		expect(skip_whitespace_forward(source, 0, source.length)).toBe(1)
	})

	test('should skip from middle position', () => {
		const source = 'abc   def'
		expect(skip_whitespace_forward(source, 3, source.length)).toBe(6)
	})
})

describe('skip_whitespace_and_comments_forward', () => {
	test('should skip whitespace only', () => {
		const source = '   abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(3)
	})

	test('should skip single comment', () => {
		const source = '/* comment */abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(13)
	})

	test('should skip whitespace and comment', () => {
		const source = '  /* comment */  abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(17)
	})

	test('should skip multiple comments', () => {
		const source = '/* a *//* b */abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(14)
	})

	test('should skip comments with whitespace between', () => {
		const source = '/* a */  /* b */  abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(18)
	})

	test('should handle comment at end boundary', () => {
		const source = '/* comment */abc'
		expect(skip_whitespace_and_comments_forward(source, 0, 13)).toBe(13)
	})

	test('should handle unterminated comment at boundary', () => {
		const source = '/* comment'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(10)
	})

	test('should handle comment with asterisks', () => {
		const source = '/* ** *** */abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(12)
	})

	test('should handle comment with slashes', () => {
		const source = '/* // /* */abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(11)
	})

	test('should not skip incomplete comment start', () => {
		const source = '/ abc'
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(0)
	})

	test('should skip from middle position', () => {
		const source = 'abc  /* x */  def'
		expect(skip_whitespace_and_comments_forward(source, 3, source.length)).toBe(14)
	})

	test('should handle nested comment markers (CSS comments dont nest)', () => {
		const source = '/* /* inner */ outer */abc'
		// CSS comments don't nest, so first */ ends the comment
		expect(skip_whitespace_and_comments_forward(source, 0, source.length)).toBe(15)
	})
})

describe('skip_whitespace_and_comments_backward', () => {
	test('should skip whitespace only', () => {
		const source = 'abc   '
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(3)
	})

	test('should skip single comment', () => {
		const source = 'abc/* comment */'
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(3)
	})

	test('should skip whitespace and comment', () => {
		const source = 'abc  /* comment */  '
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(3)
	})

	test('should skip multiple comments', () => {
		const source = 'abc/* a *//* b */'
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(3)
	})

	test('should skip comments with whitespace between', () => {
		const source = 'abc  /* a */  /* b */  '
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(3)
	})

	test('should handle comment at start boundary', () => {
		const source = '/* comment */abc'
		// When skipping backward from end, it skips 'abc', not the comment at position 13
		expect(skip_whitespace_and_comments_backward(source, source.length, 13)).toBe(16)
	})

	test('should handle unterminated comment at boundary', () => {
		const source = 'comment */'
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(0)
	})

	test('should handle comment with asterisks', () => {
		const source = 'abc/* ** *** */'
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(3)
	})

	test('should not skip incomplete comment end', () => {
		const source = 'abc /'
		expect(skip_whitespace_and_comments_backward(source, source.length, 0)).toBe(5)
	})

	test('should skip from middle position', () => {
		const source = 'abc  /* x */  def'
		expect(skip_whitespace_and_comments_backward(source, 13, 0)).toBe(3)
	})

	test('should respect start boundary', () => {
		const source = '   /* x */   abc   '
		expect(skip_whitespace_and_comments_backward(source, source.length, 13)).toBe(16)
	})
})

describe('trim_boundaries', () => {
	test('should trim whitespace from both ends', () => {
		const source = '   abc   '
		const result = trim_boundaries(source, 0, source.length)
		expect(result).toEqual([3, 6])
	})

	test('should trim comments from both ends', () => {
		const source = '/* a */abc/* b */'
		const result = trim_boundaries(source, 0, source.length)
		expect(result).toEqual([7, 10])
	})

	test('should trim whitespace and comments', () => {
		const source = '  /* a */  abc  /* b */  '
		const result = trim_boundaries(source, 0, source.length)
		expect(result).toEqual([11, 14])
	})

	test('should return null for all whitespace', () => {
		const source = '     '
		expect(trim_boundaries(source, 0, source.length)).toBe(null)
	})

	test('should return null for all comments', () => {
		const source = '/* comment */'
		expect(trim_boundaries(source, 0, source.length)).toBe(null)
	})

	test('should return null for whitespace and comments', () => {
		const source = '  /* a */  /* b */  '
		expect(trim_boundaries(source, 0, source.length)).toBe(null)
	})

	test('should handle no trimming needed', () => {
		const source = 'abc'
		const result = trim_boundaries(source, 0, source.length)
		expect(result).toEqual([0, 3])
	})

	test('should work with substring range', () => {
		const source = 'xxx  abc  xxx'
		const result = trim_boundaries(source, 3, 10)
		expect(result).toEqual([5, 8])
	})

	test('should handle empty string', () => {
		const source = ''
		expect(trim_boundaries(source, 0, 0)).toBe(null)
	})
})
