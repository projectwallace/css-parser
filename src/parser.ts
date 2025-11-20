// CSS Parser - Builds AST using the arena
import { Lexer } from './lexer'
import {
	CSSDataArena,
	NODE_STYLESHEET,
	NODE_STYLE_RULE,
	NODE_SELECTOR,
	NODE_SELECTOR_LIST,
	NODE_DECLARATION,
	NODE_AT_RULE,
	NODE_BLOCK,
	FLAG_IMPORTANT,
	FLAG_HAS_BLOCK,
	FLAG_VENDOR_PREFIXED,
	FLAG_HAS_DECLARATIONS,
} from './arena'
import { CSSNode } from './css-node'
import { ValueParser } from './value-parser'
import { SelectorParser } from './selector-parser'
import { AtRulePreludeParser } from './at-rule-prelude-parser'
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
import { trim_boundaries, is_vendor_prefixed } from './string-utils'

export interface ParserOptions {
	skip_comments?: boolean
	parse_values?: boolean
	parse_selectors?: boolean
	parse_atrule_preludes?: boolean
}

// Static at-rule lookup sets for fast classification
let DECLARATION_AT_RULES = new Set(['font-face', 'font-feature-values', 'page', 'property', 'counter-style'])
let CONDITIONAL_AT_RULES = new Set(['media', 'supports', 'container', 'layer', 'nest'])

export class Parser {
	private source: string
	private lexer: Lexer
	private arena: CSSDataArena
	private value_parser: ValueParser | null
	private selector_parser: SelectorParser | null
	private prelude_parser: AtRulePreludeParser | null
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
		this.value_parser = this.parse_values_enabled ? new ValueParser(this.arena, source) : null
		this.selector_parser = this.parse_selectors_enabled ? new SelectorParser(this.arena, source) : null
		this.prelude_parser = this.parse_atrule_preludes_enabled ? new AtRulePreludeParser(this.arena, source) : null
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
		let stylesheet = this.arena.create_node()
		this.arena.set_type(stylesheet, NODE_STYLESHEET)
		this.arena.set_start_offset(stylesheet, 0)
		this.arena.set_length(stylesheet, this.source.length)
		this.arena.set_start_line(stylesheet, 1)
		this.arena.set_start_column(stylesheet, 1)

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
		let rule_column = this.lexer.token_column

		// Create the style rule node
		let style_rule = this.arena.create_node()
		this.arena.set_type(style_rule, NODE_STYLE_RULE)
		this.arena.set_start_line(style_rule, rule_line)
		this.arena.set_start_column(style_rule, rule_column)

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
		// Capture block start position (right after '{') before consuming the token
		let block_start = this.lexer.token_end
		this.next_token() // consume '{'
		this.arena.set_flag(style_rule, FLAG_HAS_BLOCK) // Style rules always have blocks

		// Create block node
		let block_line = this.lexer.token_line
		let block_column = this.lexer.token_column
		let block_node = this.arena.create_node()
		this.arena.set_type(block_node, NODE_BLOCK)
		this.arena.set_start_offset(block_node, block_start)
		this.arena.set_start_line(block_node, block_line)
		this.arena.set_start_column(block_node, block_column)

		// Parse declarations block (and nested rules for CSS Nesting)
		while (!this.is_eof()) {
			let token_type = this.peek_type()
			if (token_type === TOKEN_RIGHT_BRACE) break

			// Check for nested at-rule
			if (token_type === TOKEN_AT_KEYWORD) {
				let nested_at_rule = this.parse_atrule()
				if (nested_at_rule !== null) {
					this.arena.append_child(block_node, nested_at_rule)
				} else {
					this.next_token()
				}
				continue
			}

			// Try to parse as declaration first
			let declaration = this.parse_declaration()
			if (declaration !== null) {
				this.arena.set_flag(style_rule, FLAG_HAS_DECLARATIONS)
				this.arena.append_child(block_node, declaration)
				continue
			}

			// If not a declaration, try parsing as nested style rule
			let nested_rule = this.parse_style_rule()
			if (nested_rule !== null) {
				this.arena.append_child(block_node, nested_rule)
			} else {
				// Skip unknown tokens
				this.next_token()
			}
		}

