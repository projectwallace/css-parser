// Value Parser - Parses CSS declaration values into structured AST nodes
import { Lexer } from './tokenize'
import {
	CSSDataArena,
	IDENTIFIER,
	NUMBER,
	DIMENSION,
	STRING,
	HASH,
	FUNCTION,
	OPERATOR,
	PARENTHESIS,
	URL,
	UNICODE_RANGE,
	IF_BRANCH,
	VALUE,
	DECLARATION,
	MEDIA_FEATURE,
} from './arena'
import {
	TOKEN_IDENT,
	TOKEN_NUMBER,
	TOKEN_PERCENTAGE,
	TOKEN_DIMENSION,
	TOKEN_STRING,
	TOKEN_HASH,
	TOKEN_FUNCTION,
	TOKEN_DELIM,
	TOKEN_COMMA,
	TOKEN_COLON,
	TOKEN_SEMICOLON,
	TOKEN_EOF,
	TOKEN_LEFT_PAREN,
	TOKEN_RIGHT_PAREN,
	TOKEN_UNICODE_RANGE,
} from './token-types'
import {
	is_whitespace,
	CHAR_MINUS_HYPHEN,
	CHAR_PLUS,
	CHAR_ASTERISK,
	CHAR_FORWARD_SLASH,
	str_equals,
} from './string-utils'
import { CSSNode } from './css-node'
import type { Value } from './node-types'

/** @internal */
export class ValueParser {
	private lexer: Lexer
	private arena: CSSDataArena
	private source: string
	private value_end: number

	constructor(arena: CSSDataArena, source: string) {
		this.arena = arena
		this.source = source
		// Create a lexer instance for value parsing
		this.lexer = new Lexer(source)
		this.value_end = 0
	}

	// Parse a declaration value range into a VALUE wrapper node
	// Returns single VALUE node index
	parse_value(start: number, end: number, start_line: number, start_column: number): number {
		this.value_end = end

		// Position lexer at value start with provided line/column
		this.lexer.seek(start, start_line, start_column)

		// Parse individual value tokens
		let value_nodes = this.parse_value_tokens()

		// Wrap in VALUE node
		if (value_nodes.length === 0) {
			// Empty value - create VALUE node with no children
			let value_node = this.arena.create_node(VALUE, start, 0, start_line, start_column)
			return value_node
		}

		// Create VALUE wrapper node spanning all value tokens
		let first_node_start = this.arena.get_start_offset(value_nodes[0])
		let last_node_index = value_nodes.at(-1)!
		let last_node_end =
			this.arena.get_start_offset(last_node_index) + this.arena.get_length(last_node_index)

		let value_node = this.arena.create_node(
			VALUE,
			first_node_start,
			last_node_end - first_node_start,
			start_line,
			start_column,
		)

		// Link value tokens as children
		this.arena.append_children(value_node, value_nodes)

		return value_node
	}

	// Core token parsing logic
	private parse_value_tokens(): number[] {
		let nodes: number[] = []

		// Parse all tokens in the value range
		while (this.lexer.pos < this.value_end) {
			// Get next token without skipping whitespace (whitespace matters in values)
			this.lexer.next_token_fast(false)

			// Stop if we've reached the end of the value
			if (this.lexer.token_start >= this.value_end) break

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break

			// Skip whitespace tokens (they're separators, not value nodes)
			if (this.is_whitespace_inline()) {
				continue
			}

			// Parse this token into a value node (token_type already cached in lexer.token_type)
			let node = this.parse_value_node()
			if (node !== null) {
				nodes.push(node)
			}
		}

		return nodes
	}

	// Helper to check if token is all whitespace (inline for hot paths)
	private is_whitespace_inline(): boolean {
		if (this.lexer.token_start >= this.lexer.token_end) return false
		for (let i = this.lexer.token_start; i < this.lexer.token_end; i++) {
			if (!is_whitespace(this.source.charCodeAt(i))) {
				return false
			}
		}
		return true
	}

