import { Lexer } from './lexer'
import type { Token } from './token-types'
import { TOKEN_EOF } from './token-types'

/**
 * Tokenize CSS source code
 * @param source - The CSS source code to tokenize
 * @param skip_comments - Whether to skip comment tokens (default: true)
 * @yields CSS tokens
 */
export function* tokenize(source: string, skip_comments = true): Generator<Token, void, undefined> {
	const lexer = new Lexer(source, skip_comments)

	while (true) {
		const token = lexer.next_token()
		if (!token || token.type === TOKEN_EOF) {
			break
		}
		yield token
	}
}
