// CSS token types following CSS Syntax spec
// https://drafts.csswg.org/css-syntax/

export const TOKEN_IDENT = 1
export const TOKEN_FUNCTION = 2
export const TOKEN_AT_KEYWORD = 3
export const TOKEN_HASH = 4
export const TOKEN_STRING = 5
export const TOKEN_BAD_STRING = 6
export const TOKEN_URL = 7
export const TOKEN_BAD_URL = 8
export const TOKEN_DELIM = 9
export const TOKEN_NUMBER = 10
export const TOKEN_PERCENTAGE = 11
export const TOKEN_DIMENSION = 12
export const TOKEN_WHITESPACE = 13
export const TOKEN_CDO = 14 // <!--
export const TOKEN_CDC = 15 // -->
export const TOKEN_COLON = 16
export const TOKEN_SEMICOLON = 17
export const TOKEN_COMMA = 18
export const TOKEN_LEFT_BRACKET = 19 // [
export const TOKEN_RIGHT_BRACKET = 20 // ]
export const TOKEN_LEFT_PAREN = 21 // (
export const TOKEN_RIGHT_PAREN = 22 // )
export const TOKEN_LEFT_BRACE = 23 // {
export const TOKEN_RIGHT_BRACE = 24 // }
export const TOKEN_COMMENT = 25
export const TOKEN_EOF = 26
export const TOKEN_UNICODE_RANGE = 27 // u+0025-00ff, u+4??

export type TokenType =
	| typeof TOKEN_IDENT
	| typeof TOKEN_FUNCTION
	| typeof TOKEN_AT_KEYWORD
	| typeof TOKEN_HASH
	| typeof TOKEN_STRING
	| typeof TOKEN_BAD_STRING
	| typeof TOKEN_URL
	| typeof TOKEN_BAD_URL
	| typeof TOKEN_DELIM
	| typeof TOKEN_NUMBER
	| typeof TOKEN_PERCENTAGE
	| typeof TOKEN_DIMENSION
	| typeof TOKEN_WHITESPACE
	| typeof TOKEN_CDO
	| typeof TOKEN_CDC
	| typeof TOKEN_COLON
	| typeof TOKEN_SEMICOLON
	| typeof TOKEN_COMMA
	| typeof TOKEN_LEFT_BRACKET
	| typeof TOKEN_RIGHT_BRACKET
	| typeof TOKEN_LEFT_PAREN
	| typeof TOKEN_RIGHT_PAREN
	| typeof TOKEN_LEFT_BRACE
	| typeof TOKEN_RIGHT_BRACE
	| typeof TOKEN_COMMENT
	| typeof TOKEN_EOF
	| typeof TOKEN_UNICODE_RANGE

export type Token = {
	type: TokenType
	start: number
	end: number
	line: number
	column: number
}
