// Condition Parser - shared parsing for CSS condition grammars (media features, supports
// conditions, style()/selector() function conditions) reused by both AtRulePreludeParser
// (@media/@supports/@container preludes) and ValueNodeParser (if()'s media()/supports()/
// style() condition functions), so both produce the same structured nodes instead of two
// independently-maintained implementations.
//
// Takes an already-constructed ValueNodeParser rather than importing and instantiating its
// own (a plain `import { ValueNodeParser } from './value-node-parser'` here would be
// circular, since value-node-parser.ts imports this file). The type-only import below is
// erased at build time and creates no runtime dependency in either direction.
import { Lexer } from './tokenize'
import {
	CSSDataArena,
	MEDIA_FEATURE,
	SUPPORTS_QUERY,
	SUPPORTS_DECLARATION,
	DECLARATION,
	VALUE,
	FUNCTION,
	FEATURE_RANGE,
	PRELUDE_OPERATOR,
	NUMBER,
	OPERATOR,
	RATIO,
} from './arena'
import {
	TOKEN_IDENT,
	TOKEN_LEFT_PAREN,
	TOKEN_RIGHT_PAREN,
	TOKEN_FUNCTION,
	TOKEN_EOF,
	type TokenType,
} from './token-types'
import {
	str_equals,
	CHAR_COLON,
	CHAR_LESS_THAN,
	CHAR_GREATER_THAN,
	CHAR_EQUALS,
	CHAR_FORWARD_SLASH,
} from './string-utils'
import { trim_boundaries, skip_whitespace_and_comments_forward } from './parse-utils'
import { SelectorParser } from './parse-selector'
import type { ValueNodeParser } from './value-node-parser'

/** @internal */
export class ConditionParser {
	private lexer: Lexer
	private arena: CSSDataArena
	private source: string
	private end: number = 0
	// Injected rather than owned, so calc()/env()/var() inside feature values get the same
	// structured children the caller's own value parsing produces (and to avoid a circular
	// import — see the file header).
	private value_node_parser: ValueNodeParser
	// Deep-parses selector()'s argument into a real SelectorList. No cycle risk (SelectorParser
	// doesn't depend on ValueNodeParser/AtRulePreludeParser), so this is safely owned here.
	private selector_parser: SelectorParser

	constructor(arena: CSSDataArena, source: string, value_node_parser: ValueNodeParser) {
		this.arena = arena
		this.source = source
		this.lexer = new Lexer(source)
		this.value_node_parser = value_node_parser
		this.selector_parser = new SelectorParser(arena, source)
	}

	// Where this instance's own lexer landed after the most recent parse_media_feature() or
	// parse_function_condition() call. ConditionParser scans with its own Lexer, separate from
	// whichever class is calling it — a caller that's mid-scan through the same range on its
	// own lexer (e.g. AtRulePreludeParser stepping through a media query's components) must
	// reseek to this position after delegating, or its own lexer position will silently fall
	// behind by however much this call consumed.
	get end_position(): [pos: number, line: number, column: number] {
		return [this.lexer.pos, this.lexer.line, this.lexer.column]
	}

	private create_node(type: number, start: number, end: number): number {
		return this.arena.create_node(
			type,
			start,
			end - start,
			this.lexer.token_line,
			this.lexer.token_column,
		)
	}

	private next_token(): TokenType {
		if (this.lexer.pos >= this.end) {
			this.lexer.token_type = TOKEN_EOF
			return TOKEN_EOF
		}
		return this.lexer.next_token_fast(false)
	}

	private is_and_or_not(str: string): boolean {
		// All logical operators are 2-3 chars: "and" (3), "or" (2), "not" (3)
		// The str_equals calls will quickly reject strings of other lengths
		return str_equals('and', str) || str_equals('or', str) || str_equals('not', str)
	}

