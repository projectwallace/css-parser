// Value Node Parser - shared recursive value-token parsing, used by both ValueParser
// (declaration values) and AtRulePreludeParser (feature values), so calc()/env()/var()
// get the same structured tree everywhere instead of an opaque text span.
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
	IF_CONDITION,
	VALUE,
	PRELUDE_OPERATOR,
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
	type TokenType,
} from './token-types'
import {
	is_whitespace,
	CHAR_MINUS_HYPHEN,
	CHAR_PLUS,
	CHAR_ASTERISK,
	CHAR_FORWARD_SLASH,
	str_equals,
} from './string-utils'
import { ConditionParser } from './parse-condition'

/** @internal */
export class ValueNodeParser {
	protected lexer: Lexer
	protected arena: CSSDataArena
	protected source: string
	protected end: number = 0
	// Last node from parse_chain(), for callers sizing a wrapper node. Avoids a tuple/array return.
	last_chain_node: number = 0
	// Shared media-feature/supports-condition/style() parsing for if()'s condition functions, so
	// they produce the same MediaFeature/FeatureRange/SupportsQuery/SupportsDeclaration nodes real
	// @media/@supports conditions do. Lazily built with a dedicated helper ValueNodeParser — NOT
	// `this` — because ConditionParser's content methods call back into the injected parser's
	// parse_chain(), which reseeks its own lexer/end; reentering `this` while it's still mid-parse
	// (inside parse_if_function_node's own scan) would clobber that in-progress state. Lazy, since
	// eagerly constructing the helper here would recurse: every ValueNodeParser's constructor would
	// try to build another ValueNodeParser to inject, forever. The helper's own condition_parser is
	// simply never accessed (it's only ever used via parse_chain), so the recursion stops there.
	private _condition_parser: ConditionParser | null = null

	private get condition_parser(): ConditionParser {
		if (this._condition_parser === null) {
			this._condition_parser = new ConditionParser(
				this.arena,
				this.source,
				new ValueNodeParser(this.arena, this.source),
			)
		}
		return this._condition_parser
	}

	constructor(arena: CSSDataArena, source: string) {
		this.arena = arena
		this.source = source
		this.lexer = new Lexer(source)
	}

