// Declaration Parser - Parses CSS declarations into structured AST nodes
import { Lexer } from './tokenize'
import { CSSDataArena, DECLARATION, RAW, FLAG_IMPORTANT, FLAG_BROWSERHACK } from './arena'
import { ValueParser } from './parse-value'
import {
	is_vendor_prefixed,
	CHAR_LEFT_BRACE,
	CHAR_RIGHT_BRACE,
	CHAR_SEMICOLON,
	CHAR_LEFT_PAREN,
	CHAR_RIGHT_PAREN,
	CHAR_EXCLAMATION,
} from './string-utils'
import {
	TOKEN_IDENT,
	TOKEN_COLON,
	TOKEN_SEMICOLON,
	TOKEN_DELIM,
	TOKEN_LEFT_PAREN,
	TOKEN_RIGHT_PAREN,
	TOKEN_LEFT_BRACKET,
	TOKEN_RIGHT_BRACKET,
	TOKEN_COMMA,
	TOKEN_HASH,
	TOKEN_AT_KEYWORD,
	type TokenType,
} from './token-types'
import { trim_boundaries, skip_whitespace_and_comments_backward } from './parse-utils'
import { CSSNode } from './css-node'
import type { Declaration } from './node-types'

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
	parse_declaration(
		start: number,
		end: number,
		line: number = 1,
		column: number = 1,
	): number | null {
		// Create a fresh lexer instance for standalone parsing
		const lexer = new Lexer(this.source)
		lexer.seek(start, line, column)
		lexer.next_token_fast(true) // skip whitespace like Parser does

		return this.parse_declaration_with_lexer(lexer, end)
	}

	// Parse a declaration using a provided lexer (used by Parser to avoid re-tokenization)
	parse_declaration_with_lexer(lexer: Lexer, end: number): number | null {
		// Save initial position so we can fully restore if parsing fails after consuming a delimiter prefix
		const initial_saved = lexer.save_position()

		// Check for browser hack prefix (single delimiter/special character before identifier)
		let has_browser_hack = false
		let has_delimiter_prefix = false
		let browser_hack_start = 0
		let browser_hack_line = 1
		let browser_hack_column = 1

		// Fast path: TOKEN_IDENT is by far the most common case (regular properties like color, margin, etc.)
		if (lexer.token_type === TOKEN_IDENT) {
			const first_char = this.source.charCodeAt(lexer.token_start)
			if (first_char === 95) {
				// '_' - underscore prefix is always a browser hack
				has_browser_hack = true
				browser_hack_start = lexer.token_start
				browser_hack_line = lexer.token_line
				browser_hack_column = lexer.token_column
			} else if (first_char === 45) {
				// '-' - hyphen prefix: vendor prefix, custom property, or browser hack
				if (
					this.source.charCodeAt(lexer.token_start + 1) !== 45 && // not '--' custom property
					!is_vendor_prefixed(this.source, lexer.token_start, lexer.token_end)
				) {
					has_browser_hack = true
					browser_hack_start = lexer.token_start
					browser_hack_line = lexer.token_line
					browser_hack_column = lexer.token_column
				}
			}
			// else: normal ident start (a-z, A-Z, etc.) - no hack possible, skip all checks
		} else if (lexer.token_type === TOKEN_AT_KEYWORD || lexer.token_type === TOKEN_HASH) {
			// Handle @property and #property hacks (tokenized as single tokens)
			has_browser_hack = true
			browser_hack_start = lexer.token_start
			browser_hack_line = lexer.token_line
			browser_hack_column = lexer.token_column
		} else if (
			lexer.token_type === TOKEN_DELIM ||
			lexer.token_type === TOKEN_LEFT_PAREN ||
			lexer.token_type === TOKEN_RIGHT_PAREN ||
			lexer.token_type === TOKEN_LEFT_BRACKET ||
			lexer.token_type === TOKEN_RIGHT_BRACKET ||
			lexer.token_type === TOKEN_COMMA ||
			lexer.token_type === TOKEN_COLON
		) {
			// Browser hacks can use various token types as prefixes (e.g., * hack)
			const delim_saved = lexer.save_position()
			browser_hack_start = lexer.token_start
			browser_hack_line = lexer.token_line
			browser_hack_column = lexer.token_column

			lexer.next_token_fast(true) // skip whitespace

			if ((lexer.token_type as TokenType) === TOKEN_IDENT) {
				has_browser_hack = true
				has_delimiter_prefix = true
			} else {
				lexer.restore_position(delim_saved)
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
			// Restore lexer state and return null.
			// If we consumed a delimiter prefix (e.g. ':' before the property name), we must restore
			// all the way back to before that prefix so the caller's lexer position is correct.
			lexer.restore_position(has_delimiter_prefix ? initial_saved : saved)
			return null
		}
		// Skip whitespace/comments after ':' WITHOUT tokenizing the first value token - the
		// raw scan below (skip_to_declaration_stop) needs to see every character of the value
		// uniformly, including what would otherwise become an already-consumed first token
		// (e.g. a leading "calc(" - its '(' must reach the paren-depth tracking below, which
		// it wouldn't if next_token_fast had already tokenized past it here).
		lexer.pos = lexer.token_end // move past ':' (already at this position, but be explicit)
		lexer.skip_whitespace_in_range(this.source.length)

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

		// Track value start (after colon, skipping whitespace) - CRITICAL: Capture line/column
		// for value parsing. Lexer is now positioned at the first value character (untokenized).
		let value_start = lexer.pos
		let value_start_line = lexer.line
		let value_start_column = lexer.column
		let value_end = value_start

		// Parse value (everything until ';' or EOF)
		let has_important = false
		let last_end = value_start
		// Track parenthesis depth to handle semicolons inside functions (e.g., url(data:image/png;base64,...))
		let paren_depth = 0

		// Fast-forward through the value using a raw character scan for the exact stop
		// points the token-by-token loop used to check (paren depth, ';'/'}' at depth zero,
		// an unparenthesized '{', and '!' for !important) - the ordinary content in between
		// doesn't need full tokenization here, since ValueNodeParser re-tokenizes the
		// resulting span properly afterward.
		// NOTE: every exit is an explicit break/return - the "ran out of input" case is only
		// detected via skip_to_declaration_stop returning 0, not via a loop condition, since a
		// paren_depth adjustment can land exactly on `end` without going through that path.
		while (true) {
			let stop_ch = lexer.skip_to_declaration_stop(end)

			if (stop_ch === CHAR_LEFT_PAREN) {
				paren_depth++
				lexer.pos++
				continue
			}
			if (stop_ch === CHAR_RIGHT_PAREN) {
				paren_depth--
				lexer.pos++
				continue
			}

			if (stop_ch === CHAR_SEMICOLON && paren_depth === 0) {
				value_end = skip_whitespace_and_comments_backward(this.source, lexer.pos, value_start)
				// Tokenize ';' so token_type reflects it, matching the state the old
				// token-by-token loop left behind right when its condition saw TOKEN_SEMICOLON
				// (already tokenized, not yet consumed) - the unchanged code below relies on it.
				lexer.next_token_fast(false)
				break
			}

			if (stop_ch === CHAR_RIGHT_BRACE && paren_depth === 0) {
				if (lexer.pos === value_start) {
					// Degenerate case: colon directly followed by the block's closing brace
					// with no value content at all (e.g. "color:}"). Replicates a quirk of the
					// original token-based scan: the pre-tokenized "first value token" being
					// '}' itself meant its end position became last_end before the per-token
					// loop ever got a chance to run.
					last_end = lexer.pos + 1
					value_end = value_start
				} else {
					last_end = skip_whitespace_and_comments_backward(this.source, lexer.pos, value_start)
					value_end = last_end
				}
				// Tokenize '}' so the caller's peek_type() sees it correctly - this declaration
				// ends at a block boundary with no trailing semicolon, and '}' isn't consumed
				// here (the enclosing block's own loop needs to see it to know it's done).
				lexer.next_token_fast(false)
				break
			}

			if (stop_ch === CHAR_LEFT_BRACE) {
				// This is actually a style rule, not a declaration - '{' can appear at any
				// paren depth and always bails out, regardless of depth.
				lexer.restore_position(saved)
				return null
			}

			if (stop_ch === CHAR_EXCLAMATION) {
				// Mark end of value before !important
				value_end = lexer.pos
				lexer.pos++ // consume '!'
				// Check if next token is an identifier (doesn't verify it's literally
				// "important" - matches the pre-existing behavior this replaces)
				let next_type = lexer.next_token_fast(true) // skip whitespace
				if (next_type === TOKEN_IDENT) {
					has_important = true
					last_end = lexer.token_end
					lexer.next_token_fast(true) // Advance to next token after "important", skip whitespace
					break
				}
				// '!' wasn't followed by an identifier - treat the already-peeked token as
				// ordinary content. lexer.pos is already right after it (tokenizing to peek
				// advances past it), so the raw scan below picks up from there naturally - an
				// extra next_token_fast here would blindly consume whatever comes next (e.g. a
				// block's closing '}') without the scan ever getting a chance to treat it as a
				// stop condition.
				last_end = lexer.token_end
				value_end = last_end
				continue
			}

			if (stop_ch === 0) {
				// Ran out of input before finding any of the above
				last_end = skip_whitespace_and_comments_backward(this.source, lexer.pos, value_start)
				value_end = last_end
				lexer.next_token_fast(false) // tokenize EOF so token_type reflects it
				break
			}

			// stop_ch is ';' or '}' but paren_depth !== 0 - ordinary content inside parens
			lexer.pos++
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
				let valueNode = this.value_parser.parse_value(
					value_start,
					trimmed[1],
					value_start_line,
					value_start_column,
				)

				// Link VALUE node as single child of the declaration
				this.arena.set_first_child(declaration, valueNode)
			} else {
				// Create RAW node for unparsed value text
				let rawNode = this.arena.create_node(
					RAW,
					trimmed[0],
					trimmed[1] - trimmed[0],
					value_start_line,
					value_start_column,
				)
				this.arena.set_first_child(declaration, rawNode)
			}
		} else {
			// Empty value - set zero-length value field so node.value returns "" instead of null
			this.arena.set_value_start_delta(declaration, value_start - prop_start)
			this.arena.set_value_length(declaration, 0)

			// Create empty VALUE node for consistency
			if (this.value_parser) {
				let valueNode = this.value_parser.parse_value(
					value_start,
					value_start,
					value_start_line,
					value_start_column,
				)
				this.arena.set_first_child(declaration, valueNode)
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
export function parse_declaration(source: string): Declaration {
	// Create an arena for the declaration nodes
	const arena = new CSSDataArena(CSSDataArena.capacity_for_source(source.length))

	// Create declaration parser
	const decl_parser = new DeclarationParser(arena, source)

	// Parse the entire source as a declaration
	const decl_index = decl_parser.parse_declaration(0, source.length)

	if (decl_index === null) {
		// Return empty declaration node if parsing failed
		const empty = arena.create_node(DECLARATION, 0, 0, 1, 1)
		return new CSSNode(arena, source, empty) as Declaration
	}

	// Wrap in CSSNode
	return new CSSNode(arena, source, decl_index) as Declaration
}