		// Expect '}' and calculate block length (excluding closing brace)
		let block_end = this.lexer.token_start
		if (this.peek_type() === TOKEN_RIGHT_BRACE) {
			block_end = this.lexer.token_start // Position of '}' (not included in block)
			this.next_token() // consume '}'
		}

		// Set block length and append to style rule
		this.arena.set_length(block_node, block_end - block_start)
		this.arena.append_child(style_rule, block_node)

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
		let selector = this.arena.create_node()
		this.arena.set_type(selector, NODE_SELECTOR_LIST)
		this.arena.set_start_line(selector, selector_line)
		this.arena.set_start_column(selector, selector_column)
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
		let decl_column = this.lexer.token_column

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
		this.arena.set_start_column(declaration, decl_column)
		this.arena.set_start_offset(declaration, prop_start)

		// Store property name position
		this.arena.set_content_start(declaration, prop_start)
		this.arena.set_content_length(declaration, prop_end - prop_start)

		// Check for vendor prefix and set flag if detected
		if (is_vendor_prefixed(this.source, prop_start, prop_end)) {
			this.arena.set_flag(declaration, FLAG_VENDOR_PREFIXED)
		}

		// Track value start (after colon, skipping whitespace)
		let value_start = this.lexer.token_start
		let value_end = value_start

		// Parse value (everything until ';' or '}')
		let has_important = false
		let last_end = this.lexer.token_end

		while (!this.is_eof()) {
			let token_type = this.peek_type()
			if (token_type === TOKEN_SEMICOLON || token_type === TOKEN_RIGHT_BRACE) break

			// Check for ! followed by any identifier (optimized: only check when we see '!')
			if (token_type === TOKEN_DELIM && this.source[this.lexer.token_start] === '!') {
				// Mark end of value before !important
				value_end = this.lexer.token_start
				// Check if next token is an identifier
				let next_type = this.lexer.next_token_fast()
				if (next_type === TOKEN_IDENT) {
					has_important = true
					last_end = this.lexer.token_end
					this.next_token() // Advance to next token after "important"
					break
				}
			}

			last_end = this.lexer.token_end
			value_end = last_end
			this.next_token()
		}