	private parse_value_node(): number | null {
		let token_type = this.lexer.token_type
		let start = this.lexer.token_start
		let end = this.lexer.token_end

		switch (token_type) {
			case TOKEN_IDENT:
				return this.create_node(IDENTIFIER, start, end)

			case TOKEN_NUMBER:
				return this.create_node(NUMBER, start, end)

			case TOKEN_PERCENTAGE:
			case TOKEN_DIMENSION:
				return this.create_node(DIMENSION, start, end)

			case TOKEN_STRING:
				return this.create_node(STRING, start, end)

			case TOKEN_HASH:
				return this.create_node(HASH, start, end)

			case TOKEN_UNICODE_RANGE:
				return this.create_node(UNICODE_RANGE, start, end)

			case TOKEN_FUNCTION:
				return this.parse_function_node(start, end)

			case TOKEN_DELIM:
				return this.parse_operator_node(start, end)

			case TOKEN_COMMA:
			case TOKEN_COLON:
			case TOKEN_SEMICOLON:
				return this.create_node(OPERATOR, start, end)

			case TOKEN_LEFT_PAREN:
				return this.parse_parenthesis_node(start, end)

			default:
				// Unknown token type, skip it
				return null
		}
	}

	private create_node(node_type: number, start: number, end: number): number {
		let node = this.arena.create_node(
			node_type,
			start,
			end - start,
			this.lexer.token_line,
			this.lexer.token_column,
		)
		// Skip set_content_start_delta since delta = start - start = 0 (already zero-initialized)
		this.arena.set_content_length(node, end - start)
		return node
	}

	private create_operator_node(start: number, end: number): number {
		return this.create_node(OPERATOR, start, end)
	}

	private parse_operator_node(start: number, end: number): number | null {
		// Only create operator nodes for specific delimiters: + - * /
		let ch = this.source.charCodeAt(start)
		if (
			ch === CHAR_PLUS ||
			ch === CHAR_MINUS_HYPHEN ||
			ch === CHAR_ASTERISK ||
			ch === CHAR_FORWARD_SLASH
		) {
			return this.create_operator_node(start, end)
		}
		// Other delimiters are ignored for now
		return null
	}

	private parse_function_node(start: number, end: number): number {
		// Function name is everything before the '('
		// The lexer's TOKEN_FUNCTION includes the '(' at the end
		let name_end = end - 1 // Exclude the '('

		// Get function name to check for special handling
		let func_name_substr = this.source.substring(start, name_end)

		// Dispatch to dedicated parser for if()
		if (str_equals('if', func_name_substr)) {
			return this.parse_if_function_node(start, end)
		}

		// Create URL or function node based on function name (length will be set later)
		let node = this.arena.create_node(
			str_equals('url', func_name_substr) ? URL : FUNCTION,
			start,
			0, // length unknown yet
			this.lexer.token_line,
			this.lexer.token_column,
		)
		this.arena.set_content_start_delta(node, 0)
		this.arena.set_content_length(node, name_end - start)

		// Special handling for url() and src() functions with unquoted content:
		// Don't parse contents to preserve URLs with dots, base64, inline SVGs, etc.
		// Users can extract the full URL from the function's text property
		// Note: Quoted urls like url("...") or url('...') parse normally
		if (str_equals('url', func_name_substr) || str_equals('src', func_name_substr)) {
			// Peek at the next token to see if it's a string
			// If it's a string, parse normally. Otherwise, skip parsing children.
			let save_pos = this.lexer.save_position()
			this.lexer.next_token_fast(false)

			// Skip whitespace
			while (this.is_whitespace_inline() && this.lexer.pos < this.value_end) {
				this.lexer.next_token_fast(false)
			}

			let first_token_type = this.lexer.token_type

			// Restore lexer position
			this.lexer.restore_position(save_pos)

			// If the first non-whitespace token is a string, parse normally
			if (first_token_type === TOKEN_STRING) {
				// Fall through to normal parsing below
			} else {
				// Unquoted URL - don't parse children
				// Note: We can't rely on value_end because URLs may contain semicolons
				// that confuse the declaration parser (e.g., data:image/png;base64,...)
				// So we consume tokens until we find the matching ')' regardless of value_end
				let paren_depth = 1
				let func_end = end
				let content_start = end // Position after 'url('
				let content_end = end

				// Just consume tokens until we find the matching ')'
				// Don't create child nodes
				while (paren_depth > 0) {
					this.lexer.next_token_fast(false)

					let token_type = this.lexer.token_type
					if (token_type === TOKEN_EOF) break

					// Track parentheses depth
					if (token_type === TOKEN_LEFT_PAREN || token_type === TOKEN_FUNCTION) {
						paren_depth++
					} else if (token_type === TOKEN_RIGHT_PAREN) {
						paren_depth--
						if (paren_depth === 0) {
							content_end = this.lexer.token_start // Position of ')'
							func_end = this.lexer.token_end
							break
						}
					}
				}

				// Set function total length (includes opening and closing parens)
				this.arena.set_length(node, func_end - start)

				// Set value to the content between parentheses (accessible via node.value)
				this.arena.set_value_start_delta(node, content_start - start)
				this.arena.set_value_length(node, content_end - content_start)

				return node
			}
		}

		// Parse function arguments (everything until matching ')')
		let args: number[] = []
		let paren_depth = 1
		let func_end = end
		let content_start = end // Position after function name and '('
		let content_end = end

		while (this.lexer.pos < this.value_end && paren_depth > 0) {
			this.lexer.next_token_fast(false)

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break
			if (this.lexer.token_start >= this.value_end) break

			// Check for closing paren
			// Note: We don't track paren_depth for TOKEN_LEFT_PAREN or TOKEN_FUNCTION here
			// because parse_value_node() will recursively handle them
			if (token_type === TOKEN_RIGHT_PAREN) {
				paren_depth--
				if (paren_depth === 0) {
					content_end = this.lexer.token_start // Position of ')'
					func_end = this.lexer.token_end
					break
				}
			}

			// Skip whitespace
			if (this.is_whitespace_inline()) continue

			// Parse argument node
			let arg_node = this.parse_value_node()
			if (arg_node !== null) {
				args.push(arg_node)
			}
		}

		// Set function total length
		this.arena.set_length(node, func_end - start)

		// Set value to the content between parentheses (accessible via node.value)
		this.arena.set_value_start_delta(node, content_start - start)
		this.arena.set_value_length(node, content_end - content_start)

		// Link arguments as children
		this.arena.append_children(node, args)

		return node
	}

