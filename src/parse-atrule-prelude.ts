// At-Rule Prelude Parser - Parses at-rule preludes into structured AST nodes
import { Lexer } from './tokenize'
import {
	CSSDataArena,
	MEDIA_QUERY,
	MEDIA_FEATURE,
	MEDIA_TYPE,
	CONTAINER_QUERY,
	SUPPORTS_QUERY,
	LAYER_NAME,
	IDENTIFIER,
	PRELUDE_OPERATOR,
	URL,
	FUNCTION,
	NUMBER,
	DIMENSION,
	STRING,
	FEATURE_RANGE,
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
	TOKEN_NUMBER,
	TOKEN_PERCENTAGE,
	TOKEN_DIMENSION,
	type TokenType,
} from './token-types'
import { str_equals, is_whitespace, CHAR_COLON, CHAR_LESS_THAN, CHAR_GREATER_THAN, CHAR_EQUALS } from './string-utils'
import { trim_boundaries, skip_whitespace_forward } from './parse-utils'
import { CSSNode } from './css-node'

/** @internal */
export class AtRulePreludeParser {
	private lexer: Lexer
	private arena: CSSDataArena
	private source: string
	private prelude_end: number

	constructor(arena: CSSDataArena, source: string) {
		this.arena = arena
		this.source = source
		// Create a lexer instance for prelude parsing (don't skip comments)
		this.lexer = new Lexer(source, false)
		this.prelude_end = 0
	}

	// Parse an at-rule prelude into nodes (standalone use)
	parse_prelude(at_rule_name: string, start: number, end: number, line: number = 1, column: number = 1): number[] {
		this.prelude_end = end

		// Position lexer at prelude start
		this.lexer.pos = start
		this.lexer.line = line
		this.lexer.column = column

		return this.parse_prelude_dispatch(at_rule_name)
	}

	// Dispatch to appropriate parser based on at-rule type
	private parse_prelude_dispatch(at_rule_name: string): number[] {
		if (str_equals('media', at_rule_name)) {
			return this.parse_media_query_list()
		} else if (str_equals('container', at_rule_name)) {
			return this.parse_container_query()
		} else if (str_equals('supports', at_rule_name)) {
			return this.parse_supports_query()
		} else if (str_equals('layer', at_rule_name)) {
			return this.parse_layer_names()
		} else if (str_equals('keyframes', at_rule_name)) {
			return this.parse_identifier()
		} else if (str_equals('property', at_rule_name)) {
			return this.parse_identifier()
		} else if (str_equals('import', at_rule_name)) {
			return this.parse_import_prelude()
		} else if (str_equals('charset', at_rule_name)) {
			return this.parse_charset_prelude()
		}
		// For now, @namespace and other at-rules are not parsed

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
		return this.arena.create_node(type, start, end - start, this.lexer.token_line, this.lexer.token_column)
	}

	private is_and_or_not(str: string): boolean {
		// All logical operators are 2-3 chars: "and" (3), "or" (2), "not" (3)
		// The str_equals calls will quickly reject strings of other lengths
		return str_equals('and', str) || str_equals('or', str) || str_equals('not', str)
	}

