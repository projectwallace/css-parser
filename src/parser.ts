// CSS Parser - Builds AST using the arena
import { Lexer } from './lexer'
import { CSSDataArena, NODE_STYLESHEET, NODE_STYLE_RULE, NODE_SELECTOR, NODE_DECLARATION, NODE_AT_RULE, FLAG_IMPORTANT } from './arena'
import { CSSNode } from './css-node'
import {
	TOKEN_EOF,
	TOKEN_LEFT_BRACE,
	TOKEN_RIGHT_BRACE,
	TOKEN_COLON,
	TOKEN_SEMICOLON,
	TOKEN_IDENT,
	TOKEN_DELIM,
	TOKEN_AT_KEYWORD,
} from './token-types'

// Static at-rule lookup sets for fast classification
const DECLARATION_AT_RULES = new Set(['font-face', 'font-feature-values', 'page', 'property', 'counter-style'])
const CONDITIONAL_AT_RULES = new Set(['media', 'supports', 'container', 'layer', 'nest'])

// Whitespace character codes for manual trimming (avoiding allocation-heavy string methods)
const SPACE = 0x20
const TAB = 0x09
const LINE_FEED = 0x0a
const CARRIAGE_RETURN = 0x0d
const FORM_FEED = 0x0c

export class Parser {
	private source: string
	private lexer: Lexer
	private arena: CSSDataArena

	constructor(source: string, skip_comments: boolean = true) {
		this.source = source
		this.lexer = new Lexer(source, skip_comments)
		// Calculate optimal capacity based on source size
		let capacity = CSSDataArena.capacity_for_source(source.length)
		this.arena = new CSSDataArena(capacity)
	}

	// Get the arena (for internal/advanced use only)
	get_arena(): CSSDataArena {
		return this.arena
	}

	// Get the source code
	get_source(): string {
		return this.source
	}

	// Fast manual trim to find actual content boundaries
	// Returns [trimmed_start, trimmed_end] or null if all whitespace
	private find_trim_boundaries(start: number, end: number): [number, number] | null {
		// Trim start: skip whitespace characters
		while (start < end) {
			let ch = this.source.charCodeAt(start)
			if (ch !== SPACE && ch !== TAB && ch !== LINE_FEED && ch !== CARRIAGE_RETURN && ch !== FORM_FEED) break
			start++
		}

		// Trim end: skip whitespace characters from the end
		while (end > start) {
			let ch = this.source.charCodeAt(end - 1)
			if (ch !== SPACE && ch !== TAB && ch !== LINE_FEED && ch !== CARRIAGE_RETURN && ch !== FORM_FEED) break
			end--
		}

		if (start >= end) return null
		return [start, end]
	}

	// Advance to the next token, skipping whitespace
	private next_token(): void {
		this.lexer.next_token_fast(true)
	}

	// Peek at current token type
	private peek_type(): number {
		return this.lexer.token_type
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

		// Check for at-rule
		if (this.peek_type() === TOKEN_AT_KEYWORD) {
			return this.parse_atrule()
		}

		// Try to parse as style rule
		return this.parse_style_rule()
	}