	/**
	 * Parse an if() inline conditional function.
	 *
	 * Spec grammar (CSS Values Level 5):
	 *   if( <if-branch>+ )
	 *   <if-branch>   = <if-condition> : <declaration-value>? ;?
	 *   <if-condition> = style(…) | media(…) | supports(…) | else
	 *
	 * Each branch becomes an IF_BRANCH child of the FUNCTION("if") node.
	 * The colon and semicolons are structural separators and do not become
	 * OPERATOR nodes — structure is carried by the IF_BRANCH nodes.
	 *
	 * IF_BRANCH arena fields:
	 *   content  → condition text (e.g. "style(--x: 1)" or "else")
	 *   value    → value text (e.g. "green")
	 *   children → [condition-node, VALUE-node?]
	 *              condition-node: FUNCTION(style/supports/media) or IDENTIFIER(else)
	 *              VALUE-node: wraps the parsed value tokens; absent when value is empty
	 */
	private parse_if_function_node(start: number, end: number): number {
		let name_end = end - 1 // exclude '('
		let save_line = this.lexer.token_line
		let save_col = this.lexer.token_column

		let node = this.arena.create_node(FUNCTION, start, 0, save_line, save_col)
		this.arena.set_content_start_delta(node, 0)
		this.arena.set_content_length(node, name_end - start) // length of "if"

		let branches: number[] = []
		let func_end = end
		let content_start = end // right after 'if('
		let content_end = end
		let if_closed = false

		while (this.lexer.pos < this.value_end && !if_closed) {
			this.lexer.next_token_fast(false)
			let tt = this.lexer.token_type

			if (tt === TOKEN_EOF) break
			if (this.lexer.token_start >= this.value_end) break

			if (tt === TOKEN_RIGHT_PAREN) {
				content_end = this.lexer.token_start
				func_end = this.lexer.token_end
				break
			}

			// Skip whitespace and any stray separators between branches
			if (this.is_whitespace_inline() || tt === TOKEN_SEMICOLON || tt === TOKEN_COLON) continue

			// ── Condition ──────────────────────────────────────────────────────
			let branch_start = this.lexer.token_start
			let branch_line = this.lexer.token_line
			let branch_col = this.lexer.token_column

			// Condition functions get specialized parsing; identifiers ("else") use generic
			let condition_node: number | null
			if (tt === TOKEN_FUNCTION) {
				condition_node = this.parse_if_condition_function(
					this.lexer.token_start,
					this.lexer.token_end,
				)
			} else {
				condition_node = this.parse_value_node()
			}
			if (condition_node === null) continue

			let condition_end_pos =
				this.arena.get_start_offset(condition_node) + this.arena.get_length(condition_node)

			// ── Find the ':' separator ─────────────────────────────────────────
			let colon_found = false
			while (this.lexer.pos < this.value_end) {
				this.lexer.next_token_fast(false)
				let t = this.lexer.token_type
				if (t === TOKEN_EOF) break
				if (this.lexer.token_start >= this.value_end) break
				if (this.is_whitespace_inline()) continue
				if (t === TOKEN_COLON) {
					colon_found = true
					break
				}
				if (t === TOKEN_RIGHT_PAREN) {
					// Condition with no colon — malformed; still record branch, close if()
					content_end = this.lexer.token_start
					func_end = this.lexer.token_end
					if_closed = true
					break
				}
				// Skip other unexpected tokens
			}

			// ── Value tokens until ';' or end of if() ────────────────────────
			let value_tokens: number[] = []
			let value_start = -1
			let value_last_end = condition_end_pos
			let value_line = 0
			let value_col = 0

			if (colon_found && !if_closed) {
				while (this.lexer.pos < this.value_end) {
					this.lexer.next_token_fast(false)
					let t = this.lexer.token_type
					if (t === TOKEN_EOF) break
					if (this.lexer.token_start >= this.value_end) break
					if (this.is_whitespace_inline()) continue

					if (t === TOKEN_SEMICOLON) break // end of this branch

					if (t === TOKEN_RIGHT_PAREN) {
						content_end = this.lexer.token_start
						func_end = this.lexer.token_end
						if_closed = true
						break
					}

					let vnode = this.parse_value_node()
					if (vnode !== null) {
						let ns = this.arena.get_start_offset(vnode)
						if (value_start === -1) {
							value_start = ns
							value_line = this.arena.get_start_line(vnode)
							value_col = this.arena.get_start_column(vnode)
						}
						value_tokens.push(vnode)
						value_last_end = ns + this.arena.get_length(vnode)
					}
				}
			}

			// ── Wrap value tokens in a VALUE node ─────────────────────────────
			let value_node: number | null = null
			if (value_tokens.length > 0) {
				value_node = this.arena.create_node(
					VALUE,
					value_start,
					value_last_end - value_start,
					value_line,
					value_col,
				)
				this.arena.append_children(value_node, value_tokens)
			}

			// ── Create IF_BRANCH node ──────────────────────────────────────────
			let branch_end = value_node !== null ? value_last_end : condition_end_pos
			let branch_node = this.arena.create_node(
				IF_BRANCH,
				branch_start,
				branch_end - branch_start,
				branch_line,
				branch_col,
			)
			this.arena.set_content_start_delta(branch_node, 0)
			this.arena.set_content_length(branch_node, condition_end_pos - branch_start)

			if (value_start !== -1) {
				this.arena.set_value_start_delta(branch_node, value_start - branch_start)
				this.arena.set_value_length(branch_node, value_last_end - value_start)
			}

			let branch_children: number[] = [condition_node]
			if (value_node !== null) branch_children.push(value_node)
			this.arena.append_children(branch_node, branch_children)
			branches.push(branch_node)
		}

		this.arena.set_length(node, func_end - start)
		this.arena.set_value_start_delta(node, content_start - start)
		this.arena.set_value_length(node, content_end - content_start)
		this.arena.append_children(node, branches)

		return node
	}