	// Parse a single media query: screen and (min-width: 768px)
	private parse_single_media_query(): number | null {
		let query_start = this.lexer.pos

		// Skip whitespace
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return null

		// Check for modifier (only, not)
		// let has_modifier = false
		let token_start = this.lexer.pos
		this.next_token()

		if (this.lexer.token_type === TOKEN_IDENT) {
			let text = this.source.substring(this.lexer.token_start, this.lexer.token_end)
			if (!str_equals('only', text) && !str_equals('not', text)) {
				// Reset - this is a media type
				this.lexer.pos = token_start
			}
		} else {
			this.lexer.pos = token_start
		}

		// Parse components (media type, features, operators)
		let components: number[] = []

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			// Check for comma (end of this query)
			if (this.peek_token_type() === TOKEN_COMMA) break

			this.next_token()

			let token_type = this.lexer.token_type
			// Media feature: (min-width: 768px)
			if (token_type === TOKEN_LEFT_PAREN) {
				let feature = this.parse_media_feature()
				if (feature !== null) {
					components.push(feature)
				}
			}
			// Identifier: media type or operator (and, or, not)
			else if (token_type === TOKEN_IDENT) {
				let text = this.source.substring(this.lexer.token_start, this.lexer.token_end)

				if (this.is_and_or_not(text)) {
					// Logical operator
					let op = this.create_node(PRELUDE_OPERATOR, this.lexer.token_start, this.lexer.token_end)
					components.push(op)
				} else {
					// Media type: screen, print, all
					let media_type = this.create_node(MEDIA_TYPE, this.lexer.token_start, this.lexer.token_end)
					components.push(media_type)
				}
			} else {
				// Unknown token, skip
				break
			}
		}

		if (components.length === 0) return null

		// Create media query node
		let query_node = this.create_node(MEDIA_QUERY, query_start, this.lexer.pos)

		// Append components as children
		this.arena.append_children(query_node, components)

