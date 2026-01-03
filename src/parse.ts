// CSS Parser - Builds AST using the arena
import { Lexer } from './tokenize'
import { CSSDataArena, STYLESHEET, STYLE_RULE, SELECTOR_LIST, AT_RULE, BLOCK, AT_RULE_PRELUDE, FLAG_HAS_BLOCK, FLAG_HAS_DECLARATIONS } from './arena'
import { CSSNode } from './css-node'
import { SelectorParser } from './parse-selector'
import { AtRulePreludeParser } from './parse-atrule-prelude'
import { DeclarationParser } from './parse-declaration'
import { TOKEN_EOF, TOKEN_LEFT_BRACE, TOKEN_RIGHT_BRACE, TOKEN_SEMICOLON, TOKEN_IDENT, TOKEN_AT_KEYWORD, TOKEN_HASH, TOKEN_DELIM, TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN, TOKEN_LEFT_BRACKET, TOKEN_RIGHT_BRACKET, TOKEN_COMMA, TOKEN_COLON } from './token-types'
import { trim_boundaries } from './parse-utils'
import { CHAR_PERIOD, CHAR_GREATER_THAN, CHAR_PLUS, CHAR_TILDE, CHAR_AMPERSAND } from './string-utils'

export interface ParserOptions {
	skip_comments?: boolean
	parse_values?: boolean
	parse_selectors?: boolean
	parse_atrule_preludes?: boolean
}

// Static at-rule lookup sets for fast classification
let DECLARATION_AT_RULES = new Set(['font-face', 'font-feature-values', 'page', 'property', 'counter-style'])
let CONDITIONAL_AT_RULES = new Set(['media', 'supports', 'container', 'layer', 'nest'])

/** @internal */
export class Parser {
	private source: string
	private lexer: Lexer
	private arena: CSSDataArena
	private selector_parser: SelectorParser | null
	private prelude_parser: AtRulePreludeParser | null
	private declaration_parser: DeclarationParser
	private parse_values_enabled: boolean
	private parse_selectors_enabled: boolean
	private parse_atrule_preludes_enabled: boolean