	/**
	 * Parse a condition function inside if() — style(), supports(), or media().
	 *
	 * Creates a FUNCTION node whose children are:
	 *   - style() / supports() → one DECLARATION child (property + VALUE)
	 *   - media()              → one MEDIA_FEATURE child (property + value children)
	 *   - anything else        → generic value nodes as children
	 *
	 * Called when the current lexer token is TOKEN_FUNCTION (the '(' is already consumed).
	 * @param func_start  Source offset of the first char of the function name.
	 * @param token_end   Source offset right after '(' (== lexer.token_end at call site).
	 */
	private parse_if_condition_function(func_start: number, token_end: number): number {
		let func_name_end = token_end - 1 // before '('
		let func_name = this.source.substring(func_start, func_name_end)
		let func_line = this.lexer.token_line
		let func_col = this.lexer.token_column

		let content_start = token_end // right after '('
		let content_end = content_start
		let func_end = content_start

		// Scan for matching ')' to find the full function extent
		let depth = 1
		while (this.lexer.pos < this.value_end && depth > 0) {
			this.lexer.next_token_fast(false)
			let tt = this.lexer.token_type
			if (tt === TOKEN_EOF) break
			if (this.lexer.token_start >= this.value_end) break

			if (tt === TOKEN_LEFT_PAREN || tt === TOKEN_FUNCTION) {
				depth++
			} else if (tt === TOKEN_RIGHT_PAREN) {
				depth--
				if (depth === 0) {
					content_end = this.lexer.token_start // before ')'
					func_end = this.lexer.token_end // after ')'
				}
			}
		}

		// Create FUNCTION node spanning the full function text
		let func_node = this.arena.create_node(
			FUNCTION,
			func_start,
			func_end - func_start,
			func_line,
			func_col,
		)
		this.arena.set_content_start_delta(func_node, 0)
		this.arena.set_content_length(func_node, func_name_end - func_start)
		this.arena.set_value_start_delta(func_node, content_start - func_start)
		this.arena.set_value_length(func_node, content_end - content_start)

		// Parse content based on function name
		let child_nodes: number[] = []

		if (str_equals('style', func_name) || str_equals('supports', func_name)) {
			// Parse as DECLARATION (property: value)
			let decl = this.parse_declaration_in_range(content_start, content_end)
			if (decl !== null) child_nodes = [decl]
		} else if (str_equals('media', func_name)) {
			// Parse as MEDIA_FEATURE (property: value)
			let feature = this.parse_media_feature_in_range(content_start, content_end)
			if (feature !== null) child_nodes = [feature]
		} else {
			// Generic: parse content as value nodes
			child_nodes = this.parse_value_nodes_in_range(content_start, content_end)
		}

		this.arena.append_children(func_node, child_nodes)
		return func_node
	}

