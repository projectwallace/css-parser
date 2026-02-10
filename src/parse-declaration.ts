// Declaration Parser - Parses CSS declarations into structured AST nodes
import { Lexer } from './tokenize'
import { CSSDataArena, DECLARATION, FLAG_IMPORTANT, FLAG_BROWSERHACK } from './arena'
import { ValueParser } from './parse-value'
import { is_vendor_prefixed } from './string-utils'
import {
	TOKEN_IDENT,
	TOKEN_COLON,
	TOKEN_SEMICOLON,
	TOKEN_DELIM,
	TOKEN_EOF,
	TOKEN_LEFT_BRACE,
	TOKEN_RIGHT_BRACE,
	TOKEN_LEFT_PAREN,
	TOKEN_RIGHT_PAREN,
	TOKEN_LEFT_BRACKET,
	TOKEN_RIGHT_BRACKET,
	TOKEN_COMMA,
	TOKEN_HASH,
	TOKEN_AT_KEYWORD,
	TOKEN_FUNCTION,
	type TokenType,
} from './token-types'
import { trim_boundaries } from './parse-utils'
import { CSSNode } from './css-node'

/** @internal */
export class DeclarationParser {
	private arena: CSSDataArena
	private source: string
	private value_parser: ValueParser | null

	constructor(arena: CSSDataArena, source: string, parse_values: boolean = true) {
		this.arena = arena
		this.source = source
		this.value_parser = parse_values ? new ValueParser(arena, source) : null
	}

	// Parse a declaration range into a declaration node (standalone use)
	parse_declaration(start: number, end: number, line: number = 1, column: number = 1): number | null {
		// Create a fresh lexer instance for standalone parsing
		const lexer = new Lexer(this.source)
		lexer.pos = start
		lexer.line = line
		lexer.column = column
		lexer.next_token_fast(true) // skip whitespace like Parser does

		return this.parse_declaration_with_lexer(lexer, end)
	}

