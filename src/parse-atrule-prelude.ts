// At-Rule Prelude Parser - Parses at-rule preludes into structured AST nodes
import { Lexer } from './tokenize'
import {
	CSSDataArena,
	MEDIA_QUERY,
	MEDIA_TYPE,
	CONTAINER_QUERY,
	SUPPORTS_QUERY,
	LAYER_NAME,
	IDENTIFIER,
	PRELUDE_OPERATOR,
	PRELUDE_SELECTORLIST,
	URL,
	FUNCTION,
	STRING,
} from './arena'
import {
	TOKEN_IDENT,
	TOKEN_LEFT_PAREN,
	TOKEN_RIGHT_PAREN,
	TOKEN_COMMA,
	TOKEN_EOF,
	TOKEN_WHITESPACE,
	TOKEN_STRING,
	TOKEN_URL,
	TOKEN_FUNCTION,
	TOKEN_DELIM,
	type TokenType,
} from './token-types'
import {
	str_equals_range,
	is_and_or_not_range,
	strip_vendor_prefix,
	CHAR_PERIOD,
} from './string-utils'
import { trim_boundaries, skip_whitespace_and_comments_forward } from './parse-utils'
import { CSSNode } from './css-node'
import type { AnyNode } from './node-types'
import { ValueNodeParser } from './value-node-parser'
import { ConditionParser } from './parse-condition'
import { SelectorParser } from './parse-selector'

/** @internal */
export interface PreludeParserOptions {
	/** Defaults to `false`, but this will become the default behavior in 0.20.0. */
	media_feature_range_name_as_child?: boolean
}

export class AtRulePreludeParser {
	private lexer: Lexer
	private arena: CSSDataArena
	private source: string
	private prelude_end: number
	// Shared with declaration values so calc()/env()/var() get structured children, not raw text
	private value_node_parser: ValueNodeParser
	// Shared media-feature/supports-condition/style()-selector() parsing, also used by ValueNodeParser
	// for if()'s condition functions — see parse-condition.ts for why value_node_parser is injected
	private condition_parser: ConditionParser
	// Deep-parses the parenthesised arguments of @scope into real SelectorLists
	private selector_parser: SelectorParser

	constructor(
		arena: CSSDataArena,
		source: string,
		media_feature_range_name_as_child: boolean = false,
	) {
		this.arena = arena
		this.source = source
		// Create a lexer instance for prelude parsing
		this.lexer = new Lexer(source)
		this.prelude_end = 0
		this.value_node_parser = new ValueNodeParser(arena, source, media_feature_range_name_as_child)
		this.condition_parser = new ConditionParser(
			arena,
			source,
			this.value_node_parser,
			media_feature_range_name_as_child,
		)
		this.selector_parser = new SelectorParser(arena, source)
	}

	// Parse an at-rule prelude into nodes (standalone use)
	parse_prelude(
		at_rule_name: string,
		start: number,
		end: number,
		line: number = 1,
		column: number = 1,
	): number[] {
		this.prelude_end = end

		// Position lexer at prelude start
		this.lexer.seek(start, line, column)

		return this.parse_prelude_dispatch(at_rule_name)
	}

	// Dispatch to appropriate parser based on at-rule type
	private parse_prelude_dispatch(at_rule_name: string): number[] {
		// Strip vendor prefix to treat @-webkit-keyframes same as @keyframes
		const normalized_name = strip_vendor_prefix(at_rule_name).toLowerCase()

		switch (normalized_name) {
			case 'media':
				return this.parse_media_query_list()
			case 'container':
				return this.parse_container_query()
			case 'supports':
				return this.parse_supports_query()
			case 'layer':
				return this.parse_layer_names()
			case 'keyframes':
			case 'property':
			case 'counter-style':
			case 'color-profile':
			case 'font-palette-values':
			case 'position-try':
			case 'font-feature-values':
			case 'page':
				return this.parse_identifier()
			case 'function':
				return this.parse_function_prelude()
			case 'import':
				return this.parse_import_prelude()
			case 'charset':
				return this.parse_charset_prelude()
			case 'namespace':
				return this.parse_namespace_prelude()
			case 'scope':
				return this.parse_scope_prelude()
			case 'custom-media':
				return this.parse_custom_media_prelude()
		}

		return []
	}