		return query_node
	}

	// Parse media feature: (min-width: 768px) or range: (50px <= width <= 100px)
	private parse_media_feature(): number | null {
		let feature_start = this.lexer.token_start // '(' position

		// Find matching right paren
		let depth = 1
		let content_start = this.lexer.pos

		while (this.lexer.pos < this.prelude_end && depth > 0) {
			this.next_token()
			let token_type = this.lexer.token_type
			if (token_type === TOKEN_LEFT_PAREN) {
				depth++
			} else if (token_type === TOKEN_RIGHT_PAREN) {
				depth--
			}
		}

		if (depth !== 0) return null // Unmatched parentheses

		let content_end = this.lexer.token_start // Before ')'
		let feature_end = this.lexer.token_end // After ')'

		// Check for range syntax (has comparison operators)
		let has_comparison = false
		for (let i = content_start; i < content_end; i++) {
			let ch = this.source.charCodeAt(i)
			if (ch === CHAR_LESS_THAN || ch === CHAR_GREATER_THAN || ch === CHAR_EQUALS) {
				has_comparison = true
				break
			}
		}

		if (has_comparison) {
			return this.parse_feature_range(feature_start, feature_end, content_start, content_end)
		}

		// Standard feature or boolean feature
		let feature = this.create_node(MEDIA_FEATURE, feature_start, feature_end)

		// Find colon to separate name from value
		let colon_pos = -1
		for (let i = content_start; i < content_end; i++) {
			if (this.source.charCodeAt(i) === CHAR_COLON) {
				colon_pos = i
				break
			}
		}

		if (colon_pos !== -1) {
			// Standard feature: (name: value)
			let name_trimmed = trim_boundaries(this.source, content_start, colon_pos)
			if (name_trimmed) {
				this.arena.set_content_start_delta(feature, name_trimmed[0] - feature_start)
				this.arena.set_content_length(feature, name_trimmed[1] - name_trimmed[0])
			}

			// Parse value portion
			let value_trimmed = trim_boundaries(this.source, colon_pos + 1, content_end)
			if (value_trimmed) {
				let value_nodes = this.parse_feature_value(value_trimmed[0], value_trimmed[1])
				if (value_nodes.length > 0) {
					this.arena.append_children(feature, value_nodes)
				}
			}
		} else {
			// Boolean feature: (hover), (color)
			let trimmed = trim_boundaries(this.source, content_start, content_end)
			if (trimmed) {
				this.arena.set_content_start_delta(feature, trimmed[0] - feature_start)
				this.arena.set_content_length(feature, trimmed[1] - trimmed[0])
			}
		}

		return feature
	}

	// Parse container query: [name] and (min-width: 400px)
	private parse_container_query(): number[] {
		let nodes: number[] = []
		let query_start = this.lexer.pos

		// Parse components (identifiers, operators, features)
		let components: number[] = []

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			this.next_token()

			let token_type = this.lexer.token_type
			// Container feature: (min-width: 400px)
			if (token_type === TOKEN_LEFT_PAREN) {
				let feature = this.parse_media_feature() // Reuse media feature parser
				if (feature !== null) {
					components.push(feature)
				}
			}
			// Function: style(--custom: 1)
			else if (token_type === TOKEN_FUNCTION) {
				let func_name = this.source.substring(this.lexer.token_start, this.lexer.token_end - 1) // -1 to exclude '('

				// For now, treat all functions (like style()) as FUNCTION nodes
				let func_start = this.lexer.token_start
				let content_start = this.lexer.token_end // After '('

				// Find matching closing paren
				let paren_depth = 1
				let func_end = this.lexer.token_end
				let content_end = content_start

				while (this.lexer.pos < this.prelude_end && paren_depth > 0) {
					this.next_token()
					let inner_token = this.lexer.token_type
					if (inner_token === TOKEN_LEFT_PAREN || inner_token === TOKEN_FUNCTION) {
						paren_depth++
					} else if (inner_token === TOKEN_RIGHT_PAREN) {
						paren_depth--
						if (paren_depth === 0) {
							content_end = this.lexer.token_start
							func_end = this.lexer.token_end
						}
					} else if (inner_token === TOKEN_EOF) {
						break
					}
				}

				// Create function node
				let func_node = this.create_node(FUNCTION, func_start, func_end)
				// Set content fields to function name
				this.arena.set_content_start_delta(func_node, 0)
				this.arena.set_content_length(func_node, func_name.length)
				// Set value fields to content inside parentheses
				this.arena.set_value_start_delta(func_node, content_start - func_start)
				this.arena.set_value_length(func_node, content_end - content_start)

				components.push(func_node)
			}
			// Identifier: operator (and, or, not) or container name
			else if (token_type === TOKEN_IDENT) {
				let text = this.source.substring(this.lexer.token_start, this.lexer.token_end)

				if (this.is_and_or_not(text)) {
					// Logical operator
					let op = this.create_node(PRELUDE_OPERATOR, this.lexer.token_start, this.lexer.token_end)
					components.push(op)
				} else {
					// Container name or other identifier
					let name = this.create_node(IDENTIFIER, this.lexer.token_start, this.lexer.token_end)
					components.push(name)
				}
			}
		}

		if (components.length === 0) return []

		// Create container query node
		let query_node = this.create_node(CONTAINER_QUERY, query_start, this.lexer.pos)

		// Append components as children
		this.arena.append_children(query_node, components)

		nodes.push(query_node)
		return nodes
	}

	// Parse supports query: (display: flex) and (gap: 1rem)
	private parse_supports_query(): number[] {
		let nodes: number[] = []

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			this.next_token()

			let token_type = this.lexer.token_type
			// Feature query: (property: value)
			if (token_type === TOKEN_LEFT_PAREN) {
				let feature_start = this.lexer.token_start

				// Find matching right paren
				let depth = 1
				let content_start = this.lexer.pos

				while (this.lexer.pos < this.prelude_end && depth > 0) {
					this.next_token()
					let inner_token_type = this.lexer.token_type
					if (inner_token_type === TOKEN_LEFT_PAREN) {
						depth++
					} else if (inner_token_type === TOKEN_RIGHT_PAREN) {
						depth--
					}
				}

				if (depth === 0) {
					let content_end = this.lexer.token_start
					let feature_end = this.lexer.token_end

					// Create supports query node
					let query = this.create_node(SUPPORTS_QUERY, feature_start, feature_end)

					// Store query content in value fields, trimmed
					let trimmed = trim_boundaries(this.source, content_start, content_end)
					if (trimmed) {
						this.arena.set_value_start_delta(query, trimmed[0] - feature_start)
						this.arena.set_value_length(query, trimmed[1] - trimmed[0])
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
		}

		return nodes
	}

	// Parse layer names: base, components, utilities
	private parse_layer_names(): number[] {
		let nodes: number[] = []

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			this.next_token()

			let token_type = this.lexer.token_type
			if (token_type === TOKEN_IDENT) {
				// Layer name
				let layer = this.create_node(LAYER_NAME, this.lexer.token_start, this.lexer.token_end)
				// Set value to the layer name text (same as the full node text)
				this.arena.set_value_start_delta(layer, 0)
				this.arena.set_value_length(layer, this.lexer.token_end - this.lexer.token_start)
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
		if (url_node !== null) {
			nodes.push(url_node)
		} else {
			return [] // URL is required, fail if not found
		}

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
		if (this.lexer.token_type !== TOKEN_URL && this.lexer.token_type !== TOKEN_FUNCTION && this.lexer.token_type !== TOKEN_STRING) {
			return null
		}

		// For url() function, we need to consume all tokens until the closing paren
		let url_start = this.lexer.token_start
		let url_end = this.lexer.token_end

		if (this.lexer.token_type === TOKEN_FUNCTION) {
			// It's url( ... we need to find the matching )
			let paren_depth = 1
			while (this.lexer.pos < this.prelude_end && paren_depth > 0) {
				let tokenType = this.next_token()
				if (tokenType === TOKEN_LEFT_PAREN || tokenType === TOKEN_FUNCTION) {
					paren_depth++
				} else if (tokenType === TOKEN_RIGHT_PAREN) {
					paren_depth--
					if (paren_depth === 0) {
						url_end = this.lexer.token_end
					}
				} else if (tokenType === TOKEN_EOF) {
					break
				}
			}
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
					let paren_depth = 1
					while (this.lexer.pos < this.prelude_end && paren_depth > 0) {
						let tokenType = this.next_token()
						if (tokenType === TOKEN_LEFT_PAREN || tokenType === TOKEN_FUNCTION) {
							paren_depth++
						} else if (tokenType === TOKEN_RIGHT_PAREN) {
							paren_depth--
							if (paren_depth === 0) {
								content_length = this.lexer.token_start - content_start
								layer_end = this.lexer.token_end
							}
						} else if (tokenType === TOKEN_EOF) {
							break
						}
					}
				}

				// Create layer node
				let layer_node = this.create_node(LAYER_NAME, layer_start, layer_end)

				// Store the layer name (content inside parentheses), trimmed
				if (content_length > 0) {
					let trimmed = trim_boundaries(this.source, content_start, content_start + content_length)
					if (trimmed) {
						// Set both content fields (for .name) and value fields (for .value)
						this.arena.set_content_start_delta(layer_node, trimmed[0] - layer_start)
						this.arena.set_content_length(layer_node, trimmed[1] - trimmed[0])
						this.arena.set_value_start_delta(layer_node, trimmed[0] - layer_start)
						this.arena.set_value_length(layer_node, trimmed[1] - trimmed[0])
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
				let paren_depth = 1
				let supports_end = this.lexer.token_end
				let content_end = content_start

				while (this.lexer.pos < this.prelude_end && paren_depth > 0) {
					let tokenType = this.next_token()
					if (tokenType === TOKEN_LEFT_PAREN || tokenType === TOKEN_FUNCTION) {
						paren_depth++
					} else if (tokenType === TOKEN_RIGHT_PAREN) {
						paren_depth--
						if (paren_depth === 0) {
							content_end = this.lexer.token_start // Before the closing ')'
							supports_end = this.lexer.token_end
						}
					} else if (tokenType === TOKEN_EOF) {
						break
					}
				}

				// Create supports node
				let supports_node = this.create_node(SUPPORTS_QUERY, supports_start, supports_end)

				// Store query content in value fields, trimmed
				let trimmed = trim_boundaries(this.source, content_start, content_end)
				if (trimmed) {
					this.arena.set_value_start_delta(supports_node, trimmed[0] - supports_start)
					this.arena.set_value_length(supports_node, trimmed[1] - trimmed[0])
				}

				return supports_node
			}
		}

		// Not supports(), restore position
		this.lexer.restore_position(saved)
		return null
	}

	// Helper: Skip whitespace
	private skip_whitespace(): void {
		this.lexer.pos = skip_whitespace_forward(this.source, this.lexer.pos, this.prelude_end)
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

	// Helper: Parse a single value token into a node
	private parse_value_token(): number | null {
		switch (this.lexer.token_type) {
			case TOKEN_IDENT:
				return this.create_node(IDENTIFIER, this.lexer.token_start, this.lexer.token_end)
			case TOKEN_NUMBER:
				return this.create_node(NUMBER, this.lexer.token_start, this.lexer.token_end)
			case TOKEN_PERCENTAGE:
			case TOKEN_DIMENSION:
				return this.create_node(DIMENSION, this.lexer.token_start, this.lexer.token_end)
			case TOKEN_STRING:
				return this.create_node(STRING, this.lexer.token_start, this.lexer.token_end)
			default:
				return null
		}
	}

	// Helper: Parse feature value portion into typed nodes
	private parse_feature_value(start: number, end: number): number[] {
		let saved_pos = this.lexer.save_position()
		this.lexer.pos = start

		let nodes: number[] = []

		while (this.lexer.pos < end) {
			this.lexer.next_token_fast(false)
			if (this.lexer.token_start >= end) break

			// Skip whitespace tokens
			let all_whitespace = true
			for (let i = this.lexer.token_start; i < this.lexer.token_end && i < end; i++) {
				if (!is_whitespace(this.source.charCodeAt(i))) {
					all_whitespace = false
					break
				}
			}
			if (all_whitespace) continue

			// Create node based on token type
			let node = this.parse_value_token()
			if (node !== null) nodes.push(node)
		}

		this.lexer.restore_position(saved_pos)
		return nodes
	}

	// Parse media feature range syntax: (50px <= width <= 100px)
	private parse_feature_range(
		feature_start: number,
		feature_end: number,
		content_start: number,
		content_end: number
	): number {
		let range_node = this.create_node(FEATURE_RANGE, feature_start, feature_end)
		let children: number[] = []
		let feature_name_start = -1
		let feature_name_end = -1

		let pos = content_start

		while (pos < content_end) {
			pos = skip_whitespace_forward(this.source, pos, content_end)
			if (pos >= content_end) break

			let ch = this.source.charCodeAt(pos)

			// Comparison operator
			if (ch === CHAR_LESS_THAN || ch === CHAR_GREATER_THAN || ch === CHAR_EQUALS) {
				let op_start = pos++
				if (pos < content_end && this.source.charCodeAt(pos) === CHAR_EQUALS) pos++

				let op = this.create_node(PRELUDE_OPERATOR, op_start, pos)
				children.push(op)
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
					// Value
					let value_nodes = this.parse_feature_value(this.lexer.token_start, this.lexer.token_end)
					children.push(...value_nodes)
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

		this.arena.append_children(range_node, children)
		return range_node
	}
}

/**
 * Parse an at-rule prelude string and return an array of AST nodes
 * @param at_rule_name - The name of the at-rule (e.g., "media", "supports", "layer")
 * @param prelude - The at-rule prelude to parse (e.g., "(min-width: 768px)", "utilities")
 * @returns An array of CSSNode objects representing the parsed prelude
 */
export function parse_atrule_prelude(at_rule_name: string, prelude: string): CSSNode[] {
	// Create an arena for the prelude nodes
	const arena = new CSSDataArena(CSSDataArena.capacity_for_source(prelude.length))

	// Create prelude parser
	const prelude_parser = new AtRulePreludeParser(arena, prelude)

	// Parse the entire source as an at-rule prelude
	const node_indices = prelude_parser.parse_prelude(at_rule_name, 0, prelude.length)

	// Wrap each node index in a CSSNode
	return node_indices.map((index) => new CSSNode(arena, prelude, index))
}