	// Scan tokens from just after an already-open '(' or function-call (depth 1) to its
	// matching ')'. Must be called right after consuming the opening token. Returns
	// [content_end, close_end, matched]: content_end/close_end are the positions right
	// before/after the closing ')'; matched is false if EOF was hit first, in which case
	// content_end/close_end are left at the position scanning started from (mirroring the
	// caller's own pre-loop defaults, so callers that don't check `matched` still get sane
	// fallback spans).
	private scan_matching_paren(): [content_end: number, close_end: number, matched: boolean] {
		let depth = 1
		let content_end = this.lexer.pos
		let close_end = this.lexer.token_end

		while (this.lexer.pos < this.end && depth > 0) {
			let token_type = this.next_token()
			if (token_type === TOKEN_LEFT_PAREN || token_type === TOKEN_FUNCTION) {
				depth++
			} else if (token_type === TOKEN_RIGHT_PAREN) {
				depth--
				if (depth === 0) {
					content_end = this.lexer.token_start
					close_end = this.lexer.token_end
				}
			} else if (token_type === TOKEN_EOF) {
				break
			}
		}

		return [content_end, close_end, depth === 0]
	}

	// Parse feature value via the shared ValueNodeParser, so calc()/env()/var() get full children.
	// Own lexer instance, so it doesn't disturb this.lexer's position — no save/restore needed.
	private parse_feature_value(start: number, end: number): number {
		return this.value_node_parser.parse_chain(start, end, this.lexer.line, this.lexer.column)
	}

	// Detect a ratio value chain (e.g. "16/9" from aspect-ratio: 16/9) and collapse it into
	// a single RATIO node, so features like `aspect-ratio: 1` and `aspect-ratio: 16/9` both
	// expose one coherent value node instead of `.value` silently returning just the numerator.
	private wrap_ratio_value(first_node: number): number {
		if (this.arena.get_type(first_node) !== NUMBER) return first_node

		let op_node = this.arena.get_next_sibling(first_node)
		if (op_node === 0 || this.arena.get_type(op_node) !== OPERATOR) return first_node
		if (this.arena.get_length(op_node) !== 1) return first_node
		if (this.source.charCodeAt(this.arena.get_start_offset(op_node)) !== CHAR_FORWARD_SLASH) {
			return first_node
		}

		let second_node = this.arena.get_next_sibling(op_node)
		if (second_node === 0 || this.arena.get_type(second_node) !== NUMBER) return first_node
		if (this.arena.get_next_sibling(second_node) !== 0) return first_node

		let start = this.arena.get_start_offset(first_node)
		let end = this.arena.get_start_offset(second_node) + this.arena.get_length(second_node)
		let ratio_node = this.arena.create_node(
			RATIO,
			start,
			end - start,
			this.arena.get_start_line(first_node),
			this.arena.get_start_column(first_node),
		)

		this.arena.set_first_child(ratio_node, first_node)
		this.arena.set_next_sibling(first_node, second_node) // drop the "/" operator from the chain

		return ratio_node
	}

	// Build SUPPORTS_DECLARATION → DECLARATION → VALUE tree for a simple (property: value) condition
	private create_supports_declaration(
		content_start: number,
		content_end: number,
		colon_pos: number,
	): number {
		let prop_trimmed = trim_boundaries(this.source, content_start, colon_pos)
		let val_trimmed = trim_boundaries(this.source, colon_pos + 1, content_end)

		if (!prop_trimmed) {
			// No property name — degenerate input, return a bare SUPPORTS_DECLARATION
			let bare = this.create_node(SUPPORTS_DECLARATION, content_start, content_end)
			return bare
		}

		// DECLARATION spans from property start to value end (or colon if no value)
		let decl_start = prop_trimmed[0]
		let decl_end = val_trimmed ? val_trimmed[1] : colon_pos + 1
		let decl = this.create_node(DECLARATION, decl_start, decl_end)
		this.arena.set_content_start_delta(decl, 0) // property starts at node start
		this.arena.set_content_length(decl, prop_trimmed[1] - prop_trimmed[0])

		if (val_trimmed) {
			let value_first = this.parse_feature_value(val_trimmed[0], val_trimmed[1])
			let value_node: number
			if (value_first === 0) {
				value_node = this.arena.create_node(
					VALUE,
					val_trimmed[0],
					0,
					this.lexer.token_line,
					this.lexer.token_column,
				)
			} else {
				value_node = this.arena.create_node(
					VALUE,
					val_trimmed[0],
					val_trimmed[1] - val_trimmed[0],
					this.lexer.token_line,
					this.lexer.token_column,
				)
				this.arena.set_first_child(value_node, value_first)
			}
			this.arena.set_first_child(decl, value_node)
		}

		let supports_decl = this.create_node(SUPPORTS_DECLARATION, content_start, content_end)
		// Mirror the property name onto the wrapper so .property doesn't need the inner Declaration
		this.arena.set_content_start_delta(supports_decl, prop_trimmed[0] - content_start)
		this.arena.set_content_length(supports_decl, prop_trimmed[1] - prop_trimmed[0])
		this.arena.set_first_child(supports_decl, decl)
		return supports_decl
	}

