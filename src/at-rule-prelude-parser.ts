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
} from './arena'
import {
	TOKEN_IDENT,
	TOKEN_LEFT_PAREN,
	TOKEN_RIGHT_PAREN,
	TOKEN_COMMA,
	TOKEN_COLON,
	TOKEN_EOF,
	TOKEN_WHITESPACE,
} from './token-types'

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
	parse_prelude(at_rule_name: string, start: number, end: number): number[] {
		this.prelude_end = end

		// Position lexer at prelude start
		this.lexer.pos = start
		this.lexer.line = 1

		const name = at_rule_name.toLowerCase()

		// Dispatch to appropriate parser based on at-rule type
		if (name === 'media') {
			return this.parse_media_query_list()
		} else if (name === 'container') {
			return this.parse_container_query()
		} else if (name === 'supports') {
			return this.parse_supports_query()
		} else if (name === 'layer') {
			return this.parse_layer_names()
		} else if (name === 'keyframes') {
			return this.parse_identifier()
		} else if (name === 'property') {
			return this.parse_identifier()
		}
		// TODO: Add support for @import with url(), layer(), and media queries
		// For now, @import, @namespace, and other at-rules are not parsed

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
			if (this.peek_token_type() === TOKEN_COMMA) {
				this.next_token() // consume comma
			}
		}

		return nodes
	}

	// Parse a single media query: screen and (min-width: 768px)
	private parse_single_media_query(): number | null {
		const query_start = this.lexer.pos
		let query_line = this.lexer.line

		// Skip whitespace
		this.skip_whitespace()
		if (this.lexer.pos >= this.prelude_end) return null

		// Check for modifier (only, not)
		let has_modifier = false
		const token_start = this.lexer.pos
		this.next_token()

		if (this.lexer.token_type === TOKEN_IDENT) {
			const text = this.source.substring(this.lexer.token_start, this.lexer.token_end).toLowerCase()
			if (text === 'only' || text === 'not') {
				has_modifier = true
			} else {
				// Reset - this is a media type
				this.lexer.pos = token_start
			}
		} else {
			this.lexer.pos = token_start
		}

		// Parse components (media type, features, operators)
		const components: number[] = []

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			// Check for comma (end of this query)
			if (this.peek_token_type() === TOKEN_COMMA) break

			const component_start = this.lexer.pos
			this.next_token()

			// Media feature: (min-width: 768px)
			if (this.lexer.token_type === TOKEN_LEFT_PAREN) {
				const feature = this.parse_media_feature()
				if (feature !== null) {
					components.push(feature)
				}
			}
			// Identifier: media type or operator (and, or, not)
			else if (this.lexer.token_type === TOKEN_IDENT) {
				const text = this.source.substring(this.lexer.token_start, this.lexer.token_end).toLowerCase()

				if (text === 'and' || text === 'or' || text === 'not') {
					// Logical operator
					const op = this.arena.create_node()
					this.arena.set_type(op, NODE_PRELUDE_OPERATOR)
					this.arena.set_start_offset(op, this.lexer.token_start)
					this.arena.set_length(op, this.lexer.token_end - this.lexer.token_start)
					this.arena.set_start_line(op, this.lexer.token_line)
					components.push(op)
				} else {
					// Media type: screen, print, all
					const media_type = this.arena.create_node()
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
		const query_node = this.arena.create_node()
		this.arena.set_type(query_node, NODE_PRELUDE_MEDIA_QUERY)
		this.arena.set_start_offset(query_node, query_start)
		this.arena.set_length(query_node, this.lexer.pos - query_start)
		this.arena.set_start_line(query_node, query_line)

		// Append components as children
		for (const component of components) {
			this.arena.append_child(query_node, component)
		}

		return query_node
	}

	// Parse media feature: (min-width: 768px)
	private parse_media_feature(): number | null {
		const feature_start = this.lexer.token_start // '(' position
		const feature_line = this.lexer.token_line

		// Find matching right paren
		let depth = 1
		const content_start = this.lexer.pos

		while (this.lexer.pos < this.prelude_end && depth > 0) {
			this.next_token()
			if (this.lexer.token_type === TOKEN_LEFT_PAREN) {
				depth++
			} else if (this.lexer.token_type === TOKEN_RIGHT_PAREN) {
				depth--
			}
		}

		if (depth !== 0) return null // Unmatched parentheses

		const content_end = this.lexer.token_start // Before ')'
		const feature_end = this.lexer.token_end // After ')'

		// Create media feature node
		const feature = this.arena.create_node()
		this.arena.set_type(feature, NODE_PRELUDE_MEDIA_FEATURE)
		this.arena.set_start_offset(feature, feature_start)
		this.arena.set_length(feature, feature_end - feature_start)
		this.arena.set_start_line(feature, feature_line)

		// Store feature content (without parentheses) in value fields
		this.arena.set_value_start(feature, content_start)
		this.arena.set_value_length(feature, content_end - content_start)

		return feature
	}

	// Parse container query: [name] and (min-width: 400px)
	private parse_container_query(): number[] {
		const nodes: number[] = []
		const query_start = this.lexer.pos
		const query_line = this.lexer.line

		// Parse components (identifiers, operators, features)
		const components: number[] = []

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			this.next_token()

			// Container feature: (min-width: 400px)
			if (this.lexer.token_type === TOKEN_LEFT_PAREN) {
				const feature = this.parse_media_feature() // Reuse media feature parser
				if (feature !== null) {
					components.push(feature)
				}
			}
			// Identifier: operator (and, or, not) or container name
			else if (this.lexer.token_type === TOKEN_IDENT) {
				const text = this.source.substring(this.lexer.token_start, this.lexer.token_end).toLowerCase()

				if (text === 'and' || text === 'or' || text === 'not') {
					// Logical operator
					const op = this.arena.create_node()
					this.arena.set_type(op, NODE_PRELUDE_OPERATOR)
					this.arena.set_start_offset(op, this.lexer.token_start)
					this.arena.set_length(op, this.lexer.token_end - this.lexer.token_start)
					this.arena.set_start_line(op, this.lexer.token_line)
					components.push(op)
				} else {
					// Container name or other identifier
					const name = this.arena.create_node()
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
		const query_node = this.arena.create_node()
		this.arena.set_type(query_node, NODE_PRELUDE_CONTAINER_QUERY)
		this.arena.set_start_offset(query_node, query_start)
		this.arena.set_length(query_node, this.lexer.pos - query_start)
		this.arena.set_start_line(query_node, query_line)

		// Append components as children
		for (const component of components) {
			this.arena.append_child(query_node, component)
		}

		nodes.push(query_node)
		return nodes
	}

	// Parse supports query: (display: flex) and (gap: 1rem)
	private parse_supports_query(): number[] {
		const nodes: number[] = []

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			const query_start = this.lexer.pos
			const query_line = this.lexer.line

			this.next_token()

			// Feature query: (property: value)
			if (this.lexer.token_type === TOKEN_LEFT_PAREN) {
				const feature_start = this.lexer.token_start
				const feature_line = this.lexer.token_line

				// Find matching right paren
				let depth = 1
				const content_start = this.lexer.pos

				while (this.lexer.pos < this.prelude_end && depth > 0) {
					this.next_token()
					if (this.lexer.token_type === TOKEN_LEFT_PAREN) {
						depth++
					} else if (this.lexer.token_type === TOKEN_RIGHT_PAREN) {
						depth--
					}
				}

				if (depth === 0) {
					const content_end = this.lexer.token_start
					const feature_end = this.lexer.token_end

					// Create supports query node
					const query = this.arena.create_node()
					this.arena.set_type(query, NODE_PRELUDE_SUPPORTS_QUERY)
					this.arena.set_start_offset(query, feature_start)
					this.arena.set_length(query, feature_end - feature_start)
					this.arena.set_start_line(query, feature_line)

					// Store query content in value fields
					this.arena.set_value_start(query, content_start)
					this.arena.set_value_length(query, content_end - content_start)

					nodes.push(query)
				}
			}
			// Identifier: operator (and, or, not)
			else if (this.lexer.token_type === TOKEN_IDENT) {
				const text = this.source.substring(this.lexer.token_start, this.lexer.token_end).toLowerCase()

				if (text === 'and' || text === 'or' || text === 'not') {
					const op = this.arena.create_node()
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
		const nodes: number[] = []

		while (this.lexer.pos < this.prelude_end) {
			this.skip_whitespace()
			if (this.lexer.pos >= this.prelude_end) break

			this.next_token()

			if (this.lexer.token_type === TOKEN_IDENT) {
				// Layer name
				const layer = this.arena.create_node()
				this.arena.set_type(layer, NODE_PRELUDE_LAYER_NAME)
				this.arena.set_start_offset(layer, this.lexer.token_start)
				this.arena.set_length(layer, this.lexer.token_end - this.lexer.token_start)
				this.arena.set_start_line(layer, this.lexer.token_line)
				nodes.push(layer)
			} else if (this.lexer.token_type === TOKEN_COMMA) {
				// Skip comma separator
				continue
			} else if (this.lexer.token_type === TOKEN_WHITESPACE) {
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
		const ident = this.arena.create_node()
		this.arena.set_type(ident, NODE_PRELUDE_IDENTIFIER)
		this.arena.set_start_offset(ident, this.lexer.token_start)
		this.arena.set_length(ident, this.lexer.token_end - this.lexer.token_start)
		this.arena.set_start_line(ident, this.lexer.token_line)

		return [ident]
	}

	// Helper: Skip whitespace
	private skip_whitespace(): void {
		while (this.lexer.pos < this.prelude_end) {
			const ch = this.source.charCodeAt(this.lexer.pos)
			if (ch !== 0x20 && ch !== 0x09 && ch !== 0x0a && ch !== 0x0d && ch !== 0x0c) {
				break
			}
			this.lexer.pos++
		}
	}

	// Helper: Peek at next token type without consuming
	private peek_token_type(): number {
		const saved_pos = this.lexer.pos
		const saved_line = this.lexer.line

		this.next_token()
		const type = this.lexer.token_type

		this.lexer.pos = saved_pos
		this.lexer.line = saved_line

		return type
	}

	// Helper: Get next token
	private next_token(): void {
		if (this.lexer.pos >= this.prelude_end) {
			this.lexer.token_type = TOKEN_EOF
			return
		}
		this.lexer.next_token_fast(false)
	}
}