	constructor(source: string, options?: ParserOptions) {
		this.source = source

		// Support legacy boolean parameter for backwards compatibility
		let opts: ParserOptions = options || {}

		let skip_comments = opts.skip_comments ?? true
		this.parse_values_enabled = opts.parse_values ?? true
		this.parse_selectors_enabled = opts.parse_selectors ?? true
		this.parse_atrule_preludes_enabled = opts.parse_atrule_preludes ?? true

		this.lexer = new Lexer(source, skip_comments)
		// Calculate optimal capacity based on source size
		let capacity = CSSDataArena.capacity_for_source(source.length)
		this.arena = new CSSDataArena(capacity)

		// Only create parsers if needed
		this.selector_parser = this.parse_selectors_enabled ? new SelectorParser(this.arena, source) : null
		this.prelude_parser = this.parse_atrule_preludes_enabled ? new AtRulePreludeParser(this.arena, source) : null
		this.declaration_parser = new DeclarationParser(this.arena, source, this.parse_values_enabled)
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
		let stylesheet = this.arena.create_node(STYLESHEET, 0, this.source.length, 1, 1)

		// Parse all rules at the top level
		let rules: number[] = []
		while (!this.is_eof()) {
			let rule = this.parse_rule()
			if (rule !== null) {
				rules.push(rule)
			} else {
				// Skip unknown tokens
				this.next_token()
			}
		}

		// Link all rules as children
		this.arena.append_children(stylesheet, rules)

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
		let rule_column = this.lexer.token_column

		// Create the style rule node (length will be set later)
		let style_rule = this.arena.create_node(
			STYLE_RULE,
			rule_start,
			0, // length unknown yet
			rule_line,
			rule_column,
		)

		// Parse selector (everything until '{')
		let selector = this.parse_selector()

		// Expect '{'
		if (this.peek_type() !== TOKEN_LEFT_BRACE) {
			// Error recovery: skip to next rule
			return null
		}
		// Capture block start position (right after '{') before consuming the token
		let block_start = this.lexer.token_end
		this.next_token() // consume '{'
		this.arena.set_flag(style_rule, FLAG_HAS_BLOCK) // Style rules always have blocks

		// Create block node (length will be set later)
		let block_line = this.lexer.token_line
		let block_column = this.lexer.token_column
		let block_node = this.arena.create_node(
			BLOCK,
			block_start,
			0, // length unknown yet
			block_line,
			block_column,
		)

		// Parse declarations block (and nested rules for CSS Nesting)
		let block_children: number[] = []
		while (!this.is_eof()) {
			let token_type = this.peek_type()
			if (token_type === TOKEN_RIGHT_BRACE) break

			// Check for nested at-rule
			if (token_type === TOKEN_AT_KEYWORD) {
				let nested_at_rule = this.parse_atrule()
				if (nested_at_rule !== null) {
					block_children.push(nested_at_rule)
				} else {
					this.next_token()
				}
				continue
			}

			// Try to parse as declaration first
			let declaration = this.parse_declaration()
			if (declaration !== null) {
				this.arena.set_flag(style_rule, FLAG_HAS_DECLARATIONS)
				block_children.push(declaration)
				continue
			}

			// If not a declaration, try parsing as nested style rule
			let nested_rule = this.parse_style_rule()
			if (nested_rule !== null) {
				block_children.push(nested_rule)
			} else {
				// Skip unknown tokens
				this.next_token()
			}
		}

		// Expect '}' and calculate lengths (block excludes brace, rule includes it)
		let block_end = this.lexer.token_start
		let rule_end = this.lexer.token_end
		if (this.peek_type() === TOKEN_RIGHT_BRACE) {
			block_end = this.lexer.token_start // Position of '}' (not included in block)
			rule_end = this.lexer.token_end // Position after '}' (included in rule)
			this.next_token() // consume '}'
		}

		// Set block length and link its children
		this.arena.set_length(block_node, block_end - block_start)
		this.arena.append_children(block_node, block_children)

		// Set the rule's length and link children (selector + block)
		this.arena.set_length(style_rule, rule_end - rule_start)
		let style_rule_children: number[] = []
		if (selector !== null) {
			style_rule_children.push(selector)
		}
		style_rule_children.push(block_node)
		this.arena.append_children(style_rule, style_rule_children)

		return style_rule
	}

	// Parse a selector (everything before '{')
	private parse_selector(): number | null {
		if (this.is_eof()) return null

		let selector_start = this.lexer.token_start
		let selector_line = this.lexer.token_line
		let selector_column = this.lexer.token_column

		// Consume tokens until we hit '{'
		let last_end = this.lexer.token_end
		while (!this.is_eof() && this.peek_type() !== TOKEN_LEFT_BRACE) {
			last_end = this.lexer.token_end
			this.next_token()
		}

		// If detailed selector parsing is enabled, use SelectorParser
		if (this.parse_selectors_enabled && this.selector_parser) {
			let selectorNode = this.selector_parser.parse_selector(selector_start, last_end, selector_line, selector_column)
			if (selectorNode !== null) {
				return selectorNode
			}
		}

		// Otherwise create a simple selector list node with just text offsets
		let selector = this.arena.create_node(SELECTOR_LIST, selector_start, last_end - selector_start, selector_line, selector_column)

		return selector
	}