	// Parse media feature range syntax: (50px <= width <= 100px)
	private parse_feature_range(
		feature_start: number,
		feature_end: number,
		content_start: number,
		content_end: number,
	): number {
		let range_node = this.create_node(FEATURE_RANGE, feature_start, feature_end)
		let first_child = 0
		let last_child = 0
		let feature_name_start = -1
		let feature_name_end = -1

		let pos = content_start

		while (pos < content_end) {
			pos = skip_whitespace_and_comments_forward(this.source, pos, content_end)
			if (pos >= content_end) break

			let ch = this.source.charCodeAt(pos)

			// Comparison operator
			if (ch === CHAR_LESS_THAN || ch === CHAR_GREATER_THAN || ch === CHAR_EQUALS) {
				let op_start = pos++
				if (pos < content_end && this.source.charCodeAt(pos) === CHAR_EQUALS) pos++

				let op = this.create_node(PRELUDE_OPERATOR, op_start, pos)
				if (first_child === 0) {
					first_child = op
				} else {
					this.arena.set_next_sibling(last_child, op)
				}
				last_child = op
			} else {
				// Value or feature name
				let saved = this.lexer.save_position()
				this.lexer.pos = pos
				this.next_token()

				if (this.lexer.token_type === TOKEN_IDENT) {
					// Feature name
					feature_name_start = this.lexer.token_start
					feature_name_end = this.lexer.token_end
				} else {
					// Value (may itself be a short chain, e.g. a single dimension node)
					let value_first = this.parse_feature_value(this.lexer.token_start, this.lexer.token_end)
					if (value_first !== 0) {
						if (first_child === 0) {
							first_child = value_first
						} else {
							this.arena.set_next_sibling(last_child, value_first)
						}
						last_child = this.arena.get_last_sibling(value_first)
					}
				}

				pos = this.lexer.pos
				this.lexer.restore_position(saved)
			}
		}

		// Store feature name in content fields
		if (feature_name_start !== -1) {
			this.arena.set_content_start_delta(range_node, feature_name_start - feature_start)
			this.arena.set_content_length(range_node, feature_name_end - feature_name_start)
		}

		if (first_child !== 0) {
			this.arena.set_first_child(range_node, first_child)
		}
		return range_node
	}

