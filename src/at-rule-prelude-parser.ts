// At-Rule Prelude Parser - Parses at-rule preludes into structured AST nodes
import { Lexer } from './lexer'
import type { CSSDataArena } from './arena'
import {
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
	type TokenType,
} from './token-types'
import { trim_boundaries, str_equals, CHAR_SPACE, CHAR_TAB, CHAR_NEWLINE, CHAR_CARRIAGE_RETURN, CHAR_FORM_FEED } from './string-utils'

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

	// Parse an at-rule prelude into nodes based on the at-rule type
	parse_prelude(at_rule_name: string, start: number, end: number, line: number = 1): number[] {
		this.prelude_end = end

		// Position lexer at prelude start
		this.lexer.pos = start
		this.lexer.line = line

		// Dispatch to appropriate parser based on at-rule type
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
			if (this.peek_token_type() === TOKEN_COMMA) {
				this.next_token() // consume comma
			}
		}

		return nodes
	}

	private is_and_or_not(str: string): boolean {
		if (str.length > 3 || str.length < 2) return false
		return str_equals('and', str) || str_equals('or', str) || str_equals('not', str)
	}

	// Parse a single media query: screen and (min-width: 768px)
	private parse_single_media_query(): number | null {
		let query_start = this.lexer.pos
		let query_line = this.lexer.line

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
					let op = this.arena.create_node()
					this.arena.set_type(op, NODE_PRELUDE_OPERATOR)
					this.arena.set_start_offset(op, this.lexer.token_start)
					this.arena.set_length(op, this.lexer.token_end - this.lexer.token_start)
					this.arena.set_start_line(op, this.lexer.token_line)
					components.push(op)
				} else {
					// Media type: screen, print, all
					let media_type = this.arena.create_node()
					this.arena.set_type(media_type, NODE_PRELUDE_MEDIA_TYPE)
					this.arena.set_start_offset(media_type, this.lexer.token_start)
					this.arena.set_length(media_type, this.lexer.token_end - this.lexer.token_start)
					this.arena.set_start_line(media_type, this.lexer.token_line)
					components.push(media_type)
				}
			} else {
				// Unknown token, skip
				break
			}
		}

		if (components.length === 0) return null

		// Create media query node
		let query_node = this.arena.create_node()
		this.arena.set_type(query_node, NODE_PRELUDE_MEDIA_QUERY)
		this.arena.set_start_offset(query_node, query_start)
		this.arena.set_length(query_node, this.lexer.pos - query_start)
		this.arena.set_start_line(query_node, query_line)

		// Append components as children
		for (let component of components) {
			this.arena.append_child(query_node, component)
		}

		return query_node
	}

	// Parse media feature: (min-width: 768px)
	private parse_media_feature(): number | null {
		let feature_start = this.lexer.token_start // '(' position
		let feature_line = this.lexer.token_line

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

		// Create media feature node
		let feature = this.arena.create_node()
		this.arena.set_type(feature, NODE_PRELUDE_MEDIA_FEATURE)
		this.arena.set_start_offset(feature, feature_start)
		this.arena.set_length(feature, feature_end - feature_start)
		this.arena.set_start_line(feature, feature_line)

		// Store feature content (without parentheses) in value fields, trimmed
		let trimmed = trim_boundaries(this.source, content_start, content_end)
		if (trimmed) {
			this.arena.set_value_start(feature, trimmed[0])
			this.arena.set_value_length(feature, trimmed[1] - trimmed[0])
		}

		return feature
	}

	// Parse container query: [name] and (min-width: 400px)
	private parse_container_query(): number[] {
		let nodes: number[] = []
		let query_start = this.lexer.pos
		let query_line = this.lexer.line

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
			// Identifier: operator (and, or, not) or container name
			else if (token_type === TOKEN_IDENT) {
				let text = this.source.substring(this.lexer.token_start, this.lexer.token_end)

				if (this.is_and_or_not(text)) {
					// Logical operator
					let op = this.arena.create_node()
					this.arena.set_type(op, NODE_PRELUDE_OPERATOR)
					this.arena.set_start_offset(op, this.lexer.token_start)
					this.arena.set_length(op, this.lexer.token_end - this.lexer.token_start)
					this.arena.set_start_line(op, this.lexer.token_line)
					components.push(op)
				} else {
					// Container name or other identifier
					let name = this.arena.create_node()
					this.arena.set_type(name, NODE_PRELUDE_IDENTIFIER)
					this.arena.set_start_offset(name, this.lexer.token_start)
					this.arena.set_length(name, this.lexer.token_end - this.lexer.token_start)
					this.arena.set_start_line(name, this.lexer.token_line)
					components.push(name)
				}
			}
		}

		if (components.length === 0) return []

		// Create container query node
		let query_node = this.arena.create_node()
		this.arena.set_type(query_node, NODE_PRELUDE_CONTAINER_QUERY)
		this.arena.set_start_offset(query_node, query_start)
		this.arena.set_length(query_node, this.lexer.pos - query_start)
		this.arena.set_start_line(query_node, query_line)

		// Append components as children
		for (let component of components) {
			this.arena.append_child(query_node, component)
		}

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
				let feature_line = this.lexer.token_line

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
					let query = this.arena.create_node()
					this.arena.set_type(query, NODE_PRELUDE_SUPPORTS_QUERY)
					this.arena.set_start_offset(query, feature_start)
					this.arena.set_length(query, feature_end - feature_start)
					this.arena.set_start_line(query, feature_line)

					// Store query content in value fields, trimmed
					let trimmed = trim_boundaries(this.source, content_start, content_end)
					if (trimmed) {
						this.arena.set_value_start(query, trimmed[0])
						this.arena.set_value_length(query, trimmed[1] - trimmed[0])
					}

					nodes.push(query)
				}
			}
			// Identifier: operator (and, or, not)
			else if (token_type === TOKEN_IDENT) {
				let text = this.source.substring(this.lexer.token_start, this.lexer.token_end)

				if (this.is_and_or_not(text)) {
					let op = this.arena.create_node()
					this.arena.set_type(op, NODE_PRELUDE_OPERATOR)
					this.arena.set_start_offset(op, this.lexer.token_start)
					this.arena.set_length(op, this.lexer.token_end - this.lexer.token_start)
					this.arena.set_start_line(op, this.lexer.token_line)
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
				let layer = this.arena.create_node()
				this.arena.set_type(layer, NODE_PRELUDE_LAYER_NAME)
				this.arena.set_start_offset(layer, this.lexer.token_start)
				this.arena.set_length(layer, this.lexer.token_end - this.lexer.token_start)
				this.arena.set_start_line(layer, this.lexer.token_line)
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
		let ident = this.arena.create_node()
		this.arena.set_type(ident, NODE_PRELUDE_IDENTIFIER)
		this.arena.set_start_offset(ident, this.lexer.token_start)
		this.arena.set_length(ident, this.lexer.token_end - this.lexer.token_start)
		this.arena.set_start_line(ident, this.lexer.token_line)

		return [ident]
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
		let url_line = this.lexer.token_line

		if (this.lexer.token_type === TOKEN_FUNCTION) {
			// It's url( ... we need to find the matching )
			let paren_depth = 1
			while (this.lexer.pos < this.prelude_end && paren_depth > 0) {
				let tokenType = this.next_token()
				if (tokenType === TOKEN_LEFT_PAREN) {
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
		let url_node = this.arena.create_node()
		this.arena.set_type(url_node, NODE_PRELUDE_IMPORT_URL)
		this.arena.set_start_offset(url_node, url_start)
		this.arena.set_length(url_node, url_end - url_start)
		this.arena.set_start_line(url_node, url_line)

		return url_node
	}

	// Parse import layer: layer or layer(name)
	private parse_import_layer(): number | null {
		// Peek at next token
		let saved_pos = this.lexer.pos
		let saved_line = this.lexer.line

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
				let layer_line = this.lexer.token_line
				let content_start = 0
				let content_length = 0

				// If it's a function token, parse the contents until closing paren
				if (this.lexer.token_type === TOKEN_FUNCTION) {
					// Track the content inside the parentheses
					content_start = this.lexer.pos
					let paren_depth = 1
					while (this.lexer.pos < this.prelude_end && paren_depth > 0) {
						let tokenType = this.next_token()
						if (tokenType === TOKEN_LEFT_PAREN) {
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
				let layer_node = this.arena.create_node()
				this.arena.set_type(layer_node, NODE_PRELUDE_IMPORT_LAYER)
				this.arena.set_start_offset(layer_node, layer_start)
				this.arena.set_length(layer_node, layer_end - layer_start)
				this.arena.set_start_line(layer_node, layer_line)

				// Store the layer name (content inside parentheses), trimmed
				if (content_length > 0) {
					let trimmed = trim_boundaries(this.source, content_start, content_start + content_length)
					if (trimmed) {
						this.arena.set_content_start(layer_node, trimmed[0])
						this.arena.set_content_length(layer_node, trimmed[1] - trimmed[0])
					}
				}

				return layer_node
			}
		}

		// Not a layer, restore position
		this.lexer.pos = saved_pos
		this.lexer.line = saved_line
		return null
	}

	// Parse import supports: supports(condition)
	private parse_import_supports(): number | null {
		// Peek at next token
		let saved_pos = this.lexer.pos
		let saved_line = this.lexer.line

		this.next_token()

		// Check for 'supports(' function
		if (this.lexer.token_type === TOKEN_FUNCTION) {
			let text = this.source.substring(this.lexer.token_start, this.lexer.token_end - 1) // -1 to exclude '('
			if (str_equals('supports', text)) {
				let supports_start = this.lexer.token_start
				let supports_line = this.lexer.token_line

				// Find matching closing parenthesis
				let paren_depth = 1
				let supports_end = this.lexer.token_end

				while (this.lexer.pos < this.prelude_end && paren_depth > 0) {
					let tokenType = this.next_token()
					if (tokenType === TOKEN_LEFT_PAREN) {
						paren_depth++
					} else if (tokenType === TOKEN_RIGHT_PAREN) {
						paren_depth--
						if (paren_depth === 0) {
							supports_end = this.lexer.token_end
						}
					} else if (tokenType === TOKEN_EOF) {
						break
					}
				}

				// Create supports node
				let supports_node = this.arena.create_node()
				this.arena.set_type(supports_node, NODE_PRELUDE_IMPORT_SUPPORTS)
				this.arena.set_start_offset(supports_node, supports_start)
				this.arena.set_length(supports_node, supports_end - supports_start)
				this.arena.set_start_line(supports_node, supports_line)

				return supports_node
			}
		}

		// Not supports(), restore position
		this.lexer.pos = saved_pos
		this.lexer.line = saved_line
		return null
	}

	// Helper: Skip whitespace
	private skip_whitespace(): void {
		while (this.lexer.pos < this.prelude_end) {
			let ch = this.source.charCodeAt(this.lexer.pos)
			if (ch !== CHAR_SPACE && ch !== CHAR_TAB && ch !== CHAR_NEWLINE && ch !== CHAR_CARRIAGE_RETURN && ch !== CHAR_FORM_FEED) {
				break
			}
			this.lexer.pos++
		}
	}

	// Helper: Peek at next token type without consuming
	private peek_token_type(): number {
		let saved_pos = this.lexer.pos
		let saved_line = this.lexer.line

		this.next_token()
		let type = this.lexer.token_type

		this.lexer.pos = saved_pos
		this.lexer.line = saved_line

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
}
