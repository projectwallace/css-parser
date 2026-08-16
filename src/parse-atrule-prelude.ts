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
import { str_equals, strip_vendor_prefix, CHAR_PERIOD } from './string-utils'
import { trim_boundaries, skip_whitespace_and_comments_forward } from './parse-utils'
import { CSSNode } from './css-node'
import type { AnyNode } from './node-types'
import { ValueNodeParser } from './value-node-parser'
import { ConditionParser } from './parse-condition'

/** @internal */
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

	constructor(arena: CSSDataArena, source: string) {
		this.arena = arena
		this.source = source
		// Create a lexer instance for prelude parsing
		this.lexer = new Lexer(source)
		this.prelude_end = 0
		this.value_node_parser = new ValueNodeParser(arena, source)
		this.condition_parser = new ConditionParser(arena, source, this.value_node_parser)
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
		let normalized_name = strip_vendor_prefix(at_rule_name).toLowerCase()

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
		let nodes: number[] = []

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			let query = this.parse_single_media_query()
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

		while (this.lexer.pos < this.prelude_end && depth > 0) {
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

	// Parse a single media query: screen and (min-width: 768px)
	private parse_single_media_query(): number | null {
		let query_start = this.lexer.pos

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
			let text = this.source.substring(this.lexer.token_start, this.lexer.token_end)
			if (str_equals('only', text) || str_equals('not', text)) {
				let modifier = this.create_node(
					PRELUDE_OPERATOR,
					this.lexer.token_start,
					this.lexer.token_end,
				)
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

			let token_type = this.lexer.token_type
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
					this.lexer.seek(...this.condition_parser.end_position)
				}
			}
			// Identifier: media type or operator (and, or, not)
			else if (token_type === TOKEN_IDENT) {
				let text = this.source.substring(this.lexer.token_start, this.lexer.token_end)

				if (this.is_and_or_not(text)) {
					// Logical operator
					component = this.create_node(
						PRELUDE_OPERATOR,
						this.lexer.token_start,
						this.lexer.token_end,
					)
				} else {
					// Media type: screen, print, all
					component = this.create_node(MEDIA_TYPE, this.lexer.token_start, this.lexer.token_end)
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
		let query_node = this.create_node(MEDIA_QUERY, query_start, this.lexer.pos)

		// Link components as children
		this.arena.set_first_child(query_node, first_component)

		return query_node
	}

	// Parse container query: [name] and (min-width: 400px)
	private parse_container_query(): number[] {
		let query_start = this.lexer.pos

		// Parse components (identifiers, operators, features), chained as siblings without an
		// intermediate array — most container queries have a single component.
		let first_component = 0
		let last_component = 0

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			this.next_token()

			let token_type = this.lexer.token_type
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
					this.lexer.seek(...this.condition_parser.end_position)
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
				this.lexer.seek(...this.condition_parser.end_position)
			}
			// Identifier: operator (and, or, not) or container name
			else if (token_type === TOKEN_IDENT) {
				let text = this.source.substring(this.lexer.token_start, this.lexer.token_end)

				if (this.is_and_or_not(text)) {
					// Logical operator
					component = this.create_node(
						PRELUDE_OPERATOR,
						this.lexer.token_start,
						this.lexer.token_end,
					)
				} else {
					// Container name or other identifier
					component = this.create_node(IDENTIFIER, this.lexer.token_start, this.lexer.token_end)
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
		let query_node = this.create_node(CONTAINER_QUERY, query_start, this.lexer.pos)

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
		let nodes: number[] = []

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			this.next_token()

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_IDENT) {
				let name_start = this.lexer.token_start
				let name_end = this.lexer.token_end

				// Glue on '.' ident segments immediately following, with no gaps.
				while (this.lexer.pos < this.prelude_end) {
					let saved = this.lexer.save_position()

					let dot_token_type = this.next_token()
					if (
						dot_token_type !== TOKEN_DELIM ||
						this.source.charCodeAt(this.lexer.token_start) !== CHAR_PERIOD ||
						this.lexer.token_start !== name_end
					) {
						this.lexer.restore_position(saved)
						break
					}
					let dot_end = this.lexer.token_end

					let segment_token_type = this.next_token()
					if (segment_token_type !== TOKEN_IDENT || this.lexer.token_start !== dot_end) {
						this.lexer.restore_position(saved)
						break
					}

					name_end = this.lexer.token_end
				}

				// Layer name (possibly dotted)
				let layer = this.create_node(LAYER_NAME, name_start, name_end)
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
		let name_start = this.lexer.token_start
		let name_end = this.lexer.token_end - 1 // Exclude '('

		return [this.create_node(IDENTIFIER, name_start, name_end)]
	}

	// Parse single identifier: keyframe name, property name
	private parse_identifier(): number[] {
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return []

		this.next_token()

		if (this.lexer.token_type !== TOKEN_IDENT) return []

		// Create identifier node
		let ident = this.create_node(IDENTIFIER, this.lexer.token_start, this.lexer.token_end)

		return [ident]
	}

	// Parse @charset prelude: "UTF-8"
	private parse_charset_prelude(): number[] {
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return []

		this.next_token()

		if (this.lexer.token_type !== TOKEN_STRING) return []

		// Create string node
		let str = this.create_node(STRING, this.lexer.token_start, this.lexer.token_end)

		return [str]
	}

	// Parse @import prelude: url() [layer] [supports()] [media-query-list]
	// @import url("styles.css") layer(base) supports(display: grid) screen and (min-width: 768px);
	private parse_import_prelude(): number[] {
		let nodes: number[] = []

		// 1. Parse URL (required) - url("...") or "..."
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return []

		let url_node = this.parse_import_url()
		if (url_node === null) {
			return [] // URL is required, fail if not found
		}

		nodes.push(url_node)

		// 2. Parse optional layer
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return nodes

		let layer_node = this.parse_import_layer()
		if (layer_node !== null) {
			nodes.push(layer_node)
		}

		// 3. Parse optional supports()
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return nodes

		let supports_node = this.parse_import_supports()
		if (supports_node !== null) {
			nodes.push(supports_node)
		}

		// 4. Parse optional media query list (remaining tokens)
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return nodes

		// Parse media queries (reuse existing parser)
		let media_nodes = this.parse_media_query_list()
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
		let url_start = this.lexer.token_start
		let url_end = this.lexer.token_end

		if (this.lexer.token_type === TOKEN_FUNCTION) {
			// It's url( ... we need to find the matching )
			let [, close_end] = this.scan_matching_paren()
			url_end = close_end
		}

		// Create URL node
		let url_node = this.create_node(URL, url_start, url_end)
		return url_node
	}

	// Parse import layer: layer or layer(name)
	private parse_import_layer(): number | null {
		// Peek at next token
		const saved = this.lexer.save_position()

		this.next_token()

		// Check for 'layer' keyword or 'layer(' function
		if (this.lexer.token_type === TOKEN_IDENT || this.lexer.token_type === TOKEN_FUNCTION) {
			let text = this.source.substring(this.lexer.token_start, this.lexer.token_end)
			// For function tokens, remove the trailing '('
			if (this.lexer.token_type === TOKEN_FUNCTION && text.endsWith('(')) {
				text = text.slice(0, -1)
			}

			if (str_equals('layer', text)) {
				let layer_start = this.lexer.token_start
				let layer_end = this.lexer.token_end
				let content_start = 0
				let content_length = 0

				// If it's a function token, parse the contents until closing paren
				if (this.lexer.token_type === TOKEN_FUNCTION) {
					// Track the content inside the parentheses
					content_start = this.lexer.pos
					let [content_end, close_end, matched] = this.scan_matching_paren()
					if (matched) {
						content_length = content_end - content_start
						layer_end = close_end
					}
				}

				// Create layer node
				let layer_node = this.create_node(LAYER_NAME, layer_start, layer_end)

				// Store the layer name (content inside parentheses), trimmed
				if (content_length > 0) {
					let trimmed = trim_boundaries(this.source, content_start, content_start + content_length)
					if (trimmed) {
						this.arena.set_content_start_delta(layer_node, trimmed[0] - layer_start)
						this.arena.set_content_length(layer_node, trimmed[1] - trimmed[0])
					}
				}

				return layer_node
			}
		}

		// Not a layer, restore position
		this.lexer.restore_position(saved)
		return null
	}

	// Parse import supports: supports(condition)
	private parse_import_supports(): number | null {
		// Peek at next token
		const saved = this.lexer.save_position()

		this.next_token()

		// Check for 'supports(' function
		if (this.lexer.token_type === TOKEN_FUNCTION) {
			let text = this.source.substring(this.lexer.token_start, this.lexer.token_end - 1) // -1 to exclude '('
			if (str_equals('supports', text)) {
				let supports_start = this.lexer.token_start
				let content_start = this.lexer.token_end // After the opening '('

				// Find matching closing parenthesis
				let [content_end, supports_end] = this.scan_matching_paren()

				// Create supports node
				let supports_node = this.create_node(SUPPORTS_QUERY, supports_start, supports_end)

				// Store query content in value fields, trimmed
				let trimmed = trim_boundaries(this.source, content_start, content_end)
				if (trimmed) {
					this.arena.set_value_start_delta(supports_node, trimmed[0] - supports_start)
					this.arena.set_value_length(supports_node, trimmed[1] - trimmed[0])

					// Check for simple declaration: supports(property: value)
					let decl_child = this.condition_parser.parse_supports_declaration_content(
						trimmed[0],
						trimmed[1],
					)
					if (decl_child !== null) {
						this.arena.set_first_child(supports_node, decl_child)
					}
				}

				return supports_node
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
		let type = this.lexer.token_type

		this.lexer.restore_position(saved)

		return type
	}

	// Helper: Get next token
	private next_token(): TokenType {
		if (this.lexer.pos >= this.prelude_end) {
			this.lexer.token_type = TOKEN_EOF
			return TOKEN_EOF
		}
		return this.lexer.next_token_fast(false)
	}

	// Parse @namespace prelude: [prefix] url("...") | "..."
	// e.g. @namespace url("http://www.w3.org/1999/xhtml");
	// e.g. @namespace svg url("http://www.w3.org/2000/svg");
	private parse_namespace_prelude(): number[] {
		let nodes: number[] = []
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
		let nodes: number[] = []

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			const token_type = this.peek_token_type()

			if (token_type === TOKEN_LEFT_PAREN) {
				this.next_token() // consume '('
				let paren_start = this.lexer.token_start
				let content_start = this.lexer.pos

				let [content_end, paren_end] = this.scan_matching_paren()

				let scope_node = this.create_node(PRELUDE_SELECTORLIST, paren_start, paren_end)
				let trimmed = trim_boundaries(this.source, content_start, content_end)
				if (trimmed) {
					this.arena.set_value_start_delta(scope_node, trimmed[0] - paren_start)
					this.arena.set_value_length(scope_node, trimmed[1] - trimmed[0])
				}
				nodes.push(scope_node)
			} else if (token_type === TOKEN_IDENT) {
				this.next_token()
				let text = this.source.substring(this.lexer.token_start, this.lexer.token_end)
				if (str_equals('to', text)) {
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
		let nodes: number[] = []
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
 * @returns An array of CSSNode objects representing the parsed prelude
 */
export function parse_atrule_prelude(at_rule_name: string, prelude: string): AnyNode[] {
	// Create an arena for the prelude nodes
	const arena = new CSSDataArena(CSSDataArena.capacity_for_source(prelude.length))

	// Create prelude parser
	const prelude_parser = new AtRulePreludeParser(arena, prelude)

	// Parse the entire source as an at-rule prelude
	const node_indices = prelude_parser.parse_prelude(at_rule_name, 0, prelude.length)

	// Wrap each node index in a CSSNode
	return node_indices.map((index) => new CSSNode(arena, prelude, index) as AnyNode)
}