	// Parse value tokens in [start, end) into typed nodes, chained as siblings.
	// Returns the first node (0 if none); last node left in this.last_chain_node.
	parse_chain(start: number, end: number, start_line: number, start_column: number): number {
		this.end = end
		this.lexer.seek(start, start_line, start_column)

		let first_node = 0
		let last_node = 0

		while (this.lexer.pos < this.end) {
			// Get next token without skipping whitespace (whitespace matters in values)
			this.lexer.next_token_fast(false)

			// Stop if we've reached the end of the range
			if (this.lexer.token_start >= this.end) break

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break

			// Skip whitespace tokens (they're separators, not value nodes)
			if (this.is_whitespace_inline()) {
				continue
			}

			// Parse this token into a value node (token_type already cached in lexer.token_type)
			let node = this.parse_value_node()
			if (node !== null) {
				if (first_node === 0) {
					first_node = node
				} else {
					this.arena.set_next_sibling(last_node, node)
				}
				last_node = node
			}
		}

		this.last_chain_node = last_node
		return first_node
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

	private parse_operator_node(start: number, end: number): number | null {
		// Only create operator nodes for specific delimiters: + - * /
		let ch = this.source.charCodeAt(start)
		if (
			ch === CHAR_PLUS ||
			ch === CHAR_MINUS_HYPHEN ||
			ch === CHAR_ASTERISK ||
			ch === CHAR_FORWARD_SLASH
		) {
			return this.create_node(OPERATOR, start, end)
		}
		// Other delimiters are ignored for now
		return null
	}

	// Scan tokens from just after an already-open '(' or function-call (depth 1) to its
	// matching ')'. Must be called right after consuming the opening token.
	// When `bounded` is true, scanning stops at `this.end` (the if()-condition-function
	// case, which must not overrun its enclosing range). When `bounded` is false, `this.end`
	// is ignored and scanning continues to a real ')' or EOF (the unquoted url()/src() case,
	// whose content may contain characters like ';' that would otherwise truncate it early —
	// see the caller for why).
	// Returns [content_end, close_end, matched]; matched is false if EOF was hit first, in
	// which case content_end/close_end are left at their initial (scan-start) values.
	private scan_matching_paren(
		bounded: boolean,
	): [content_end: number, close_end: number, matched: boolean] {
		let depth = 1
		let content_end = this.lexer.pos
		let close_end = this.lexer.token_end

		while ((!bounded || this.lexer.pos < this.end) && depth > 0) {
			this.lexer.next_token_fast(false)
			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break
			if (bounded && this.lexer.token_start >= this.end) break

			if (token_type === TOKEN_LEFT_PAREN || token_type === TOKEN_FUNCTION) {
				depth++
			} else if (token_type === TOKEN_RIGHT_PAREN) {
				depth--
				if (depth === 0) {
					content_end = this.lexer.token_start
					close_end = this.lexer.token_end
				}
			}
		}

		return [content_end, close_end, depth === 0]
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
			while (this.is_whitespace_inline() && this.lexer.pos < this.end) {
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
				// Note: We can't rely on `end` because URLs may contain semicolons
				// that confuse the declaration parser (e.g., data:image/png;base64,...)
				// So we consume tokens until we find the matching ')' regardless of `end`
				let func_end = end
				let content_start = end // Position after 'url('
				let content_end = end

				let [scanned_content_end, scanned_func_end, matched] = this.scan_matching_paren(false)
				if (matched) {
					content_end = scanned_content_end
					func_end = scanned_func_end
				}

				// Set function total length (includes opening and closing parens)
				this.arena.set_length(node, func_end - start)

				// Set value to the content between parentheses (accessible via node.value)
				this.arena.set_value_start_delta(node, content_start - start)
				this.arena.set_value_length(node, content_end - content_start)

				return node
			}
		}

		// Parse function arguments (everything until matching ')'), chained as siblings
		// without an intermediate array (single-argument calls like var(--x) are common)
		let first_arg = 0
		let last_arg = 0
		let paren_depth = 1
		let func_end = end
		let content_start = end // Position after function name and '('
		let content_end = end

		while (this.lexer.pos < this.end && paren_depth > 0) {
			this.lexer.next_token_fast(false)

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break
			if (this.lexer.token_start >= this.end) break

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
				if (first_arg === 0) {
					first_arg = arg_node
				} else {
					this.arena.set_next_sibling(last_arg, arg_node)
				}
				last_arg = arg_node
			}
		}

		// Set function total length
		this.arena.set_length(node, func_end - start)

		// Set value to the content between parentheses (accessible via node.value)
		this.arena.set_value_start_delta(node, content_start - start)
		this.arena.set_value_length(node, content_end - content_start)

		// Link arguments as children
		if (first_arg !== 0) {
			this.arena.set_first_child(node, first_arg)
		}