	// Parse a style rule: selector { declarations }
	private parse_style_rule(): number | null {
		if (this.is_eof()) return null

		let rule_start = this.lexer.token_start
		let rule_line = this.lexer.token_line

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

		// Parse declarations block (and nested rules for CSS Nesting)
		while (!this.is_eof() && this.peek_type() !== TOKEN_RIGHT_BRACE) {
			// Check for nested at-rule
			if (this.peek_type() === TOKEN_AT_KEYWORD) {
				let nested_at_rule = this.parse_atrule()
				if (nested_at_rule !== null) {
					this.arena.append_child(style_rule, nested_at_rule)
				} else {
					this.next_token()
				}
				continue
			}

			// Try to parse as declaration first
			let declaration = this.parse_declaration()
			if (declaration !== null) {
				this.arena.append_child(style_rule, declaration)
				continue
			}

			// If not a declaration, try parsing as nested style rule
			let nested_rule = this.parse_style_rule()
			if (nested_rule !== null) {
				this.arena.append_child(style_rule, nested_rule)
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
		this.arena.set_start_offset(style_rule, rule_start)
		this.arena.set_length(style_rule, this.lexer.token_end - rule_start)

		return style_rule
	}

	// Parse a selector (everything before '{')
	private parse_selector(): number | null {
		if (this.is_eof()) return null

		let selector_start = this.lexer.token_start
		let selector_line = this.lexer.token_line

		// Create selector node
		let selector = this.arena.create_node()
		this.arena.set_type(selector, NODE_SELECTOR)
		this.arena.set_start_line(selector, selector_line)

		// Consume tokens until we hit '{'
		let last_end = this.lexer.token_end
		while (!this.is_eof() && this.peek_type() !== TOKEN_LEFT_BRACE) {
			last_end = this.lexer.token_end
			this.next_token()
		}

		// Set selector offsets
		this.arena.set_start_offset(selector, selector_start)
		this.arena.set_length(selector, last_end - selector_start)

		return selector
	}

	// Parse a declaration: property: value;
	private parse_declaration(): number | null {
		// Expect identifier (property name)
		if (this.peek_type() !== TOKEN_IDENT) {
			return null
		}

		let prop_start = this.lexer.token_start
		let prop_end = this.lexer.token_end
		let decl_line = this.lexer.token_line

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

		// Track value start (after colon, skipping whitespace)
		let value_start = this.lexer.token_start
		let value_end = value_start

		// Parse value (everything until ';' or '}')
		let has_important = false
		let last_end = this.lexer.token_end

		while (!this.is_eof() && this.peek_type() !== TOKEN_SEMICOLON && this.peek_type() !== TOKEN_RIGHT_BRACE) {
			// Check for ! followed by any identifier (optimized: only check when we see '!')
			if (this.peek_type() === TOKEN_DELIM && this.source[this.lexer.token_start] === '!') {
				// Mark end of value before !important
				value_end = this.lexer.token_start
				// Check if next token is an identifier
				let next_type = this.lexer.next_token_fast()
				if (next_type === TOKEN_IDENT) {
					has_important = true
					last_end = this.lexer.token_end
					break
				}
			}

			last_end = this.lexer.token_end
			value_end = last_end
			this.next_token()
		}

		// Store value position (trimmed)
		let trimmed = this.find_trim_boundaries(value_start, value_end)
		if (trimmed) {
			this.arena.set_value_start(declaration, trimmed[0])
			this.arena.set_value_length(declaration, trimmed[1] - trimmed[0])
		}

		// Set !important flag if found
		if (has_important) {
			this.arena.set_flag(declaration, FLAG_IMPORTANT)
		}

		// Consume ';' if present
		if (this.peek_type() === TOKEN_SEMICOLON) {
			last_end = this.lexer.token_end
			this.next_token()
		}

		// Set declaration length
		this.arena.set_length(declaration, last_end - prop_start)

		return declaration
	}

	// Parse an at-rule: @media, @import, @font-face, etc.
	private parse_atrule(): number | null {
		if (this.peek_type() !== TOKEN_AT_KEYWORD) {
			return null
		}

		let at_rule_start = this.lexer.token_start
		let at_rule_line = this.lexer.token_line

		// Extract at-rule name (skip the '@')
		let at_rule_name = this.source.substring(this.lexer.token_start + 1, this.lexer.token_end)
		let name_start = this.lexer.token_start + 1
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

		// Track prelude start and end
		let prelude_start = this.lexer.token_start
		let prelude_end = prelude_start

		// Parse prelude (everything before '{' or ';')
		while (!this.is_eof() && this.peek_type() !== TOKEN_LEFT_BRACE && this.peek_type() !== TOKEN_SEMICOLON) {
			prelude_end = this.lexer.token_end
			this.next_token()
		}

		// Store prelude position (trimmed)
		let trimmed = this.find_trim_boundaries(prelude_start, prelude_end)
		if (trimmed) {
			this.arena.set_value_start(at_rule, trimmed[0])
			this.arena.set_value_length(at_rule, trimmed[1] - trimmed[0])
		}

		let last_end = this.lexer.token_end

		// Check if this at-rule has a block or is a statement
		if (this.peek_type() === TOKEN_LEFT_BRACE) {
			this.next_token() // consume '{'

			// Determine what to parse inside the block based on the at-rule name
			let has_declarations = this.atrule_has_declarations(at_rule_name)
			let is_conditional = this.atrule_is_conditional(at_rule_name)

			if (has_declarations) {
				// Parse declarations only (like @font-face, @page)
				while (!this.is_eof() && this.peek_type() !== TOKEN_RIGHT_BRACE) {
					let declaration = this.parse_declaration()
					if (declaration !== null) {
						this.arena.append_child(at_rule, declaration)
					} else {
						this.next_token()
					}
				}
			} else if (is_conditional) {
				// Conditional at-rules can contain both declarations and rules (CSS Nesting)
				while (!this.is_eof() && this.peek_type() !== TOKEN_RIGHT_BRACE) {
					// Check for nested at-rule
					if (this.peek_type() === TOKEN_AT_KEYWORD) {
						let nested_at_rule = this.parse_atrule()
						if (nested_at_rule !== null) {
							this.arena.append_child(at_rule, nested_at_rule)
						} else {
							this.next_token()
						}
						continue
					}

					// Try to parse as declaration first
					let declaration = this.parse_declaration()
					if (declaration !== null) {
						this.arena.append_child(at_rule, declaration)
						continue
					}

					// If not a declaration, try parsing as nested style rule
					let nested_rule = this.parse_style_rule()
					if (nested_rule !== null) {
						this.arena.append_child(at_rule, nested_rule)
					} else {
						// Skip unknown tokens
						this.next_token()
					}
				}
			} else {
				// Parse nested rules only (like @keyframes)
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
				last_end = this.lexer.token_end
				this.next_token()
			}
		} else if (this.peek_type() === TOKEN_SEMICOLON) {
			// Statement at-rule (like @import, @namespace)
			last_end = this.lexer.token_end
			this.next_token() // consume ';'
		}

		// Set at-rule length
		this.arena.set_length(at_rule, last_end - at_rule_start)

		return at_rule
	}

	// Determine if an at-rule contains declarations or nested rules
	private atrule_has_declarations(name: string): boolean {
		return DECLARATION_AT_RULES.has(name.toLowerCase())
	}

	// Determine if an at-rule is conditional (can contain both declarations and rules in CSS Nesting)
	private atrule_is_conditional(name: string): boolean {
		return CONDITIONAL_AT_RULES.has(name.toLowerCase())
	}
}