	// Parse media query list: screen, (min-width: 768px), ...
	private parse_media_query_list(): number[] {
		const nodes: number[] = []

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			const query = this.parse_single_media_query()
			if (query !== null) {
				nodes.push(query)
			}

			// Skip comma separator
			this.skip_whitespace()
			const saved = this.lexer.save_position()
			this.next_token()
			if (this.lexer.token_type !== TOKEN_COMMA) {
				// Not a comma, restore position
				this.lexer.restore_position(saved)
			}
		}

		return nodes
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

	// Scan tokens from just after an already-open '(' or function-call (depth 1) to its
	// matching ')'. Must be called right after consuming the opening token. Returns
	// [content_end, close_end, matched]: content_end/close_end are the positions right
	// before/after the closing ')'; matched is false if EOF was hit first, in which case
	// content_end/close_end are left at the position scanning started from (mirroring the
	// caller's own pre-loop defaults, so callers that don't check `matched` still get sane
	// fallback spans).
	private paren_content_end = 0
	private paren_close_end = 0

	private scan_matching_paren(): boolean {
		let depth = 1
		let content_end = this.lexer.pos
		let close_end = this.lexer.token_end

		while (this.lexer.pos < this.prelude_end && depth > 0) {
			const token_type = this.next_token()
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

		this.paren_content_end = content_end
		this.paren_close_end = close_end
		return depth === 0
	}

	// Parse a single media query: screen and (min-width: 768px)
	private parse_single_media_query(): number | null {
		const query_start = this.lexer.pos

		// Skip whitespace
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return null

		// Parse components (media type, features, operators), chained as siblings without an
		// intermediate array — most media queries have exactly one component (a single media
		// type or a single feature), so this avoids an allocation for the common case.
		let first_component = 0
		let last_component = 0

		// Leading modifier (only/not) — emit as PRELUDE_OPERATOR like the and/or/not combinators below
		const saved_token_start = this.lexer.save_position()
		this.next_token()

		if (this.lexer.token_type === TOKEN_IDENT) {
			const source = this.source
			const token_start = this.lexer.token_start
			const token_end = this.lexer.token_end
			if (
				str_equals_range(source, token_start, token_end, 'only') ||
				str_equals_range(source, token_start, token_end, 'not')
			) {
				const modifier = this.create_node(PRELUDE_OPERATOR, token_start, token_end)
				first_component = modifier
				last_component = modifier
			} else {
				// Reset - this is a media type
				this.lexer.restore_position(saved_token_start)
			}
		} else {
			this.lexer.restore_position(saved_token_start)
		}

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			// Check for comma (end of this query)
			if (this.peek_token_type() === TOKEN_COMMA) break

			this.next_token()

			const token_type = this.lexer.token_type
			let component: number | null = null

			// Media feature: (min-width: 768px)
			if (token_type === TOKEN_LEFT_PAREN) {
				component = this.condition_parser.parse_media_feature(
					this.lexer.token_start,
					this.prelude_end,
					this.lexer.token_line,
					this.lexer.token_column,
				)
				if (component !== null) {
					// condition_parser scanned with its own lexer — resync ours past what it consumed
					this.condition_parser.seek_to_end(this.lexer)
				}
			}
			// Identifier: media type or operator (and, or, not)
			else if (token_type === TOKEN_IDENT) {
				const token_start = this.lexer.token_start
				const token_end = this.lexer.token_end
				if (is_and_or_not_range(this.source, token_start, token_end)) {
					// Logical operator
					component = this.create_node(PRELUDE_OPERATOR, token_start, token_end)
				} else {
					// Media type: screen, print, all
					component = this.create_node(MEDIA_TYPE, token_start, token_end)
				}
			} else {
				// Unknown token, skip
				break
			}

			if (component !== null) {
				if (first_component === 0) {
					first_component = component
				} else {
					this.arena.set_next_sibling(last_component, component)
				}
				last_component = component
			}
		}

		if (first_component === 0) return null

		// Create media query node
		const query_node = this.create_node(MEDIA_QUERY, query_start, this.lexer.pos)

		// Link components as children
		this.arena.set_first_child(query_node, first_component)

		return query_node
	}