	/**
	 * Parse the content of a media feature — everything between its parentheses, already
	 * known by the caller as `[content_start, content_end)`. `feature_start`/`feature_end`
	 * are the span of the feature node itself: for a real `@media (min-width: 768px)` feature
	 * this includes the surrounding parens (`feature_start < content_start`); for if()'s
	 * `media(min-width: 768px)`, media()'s own parens already delimit the content, so callers
	 * pass `feature_start === content_start` and `feature_end === content_end`.
	 * Returns a MEDIA_FEATURE (name/boolean/name:value) or FEATURE_RANGE (comparison syntax) node.
	 */
	parse_media_feature_content(
		feature_start: number,
		feature_end: number,
		content_start: number,
		content_end: number,
	): number {
		// Check for range syntax (has comparison operators)
		let has_comparison = false
		let i = content_start
		while (i < content_end) {
			i = skip_whitespace_and_comments_forward(this.source, i, content_end)
			if (i >= content_end) break

			let ch = this.source.charCodeAt(i)
			if (ch === CHAR_LESS_THAN || ch === CHAR_GREATER_THAN || ch === CHAR_EQUALS) {
				has_comparison = true
				break
			}
			i++
		}

		if (has_comparison) {
			return this.parse_feature_range(feature_start, feature_end, content_start, content_end)
		}

		// Standard feature or boolean feature
		let feature = this.create_node(MEDIA_FEATURE, feature_start, feature_end)

		// Find colon to separate name from value
		let colon_pos = -1
		let j = content_start
		while (j < content_end) {
			j = skip_whitespace_and_comments_forward(this.source, j, content_end)
			if (j >= content_end) break

			if (this.source.charCodeAt(j) === CHAR_COLON) {
				colon_pos = j
				break
			}
			j++
		}

		if (colon_pos === -1) {
			// Boolean feature: (hover), (color)
			let trimmed = trim_boundaries(this.source, content_start, content_end)
			if (trimmed) {
				this.arena.set_content_start_delta(feature, trimmed[0] - feature_start)
				this.arena.set_content_length(feature, trimmed[1] - trimmed[0])
			}
		} else {
			// Standard feature: (name: value)
			let name_trimmed = trim_boundaries(this.source, content_start, colon_pos)
			if (name_trimmed) {
				this.arena.set_content_start_delta(feature, name_trimmed[0] - feature_start)
				this.arena.set_content_length(feature, name_trimmed[1] - name_trimmed[0])
			}

			// Parse value portion
			let value_trimmed = trim_boundaries(this.source, colon_pos + 1, content_end)
			if (value_trimmed) {
				let value_first = this.parse_feature_value(value_trimmed[0], value_trimmed[1])
				if (value_first !== 0) {
					this.arena.set_first_child(feature, this.wrap_ratio_value(value_first))
				}
			}
		}

		return feature
	}

	// Parse a media feature: (min-width: 768px) or (50px <= width <= 100px). `open_paren_start`
	// is the source offset of the feature's own '(' — this seeks its own lexer there and
	// re-scans, rather than assuming the caller's lexer is positioned there (ConditionParser
	// owns a separate lexer instance from whichever class is calling it). `end` bounds the scan
	// for the matching ')' (the caller's own enclosing range, e.g. a media query's/prelude's end).
	parse_media_feature(
		open_paren_start: number,
		end: number,
		line: number,
		column: number,
	): number | null {
		this.end = end
		this.lexer.seek(open_paren_start, line, column)
		this.next_token() // consume '('

		let feature_start = this.lexer.token_start
		let content_start = this.lexer.pos

		let [content_end, feature_end, matched] = this.scan_matching_paren()
		if (!matched) return null

		return this.parse_media_feature_content(feature_start, feature_end, content_start, content_end)
	}

	// Parse a bare function condition: style(...), selector(...), font-tech(...). `func_start`
	// is the source offset of the function name's first char — this seeks its own lexer there
	// and re-scans (see parse_media_feature for why). `end` bounds the scan for the matching ')'.
	parse_function_condition(func_start: number, end: number, line: number, column: number): number {
		this.end = end
		this.lexer.seek(func_start, line, column)
		this.next_token() // consume the function token, up to and including '('

		let func_name = this.source.substring(this.lexer.token_start, this.lexer.token_end - 1) // -1 to exclude '('
		let content_start = this.lexer.token_end // After '('

		// Find matching closing paren
		let [content_end, func_end] = this.scan_matching_paren()

		// Create function node
		let func_node = this.create_node(FUNCTION, func_start, func_end)
		// Set content fields to function name
		this.arena.set_content_start_delta(func_node, 0)
		this.arena.set_content_length(func_node, func_name.length)
		// Set value fields to content inside parentheses
		this.arena.set_value_start_delta(func_node, content_start - func_start)
		this.arena.set_value_length(func_node, content_end - content_start)

		// selector()'s argument is a <complex-selector> — parse it into a real SelectorList
		if (str_equals('selector', func_name)) {
			let selector_list = this.selector_parser.parse_selector(
				content_start,
				content_end,
				this.lexer.line,
				this.lexer.column,
			)
			if (selector_list !== null) {
				this.arena.set_first_child(func_node, selector_list)
			}
		}
		// style()'s argument is a <declaration> — parse it into the same tree as (property: value)
		else if (str_equals('style', func_name)) {
			let decl_child = this.parse_supports_declaration_content(content_start, content_end)
			if (decl_child !== null) {
				this.arena.set_first_child(func_node, decl_child)
			}
		}

		return func_node
	}

