import { type Token, type TokenType } from './token-types';
export declare class Lexer {
    source: string;
    pos: number;
    line: number;
    column: number;
    constructor(source: string);
    nextToken(): Token | null;
    consumeWhitespace(start_line: number, start_column: number): Token;
    consumeComment(start_line: number, start_column: number): Token;
    consumeString(quote: number, start_line: number, start_column: number): Token;
    consumeHexEscape(): void;
    consumeNumber(start_line: number, start_column: number): Token;
    consumeIdentOrFunction(start_line: number, start_column: number): Token;
    consumeAtKeyword(start_line: number, start_column: number): Token;
    consumeHash(start_line: number, start_column: number): Token;
    advance(count?: number): void;
    peek(offset?: number): number;
    makeToken(type: TokenType, start: number, end: number, line?: number, column?: number): Token;
}