	// Parse container query: [name] and (min-width: 400px)
	private parse_container_query(): number[] {
		const query_start = this.lexer.pos

		// Parse components (identifiers, operators, features), chained as siblings without an
		// intermediate array — most container queries have a single component.
		let first_component = 0
		let last_component = 0

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			this.next_token()

			const token_type = this.lexer.token_type
			let component: number | null = null

			// Container feature: (min-width: 400px)
			if (token_type === TOKEN_LEFT_PAREN) {
				component = this.condition_parser.parse_media_feature(
					this.lexer.token_start,
					this.prelude_end,
					this.lexer.token_line,
					this.lexer.token_column,
				)
				if (component !== null) {
					this.condition_parser.seek_to_end(this.lexer)
				}
			}
			// Function: style(--custom: 1)
			else if (token_type === TOKEN_FUNCTION) {
				component = this.condition_parser.parse_function_condition(
					this.lexer.token_start,
					this.prelude_end,
					this.lexer.token_line,
					this.lexer.token_column,
				)
				this.condition_parser.seek_to_end(this.lexer)
			}
			// Identifier: operator (and, or, not) or container name
			else if (token_type === TOKEN_IDENT) {
				const token_start = this.lexer.token_start
				const token_end = this.lexer.token_end
				if (is_and_or_not_range(this.source, token_start, token_end)) {
					// Logical operator
					component = this.create_node(PRELUDE_OPERATOR, token_start, token_end)
				} else {
					// Container name or other identifier
					component = this.create_node(IDENTIFIER, token_start, token_end)
				}
			}

			if (component !== null) {
				if (first_component === 0) {
					first_component = component
				} else {
					this.arena.set_next_sibling(last_component, component)
				}
				last_component = component
			}
		}

		if (first_component === 0) return []

		// Create container query node
		const query_node = this.create_node(CONTAINER_QUERY, query_start, this.lexer.pos)

		// Link components as children
		this.arena.set_first_child(query_node, first_component)