	/**
	 * Parse a "property: value" text range into a DECLARATION node.
	 * The DECLARATION has one child: a VALUE node containing the parsed value tokens.
	 */
	private parse_declaration_in_range(content_start: number, content_end: number): number | null {
		let colon = this.find_colon_at_depth_zero(content_start, content_end)
		let prop_end = colon === -1 ? content_end : colon
		let prop_range = this.trim_range(content_start, prop_end)
		if (!prop_range) return null

		let [prop_start, prop_end_trim] = prop_range
		let decl_end = colon === -1 ? prop_end_trim : content_end

		let decl = this.arena.create_node(
			DECLARATION,
			prop_start,
			decl_end - prop_start,
			this.lexer.token_line,
			this.lexer.token_column,
		)
		this.arena.set_content_start_delta(decl, 0)
		this.arena.set_content_length(decl, prop_end_trim - prop_start)

		if (colon !== -1) {
			let val_range = this.trim_range(colon + 1, content_end)
			if (val_range) {
				let [val_start, val_end] = val_range
				let val_nodes = this.parse_value_nodes_in_range(val_start, val_end)
				let value_node = this.arena.create_node(
					VALUE,
					val_start,
					val_end - val_start,
					this.lexer.token_line,
					this.lexer.token_column,
				)
				this.arena.append_children(value_node, val_nodes)
				this.arena.append_children(decl, [value_node])
			}
		}

		return decl
	}