	// Parse a declaration: property: value;
	private parse_declaration(): number | null {
		// Check if this could be a declaration (identifier or browser hack prefix)
		const token_type = this.peek_type()

		// Accept identifiers, at-keywords, and hash tokens
		if (token_type === TOKEN_IDENT || token_type === TOKEN_AT_KEYWORD || token_type === TOKEN_HASH) {
			return this.declaration_parser.parse_declaration_with_lexer(this.lexer, this.source.length)
		}

		// For delimiters and special tokens, check if they could be browser hack prefixes
		// Only accept single-character prefixes that are not CSS selector syntax
		if (
			token_type === TOKEN_DELIM ||
			token_type === TOKEN_LEFT_PAREN ||
			token_type === TOKEN_RIGHT_PAREN ||
			token_type === TOKEN_LEFT_BRACKET ||
			token_type === TOKEN_RIGHT_BRACKET ||
			token_type === TOKEN_COMMA ||
			token_type === TOKEN_COLON
		) {
			// Check if this delimiter could be a browser hack (not a selector combinator)
			const char_code = this.source.charCodeAt(this.lexer.token_start)
			// Exclude selector-specific delimiters: . (class), > (child), + (adjacent), ~ (general), & (nesting)
			if (char_code === CHAR_PERIOD || char_code === CHAR_GREATER_THAN || char_code === CHAR_PLUS || char_code === CHAR_TILDE || char_code === CHAR_AMPERSAND) {
				return null
			}
			// Let DeclarationParser try to parse it and return null if it's not a valid declaration
			return this.declaration_parser.parse_declaration_with_lexer(this.lexer, this.source.length)
		}

		return null
	}

