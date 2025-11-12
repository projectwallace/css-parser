// CSS Parser - Builds AST using the arena
import { Lexer } from './lexer'
import { CSSDataArena, NODE_STYLESHEET, NODE_STYLE_RULE, NODE_SELECTOR, NODE_DECLARATION, NODE_AT_RULE, FLAG_IMPORTANT } from './arena'
import { CSSNode } from './css-node'
import type { Token } from './token-types'
import {
	TOKEN_EOF,
	TOKEN_WHITESPACE,
	TOKEN_COMMENT,
	TOKEN_LEFT_BRACE,
	TOKEN_RIGHT_BRACE,
	TOKEN_COLON,
	TOKEN_SEMICOLON,
	TOKEN_IDENT,
	TOKEN_DELIM,
	TOKEN_AT_KEYWORD,
} from './token-types'

export class Parser {
	private source: string
	private lexer: Lexer
	private arena: CSSDataArena
	private currentToken: Token | null

	constructor(source: string) {
		this.source = source
		this.lexer = new Lexer(source)
		// Calculate optimal capacity based on source size
		let capacity = CSSDataArena.capacity_for_source(source.length)
		this.arena = new CSSDataArena(capacity)
		this.currentToken = null
	}

	// Get the arena (for internal/advanced use only)
	get_arena(): CSSDataArena {
		return this.arena
	}

	// Get the source code
	get_source(): string {
		return this.source
	}

	// Advance to the next token, skipping whitespace
	private next_token(): Token | null {
		do {
			this.currentToken = this.lexer.next_token()
		} while (this.currentToken && this.currentToken.type === TOKEN_WHITESPACE)

		return this.currentToken
	}

	// Peek at current token type
	private peek_type(): number {
		return this.currentToken?.type ?? TOKEN_EOF
	}

	// Check if we're at the end of input
	private is_eof(): boolean {
		return this.peek_type() === TOKEN_EOF
	}

	// Parse the entire stylesheet and return the root CSSNode
	parse(): CSSNode {
		// Start by getting the first token
		this.next_token()

		// Create the root stylesheet node
		let stylesheet = this.arena.create_node()
		this.arena.set_type(stylesheet, NODE_STYLESHEET)
		this.arena.set_start_offset(stylesheet, 0)
		this.arena.set_length(stylesheet, this.source.length)
		this.arena.set_start_line(stylesheet, 1)

		// Parse all rules at the top level
		while (!this.is_eof()) {
			let rule = this.parse_rule()
			if (rule !== null) {
				this.arena.append_child(stylesheet, rule)
			} else {
				// Skip unknown tokens
				this.next_token()
			}
		}

		// Return wrapped node
		return new CSSNode(this.arena, this.source, stylesheet)
	}

	// Parse a rule (style rule or at-rule)
	private parse_rule(): number | null {
		if (this.is_eof()) {
			return null
		}

		// Skip comments at rule level
		if (this.peek_type() === TOKEN_COMMENT) {
			// TODO: Create comment nodes
			this.next_token()
			return null
		}

		// Check for at-rule
		if (this.peek_type() === TOKEN_AT_KEYWORD) {
			return this.parse_atrule()
		}

		// Try to parse as style rule
		return this.parse_style_rule()
	}

	// Parse a style rule: selector { declarations }
	private parse_style_rule(): number | null {
		let start_token = this.currentToken
		if (!start_token) return null

		let rule_start = start_token.start
		let rule_line = start_token.line

		// Create the style rule node
		let style_rule = this.arena.create_node()
		this.arena.set_type(style_rule, NODE_STYLE_RULE)
		this.arena.set_start_line(style_rule, rule_line)

		// Parse selector (everything until '{')
		let selector = this.parse_selector()
		if (selector !== null) {
			this.arena.append_child(style_rule, selector)
		}

		// Expect '{'
		if (this.peek_type() !== TOKEN_LEFT_BRACE) {
			// Error recovery: skip to next rule
			return null
		}
		this.next_token() // consume '{'

		// Parse declarations block
		while (!this.is_eof() && this.peek_type() !== TOKEN_RIGHT_BRACE) {
			let declaration = this.parse_declaration()
			if (declaration !== null) {
				this.arena.append_child(style_rule, declaration)
			} else {
				// Skip unknown tokens
				this.next_token()
			}
		}

		// Expect '}'
		if (this.peek_type() === TOKEN_RIGHT_BRACE) {
			this.next_token() // consume '}'
		}

		// Set the rule's offsets
		let end_token = this.currentToken
		if (end_token) {
			this.arena.set_start_offset(style_rule, rule_start)
			this.arena.set_length(style_rule, end_token.end - rule_start)
		}

		return style_rule
	}

	// Parse a selector (everything before '{')
	private parse_selector(): number | null {
		let start_token = this.currentToken
		if (!start_token) return null

		let selector_start = start_token.start
		let selector_line = start_token.line

		// Create selector node
		let selector = this.arena.create_node()
		this.arena.set_type(selector, NODE_SELECTOR)
		this.arena.set_start_line(selector, selector_line)

		// Consume tokens until we hit '{'
		let last_token = start_token
		while (!this.is_eof() && this.peek_type() !== TOKEN_LEFT_BRACE) {
			last_token = this.currentToken!
			this.next_token()
		}

		// Set selector offsets
		this.arena.set_start_offset(selector, selector_start)
		this.arena.set_length(selector, last_token.end - selector_start)

		return selector
	}