	/**
	 * Parse a "property: value" text range into a MEDIA_FEATURE node.
	 * Value tokens become children of the MEDIA_FEATURE.
	 */
	private parse_media_feature_in_range(content_start: number, content_end: number): number | null {
		let colon = this.find_colon_at_depth_zero(content_start, content_end)
		let prop_end = colon === -1 ? content_end : colon
		let prop_range = this.trim_range(content_start, prop_end)
		if (!prop_range) return null

		let feature = this.arena.create_node(
			MEDIA_FEATURE,
			content_start,
			content_end - content_start,
			this.lexer.token_line,
			this.lexer.token_column,
		)
		this.arena.set_content_start_delta(feature, prop_range[0] - content_start)
		this.arena.set_content_length(feature, prop_range[1] - prop_range[0])

		if (colon !== -1) {
			let val_range = this.trim_range(colon + 1, content_end)
			if (val_range) {
				let val_nodes = this.parse_value_nodes_in_range(val_range[0], val_range[1])
				this.arena.append_children(feature, val_nodes)
			}
		}

		return feature
	}

	/** Parse value tokens in a source sub-range using save/restore to protect lexer state. */
	private parse_value_nodes_in_range(start: number, end: number): number[] {
		let saved_end = this.value_end
		let saved_pos = this.lexer.save_position()

		this.value_end = end
		this.lexer.seek(start, this.lexer.line, this.lexer.column)

		let nodes = this.parse_value_tokens()

		this.lexer.restore_position(saved_pos)
		this.value_end = saved_end

		return nodes
	}

	/** Find the position of the first ':' at parenthesis depth 0. Returns -1 if not found. */
	private find_colon_at_depth_zero(start: number, end: number): number {
		let depth = 0
		for (let i = start; i < end; i++) {
			let ch = this.source.charCodeAt(i)
			if (ch === 0x28 /* ( */) depth++
			else if (ch === 0x29 /* ) */) depth--
			else if (ch === 0x3a /* : */ && depth === 0) return i
		}
		return -1
	}

	/** Trim leading/trailing whitespace from [start, end). Returns null if the range is empty. */
	private trim_range(start: number, end: number): [number, number] | null {
		while (start < end && is_whitespace(this.source.charCodeAt(start))) start++
		while (end > start && is_whitespace(this.source.charCodeAt(end - 1))) end--
		if (start >= end) return null
		return [start, end]
	}

	private parse_parenthesis_node(start: number, end: number): number {
		// Create parenthesis node (length will be set later)
		let node = this.arena.create_node(
			PARENTHESIS,
			start,
			0, // length unknown yet
			this.lexer.token_line,
			this.lexer.token_column,
		)

		// Parse parenthesized content (everything until matching ')')
		let children: number[] = []
		let paren_depth = 1
		let paren_end = end

		while (this.lexer.pos < this.value_end && paren_depth > 0) {
			this.lexer.next_token_fast(false)

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break
			if (this.lexer.token_start >= this.value_end) break

			// Check for closing paren BEFORE parsing child nodes
			// This is important because child nodes (like nested parentheses or functions)
			// will consume tokens including closing parens
			if (token_type === TOKEN_RIGHT_PAREN) {
				paren_depth--
				if (paren_depth === 0) {
					paren_end = this.lexer.token_end
					break
				}
			}

			// Skip whitespace
			if (this.is_whitespace_inline()) continue

			// Parse child node
			// Note: We don't track paren_depth for LEFT_PAREN or TOKEN_FUNCTION here
			// because parse_value_node() will recursively handle them
			let child_node = this.parse_value_node()
			if (child_node !== null) {
				children.push(child_node)
			}
		}

		// Set parenthesis total length (includes opening and closing parens)
		this.arena.set_length(node, paren_end - start)

		// Link children as siblings
		this.arena.append_children(node, children)

		return node
	}
}

/**
 * Parse a CSS declaration value string and return a VALUE node
 * @param value_string - The CSS value to parse (e.g., "1px solid red")
 * @returns A CSSNode VALUE wrapper containing the parsed value tokens as children
 */
export function parse_value(value_string: string): Value {
	// Create an arena for the value nodes
	const arena = new CSSDataArena(CSSDataArena.capacity_for_source(value_string.length))

	// Create value parser
	const value_parser = new ValueParser(arena, value_string)

	// Parse the entire source as a value (starting at line 1, column 1)
	// Returns single VALUE node index now
	const value_node_index = value_parser.parse_value(0, value_string.length, 1, 1)

	// Wrap the VALUE node in a CSSNode
	return new CSSNode(arena, value_string, value_node_index) as Value
}
