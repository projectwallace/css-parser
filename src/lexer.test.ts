import { describe, it, expect } from 'vitest'
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
		it('should tokenize braces', () => {
			let lexer = new Lexer('{')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_LEFT_BRACE)
			expect(token?.start).toBe(0)
			expect(token?.end).toBe(1)

			lexer = new Lexer('}')
			token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_RIGHT_BRACE)
		})

		it('should tokenize colon and semicolon', () => {
			let lexer = new Lexer(':')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_COLON)

			lexer = new Lexer(';')
			token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_SEMICOLON)
		})

		it('should tokenize comma', () => {
			let lexer = new Lexer(',')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_COMMA)
		})

		it('should tokenize brackets', () => {
			let lexer = new Lexer('[')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_LEFT_BRACKET)

			lexer = new Lexer(']')
			token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_RIGHT_BRACKET)
		})

		it('should tokenize parentheses', () => {
			let lexer = new Lexer('(')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_LEFT_PAREN)

			lexer = new Lexer(')')
			token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_RIGHT_PAREN)
		})
	})

	describe('whitespace', () => {
		it('should tokenize spaces', () => {
			let lexer = new Lexer('   ')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_WHITESPACE)
			expect(token!.end - token!.start).toBe(3)
		})

		it('should tokenize tabs', () => {
			let lexer = new Lexer('\t\t')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_WHITESPACE)
		})

		it('should tokenize newlines', () => {
			let lexer = new Lexer('\n\r\n')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_WHITESPACE)
			expect(lexer.line).toBe(3)
		})

		it('should track line and column', () => {
			let lexer = new Lexer('a\nb')
			let token = lexer.next_token() // a
			expect(token?.line).toBe(1)
			expect(token?.column).toBe(1)

			lexer.next_token() // \n
			token = lexer.next_token() // b
			expect(token?.line).toBe(2)
			expect(token?.column).toBe(1)
		})
	})

	describe('comments', () => {
		it('should tokenize comments', () => {
			let lexer = new Lexer('/* comment */')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_COMMENT)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('/* comment */')
		})

		it('should tokenize unclosed comments', () => {
			let lexer = new Lexer('/* unclosed')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_COMMENT)
		})

		it('should track lines in comments', () => {
			let lexer = new Lexer('/* line1\nline2 */')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_COMMENT)
			expect(lexer.line).toBe(2)
		})
	})

	describe('strings', () => {
		it('should tokenize double-quoted strings', () => {
			let lexer = new Lexer('"hello"')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_STRING)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('"hello"')
		})

		it('should tokenize single-quoted strings', () => {
			let lexer = new Lexer("'hello'")
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_STRING)
		})

		it('should handle escaped quotes', () => {
			let lexer = new Lexer('"hello \\"world\\""')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_STRING)
		})

		it('should handle hex escapes', () => {
			let lexer = new Lexer('"\\20\\000020"')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_STRING)
		})

		it('should handle escaped newlines', () => {
			let lexer = new Lexer('"line\\\ncontinued"')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_STRING)
		})

		it('should mark unclosed strings as bad', () => {
			let lexer = new Lexer('"unclosed\n')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_BAD_STRING)
		})

		it('should mark EOF unclosed strings as bad', () => {
			let lexer = new Lexer('"unclosed')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_BAD_STRING)
		})
	})

	describe('numbers', () => {
		it('should tokenize integers', () => {
			let lexer = new Lexer('123')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_NUMBER)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('123')
		})

		it('should tokenize decimals', () => {
			let lexer = new Lexer('123.456')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_NUMBER)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('123.456')
		})

		it('should tokenize decimals starting with dot', () => {
			let lexer = new Lexer('.5')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_NUMBER)
		})

		it('should tokenize signed numbers', () => {
			let lexer = new Lexer('+10')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_NUMBER)

			lexer = new Lexer('-10')
			token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_NUMBER)
		})

		it('should tokenize scientific notation', () => {
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
		it('should tokenize percentages', () => {
			let lexer = new Lexer('50%')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_PERCENTAGE)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('50%')
		})

		it('should tokenize negative percentages', () => {
			let lexer = new Lexer('-50%')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_PERCENTAGE)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('-50%')
		})

		it('should tokenize positive percentages', () => {
			let lexer = new Lexer('+50%')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_PERCENTAGE)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('+50%')
		})

		it('should tokenize fraction percentages', () => {
			let lexer = new Lexer('+5.5%')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_PERCENTAGE)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('+5.5%')
		})

		it('should tokenize scientific fraction percentages', () => {
			let lexer = new Lexer('+5.2e-10%')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_PERCENTAGE)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('+5.2e-10%')
		})
	})

	describe('dimensions', () => {
		it('should tokenize pixel dimensions', () => {
			let lexer = new Lexer('10px')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_DIMENSION)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('10px')
		})

		it('should tokenize various units', () => {
			const units = ['em', 'rem', 'vh', 'vw', 'ch', 'ex', 'cm', 'mm', 'in', 'pt', 'pc']
			for (let unit of units) {
				let lexer = new Lexer(`10${unit}`)
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_DIMENSION)
			}
		})
	})

	describe('identifiers', () => {
		it('should tokenize identifiers', () => {
			let lexer = new Lexer('color')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_IDENT)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('color')
		})

		it('should tokenize vendor prefixes', () => {
			let lexer = new Lexer('-webkit-transform')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_IDENT)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('-webkit-transform')
		})

		it('should tokenize CSS custom properties (variables)', () => {
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

		it('should tokenize identifiers with underscores', () => {
			let lexer = new Lexer('_private')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_IDENT)
		})

		it('should tokenize identifiers with digits', () => {
			let lexer = new Lexer('grid2')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_IDENT)
		})

		describe('escape sequences', () => {
			it('should handle hex escape sequences', () => {
				// \32 = character code 0x32 (the digit '2')
				let lexer = new Lexer('\\32xl')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('\\32xl')
			})

			it('should handle character escape sequences', () => {
				// \: = escaped colon
				let lexer = new Lexer('\\:ease-in')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('\\:ease-in')
			})

			it('should handle combined escape sequences (Tailwind CSS)', () => {
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

			it('should handle whitespace after hex escapes', () => {
				// Per CSS spec, hex escapes can be followed by optional whitespace
				// \32 xl = character 0x32 followed by 'xl'
				let lexer = new Lexer('\\32 xl')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('\\32 xl')
			})

			it('should handle 6-digit hex escapes', () => {
				// Maximum 6 hex digits per escape
				let lexer = new Lexer('\\000032xl')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('\\000032xl')
			})

			it('should handle multiple escapes in sequence', () => {
				let lexer = new Lexer('\\32\\33\\34')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('\\32\\33\\34')
			})

			it('should handle escape at start of identifier', () => {
				let lexer = new Lexer('\\:hover')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('\\:hover')
			})

			it('should handle escape at end of identifier', () => {
				let lexer = new Lexer('ease-in\\:')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('ease-in\\:')
			})

			it('should stop at newline after backslash', () => {
				// Backslash followed by newline is invalid in identifier
				let lexer = new Lexer('test\\\nmore')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_IDENT)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('test')
			})

			it('should handle escapes in functions', () => {
				let lexer = new Lexer('\\32xl\\:fn(')
				let token = lexer.next_token()
				expect(token?.type).toBe(TOKEN_FUNCTION)
				expect(lexer.source.slice(token!.start, token!.end)).toBe('\\32xl\\:fn(')
			})
		})
	})

	describe('functions', () => {
		it('should tokenize functions', () => {
			let lexer = new Lexer('rgb(')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_FUNCTION)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('rgb(')
		})

		it('should tokenize vendor-prefixed functions', () => {
			let lexer = new Lexer('-webkit-calc(')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_FUNCTION)
		})
	})

	describe('at-keywords', () => {
		it('should tokenize @media', () => {
			let lexer = new Lexer('@media')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_AT_KEYWORD)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('@media')
		})

		it('should tokenize @keyframes', () => {
			let lexer = new Lexer('@keyframes')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_AT_KEYWORD)
		})

		it('should tokenize @-webkitkeyframes', () => {
			let lexer = new Lexer('@-webkitkeyframes')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_AT_KEYWORD)
		})
	})

	describe('hash', () => {
		it('should tokenize hash colors', () => {
			let lexer = new Lexer('#fff')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_HASH)
			expect(lexer.source.slice(token!.start, token!.end)).toBe('#fff')
		})

		it('should tokenize hash IDs', () => {
			let lexer = new Lexer('#main-content')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_HASH)
		})
	})

	describe('CDO/CDC', () => {
		it('should tokenize CDO', () => {
			let lexer = new Lexer('<!--')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_CDO)
		})

		it('should tokenize CDC', () => {
			let lexer = new Lexer('-->')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_CDC)
		})
	})

	describe('delimiters', () => {
		it('should tokenize unknown characters as delimiters', () => {
			let lexer = new Lexer('~')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_DELIM)
		})

		it('should tokenize + as delimiter when not part of number', () => {
			let lexer = new Lexer('+ ')
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_DELIM)
		})
	})

	describe('EOF', () => {
		it('should return EOF token at end', () => {
			let lexer = new Lexer('a')
			lexer.next_token() // a
			let token = lexer.next_token()
			expect(token?.type).toBe(TOKEN_EOF)
		})
	})

	describe('real CSS', () => {
		it('should tokenize a CSS rule', () => {
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

		it('should tokenize declaration with number and unit', () => {
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
})