		return node
	}

	/**
	 * Parse an if() inline conditional function.
	 *
	 * Spec grammar (CSS Values Level 5):
	 *   if( <if-branch>+ )
	 *   <if-branch>    = <if-condition> : <declaration-value>? ;?
	 *   <if-condition> = style(…) | media(…) | supports(…) | else
	 *
	 * Each branch becomes an IF_BRANCH child (see the `IfBranch` type in node-types.ts
	 * for its shape). Colons/semicolons here are structural separators, not OPERATOR nodes.
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

		while (this.lexer.pos < this.end && !if_closed) {
			this.lexer.next_token_fast(false)
			let tt = this.lexer.token_type

			if (tt === TOKEN_EOF) break
			if (this.lexer.token_start >= this.end) break

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

			let condition_node = this.parse_if_condition()
			if (condition_node === null) continue

			let condition_end_pos =
				this.arena.get_start_offset(condition_node) + this.arena.get_length(condition_node)

			// ── Find the ':' separator ─────────────────────────────────────────
			let colon_found = false
			while (this.lexer.pos < this.end) {
				this.lexer.next_token_fast(false)
				let t = this.lexer.token_type
				if (t === TOKEN_EOF) break
				if (this.lexer.token_start >= this.end) break
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
				while (this.lexer.pos < this.end) {
					this.lexer.next_token_fast(false)
					let t = this.lexer.token_type
					if (t === TOKEN_EOF) break
					if (this.lexer.token_start >= this.end) break
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
			let branch_end = value_node === null ? condition_end_pos : value_last_end
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

	private is_and_or_not(str: string): boolean {
		// All logical operators are 2-3 chars: "and" (3), "or" (2), "not" (3)
		return str_equals('and', str) || str_equals('or', str) || str_equals('not', str)
	}

	// Advance past whitespace to the next real token, returning its type (TOKEN_EOF once
	// `this.end` is reached). Used to look ahead for a not/and/or continuation without
	// committing to consuming it — callers restore to a saved position when it doesn't.
	private next_significant_token(): TokenType {
		while (this.lexer.pos < this.end) {
			this.lexer.next_token_fast(false)
			if (this.lexer.token_start >= this.end) return TOKEN_EOF
			if (this.is_whitespace_inline()) continue
			return this.lexer.token_type
		}
		return TOKEN_EOF
	}

	/**
	 * Parse an if()-branch condition:
	 *   <if-condition> = <boolean-expr[ <if-test> ]> | else
	 *   <if-test>      = style(…) | media(…) | supports(…)
	 * i.e. a single test function, the bare "else" identifier, or those test functions
	 * combined with not/and/or (e.g. "not style(--x: 1)", "style(--a: 1) and media(width > 600px)").
	 * Called with the lexer's current token already positioned at the condition's first token.
	 * A simple single-function/"else" condition returns that node directly, unwrapped (matching
	 * prior behavior); a compound not/and/or condition wraps the flat operator/function chain in
	 * an IF_CONDITION node so IfBranch.condition/.value (single first_child/next_sibling hops)
	 * still see exactly one node for "the condition".
	 */
	private parse_if_condition(): number | null {
		// "else" never combines with not/and/or — always a bare identifier.
		if (this.lexer.token_type === TOKEN_IDENT) {
			let text = this.source.substring(this.lexer.token_start, this.lexer.token_end)
			if (str_equals('else', text)) {
				return this.parse_value_node()
			}
		}

		let first = 0
		let last = 0
		let component_count = 0
		let compound = false

		for (;;) {
			let tt = this.lexer.token_type
			let component: number | null = null
			let is_operator = false

			if (tt === TOKEN_FUNCTION) {
				component = this.parse_if_condition_function(this.lexer.token_start, this.lexer.token_end)
			} else if (tt === TOKEN_IDENT) {
				let text = this.source.substring(this.lexer.token_start, this.lexer.token_end)
				if (this.is_and_or_not(text)) {
					is_operator = true
					component = this.arena.create_node(
						PRELUDE_OPERATOR,
						this.lexer.token_start,
						this.lexer.token_end - this.lexer.token_start,
						this.lexer.token_line,
						this.lexer.token_column,
					)
				} else {
					component = this.parse_value_node()
				}
			} else {
				component = this.parse_value_node()
			}

			if (component !== null) {
				component_count++
				if (first === 0) first = component
				else this.arena.set_next_sibling(last, component)
				last = component
			}

			// Only a test function or a not/and/or operator can be followed by more of the
			// condition; anything else ends the condition here.
			if (tt !== TOKEN_FUNCTION && !is_operator) break

			let saved = this.lexer.save_position()
			let next_tt = this.next_significant_token()
			if (next_tt === TOKEN_FUNCTION) {
				compound = true
				continue
			}
			if (next_tt === TOKEN_IDENT) {
				let text = this.source.substring(this.lexer.token_start, this.lexer.token_end)
				if (this.is_and_or_not(text)) {
					compound = true
					continue
				}
			}
			this.lexer.restore_position(saved)
			break
		}

		if (first === 0) return null
		if (component_count === 1 && !compound) return first

		// Compound condition — wrap the flat not/and/or/function chain in an IF_CONDITION node
		let wrapper_start = this.arena.get_start_offset(first)
		let last_sibling = this.arena.get_last_sibling(first)
		let wrapper_end = this.arena.get_start_offset(last_sibling) + this.arena.get_length(last_sibling)
		let wrapper = this.arena.create_node(
			IF_CONDITION,
			wrapper_start,
			wrapper_end - wrapper_start,
			this.arena.get_start_line(first),
			this.arena.get_start_column(first),
		)
		this.arena.set_first_child(wrapper, first)
		return wrapper
	}

	/**
	 * Parse a condition function inside if() — style(), supports(), or media(). Content parsing
	 * is delegated to the shared ConditionParser (see parse-condition.ts), so these produce the
	 * same node shapes real `@supports`/`@media` conditions do:
	 *   style()/supports() → SUPPORTS_DECLARATION(s) — supports() gets the full compound
	 *     <supports-condition> grammar (and/or/not, nested conditions), same as `@supports`.
	 *   media()  → a single MEDIA_FEATURE or FEATURE_RANGE (comparison syntax), same as `@media`.
	 *   anything else → generic value nodes, as before.
	 *
	 * Called with the current token at TOKEN_FUNCTION (the '(' already consumed).
	 * @param func_start  Offset of the function name's first char.
	 * @param token_end   Offset right after '(' (== lexer.token_end here).
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
		let [scanned_content_end, scanned_func_end, matched] = this.scan_matching_paren(true)
		if (matched) {
			content_end = scanned_content_end
			func_end = scanned_func_end
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

		if (str_equals('style', func_name)) {
			// style(<style-query>): a bare single declaration when the content has a top-level
			// ':' (style(--x: 1)); otherwise the full compound and/or/not grammar over
			// parenthesized declarations, same as `@supports` — style((--a: 1) or (--a: 2)).
			let decl = this.condition_parser.parse_supports_declaration_content(
				content_start,
				content_end,
			)
			if (decl === null) {
				child_nodes = this.condition_parser.parse_supports_condition(
					content_start,
					content_end,
					func_line,
					func_col,
				)
			} else {
				child_nodes = [decl]
			}
		} else if (str_equals('supports', func_name)) {
			// supports(<supports-condition>): a bare single declaration when the content has a
			// top-level ':' (matching style()'s shorthand — supports(display: grid), no extra
			// parens needed); otherwise the full compound grammar, same as `@supports`'s own
			// prelude — supports((a) and (b)), supports(not (c)), nested style()/selector()/…
			let decl = this.condition_parser.parse_supports_declaration_content(
				content_start,
				content_end,
			)
			if (decl === null) {
				child_nodes = this.condition_parser.parse_supports_condition(
					content_start,
					content_end,
					func_line,
					func_col,
				)
			} else {
				child_nodes = [decl]
			}
		} else if (str_equals('media', func_name)) {
			// media()'s own parens delimit the feature; there's no separate inner paren pair,
			// so the feature span equals the content span (see parse_media_feature_content's docs)
			let feature = this.condition_parser.parse_media_feature_content(
				content_start,
				content_end,
				content_start,
				content_end,
			)
			child_nodes = [feature]
		} else {
			// Generic: parse content as value nodes
			child_nodes = this.parse_value_nodes_in_range(content_start, content_end)
		}

		this.arena.append_children(func_node, child_nodes)
		return func_node
	}

	/** Parse value tokens in a source sub-range using save/restore to protect lexer state. */
	private parse_value_nodes_in_range(start: number, end: number): number[] {
		let saved_end = this.end
		let saved_pos = this.lexer.save_position()

		this.end = end
		this.lexer.seek(start, this.lexer.line, this.lexer.column)

		let nodes: number[] = []
		while (this.lexer.pos < this.end) {
			this.lexer.next_token_fast(false)
			if (this.lexer.token_start >= this.end) break
			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break
			if (this.is_whitespace_inline()) continue
			let node = this.parse_value_node()
			if (node !== null) nodes.push(node)
		}

		this.lexer.restore_position(saved_pos)
		this.end = saved_end

		return nodes
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

		// Parse parenthesized content (everything until matching ')'), chained as siblings
		// without an intermediate array
		let first_child = 0
		let last_child = 0
		let paren_depth = 1
		let paren_end = end

		while (this.lexer.pos < this.end && paren_depth > 0) {
			this.lexer.next_token_fast(false)

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_EOF) break
			if (this.lexer.token_start >= this.end) break

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
				if (first_child === 0) {
					first_child = child_node
				} else {
					this.arena.set_next_sibling(last_child, child_node)
				}
				last_child = child_node
			}
		}

		// Set parenthesis total length (includes opening and closing parens)
		this.arena.set_length(node, paren_end - start)

		// Link children as siblings
		if (first_child !== 0) {
			this.arena.set_first_child(node, first_child)
		}

		return node
	}
}