		// Store value position (trimmed) and parse value nodes
		let trimmed = trim_boundaries(this.source, value_start, value_end)
		if (trimmed) {
			// Store raw value string offsets (for fast string access)
			this.arena.set_value_start(declaration, trimmed[0])
			this.arena.set_value_length(declaration, trimmed[1] - trimmed[0])

			// Parse value into structured nodes (only if enabled)
			if (this.parse_values_enabled && this.value_parser) {
				let valueNodes = this.value_parser.parse_value(trimmed[0], trimmed[1])

				// Link value nodes as children of the declaration
				if (valueNodes.length > 0) {
					this.arena.set_first_child(declaration, valueNodes[0])
					this.arena.set_last_child(declaration, valueNodes[valueNodes.length - 1])

					// Chain value nodes as siblings
					for (let i = 0; i < valueNodes.length - 1; i++) {
						this.arena.set_next_sibling(valueNodes[i], valueNodes[i + 1])
					}
				}
			}
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
		let at_rule_column = this.lexer.token_column

		// Extract at-rule name (skip the '@')
		let at_rule_name = this.source.substring(this.lexer.token_start + 1, this.lexer.token_end)
		let name_start = this.lexer.token_start + 1
		let name_length = at_rule_name.length

		this.next_token() // consume @keyword

		// Create at-rule node
		let at_rule = this.arena.create_node()
		this.arena.set_type(at_rule, NODE_AT_RULE)
		this.arena.set_start_line(at_rule, at_rule_line)
		this.arena.set_start_column(at_rule, at_rule_column)
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
		let trimmed = trim_boundaries(this.source, prelude_start, prelude_end)
		if (trimmed) {
			this.arena.set_value_start(at_rule, trimmed[0])
			this.arena.set_value_length(at_rule, trimmed[1] - trimmed[0])

			// Parse prelude if enabled
			if (this.prelude_parser) {
				let prelude_nodes = this.prelude_parser.parse_prelude(at_rule_name, trimmed[0], trimmed[1], at_rule_line, at_rule_column)
				for (let prelude_node of prelude_nodes) {
					this.arena.append_child(at_rule, prelude_node)
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

			// Create block node
			let block_line = this.lexer.token_line
			let block_column = this.lexer.token_column
			let block_node = this.arena.create_node()
			this.arena.set_type(block_node, NODE_BLOCK)
			this.arena.set_start_offset(block_node, block_start)
			this.arena.set_start_line(block_node, block_line)
			this.arena.set_start_column(block_node, block_column)

			// Determine what to parse inside the block based on the at-rule name
			let has_declarations = this.atrule_has_declarations(at_rule_name)
			let is_conditional = this.atrule_is_conditional(at_rule_name)

			if (has_declarations) {
				// Parse declarations only (like @font-face, @page)
				while (!this.is_eof()) {
					let token_type = this.peek_type()
					if (token_type === TOKEN_RIGHT_BRACE) break

					let declaration = this.parse_declaration()
					if (declaration !== null) {
						this.arena.append_child(block_node, declaration)
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
							this.arena.append_child(block_node, nested_at_rule)
						} else {
							this.next_token()
						}
						continue
					}

					// Try to parse as declaration first
					let declaration = this.parse_declaration()
					if (declaration !== null) {
						this.arena.append_child(block_node, declaration)
						continue
					}

					// If not a declaration, try parsing as nested style rule
					let nested_rule = this.parse_style_rule()
					if (nested_rule !== null) {
						this.arena.append_child(block_node, nested_rule)
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
						this.arena.append_child(block_node, rule)
					} else {
						this.next_token()
					}
				}
			}

			// Consume '}' (block excludes closing brace, but at-rule includes it)
			if (this.peek_type() === TOKEN_RIGHT_BRACE) {
				let block_end = this.lexer.token_start // Position of '}' (not included in block)
				this.next_token()
				last_end = this.lexer.token_end // Position after '}' (included in at-rule)

				// Set block length (excludes closing brace)
				this.arena.set_length(block_node, block_end - block_start)
			} else {
				// No closing brace found (error recovery)
				this.arena.set_length(block_node, last_end - block_start)
			}

			this.arena.append_child(at_rule, block_node)
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

// Re-export node type constants so consumers don't need to import from arena
export {
	NODE_STYLESHEET,
	NODE_STYLE_RULE,
	NODE_AT_RULE,
	NODE_DECLARATION,
	NODE_SELECTOR,
	NODE_COMMENT,
	NODE_BLOCK,
	NODE_VALUE_KEYWORD,
	NODE_VALUE_NUMBER,
	NODE_VALUE_DIMENSION,
	NODE_VALUE_STRING,
	NODE_VALUE_COLOR,
	NODE_VALUE_FUNCTION,
	NODE_VALUE_OPERATOR,
	NODE_SELECTOR_LIST,
	NODE_SELECTOR_TYPE,
	NODE_SELECTOR_CLASS,
	NODE_SELECTOR_ID,
	NODE_SELECTOR_ATTRIBUTE,
	NODE_SELECTOR_PSEUDO_CLASS,
	NODE_SELECTOR_PSEUDO_ELEMENT,
	NODE_SELECTOR_COMBINATOR,
	NODE_SELECTOR_UNIVERSAL,
	NODE_SELECTOR_NESTING,
	NODE_PRELUDE_MEDIA_QUERY,
	NODE_PRELUDE_MEDIA_FEATURE,
	NODE_PRELUDE_MEDIA_TYPE,
	NODE_PRELUDE_CONTAINER_QUERY,
	NODE_PRELUDE_SUPPORTS_QUERY,
	NODE_PRELUDE_LAYER_NAME,
	NODE_PRELUDE_IDENTIFIER,
	NODE_PRELUDE_OPERATOR,
	NODE_PRELUDE_IMPORT_URL,
	NODE_PRELUDE_IMPORT_LAYER,
	NODE_PRELUDE_IMPORT_SUPPORTS,
	FLAG_IMPORTANT,
} from './arena'
