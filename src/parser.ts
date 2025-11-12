// CSS Parser - Builds AST using the arena
import { Lexer } from './lexer'
import {
	CSSDataArena,
	NODE_STYLESHEET,
	NODE_STYLE_RULE,
	NODE_SELECTOR,
	NODE_DECLARATION,
	NODE_AT_RULE,
	FLAG_IMPORTANT,
} from './arena'
import type { Token } from './token-types'
import {
	TOKEN_EOF,
	TOKEN_WHITESPACE,
	TOKEN_COMMENT,
	TOKEN_LEFT_BRACE,
	TOKEN_RIGHT_BRACE,
	TOKEN_COLON,
	TOKEN_SEMICOLON,
	TOKEN_IDENT,
	TOKEN_DELIM,
	TOKEN_AT_KEYWORD,
} from './token-types'

export class Parser {
	private source: string
	private lexer: Lexer
	private arena: CSSDataArena
	private currentToken: Token | null

	constructor(source: string) {
		this.source = source
		this.lexer = new Lexer(source)
		// Calculate optimal capacity based on source size
		const capacity = CSSDataArena.capacityForSource(source.length)
		this.arena = new CSSDataArena(capacity)
		this.currentToken = null
	}

	// Get the arena (for inspection/traversal after parsing)
	getArena(): CSSDataArena {
		return this.arena
	}

	// Advance to the next token, skipping whitespace
	private nextToken(): Token | null {
		do {
			this.currentToken = this.lexer.nextToken()
		} while (this.currentToken && this.currentToken.type === TOKEN_WHITESPACE)

		return this.currentToken
	}

	// Peek at current token type
	private peekType(): number {
		return this.currentToken?.type ?? TOKEN_EOF
	}

	// Check if we're at the end of input
	private isEOF(): boolean {
		return this.peekType() === TOKEN_EOF
	}

	// Parse the entire stylesheet and return the root node index
	parse(): number {
		// Start by getting the first token
		this.nextToken()

		// Create the root stylesheet node
		const stylesheet = this.arena.createNode()
		this.arena.setType(stylesheet, NODE_STYLESHEET)
		this.arena.setStartOffset(stylesheet, 0)
		this.arena.setLength(stylesheet, this.source.length)
		this.arena.setStartLine(stylesheet, 1)

		// Parse all rules at the top level
		while (!this.isEOF()) {
			const rule = this.parseRule()
			if (rule !== null) {
				this.arena.appendChild(stylesheet, rule)
			} else {
				// Skip unknown tokens
				this.nextToken()
			}
		}

		return stylesheet
	}

	// Parse a rule (style rule or at-rule)
	private parseRule(): number | null {
		if (this.isEOF()) {
			return null
		}

		// Skip comments at rule level
		if (this.peekType() === TOKEN_COMMENT) {
			// TODO: Create comment nodes
			this.nextToken()
			return null
		}

		// Check for at-rule
		if (this.peekType() === TOKEN_AT_KEYWORD) {
			return this.parseAtRule()
		}

		// Try to parse as style rule
		return this.parseStyleRule()
	}

	// Parse a style rule: selector { declarations }
	private parseStyleRule(): number | null {
		const startToken = this.currentToken
		if (!startToken) return null

		const ruleStart = startToken.start
		const ruleLine = startToken.line

		// Create the style rule node
		const styleRule = this.arena.createNode()
		this.arena.setType(styleRule, NODE_STYLE_RULE)
		this.arena.setStartLine(styleRule, ruleLine)

		// Parse selector (everything until '{')
		const selector = this.parseSelector()
		if (selector !== null) {
			this.arena.appendChild(styleRule, selector)
		}

		// Expect '{'
		if (this.peekType() !== TOKEN_LEFT_BRACE) {
			// Error recovery: skip to next rule
			return null
		}
		this.nextToken() // consume '{'

		// Parse declarations block
		while (!this.isEOF() && this.peekType() !== TOKEN_RIGHT_BRACE) {
			const declaration = this.parseDeclaration()
			if (declaration !== null) {
				this.arena.appendChild(styleRule, declaration)
			} else {
				// Skip unknown tokens
				this.nextToken()
			}
		}

		// Expect '}'
		if (this.peekType() === TOKEN_RIGHT_BRACE) {
			this.nextToken() // consume '}'
		}

		// Set the rule's offsets
		const endToken = this.currentToken
		if (endToken) {
			this.arena.setStartOffset(styleRule, ruleStart)
			this.arena.setLength(styleRule, endToken.end - ruleStart)
		}

		return styleRule
	}

	// Parse a selector (everything before '{')
	private parseSelector(): number | null {
		const startToken = this.currentToken
		if (!startToken) return null

		const selectorStart = startToken.start
		const selectorLine = startToken.line

		// Create selector node
		const selector = this.arena.createNode()
		this.arena.setType(selector, NODE_SELECTOR)
		this.arena.setStartLine(selector, selectorLine)

		// Consume tokens until we hit '{'
		let lastToken = startToken
		while (!this.isEOF() && this.peekType() !== TOKEN_LEFT_BRACE) {
			lastToken = this.currentToken!
			this.nextToken()
		}

		// Set selector offsets
		this.arena.setStartOffset(selector, selectorStart)
		this.arena.setLength(selector, lastToken.end - selectorStart)

		return selector
	}