	/**
	 * Parse a single `(property: value)` supports declaration from a content range — the
	 * `<style-feature>`/`<supports-feature>` grammar shared by `style()`, `@supports (…)`, and
	 * `@import … supports(…)`. Returns null if no top-level ':' is found.
	 */
	parse_supports_declaration_content(content_start: number, content_end: number): number | null {
		let colon_pos = this.find_colon_at_depth_zero(content_start, content_end)
		if (colon_pos === -1) return null
		return this.create_supports_declaration(content_start, content_end, colon_pos)
	}

	private find_colon_at_depth_zero(start: number, end: number): number {
		let depth = 0
		for (let i = start; i < end; i++) {
			let ch = this.source.charCodeAt(i)
			if (ch === 0x28 /* ( */) depth++
			else if (ch === 0x29 /* ) */) depth--
			else if (ch === CHAR_COLON && depth === 0) return i
		}
		return -1
	}

	/**
	 * Parse a `<supports-condition>` — the compound and/or/not grammar shared by `@supports`
	 * preludes and if()'s `supports(...)` condition function: parenthesized `(property: value)`
	 * declarations, `and`/`or`/`not` logical operators, and nested function conditions
	 * (`selector()`, `style()`, etc.), chained as flat siblings.
	 * `start`/`end` bound the range to scan; the caller has already positioned nothing — this
	 * seeks its own lexer, so it's safe to call with any sub-range of the source.
	 */
	parse_supports_condition(start: number, end: number, line: number, column: number): number[] {
		let saved_end = this.end
		this.end = end
		this.lexer.seek(start, line, column)

		let nodes: number[] = []

		while (this.lexer.pos < this.end) {
			this.lexer.skip_whitespace_in_range(this.end)
			if (this.lexer.pos >= this.end) break

			this.next_token()

			let token_type = this.lexer.token_type
			// Feature query: (property: value)
			if (token_type === TOKEN_LEFT_PAREN) {
				let feature_start = this.lexer.token_start
				let content_start = this.lexer.pos

				let [content_end, feature_end, matched] = this.scan_matching_paren()

				if (matched) {
					let query = this.create_node(SUPPORTS_QUERY, feature_start, feature_end)

					let trimmed = trim_boundaries(this.source, content_start, content_end)
					if (trimmed) {
						this.arena.set_value_start_delta(query, trimmed[0] - feature_start)
						this.arena.set_value_length(query, trimmed[1] - trimmed[0])

						let decl_child = this.parse_supports_declaration_content(trimmed[0], trimmed[1])
						if (decl_child !== null) {
							this.arena.set_first_child(query, decl_child)
						}
					}

					nodes.push(query)
				}
			}
			// Identifier: operator (and, or, not)
			else if (token_type === TOKEN_IDENT) {
				let text = this.source.substring(this.lexer.token_start, this.lexer.token_end)

				if (this.is_and_or_not(text)) {
					let op = this.create_node(PRELUDE_OPERATOR, this.lexer.token_start, this.lexer.token_end)
					nodes.push(op)
				}
			}
			// Function condition: selector([popover]:open), style(--x: 1), font-tech(color-COLRv1), ...
			else if (token_type === TOKEN_FUNCTION) {
				nodes.push(
					this.parse_function_condition(
						this.lexer.token_start,
						this.end,
						this.lexer.token_line,
						this.lexer.token_column,
					),
				)
			}
		}

		this.end = saved_end
		return nodes
	}
}