	// Parse a declaration: property: value;
	private parse_declaration(): number | null {
		// Skip comments
		if (this.peek_type() === TOKEN_COMMENT) {
			// TODO: Create comment nodes
			this.next_token()
			return null
		}

		// Expect identifier (property name)
		if (this.peek_type() !== TOKEN_IDENT) {
			return null
		}

		let start_token = this.currentToken
		if (!start_token) return null

		let prop_start = start_token.start
		let prop_end = start_token.end
		let decl_line = start_token.line

		this.next_token() // consume property name

		// Expect ':'
		if (this.peek_type() !== TOKEN_COLON) {
			return null
		}
		this.next_token() // consume ':'

		// Create declaration node
		let declaration = this.arena.create_node()
		this.arena.set_type(declaration, NODE_DECLARATION)
		this.arena.set_start_line(declaration, decl_line)
		this.arena.set_start_offset(declaration, prop_start)

		// Store property name position
		this.arena.set_content_start(declaration, prop_start)
		this.arena.set_content_length(declaration, prop_end - prop_start)

		// Parse value (everything until ';' or '}')
		let has_important = false
		let last_token = this.currentToken

		while (!this.is_eof() && this.peek_type() !== TOKEN_SEMICOLON && this.peek_type() !== TOKEN_RIGHT_BRACE) {
			// Check for ! followed by any identifier (e.g., !important, !ie, etc.)
			if (this.peek_type() === TOKEN_DELIM && this.currentToken && this.source[this.currentToken.start] === '!') {
				// Check if next token is an identifier
				let next_token = this.lexer.next_token()
				if (next_token && next_token.type === TOKEN_IDENT) {
					has_important = true
					last_token = next_token
					this.currentToken = next_token
					break
				}
			}

			last_token = this.currentToken!
			this.next_token()
		}

		// Set !important flag if found
		if (has_important) {
			this.arena.set_flag(declaration, FLAG_IMPORTANT)
		}

		// Consume ';' if present
		if (this.peek_type() === TOKEN_SEMICOLON) {
			last_token = this.currentToken!
			this.next_token()
		}

		// Set declaration length
		if (last_token) {
			this.arena.set_length(declaration, last_token.end - prop_start)
		}

		return declaration
	}

	// Parse an at-rule: @media, @import, @font-face, etc.
	private parse_atrule(): number | null {
		let start_token = this.currentToken
		if (!start_token || start_token.type !== TOKEN_AT_KEYWORD) {
			return null
		}

		let at_rule_start = start_token.start
		let at_rule_line = start_token.line

		// Extract at-rule name (skip the '@')
		let at_rule_name = this.source.substring(start_token.start + 1, start_token.end)
		let name_start = start_token.start + 1
		let name_length = at_rule_name.length

		this.next_token() // consume @keyword

		// Create at-rule node
		let at_rule = this.arena.create_node()
		this.arena.set_type(at_rule, NODE_AT_RULE)
		this.arena.set_start_line(at_rule, at_rule_line)
		this.arena.set_start_offset(at_rule, at_rule_start)

		// Store at-rule name in contentStart/contentLength
		this.arena.set_content_start(at_rule, name_start)
		this.arena.set_content_length(at_rule, name_length)

		// Parse prelude (everything before '{' or ';')
		// For now, just consume tokens
		while (!this.is_eof() && this.peek_type() !== TOKEN_LEFT_BRACE && this.peek_type() !== TOKEN_SEMICOLON) {
			this.next_token()
		}

		let last_token = this.currentToken

		// Check if this at-rule has a block or is a statement
		if (this.peek_type() === TOKEN_LEFT_BRACE) {
			this.next_token() // consume '{'

			// Determine what to parse inside the block based on the at-rule name
			let has_declarations = this.atrule_has_declarations(at_rule_name)

			if (has_declarations) {
				// Parse declarations (like @font-face, @page)
				while (!this.is_eof() && this.peek_type() !== TOKEN_RIGHT_BRACE) {
					let declaration = this.parse_declaration()
					if (declaration !== null) {
						this.arena.append_child(at_rule, declaration)
					} else {
						this.next_token()
					}
				}
			} else {
				// Parse nested rules (like @media, @supports, @layer)
				while (!this.is_eof() && this.peek_type() !== TOKEN_RIGHT_BRACE) {
					let rule = this.parse_rule()
					if (rule !== null) {
						this.arena.append_child(at_rule, rule)
					} else {
						this.next_token()
					}
				}
			}

			// Consume '}'
			if (this.peek_type() === TOKEN_RIGHT_BRACE) {
				last_token = this.currentToken!
				this.next_token()
			}
		} else if (this.peek_type() === TOKEN_SEMICOLON) {
			// Statement at-rule (like @import, @namespace)
			last_token = this.currentToken!
			this.next_token() // consume ';'
		}

		// Set at-rule length
		if (last_token) {
			this.arena.set_length(at_rule, last_token.end - at_rule_start)
		}

		return at_rule
	}

	// Determine if an at-rule contains declarations or nested rules
	private atrule_has_declarations(name: string): boolean {
		// At-rules with declarations in their blocks
		let declaration_at_rules = ['font-face', 'font-feature-values', 'page', 'property', 'counter-style']

		return declaration_at_rules.includes(name)
	}
}
