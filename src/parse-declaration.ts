// Declaration Parser - Parses CSS declarations into structured AST nodes
import { Lexer } from './lexer'
import { CSSDataArena, DECLARATION, FLAG_IMPORTANT } from './arena'
import { ValueParser } from './parse-value'
import {
	TOKEN_IDENT,
	TOKEN_COLON,
	TOKEN_SEMICOLON,
	TOKEN_DELIM,
	TOKEN_EOF,
	TOKEN_LEFT_BRACE,
	TOKEN_RIGHT_BRACE,
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
		const lexer = new Lexer(this.source, false)
		lexer.pos = start
		lexer.line = line
		lexer.column = column
		lexer.next_token_fast(true) // skip whitespace like Parser does

		return this.parse_declaration_with_lexer(lexer, end)
	}

	// Parse a declaration using a provided lexer (used by Parser to avoid re-tokenization)
	parse_declaration_with_lexer(lexer: Lexer, end: number): number | null {
		// Expect identifier (property name) - whitespace already skipped by caller
		if (lexer.token_type !== TOKEN_IDENT) {
			return null
		}

		let prop_start = lexer.token_start
		let prop_end = lexer.token_end
		// CRITICAL: Capture line/column BEFORE consuming property token
		let decl_line = lexer.token_line
		let decl_column = lexer.token_column

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
			decl_column
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

		// Process tokens until we hit semicolon, EOF, or end of input
		while ((lexer.token_type as TokenType) !== TOKEN_EOF && lexer.token_start < end) {
			let token_type = lexer.token_type as TokenType
			if (token_type === TOKEN_SEMICOLON) break
			if (token_type === TOKEN_RIGHT_BRACE) break

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
				let valueNodes = this.value_parser.parse_value(value_start, trimmed[1], value_start_line, value_start_column)

				// Link value nodes as children of the declaration
				this.arena.append_children(declaration, valueNodes)
			}
		} else {
			// Empty value - set zero-length value field so node.value returns "" instead of null
			this.arena.set_value_start_delta(declaration, value_start - prop_start)
			this.arena.set_value_length(declaration, 0)
		}

		// Set !important flag if found
		if (has_important) {
			this.arena.set_flag(declaration, FLAG_IMPORTANT)
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