		return [query_node]
	}

	// Parse supports query: (display: flex) and (gap: 1rem)
	private parse_supports_query(): number[] {
		return this.condition_parser.parse_supports_condition(
			this.lexer.pos,
			this.prelude_end,
			this.lexer.line,
			this.lexer.column,
		)
	}

	// Parse layer names: base, components, utilities
	// A single name may be dotted for nested layers: base.normalize
	// <layer-name> = <ident> ['.' <ident>]* with no whitespace around the dots.
	private parse_layer_names(): number[] {
		const nodes: number[] = []

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			this.next_token()

			const token_type = this.lexer.token_type
			if (token_type === TOKEN_IDENT) {
				const name_start = this.lexer.token_start
				let name_end = this.lexer.token_end

				// Glue on '.' ident segments immediately following, with no gaps.
				while (this.lexer.pos < this.prelude_end) {
					const saved = this.lexer.save_position()

					const dot_token_type = this.next_token()
					if (
						dot_token_type !== TOKEN_DELIM ||
						this.source.charCodeAt(this.lexer.token_start) !== CHAR_PERIOD ||
						this.lexer.token_start !== name_end
					) {
						this.lexer.restore_position(saved)
						break
					}
					const dot_end = this.lexer.token_end

					const segment_token_type = this.next_token()
					if (segment_token_type !== TOKEN_IDENT || this.lexer.token_start !== dot_end) {
						this.lexer.restore_position(saved)
						break
					}

					name_end = this.lexer.token_end
				}

				// Layer name (possibly dotted)
				const layer = this.create_node(LAYER_NAME, name_start, name_end)
				this.arena.set_content_start_delta(layer, 0)
				this.arena.set_content_length(layer, name_end - name_start)
				nodes.push(layer)
			} else if (token_type === TOKEN_COMMA) {
				// Skip comma separator
				continue
			} else if (token_type === TOKEN_WHITESPACE) {
				// Skip whitespace
				continue
			}
		}

		return nodes
	}

	// Parse @function prelude: --function-name(--param1, --param2, ...) [returns <type>]?
	// The function name is a dashed-ident immediately followed by '(' (TOKEN_FUNCTION).
	// Parameters and return type remain in the raw prelude text (accessible via .value).
	private parse_function_prelude(): number[] {
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return []

		this.next_token()

		// @function prelude starts with a <dashed-function> token like --name(
		// which the CSS tokenizer produces as TOKEN_FUNCTION (includes the '(')
		if (this.lexer.token_type !== TOKEN_FUNCTION) return []

		// Create an IDENTIFIER node for just the function name (without '(')
		const name_start = this.lexer.token_start
		const name_end = this.lexer.token_end - 1 // Exclude '('

		return [this.create_node(IDENTIFIER, name_start, name_end)]
	}

	// Parse single identifier: keyframe name, property name
	private parse_identifier(): number[] {
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return []

		this.next_token()

		if (this.lexer.token_type !== TOKEN_IDENT) return []

		// Create identifier node
		const ident = this.create_node(IDENTIFIER, this.lexer.token_start, this.lexer.token_end)

		return [ident]
	}

	// Parse @charset prelude: "UTF-8"
	private parse_charset_prelude(): number[] {
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return []

		this.next_token()

		if (this.lexer.token_type !== TOKEN_STRING) return []

		// Create string node
		const str = this.create_node(STRING, this.lexer.token_start, this.lexer.token_end)

		return [str]
	}

	// Parse @import prelude: url() [layer] [supports()] [media-query-list]
	// @import url("styles.css") layer(base) supports(display: grid) screen and (min-width: 768px);
	private parse_import_prelude(): number[] {
		const nodes: number[] = []

		// 1. Parse URL (required) - url("...") or "..."
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return []

		const url_node = this.parse_import_url()
		if (url_node === null) {
			return [] // URL is required, fail if not found
		}

		nodes.push(url_node)

		// 2. Parse optional layer
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return nodes

		const layer_node = this.parse_import_layer()
		if (layer_node !== null) {
			nodes.push(layer_node)
		}

		// 3. Parse optional supports()
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return nodes

		const supports_node = this.parse_import_supports()
		if (supports_node !== null) {
			nodes.push(supports_node)
		}

		// 4. Parse optional media query list (remaining tokens)
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return nodes

		// Parse media queries (reuse existing parser)
		const media_nodes = this.parse_media_query_list()
		nodes.push(...media_nodes)

		return nodes
	}

	// Parse import URL: url("file.css") or "file.css"
	private parse_import_url(): number | null {
		this.next_token()

		// Accept TOKEN_URL, TOKEN_FUNCTION (url(...)), or TOKEN_STRING
		if (
			this.lexer.token_type !== TOKEN_URL &&
			this.lexer.token_type !== TOKEN_FUNCTION &&
			this.lexer.token_type !== TOKEN_STRING
		) {
			return null
		}

		// For url() function, we need to consume all tokens until the closing paren
		const url_start = this.lexer.token_start
		let url_end = this.lexer.token_end

		if (this.lexer.token_type === TOKEN_FUNCTION) {
			// It's url( ... we need to find the matching )
			this.scan_matching_paren()
			const close_end = this.paren_close_end
			url_end = close_end
		}

		// Create URL node
		const url_node = this.create_node(URL, url_start, url_end)
		return url_node
	}

	// Parse import layer: `layer` or `layer(name)`
	// - `layer`        → LayerName with name=''
	// - `layer()`      → Function{name='layer'} without children
	// - `layer(a.b)`   → Function{name='layer'} > LayerName{name='a.b'}
	//   (names are read by parse_layer_names, so `@import` and `@layer` agree)
	private parse_import_layer(): number | null {
		// Peek at next token
		const saved = this.lexer.save_position()

		this.next_token()

		// Check for 'layer' keyword or 'layer(' function
		if (this.lexer.token_type === TOKEN_IDENT || this.lexer.token_type === TOKEN_FUNCTION) {
			// For function tokens, exclude the trailing '('
			const name_end =
				this.lexer.token_type === TOKEN_FUNCTION ? this.lexer.token_end - 1 : this.lexer.token_end

			if (str_equals_range(this.source, this.lexer.token_start, name_end, 'layer')) {
				const layer_start = this.lexer.token_start

				// Bare `layer` keyword: an unnamed layer
				if (this.lexer.token_type === TOKEN_IDENT) {
					const layer_node = this.create_node(LAYER_NAME, layer_start, this.lexer.token_end)
					this.arena.set_content_start_delta(layer_node, 0)
					this.arena.set_content_length(layer_node, 0)
					return layer_node
				}

				// layer(...): the Function owns the parentheses, the LayerName only the name
				const content_start = this.lexer.token_end // After the opening '('
				const after_open = this.lexer.save_position()
				const matched = this.scan_matching_paren()
				const content_end = this.paren_content_end
				const layer_end = matched ? this.paren_close_end : this.lexer.pos

				const func_node = this.create_node(FUNCTION, layer_start, layer_end)
				this.arena.set_content_start_delta(func_node, 0)
				this.arena.set_content_length(func_node, name_end - layer_start)

				const trimmed = matched ? trim_boundaries(this.source, content_start, content_end) : null
				if (trimmed) {
					this.arena.set_value_start_delta(func_node, trimmed[0] - layer_start)
					this.arena.set_value_length(func_node, trimmed[1] - trimmed[0])

					// Read the names exactly like an `@layer` prelude does
					const after_close = this.lexer.save_position()
					const saved_prelude_end = this.prelude_end
					this.lexer.restore_position(after_open)
					this.prelude_end = content_end
					const names = this.parse_layer_names()
					this.prelude_end = saved_prelude_end
					this.lexer.restore_position(after_close)

					this.arena.append_children(func_node, names)
				}

				return func_node
			}
		}

		// Not a layer, restore position
		this.lexer.restore_position(saved)
		return null
	}

	// Parse import supports: supports(condition)
	// Function{name='supports'} owns the outer parentheses. Its children are either
	//   - SupportsQuery > SupportsDeclaration for `supports(display: grid)`, where the
	//     SupportsQuery has no parentheses of its own because the source has none, or
	//   - the same flat condition nodes as an `@supports` prelude for
	//     `supports((display: grid) and (color: red))`, where each SupportsQuery
	//     owns its own `(…)`.
	private parse_import_supports(): number | null {
		// Peek at next token
		const saved = this.lexer.save_position()

		this.next_token()

		// Check for 'supports(' function
		if (this.lexer.token_type === TOKEN_FUNCTION) {
			// -1 to exclude '('
			if (
				str_equals_range(this.source, this.lexer.token_start, this.lexer.token_end - 1, 'supports')
			) {
				const supports_start = this.lexer.token_start
				const name_end = this.lexer.token_end - 1
				const content_start = this.lexer.token_end // After the opening '('
				const line = this.lexer.line
				const column = this.lexer.column

				// Find matching closing parenthesis
				this.scan_matching_paren()
				const content_end = this.paren_content_end
				const supports_end = this.paren_close_end

				const func_node = this.create_node(FUNCTION, supports_start, supports_end)
				this.arena.set_content_start_delta(func_node, 0)
				this.arena.set_content_length(func_node, name_end - supports_start)

				const trimmed = trim_boundaries(this.source, content_start, content_end)
				if (trimmed) {
					const condition_start = trimmed[0]
					const condition_end = trimmed[1]
					const condition_length = condition_end - condition_start
					this.arena.set_value_start_delta(func_node, condition_start - supports_start)
					this.arena.set_value_length(func_node, condition_length)

					const decl_child = this.condition_parser.parse_supports_declaration_content(
						condition_start,
						condition_end,
					)
					if (decl_child === null) {
						const children = this.condition_parser.parse_supports_condition(
							condition_start,
							condition_end,
							line,
							column,
						)
						this.arena.append_children(func_node, children)
					} else {
						const query = this.create_node(SUPPORTS_QUERY, condition_start, condition_end)
						this.arena.set_value_start_delta(query, 0)
						this.arena.set_value_length(query, condition_length)
						this.arena.set_first_child(query, decl_child)
						this.arena.set_first_child(func_node, query)
					}
				}

				return func_node
			}
		}

		// Not supports(), restore position
		this.lexer.restore_position(saved)
		return null
	}

	// Helper: Skip whitespace and comments
	private skip_whitespace(): void {
		this.lexer.skip_whitespace_in_range(this.prelude_end)
	}

	// Helper: Peek at next token type without consuming
	private peek_token_type(): number {
		const saved = this.lexer.save_position()

		this.next_token()
		const type = this.lexer.token_type

		this.lexer.restore_position(saved)

		return type
	}

	// Helper: Get next token
	private next_token(): TokenType {
		if (this.lexer.pos >= this.prelude_end) {
			this.lexer.token_type = TOKEN_EOF
			return TOKEN_EOF
		}
		return this.lexer.next_token(false)
	}

	// Parse @namespace prelude: [prefix] url("...") | "..."
	// e.g. @namespace url("http://www.w3.org/1999/xhtml");
	// e.g. @namespace svg url("http://www.w3.org/2000/svg");
	private parse_namespace_prelude(): number[] {
		const nodes: number[] = []
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return []

		// Peek: if it's an IDENT it's an optional prefix, otherwise let parse_import_url() take it
		const saved = this.lexer.save_position()
		this.next_token()

		if (this.lexer.token_type === TOKEN_IDENT) {
			nodes.push(this.create_node(IDENTIFIER, this.lexer.token_start, this.lexer.token_end))
			this.skip_whitespace()
		} else {
			this.lexer.restore_position(saved)
		}

		const url_node = this.parse_import_url()
		if (url_node !== null) nodes.push(url_node)

		return nodes
	}

	// Parse @scope prelude: [(<scope-start>)] [to (<scope-end>)]
	// e.g. @scope (.parent) to (.child) { }
	private parse_scope_prelude(): number[] {
		const nodes: number[] = []

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			const token_type = this.peek_token_type()

			if (token_type === TOKEN_LEFT_PAREN) {
				this.next_token() // consume '('
				const paren_start = this.lexer.token_start
				const content_start = this.lexer.pos
				// '(' is a single char on one line, so the content starts right after it
				const content_line = this.lexer.token_line
				const content_column = this.lexer.token_column

				this.scan_matching_paren()
				const content_end = this.paren_content_end
				const paren_end = this.paren_close_end

				const scope_node = this.create_node(PRELUDE_SELECTORLIST, paren_start, paren_end)
				const trimmed = trim_boundaries(this.source, content_start, content_end)
				if (trimmed) {
					this.arena.set_value_start_delta(scope_node, trimmed[0] - paren_start)
					this.arena.set_value_length(scope_node, trimmed[1] - trimmed[0])

					// <scope-start>/<scope-end> are plain <selector-list>s; unlike :has(), no leading combinator
					let line = content_line
					let column = content_column
					for (let i = content_start; i < trimmed[0]; i++) {
						if (this.source.charCodeAt(i) === 0x0a) {
							line++
							column = 1
						} else {
							column++
						}
					}
					const selector_list = this.selector_parser.parse_selector(
						trimmed[0],
						trimmed[1],
						line,
						column,
						false,
					)
					if (selector_list !== null) {
						this.arena.set_first_child(scope_node, selector_list)
					}
				}
				nodes.push(scope_node)
			} else if (token_type === TOKEN_IDENT) {
				this.next_token()
				if (str_equals_range(this.source, this.lexer.token_start, this.lexer.token_end, 'to')) {
					nodes.push(
						this.create_node(PRELUDE_OPERATOR, this.lexer.token_start, this.lexer.token_end),
					)
				}
			} else {
				this.next_token()
			}
		}

		return nodes
	}

	// Parse @custom-media prelude: --name <media-condition>
	// e.g. @custom-media --small (max-width: 30em);
	private parse_custom_media_prelude(): number[] {
		const nodes: number[] = []
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return []

		this.next_token()
		if (this.lexer.token_type !== TOKEN_IDENT) return []

		nodes.push(
			this.create_node(IDENTIFIER, this.lexer.token_start, this.lexer.token_end),
			...this.parse_media_query_list(),
		)

		return nodes
	}
}

/**
 * Parse an at-rule prelude string and return an array of AST nodes
 * @param at_rule_name - The name of the at-rule (e.g., "media", "supports", "layer")
 * @param prelude - The at-rule prelude to parse (e.g., "(min-width: 768px)", "utilities")
 * @param options - Parser options (`media_feature_range_name_as_child`: also add the feature name of a media range as an Identifier child. This will become the default behavior in 0.20.0.)
 * @returns An array of CSSNode objects representing the parsed prelude
 */
export function parse_atrule_prelude(
	at_rule_name: string,
	prelude: string,
	options?: PreludeParserOptions,
): AnyNode[] {
	// Create an arena for the prelude nodes
	const arena = new CSSDataArena(CSSDataArena.capacity_for_source(prelude.length))

	// Create prelude parser
	const prelude_parser = new AtRulePreludeParser(
		arena,
		prelude,
		options?.media_feature_range_name_as_child ?? false,
	)

	// Parse the entire source as an at-rule prelude
	const node_indices = prelude_parser.parse_prelude(at_rule_name, 0, prelude.length)

	// Wrap each node index in a CSSNode
	return node_indices.map((index) => new CSSNode(arena, prelude, index) as AnyNode)
}