	// Parse a declaration using a provided lexer (used by Parser to avoid re-tokenization)
	parse_declaration_with_lexer(lexer: Lexer, end: number): number | null {
		// Check for browser hack prefix (single delimiter/special character before identifier)
		let has_browser_hack = false
		let browser_hack_start = 0
		let browser_hack_line = 1
		let browser_hack_column = 1

		// Handle @property and #property (tokenized as single tokens)
		if (lexer.token_type === TOKEN_AT_KEYWORD || lexer.token_type === TOKEN_HASH) {
			// These tokens already include the @ or # prefix in their text
			// Mark as browser hack since @ and # prefixes are not standard CSS
			has_browser_hack = true
			browser_hack_start = lexer.token_start
			browser_hack_line = lexer.token_line
			browser_hack_column = lexer.token_column
		} else if (lexer.token_type === TOKEN_IDENT) {
			// Check if identifier starts with browser hack character
			// Some hacks like -property, _property are tokenized as single identifiers
			const first_char = this.source.charCodeAt(lexer.token_start)
			if (first_char === 95) {
				// '_' - underscore prefix is always a browser hack
				has_browser_hack = true
				browser_hack_start = lexer.token_start
				browser_hack_line = lexer.token_line
				browser_hack_column = lexer.token_column
			} else if (first_char === 45) {
				// '-' - hyphen prefix could be vendor prefix, custom property, or browser hack
				// Check if it's a custom property (starts with --)
				const second_char = this.source.charCodeAt(lexer.token_start + 1)
				const is_custom_property = second_char === 45 // '--'

				// Use fast vendor prefix check (no allocations)
				if (!is_custom_property && !is_vendor_prefixed(this.source, lexer.token_start, lexer.token_end)) {
					// This is a browser hack like -property
					has_browser_hack = true
					browser_hack_start = lexer.token_start
					browser_hack_line = lexer.token_line
					browser_hack_column = lexer.token_column
				}
			}
		} else {
			// Browser hacks can use various token types as prefixes
			const is_browser_hack_token =
				lexer.token_type === TOKEN_DELIM ||
				lexer.token_type === TOKEN_LEFT_PAREN ||
				lexer.token_type === TOKEN_RIGHT_PAREN ||
				lexer.token_type === TOKEN_LEFT_BRACKET ||
				lexer.token_type === TOKEN_RIGHT_BRACKET ||
				lexer.token_type === TOKEN_COMMA ||
				lexer.token_type === TOKEN_COLON

			if (is_browser_hack_token) {
				// Save position in case this isn't a browser hack
				const delim_saved = lexer.save_position()
				browser_hack_start = lexer.token_start
				browser_hack_line = lexer.token_line
				browser_hack_column = lexer.token_column

				// Consume delimiter and check if next token is identifier
				lexer.next_token_fast(true) // skip whitespace

				if ((lexer.token_type as TokenType) === TOKEN_IDENT) {
					// This is a browser hack!
					has_browser_hack = true
				} else {
					// Not a browser hack, restore position
					lexer.restore_position(delim_saved)
				}
			}
		}

		// Expect identifier, at-keyword, or hash token (property name) - whitespace already skipped by caller
		if (
			lexer.token_type !== TOKEN_IDENT &&
			lexer.token_type !== TOKEN_AT_KEYWORD &&
			lexer.token_type !== TOKEN_HASH
		) {
			return null
		}

		let prop_start = has_browser_hack ? browser_hack_start : lexer.token_start
		let prop_end = lexer.token_end
		// CRITICAL: Capture line/column BEFORE consuming property token
		let decl_line = has_browser_hack ? browser_hack_line : lexer.token_line
		let decl_column = has_browser_hack ? browser_hack_column : lexer.token_column

		// Lookahead: save lexer state before consuming
		const saved = lexer.save_position()

		lexer.next_token_fast(true) // consume property name, skip whitespace

		// Expect ':' (type assertion needed because TS doesn't know next_token mutates token_type)
		if ((lexer.token_type as TokenType) !== TOKEN_COLON) {
			// Restore lexer state and return null
			lexer.restore_position(saved)
			return null
		}
		lexer.next_token_fast(true) // consume ':', skip whitespace

		// Create declaration node (length will be set later)
		let declaration = this.arena.create_node(
			DECLARATION,
			prop_start,
			0, // length unknown yet
			decl_line,
			decl_column,
		)

		// Store property name position (delta = 0 since content starts at same offset as node)
		this.arena.set_content_start_delta(declaration, 0)
		this.arena.set_content_length(declaration, prop_end - prop_start)

		// Track value start (after colon, skipping whitespace)
		// CRITICAL: Capture line/column for value parsing
		// After consuming ':', lexer is now positioned at first value token
		let value_start = lexer.token_start
		let value_start_line = lexer.token_line
		let value_start_column = lexer.token_column
		let value_end = value_start

		// Parse value (everything until ';' or EOF)
		let has_important = false
		let last_end = lexer.token_end
		// Track parenthesis depth to handle semicolons inside functions (e.g., url(data:image/png;base64,...))
		let paren_depth = 0

		// Process tokens until we hit semicolon, EOF, or end of input
		while ((lexer.token_type as TokenType) !== TOKEN_EOF && lexer.token_start < end) {
			let token_type = lexer.token_type as TokenType

			// Track parenthesis depth
			if (token_type === TOKEN_LEFT_PAREN || token_type === TOKEN_FUNCTION) {
				paren_depth++
			} else if (token_type === TOKEN_RIGHT_PAREN) {
				paren_depth--
			}

			// Only break on semicolon/brace when outside all parentheses
			if (token_type === TOKEN_SEMICOLON && paren_depth === 0) break
			if (token_type === TOKEN_RIGHT_BRACE && paren_depth === 0) break

			// If we encounter '{', this is actually a style rule, not a declaration
			if (token_type === TOKEN_LEFT_BRACE) {
				lexer.restore_position(saved)
				return null
			}

			// Check for ! followed by any identifier (optimized: only check when we see '!')
			if (token_type === TOKEN_DELIM && this.source[lexer.token_start] === '!') {
				// Mark end of value before !important
				value_end = lexer.token_start
				// Check if next token is an identifier
				let next_type = lexer.next_token_fast(true) // skip whitespace
				if (next_type === TOKEN_IDENT) {
					has_important = true
					last_end = lexer.token_end
					lexer.next_token_fast(true) // Advance to next token after "important", skip whitespace
					break
				}
			}

			last_end = lexer.token_end
			value_end = last_end
			lexer.next_token_fast(true) // skip whitespace
		}

		// Store value position (trimmed) and parse value nodes
		let trimmed = trim_boundaries(this.source, value_start, value_end)
		if (trimmed) {
			// Store raw value string offsets (for fast string access)
			this.arena.set_value_start_delta(declaration, trimmed[0] - prop_start)
			this.arena.set_value_length(declaration, trimmed[1] - trimmed[0])

			// Parse value into structured nodes (only if enabled)
			if (this.value_parser) {
				// CRITICAL: Pass value_start_line and value_start_column to value parser
				let valueNode = this.value_parser.parse_value(value_start, trimmed[1], value_start_line, value_start_column)

				// Link VALUE node as single child of the declaration
				this.arena.append_children(declaration, [valueNode])
			}
		} else {
			// Empty value - set zero-length value field so node.value returns "" instead of null
			this.arena.set_value_start_delta(declaration, value_start - prop_start)
			this.arena.set_value_length(declaration, 0)

			// Create empty VALUE node for consistency
			if (this.value_parser) {
				let valueNode = this.value_parser.parse_value(value_start, value_start, value_start_line, value_start_column)
				this.arena.append_children(declaration, [valueNode])
			}
		}

		// Set !important flag if found
		if (has_important) {
			this.arena.set_flag(declaration, FLAG_IMPORTANT)
		}

		// Set browser hack flag if found
		if (has_browser_hack) {
			this.arena.set_flag(declaration, FLAG_BROWSERHACK)
		}

		// Consume ';' if present
		if ((lexer.token_type as TokenType) === TOKEN_SEMICOLON) {
			last_end = lexer.token_end
			lexer.next_token_fast(true) // skip whitespace
		}

		// Set declaration length
		this.arena.set_length(declaration, last_end - prop_start)

		return declaration
	}
}

/**
 * Parse a CSS declaration string and return an AST
 * @param source - The CSS declaration to parse (e.g., "color: red", "margin: 10px !important")
 * @returns The DECLARATION CSSNode
 */
export function parse_declaration(source: string): CSSNode {
	// Create an arena for the declaration nodes
	const arena = new CSSDataArena(CSSDataArena.capacity_for_source(source.length))

	// Create declaration parser
	const decl_parser = new DeclarationParser(arena, source)

	// Parse the entire source as a declaration
	const decl_index = decl_parser.parse_declaration(0, source.length)

	if (decl_index === null) {
		// Return empty declaration node if parsing failed
		const empty = arena.create_node(DECLARATION, 0, 0, 1, 1)
		return new CSSNode(arena, source, empty)
	}

	// Wrap in CSSNode
	return new CSSNode(arena, source, decl_index)
}