	// Parse a declaration: property: value;
	private parseDeclaration(): number | null {
		// Skip comments
		if (this.peekType() === TOKEN_COMMENT) {
			// TODO: Create comment nodes
			this.nextToken()
			return null
		}

		// Expect identifier (property name)
		if (this.peekType() !== TOKEN_IDENT) {
			return null
		}

		const startToken = this.currentToken
		if (!startToken) return null

		const propStart = startToken.start
		const propEnd = startToken.end
		const declLine = startToken.line

		this.nextToken() // consume property name

		// Expect ':'
		if (this.peekType() !== TOKEN_COLON) {
			return null
		}
		this.nextToken() // consume ':'

		// Create declaration node
		const declaration = this.arena.createNode()
		this.arena.setType(declaration, NODE_DECLARATION)
		this.arena.setStartLine(declaration, declLine)
		this.arena.setStartOffset(declaration, propStart)

		// Store property name position
		this.arena.setContentStart(declaration, propStart)
		this.arena.setContentLength(declaration, propEnd - propStart)

		// Parse value (everything until ';' or '}')
		let hasImportant = false
		let lastToken = this.currentToken

		while (!this.isEOF() && this.peekType() !== TOKEN_SEMICOLON && this.peekType() !== TOKEN_RIGHT_BRACE) {
			// Check for ! followed by any identifier (e.g., !important, !ie, etc.)
			if (this.peekType() === TOKEN_DELIM && this.currentToken && this.source[this.currentToken.start] === '!') {
				// Check if next token is an identifier
				const nextToken = this.lexer.nextToken()
				if (nextToken && nextToken.type === TOKEN_IDENT) {
					hasImportant = true
					lastToken = nextToken
					this.currentToken = nextToken
					break
				}
			}

			lastToken = this.currentToken!
			this.nextToken()
		}

		// Set !important flag if found
		if (hasImportant) {
			this.arena.setFlag(declaration, FLAG_IMPORTANT)
		}

		// Consume ';' if present
		if (this.peekType() === TOKEN_SEMICOLON) {
			lastToken = this.currentToken!
			this.nextToken()
		}

		// Set declaration length
		if (lastToken) {
			this.arena.setLength(declaration, lastToken.end - propStart)
		}

		return declaration
	}

	// Parse an at-rule: @media, @import, @font-face, etc.
	private parseAtRule(): number | null {
		const startToken = this.currentToken
		if (!startToken || startToken.type !== TOKEN_AT_KEYWORD) {
			return null
		}

		const atRuleStart = startToken.start
		const atRuleLine = startToken.line

		// Extract at-rule name (skip the '@')
		const atRuleName = this.source.substring(startToken.start + 1, startToken.end)
		const nameStart = startToken.start + 1
		const nameLength = atRuleName.length

		this.nextToken() // consume @keyword

		// Create at-rule node
		const atRule = this.arena.createNode()
		this.arena.setType(atRule, NODE_AT_RULE)
		this.arena.setStartLine(atRule, atRuleLine)
		this.arena.setStartOffset(atRule, atRuleStart)

		// Store at-rule name in contentStart/contentLength
		this.arena.setContentStart(atRule, nameStart)
		this.arena.setContentLength(atRule, nameLength)

		// Parse prelude (everything before '{' or ';')
		// For now, just consume tokens
		while (!this.isEOF() && this.peekType() !== TOKEN_LEFT_BRACE && this.peekType() !== TOKEN_SEMICOLON) {
			this.nextToken()
		}

		let lastToken = this.currentToken

		// Check if this at-rule has a block or is a statement
		if (this.peekType() === TOKEN_LEFT_BRACE) {
			this.nextToken() // consume '{'

			// Determine what to parse inside the block based on the at-rule name
			const hasDeclarations = this.atRuleHasDeclarations(atRuleName)

			if (hasDeclarations) {
				// Parse declarations (like @font-face, @page)
				while (!this.isEOF() && this.peekType() !== TOKEN_RIGHT_BRACE) {
					const declaration = this.parseDeclaration()
					if (declaration !== null) {
						this.arena.appendChild(atRule, declaration)
					} else {
						this.nextToken()
					}
				}
			} else {
				// Parse nested rules (like @media, @supports, @layer)
				while (!this.isEOF() && this.peekType() !== TOKEN_RIGHT_BRACE) {
					const rule = this.parseRule()
					if (rule !== null) {
						this.arena.appendChild(atRule, rule)
					} else {
						this.nextToken()
					}
				}
			}

			// Consume '}'
			if (this.peekType() === TOKEN_RIGHT_BRACE) {
				lastToken = this.currentToken!
				this.nextToken()
			}
		} else if (this.peekType() === TOKEN_SEMICOLON) {
			// Statement at-rule (like @import, @namespace)
			lastToken = this.currentToken!
			this.nextToken() // consume ';'
		}

		// Set at-rule length
		if (lastToken) {
			this.arena.setLength(atRule, lastToken.end - atRuleStart)
		}

		return atRule
	}

	// Determine if an at-rule contains declarations or nested rules
	private atRuleHasDeclarations(name: string): boolean {
		// At-rules with declarations in their blocks
		const declarationAtRules = ['font-face', 'font-feature-values', 'page', 'property', 'counter-style']

		return declarationAtRules.includes(name)
	}
}
