import { describe, test, expect } from 'vitest'
import { Lexer } from './lexer'
import {
	TOKEN_IDENT,
	TOKEN_FUNCTION,
	TOKEN_AT_KEYWORD,
	TOKEN_HASH,
	TOKEN_STRING,
	TOKEN_BAD_STRING,
	TOKEN_NUMBER,
	TOKEN_PERCENTAGE,
	TOKEN_DIMENSION,
	TOKEN_WHITESPACE,
	TOKEN_CDO,
	TOKEN_CDC,
	TOKEN_COLON,
	TOKEN_SEMICOLON,
	TOKEN_COMMA,
	TOKEN_LEFT_BRACKET,
	TOKEN_RIGHT_BRACKET,
	TOKEN_LEFT_PAREN,
	TOKEN_RIGHT_PAREN,
	TOKEN_LEFT_BRACE,
	TOKEN_RIGHT_BRACE,
	TOKEN_COMMENT,
	TOKEN_DELIM,
	TOKEN_EOF,
} from './token-types'

describe('Lexer', () => {
	describe('single-character tokens', () => {
		test('should tokenize braces', () => {
			let lexer = new Lexer('{')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_LEFT_BRACE)
			expect(token?.start).toBe(0)
			expect(token?.end).toBe(1)

			lexer = new Lexer('}')
			token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_RIGHT_BRACE)
		})

		test('should tokenize colon and semicolon', () => {
			let lexer = new Lexer(':')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_COLON)

			lexer = new Lexer(';')
			token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_SEMICOLON)
		})

		test('should tokenize comma', () => {
			let lexer = new Lexer(',')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_COMMA)
		})

		test('should tokenize brackets', () => {
			let lexer = new Lexer('[')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_LEFT_BRACKET)

			lexer = new Lexer(']')
			token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_RIGHT_BRACKET)
		})

		test('should tokenize parentheses', () => {
			let lexer = new Lexer('(')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_LEFT_PAREN)

			lexer = new Lexer(')')
			token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_RIGHT_PAREN)
		})
	})

	describe('whitespace', () => {
		test('should tokenize spaces', () => {
			let lexer = new Lexer('   ')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_WHITESPACE)
			expect(token!.end - token!.start).toBe(3)
		})

		test('should tokenize tabs', () => {
			let lexer = new Lexer('\t\t')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_WHITESPACE)
		})

		test('should tokenize newlines', () => {
			let lexer = new Lexer('\n\r\n')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_WHITESPACE)
			expect(lexer.line).toBe(3)
		})

		test('should track line', () => {
			let lexer = new Lexer('a\nb')
			let token = lexer.next_token() // a
			expect(token?.line).toBe(1)

			lexer.next_token() // \n
			token = lexer.next_token() // b
			expect(token?.line).toBe(2)
		})
	})

	describe('comments', () => {
		test('should tokenize comments', () => {
			let lexer = new Lexer('/* comment */')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_COMMENT)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('/* comment */')
		})

		test('should tokenize unclosed comments', () => {
			let lexer = new Lexer('/* unclosed')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_COMMENT)
		})

		test('should track lines in comments', () => {
			let lexer = new Lexer('/* line1\nline2 */')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_COMMENT)
			expect(lexer.line).toBe(2)
		})
	})

	describe('strings', () => {
		test('should tokenize double-quoted strings', () => {
			let lexer = new Lexer('"hello"')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_STRING)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('"hello"')
		})

		test('should tokenize single-quoted strings', () => {
			let lexer = new Lexer("'hello'")
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_STRING)
		})

		test('should handle escaped quotes', () => {
			let lexer = new Lexer('"hello \\"world\\""')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_STRING)
		})

		test('should handle hex escapes', () => {
			let lexer = new Lexer('"\\20\\000020"')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_STRING)
		})

		test('should handle escaped newlines', () => {
			let lexer = new Lexer('"line\\\ncontinued"')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_STRING)
		})

		test('should mark unclosed strings as bad', () => {
			let lexer = new Lexer('"unclosed\n')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_BAD_STRING)
		})

		test('should mark EOF unclosed strings as bad', () => {
			let lexer = new Lexer('"unclosed')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_BAD_STRING)
		})
	})

	describe('numbers', () => {
		test('should tokenize integers', () => {
			let lexer = new Lexer('123')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_NUMBER)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('123')
		})

		test('should tokenize decimals', () => {
			let lexer = new Lexer('123.456')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_NUMBER)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('123.456')
		})

		test('should tokenize decimals starting with dot', () => {
			let lexer = new Lexer('.5')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_NUMBER)
		})

		test('should tokenize signed numbers', () => {
			let lexer = new Lexer('+10')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_NUMBER)

			lexer = new Lexer('-10')
			token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_NUMBER)
		})

		test('should tokenize scientific notation', () => {
			let lexer = new Lexer('1e10')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_NUMBER)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('1e10')

			lexer = new Lexer('1.5e-10')
			token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_NUMBER)
		})
	})

	describe('percentages', () => {
		test('should tokenize percentages', () => {
			let lexer = new Lexer('50%')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_PERCENTAGE)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('50%')
		})

		test('should tokenize negative percentages', () => {
			let lexer = new Lexer('-50%')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_PERCENTAGE)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('-50%')
		})

		test('should tokenize positive percentages', () => {
			let lexer = new Lexer('+50%')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_PERCENTAGE)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('+50%')
		})

		test('should tokenize fraction percentages', () => {
			let lexer = new Lexer('+5.5%')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_PERCENTAGE)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('+5.5%')
		})

		test('should tokenize scientific fraction percentages', () => {
			let lexer = new Lexer('+5.2e-10%')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_PERCENTAGE)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('+5.2e-10%')
		})
	})

	describe('dimensions', () => {
		test('should tokenize pixel dimensions', () => {
			let lexer = new Lexer('10px')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_DIMENSION)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('10px')
		})

		test('should tokenize various units', () => {
			const units = ['em', 'rem', 'vh', 'vw', 'ch', 'ex', 'cm', 'mm', 'in', 'pt', 'pc']
			for (let unit of units) {
				let lexer = new Lexer(`10${unit}`)
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_DIMENSION)
			}
		})
	})

	describe('identifiers', () => {
		test('should tokenize identifiers', () => {
			let lexer = new Lexer('color')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_IDENT)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('color')
		})

		test('should tokenize vendor prefixes', () => {
			let lexer = new Lexer('-webkit-transform')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_IDENT)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('-webkit-transform')
		})

		test('should tokenize CSS custom properties (variables)', () => {
			let lexer = new Lexer('--test')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_IDENT)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('--test')

			// Test in context: a{--custom-prop:1}
			lexer = new Lexer('a{--custom-prop:1}')
			let tokens = []
			while (true) {
				let t = lexer.next_token()
				if (!t || t.type === TOKEN_EOF) break
				tokens.push(t)
			}

			// Should be: a { --custom-prop : 1 }
			expect(tokens.length).toBe(6)
			expect(tokens[0].type).toBe(TOKEN_IDENT) // a
			expect(tokens[1].type).toBe(TOKEN_LEFT_BRACE) // {
			expect(tokens[2].type).toBe(TOKEN_IDENT) // --custom-prop (single token!)
			expect(tokens[2].start).toBe(2)
			expect(tokens[2].end).toBe(15)
			expect(lexer.source.slice(tokens[2].start, tokens[2].end)).toBe('--custom-prop')
			expect(tokens[3].type).toBe(TOKEN_COLON) // :
			expect(tokens[4].type).toBe(TOKEN_NUMBER) // 1
			expect(tokens[5].type).toBe(TOKEN_RIGHT_BRACE) // }
		})

		test('should tokenize identifiers with underscores', () => {
			let lexer = new Lexer('_private')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_IDENT)
		})

		test('should tokenize identifiers with digits', () => {
			let lexer = new Lexer('grid2')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_IDENT)
		})

		describe('escape sequences', () => {
			test('should handle hex escape sequences', () => {
				// \32 = character code 0x32 (the digit '2')
				let lexer = new Lexer('\\32xl')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('\\32xl')
			})

			test('should handle character escape sequences', () => {
				// \: = escaped colon
				let lexer = new Lexer('\\:ease-in')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('\\:ease-in')
			})

			test('should handle combined escape sequences (Tailwind CSS)', () => {
				// This is the exact case from the bug report: .\\32xl\\:ease-in{}
				// Should tokenize as: DELIM(.) + IDENT(\32xl\:ease-in) + LEFT_BRACE + RIGHT_BRACE
				let lexer = new Lexer('.\\32xl\\:ease-in{}')
				let tokens = []
				while (true) {
					let t = lexer.next_token()
					if (!t || t.type === TOKEN_EOF) break
					tokens.push(t)
				}

				expect(tokens.length).toBe(4)
				expect(tokens[0].type).toBe(TOKEN_DELIM) // .
				expect(tokens[1].type).toBe(TOKEN_IDENT) // \32xl\:ease-in (single token!)
				expect(lexer.source.slice(tokens[1].start, tokens[1].end)).toBe('\\32xl\\:ease-in')
				expect(tokens[2].type).toBe(TOKEN_LEFT_BRACE) // {
				expect(tokens[3].type).toBe(TOKEN_RIGHT_BRACE) // }
			})

			test('should handle whitespace after hex escapes', () => {
				// Per CSS spec, hex escapes can be followed by optional whitespace
				// \32 xl = character 0x32 followed by 'xl'
				let lexer = new Lexer('\\32 xl')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('\\32 xl')
			})

			test('should handle 6-digit hex escapes', () => {
				// Maximum 6 hex digits per escape
				let lexer = new Lexer('\\000032xl')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('\\000032xl')
			})

			test('should handle multiple escapes in sequence', () => {
				let lexer = new Lexer('\\32\\33\\34')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('\\32\\33\\34')
			})

			test('should handle escape at start of identifier', () => {
				let lexer = new Lexer('\\:hover')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('\\:hover')
			})

			test('should handle escape at end of identifier', () => {
				let lexer = new Lexer('ease-in\\:')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('ease-in\\:')
			})

			test('should stop at newline after backslash', () => {
				// Backslash followed by newline is invalid in identifier
				let lexer = new Lexer('test\\\nmore')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('test')
			})

			test('should handle escapes in functions', () => {
				let lexer = new Lexer('\\32xl\\:fn(')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_FUNCTION)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('\\32xl\\:fn(')
			})
		})
	})

	describe('functions', () => {
		test('should tokenize functions', () => {
			let lexer = new Lexer('rgb(')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_FUNCTION)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('rgb(')
		})

		test('should tokenize vendor-prefixed functions', () => {
			let lexer = new Lexer('-webkit-calc(')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_FUNCTION)
		})
	})

	describe('at-keywords', () => {
		test('should tokenize @media', () => {
			let lexer = new Lexer('@media')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_AT_KEYWORD)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('@media')
		})

		test('should tokenize @keyframes', () => {
			let lexer = new Lexer('@keyframes')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_AT_KEYWORD)
		})

		test('should tokenize @-webkitkeyframes', () => {
			let lexer = new Lexer('@-webkitkeyframes')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_AT_KEYWORD)
		})
	})

	describe('hash', () => {
		test('should tokenize hash colors', () => {
			let lexer = new Lexer('#fff')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_HASH)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('#fff')
		})

		test('should tokenize hash IDs', () => {
			let lexer = new Lexer('#main-content')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_HASH)
		})
	})

	describe('CDO/CDC', () => {
		test('should tokenize CDO', () => {
			let lexer = new Lexer('<!--')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_CDO)
		})

		test('should tokenize CDC', () => {
			let lexer = new Lexer('-->')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_CDC)
		})
	})

	describe('delimiters', () => {
		test('should tokenize unknown characters as delimiters', () => {
			let lexer = new Lexer('~')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_DELIM)
		})

		test('should tokenize + as delimiter when not part of number', () => {
			let lexer = new Lexer('+ ')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_DELIM)
		})
	})

	describe('EOF', () => {
		test('should return EOF token at end', () => {
			let lexer = new Lexer('a')
			lexer.next_token() // a
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_EOF)
		})
	})

	describe('real CSS', () => {
		test('should tokenize a CSS rule', () => {
			let lexer = new Lexer('.class { color: red; }')
			let tokens = []
			let token
			while ((token = lexer.next_token()) && token.type !== TOKEN_EOF) {
				tokens.push(token.type)
			}
			expect(tokens).toEqual([
				TOKEN_DELIM, // .
				TOKEN_IDENT, // class
				TOKEN_WHITESPACE,
				TOKEN_LEFT_BRACE,
				TOKEN_WHITESPACE,
				TOKEN_IDENT, // color
				TOKEN_COLON,
				TOKEN_WHITESPACE,
				TOKEN_IDENT, // red
				TOKEN_SEMICOLON,
				TOKEN_WHITESPACE,
				TOKEN_RIGHT_BRACE,
			])
		})

		test('should tokenize declaration with number and unit', () => {
			let lexer = new Lexer('width: 100px')
			let tokens = []
			let token
			while ((token = lexer.next_token()) && token.type !== TOKEN_EOF) {
				if (token.type !== TOKEN_WHITESPACE) {
					tokens.push(token.type)
				}
			}
			expect(tokens).toEqual([TOKEN_IDENT, TOKEN_COLON, TOKEN_DIMENSION])
		})
	})

	describe('column tracking', () => {
		test('should track column for single line tokens', () => {
			let lexer = new Lexer('body { color: red; }')
			let token

			token = lexer.next_token() // 'body'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(1)

			token = lexer.next_token() // whitespace
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(5)

			token = lexer.next_token() // '{'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(6)

			token = lexer.next_token() // whitespace
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(7)

			token = lexer.next_token() // 'color'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(8)
		})

		test('should track column across multiple lines', () => {
			let lexer = new Lexer('body {\n  color: red;\n}')
			let token

			token = lexer.next_token() // 'body'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(1)

			token = lexer.next_token() // whitespace
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(5)

			token = lexer.next_token() // '{'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(6)

			token = lexer.next_token() // '\n  '
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(7)

			token = lexer.next_token() // 'color'
			expect(token?.line).toBe(2)
			expect(token?.column).toBe(3)

			token = lexer.next_token() // ':'
			expect(token?.line).toBe(2)
			expect(token?.column).toBe(8)
		})

		test('should reset column to 1 after newline', () => {
			let lexer = new Lexer('a\nb')
			let token

			token = lexer.next_token() // 'a'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(1)

			token = lexer.next_token() // '\n'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(2)

			token = lexer.next_token() // 'b'
			expect(token?.line).toBe(2)
			expect(token?.column).toBe(1)
		})

		test('should track column for multi-character tokens', () => {
			let lexer = new Lexer('font-size: 16px;')
			let token

			token = lexer.next_token() // 'font-size'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(1)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('font-size')

			token = lexer.next_token() // ':'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(10)

			token = lexer.next_token() // ' '
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(11)

			token = lexer.next_token() // '16px'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(12)
		})

		test('should track column for strings', () => {
			let lexer = new Lexer('content: "hello world";')
			let token

			token = lexer.next_token() // 'content'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(1)

			token = lexer.next_token() // ':'
			token = lexer.next_token() // ' '

			token = lexer.next_token() // '"hello world"'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(10)
			expect(token?.type).toBe(TOKEN_STRING)
		})

		test('should track column for comments', () => {
			let lexer = new Lexer('/* comment */ body', false)
			let token

			token = lexer.next_token() // '/* comment */'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(1)
			expect(token?.type).toBe(TOKEN_COMMENT)

			token = lexer.next_token() // ' '
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(14)
		})

		test('should track column for multi-line comments', () => {
			let lexer = new Lexer('/* line1\nline2 */ a', false)
			let token

			token = lexer.next_token() // '/* line1\nline2 */'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(1)
			expect(token?.type).toBe(TOKEN_COMMENT)

			token = lexer.next_token() // ' '
			expect(token?.line).toBe(2)
			expect(token?.column).toBe(9)

			token = lexer.next_token() // 'a'
			expect(token?.line).toBe(2)
			expect(token?.column).toBe(10)
		})

		test('should track column for numbers with decimals', () => {
			let lexer = new Lexer('opacity: 0.5;')
			let token

			token = lexer.next_token() // 'opacity'
			expect(token?.column).toBe(1)

			token = lexer.next_token() // ':'
			token = lexer.next_token() // ' '

			token = lexer.next_token() // '0.5'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(10)
			expect(token?.type).toBe(TOKEN_NUMBER)
		})

		test('should track column for at-keywords', () => {
			let lexer = new Lexer('@media screen')
			let token

			token = lexer.next_token() // '@media'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(1)
			expect(token?.type).toBe(TOKEN_AT_KEYWORD)

			token = lexer.next_token() // ' '
			token = lexer.next_token() // 'screen'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(8)
		})

		test('should handle \\r\\n as single newline for column counting', () => {
			let lexer = new Lexer('a\r\nb')
			let token

			token = lexer.next_token() // 'a'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(1)

			token = lexer.next_token() // '\r\n'
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(2)

			token = lexer.next_token() // 'b'
			expect(token?.line).toBe(2)
			expect(token?.column).toBe(1)
		})
	})
})