	// Parse an at-rule: @media, @import, @font-face, etc.
	private parse_atrule(): number | null {
		if (this.peek_type() !== TOKEN_AT_KEYWORD) {
			return null
		}

		let at_rule_start = this.lexer.token_start
		let at_rule_line = this.lexer.token_line
		let at_rule_column = this.lexer.token_column

		// Extract at-rule name (skip the '@')
		let name_start = this.lexer.token_start + 1
		let name_length = this.lexer.token_end - name_start
		let at_rule_name = this.source.substring(name_start, this.lexer.token_end)

		this.next_token() // consume @keyword

		// Create at-rule node (length will be set later)
		let at_rule = this.arena.create_node(
			AT_RULE,
			at_rule_start,
			0, // length unknown yet
			at_rule_line,
			at_rule_column,
		)

		// Store at-rule name in contentStart/contentLength
		this.arena.set_content_start_delta(at_rule, name_start - at_rule_start)
		this.arena.set_content_length(at_rule, name_length)

		// Track prelude start and end
		let prelude_start = this.lexer.token_start
		let prelude_end = prelude_start

		// Parse prelude (everything before '{' or ';')
		while (!this.is_eof()) {
			let token_type = this.peek_type()
			if (token_type === TOKEN_LEFT_BRACE || token_type === TOKEN_SEMICOLON) break
			prelude_end = this.lexer.token_end
			this.next_token()
		}

		// Store prelude position (trimmed)
		let trimmed = trim_boundaries(this.source, prelude_start, prelude_end)
		let prelude_wrapper: number | null = null
		if (trimmed) {
			this.arena.set_value_start_delta(at_rule, trimmed[0] - at_rule_start)
			this.arena.set_value_length(at_rule, trimmed[1] - trimmed[0])

			// Parse prelude if enabled
			if (this.prelude_parser) {
				let prelude_nodes = this.prelude_parser.parse_prelude(at_rule_name, trimmed[0], trimmed[1], at_rule_line, at_rule_column)

				// Wrap prelude nodes in an AT_RULE_PRELUDE wrapper
				if (prelude_nodes.length > 0) {
					prelude_wrapper = this.arena.create_node(AT_RULE_PRELUDE, trimmed[0], trimmed[1] - trimmed[0], at_rule_line, at_rule_column)
					this.arena.append_children(prelude_wrapper, prelude_nodes)
				}
			}
		}

		let last_end = this.lexer.token_end

		// Check if this at-rule has a block or is a statement
		if (this.peek_type() === TOKEN_LEFT_BRACE) {
			// Capture block start position (right after '{') before consuming the token
			let block_start = this.lexer.token_end
			this.next_token() // consume '{'
			this.arena.set_flag(at_rule, FLAG_HAS_BLOCK) // At-rule has a block

			// Create block node (length will be set later)
			let block_line = this.lexer.token_line
			let block_column = this.lexer.token_column
			let block_node = this.arena.create_node(
				BLOCK,
				block_start,
				0, // length unknown yet
				block_line,
				block_column,
			)

			// Determine what to parse inside the block based on the at-rule name
			let has_declarations = this.atrule_has_declarations(at_rule_name)
			let is_conditional = this.atrule_is_conditional(at_rule_name)
			let block_children: number[] = []

			if (has_declarations) {
				// Parse declarations only (like @font-face, @page)
				while (!this.is_eof()) {
					let token_type = this.peek_type()
					if (token_type === TOKEN_RIGHT_BRACE) break

					let declaration = this.parse_declaration()
					if (declaration !== null) {
						block_children.push(declaration)
					} else {
						this.next_token()
					}
				}
			} else if (is_conditional) {
				// Conditional at-rules can contain both declarations and rules (CSS Nesting)
				while (!this.is_eof()) {
					let token_type = this.peek_type()
					if (token_type === TOKEN_RIGHT_BRACE) break

					// Check for nested at-rule
					if (token_type === TOKEN_AT_KEYWORD) {
						let nested_at_rule = this.parse_atrule()
						if (nested_at_rule !== null) {
							block_children.push(nested_at_rule)
						} else {
							this.next_token()
						}
						continue
					}

					// Try to parse as declaration first
					let declaration = this.parse_declaration()
					if (declaration !== null) {
						block_children.push(declaration)
						continue
					}

					// If not a declaration, try parsing as nested style rule
					let nested_rule = this.parse_style_rule()
					if (nested_rule !== null) {
						block_children.push(nested_rule)
					} else {
						// Skip unknown tokens
						this.next_token()
					}
				}
			} else {
				// Parse nested rules only (like @keyframes)
				while (!this.is_eof()) {
					let token_type = this.peek_type()
					if (token_type === TOKEN_RIGHT_BRACE) break

					let rule = this.parse_rule()
					if (rule !== null) {
						block_children.push(rule)
					} else {
						this.next_token()
					}
				}
			}

			// Consume '}' (block excludes closing brace, but at-rule includes it)
			if (this.peek_type() === TOKEN_RIGHT_BRACE) {
				let block_end = this.lexer.token_start // Position of '}' (not included in block)
				last_end = this.lexer.token_end // Position after '}' (included in at-rule)
				this.next_token()

				// Set block length (excludes closing brace)
				this.arena.set_length(block_node, block_end - block_start)
			} else {
				// No closing brace found (error recovery)
				this.arena.set_length(block_node, last_end - block_start)
			}

			// Link block children
			this.arena.append_children(block_node, block_children)

			// Build at-rule children: [prelude_wrapper?, block]
			let at_rule_children: number[] = []
			if (prelude_wrapper !== null) {
				at_rule_children.push(prelude_wrapper)
			}
			at_rule_children.push(block_node)

			// Set at-rule length and link children
			this.arena.set_length(at_rule, last_end - at_rule_start)
			this.arena.append_children(at_rule, at_rule_children)
		} else if (this.peek_type() === TOKEN_SEMICOLON) {
			// Statement at-rule (like @import, @namespace)
			last_end = this.lexer.token_end
			this.next_token() // consume ';'

			// Set at-rule length and link children (prelude wrapper only, no block)
			this.arena.set_length(at_rule, last_end - at_rule_start)
			if (prelude_wrapper !== null) {
				this.arena.append_children(at_rule, [prelude_wrapper])
			}
		} else {
			// No block or semicolon (error recovery)
			this.arena.set_length(at_rule, last_end - at_rule_start)
			if (prelude_wrapper !== null) {
				this.arena.append_children(at_rule, [prelude_wrapper])
			}
		}

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

/**
 * Parse CSS and return an AST
 * @param source - The CSS source code to parse
 * @param options - Parser options
 * @returns The root CSSNode of the AST
 */
export function parse(source: string, options?: ParserOptions): CSSNode {
	const parser = new Parser(source, options)
	return parser.parse()
}
