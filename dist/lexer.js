const CHAR_ALPHA = 1 << 0;
const CHAR_DIGIT = 1 << 1;
const CHAR_HEX = 1 << 2;
const CHAR_WHITESPACE = 1 << 3;
const CHAR_NEWLINE = 1 << 4;
const char_types = new Uint8Array(128);
for (let i = 48; i <= 57; i++) {
  char_types[i] = CHAR_DIGIT;
}
for (let i = 48; i <= 57; i++) {
  char_types[i] |= CHAR_HEX;
}
for (let i = 65; i <= 70; i++) {
  char_types[i] = CHAR_HEX;
}
for (let i = 97; i <= 102; i++) {
  char_types[i] = CHAR_HEX;
}
for (let i = 65; i <= 90; i++) {
  char_types[i] |= CHAR_ALPHA;
}
for (let i = 97; i <= 122; i++) {
  char_types[i] |= CHAR_ALPHA;
}
char_types[32] = CHAR_WHITESPACE;
char_types[9] = CHAR_WHITESPACE;
char_types[10] = CHAR_NEWLINE;
char_types[13] = CHAR_NEWLINE;
char_types[12] = CHAR_NEWLINE;
function isDigit(ch) {
  return ch < 128 && (char_types[ch] & CHAR_DIGIT) !== 0;
}
function isHexDigit(ch) {
  return ch < 128 && (char_types[ch] & CHAR_HEX) !== 0;
}
function isAlpha(ch) {
  return ch < 128 && (char_types[ch] & CHAR_ALPHA) !== 0;
}
function isWhitespace(ch) {
  return ch < 128 && (char_types[ch] & CHAR_WHITESPACE) !== 0;
}
function isNewline(ch) {
  return ch < 128 && (char_types[ch] & CHAR_NEWLINE) !== 0;
}
function isIdentStart(ch) {
  if (ch >= 128) return true;
  if (ch === 95) return true;
  return isAlpha(ch);
}
function isIdentChar(ch) {
  if (ch === 45) return true;
  return isIdentStart(ch) || isDigit(ch);
}

const TOKEN_IDENT = 1;
const TOKEN_FUNCTION = 2;
const TOKEN_AT_KEYWORD = 3;
const TOKEN_HASH = 4;
const TOKEN_STRING = 5;
const TOKEN_BAD_STRING = 6;
const TOKEN_URL = 7;
const TOKEN_BAD_URL = 8;
const TOKEN_DELIM = 9;
const TOKEN_NUMBER = 10;
const TOKEN_PERCENTAGE = 11;
const TOKEN_DIMENSION = 12;
const TOKEN_WHITESPACE = 13;
const TOKEN_CDO = 14;
const TOKEN_CDC = 15;
const TOKEN_COLON = 16;
const TOKEN_SEMICOLON = 17;
const TOKEN_COMMA = 18;
const TOKEN_LEFT_BRACKET = 19;
const TOKEN_RIGHT_BRACKET = 20;
const TOKEN_LEFT_PAREN = 21;
const TOKEN_RIGHT_PAREN = 22;
const TOKEN_LEFT_BRACE = 23;
const TOKEN_RIGHT_BRACE = 24;
const TOKEN_COMMENT = 25;
const TOKEN_EOF = 26;

class Lexer {
  source;
  pos;
  line;
  column;
  constructor(source) {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.column = 1;
  }
  nextToken() {
    if (this.pos >= this.source.length) {
      return this.makeToken(TOKEN_EOF, this.pos, this.pos);
    }
    const ch = this.source.charCodeAt(this.pos);
    const start = this.pos;
    const start_line = this.line;
    const start_column = this.column;
    if (ch === 123) {
      this.advance();
      return this.makeToken(TOKEN_LEFT_BRACE, start, this.pos, start_line, start_column);
    }
    if (ch === 125) {
      this.advance();
      return this.makeToken(TOKEN_RIGHT_BRACE, start, this.pos, start_line, start_column);
    }
    if (ch === 58) {
      this.advance();
      return this.makeToken(TOKEN_COLON, start, this.pos, start_line, start_column);
    }
    if (ch === 59) {
      this.advance();
      return this.makeToken(TOKEN_SEMICOLON, start, this.pos, start_line, start_column);
    }
    if (ch === 44) {
      this.advance();
      return this.makeToken(TOKEN_COMMA, start, this.pos, start_line, start_column);
    }
    if (ch === 91) {
      this.advance();
      return this.makeToken(TOKEN_LEFT_BRACKET, start, this.pos, start_line, start_column);
    }
    if (ch === 93) {
      this.advance();
      return this.makeToken(TOKEN_RIGHT_BRACKET, start, this.pos, start_line, start_column);
    }
    if (ch === 40) {
      this.advance();
      return this.makeToken(TOKEN_LEFT_PAREN, start, this.pos, start_line, start_column);
    }
    if (ch === 41) {
      this.advance();
      return this.makeToken(TOKEN_RIGHT_PAREN, start, this.pos, start_line, start_column);
    }
    if (isWhitespace(ch) || isNewline(ch)) {
      return this.consumeWhitespace(start_line, start_column);
    }
    if (ch === 47 && this.peek() === 42) {
      return this.consumeComment(start_line, start_column);
    }
    if (ch === 34 || ch === 39) {
      return this.consumeString(ch, start_line, start_column);
    }
    if (isDigit(ch)) {
      return this.consumeNumber(start_line, start_column);
    }
    if (ch === 46 && isDigit(this.peek())) {
      return this.consumeNumber(start_line, start_column);
    }
    if (ch === 60 && this.peek() === 33 && this.peek(2) === 45 && this.peek(3) === 45) {
      this.advance(4);
      return this.makeToken(TOKEN_CDO, start, this.pos, start_line, start_column);
    }
    if (ch === 45 && this.peek() === 45 && this.peek(2) === 62) {
      this.advance(3);
      return this.makeToken(TOKEN_CDC, start, this.pos, start_line, start_column);
    }
    if (ch === 64) {
      return this.consumeAtKeyword(start_line, start_column);
    }
    if (ch === 35) {
      return this.consumeHash(start_line, start_column);
    }
    if (isIdentStart(ch) || ch === 45 && isIdentStart(this.peek())) {
      return this.consumeIdentOrFunction(start_line, start_column);
    }
    if (ch === 45) {
      const next = this.peek();
      if (isDigit(next) || next === 46 && isDigit(this.peek(2))) {
        return this.consumeNumber(start_line, start_column);
      }
    }
    if (ch === 43) {
      const next = this.peek();
      if (isDigit(next) || next === 46 && isDigit(this.peek(2))) {
        return this.consumeNumber(start_line, start_column);
      }
    }
    this.advance();
    return this.makeToken(TOKEN_DELIM, start, this.pos, start_line, start_column);
  }
  consumeWhitespace(start_line, start_column) {
    const start = this.pos;
    while (this.pos < this.source.length) {
      const ch = this.source.charCodeAt(this.pos);
      if (!isWhitespace(ch) && !isNewline(ch)) break;
      this.advance();
    }
    return this.makeToken(TOKEN_WHITESPACE, start, this.pos, start_line, start_column);
  }
  consumeComment(start_line, start_column) {
    const start = this.pos;
    this.advance(2);
    while (this.pos < this.source.length - 1) {
      if (this.source.charCodeAt(this.pos) === 42 && this.source.charCodeAt(this.pos + 1) === 47) {
        this.advance(2);
        break;
      }
      this.advance();
    }
    return this.makeToken(TOKEN_COMMENT, start, this.pos, start_line, start_column);
  }
  consumeString(quote, start_line, start_column) {
    const start = this.pos;
    this.advance();
    while (this.pos < this.source.length) {
      const ch = this.source.charCodeAt(this.pos);
      if (ch === quote) {
        this.advance();
        return this.makeToken(TOKEN_STRING, start, this.pos, start_line, start_column);
      }
      if (isNewline(ch)) {
        return this.makeToken(TOKEN_BAD_STRING, start, this.pos, start_line, start_column);
      }
      if (ch === 92) {
        this.advance();
        if (this.pos < this.source.length) {
          const next = this.source.charCodeAt(this.pos);
          if (isHexDigit(next)) {
            this.consumeHexEscape();
          } else if (!isNewline(next)) {
            this.advance();
          } else {
            this.advance();
          }
        }
        continue;
      }
      this.advance();
    }
    return this.makeToken(TOKEN_BAD_STRING, start, this.pos, start_line, start_column);
  }
  consumeHexEscape() {
    let count = 0;
    while (count < 6 && this.pos < this.source.length) {
      const ch2 = this.source.charCodeAt(this.pos);
      if (!isHexDigit(ch2)) break;
      this.advance();
      count++;
    }
    const ch = this.source.charCodeAt(this.pos);
    if (isWhitespace(ch) || isNewline(ch)) {
      this.advance();
    }
  }
  consumeNumber(start_line, start_column) {
    const start = this.pos;
    const ch = this.source.charCodeAt(this.pos);
    if (ch === 43 || ch === 45) {
      this.advance();
    }
    while (this.pos < this.source.length && isDigit(this.source.charCodeAt(this.pos))) {
      this.advance();
    }
    if (this.pos < this.source.length && this.source.charCodeAt(this.pos) === 46 && this.pos + 1 < this.source.length && isDigit(this.source.charCodeAt(this.pos + 1))) {
      this.advance();
      while (this.pos < this.source.length && isDigit(this.source.charCodeAt(this.pos))) {
        this.advance();
      }
    }
    if (this.pos < this.source.length && (this.source.charCodeAt(this.pos) === 101 || this.source.charCodeAt(this.pos) === 69)) {
      const next = this.peek();
      if (isDigit(next) || (next === 43 || next === 45) && isDigit(this.peek(2))) {
        this.advance();
        if (this.source.charCodeAt(this.pos) === 43 || this.source.charCodeAt(this.pos) === 45) {
          this.advance();
        }
        while (this.pos < this.source.length && isDigit(this.source.charCodeAt(this.pos))) {
          this.advance();
        }
      }
    }
    if (this.pos < this.source.length) {
      const ch2 = this.source.charCodeAt(this.pos);
      if (ch2 === 37) {
        this.advance();
        return this.makeToken(TOKEN_PERCENTAGE, start, this.pos, start_line, start_column);
      }
      if (isIdentStart(ch2) || ch2 === 45 && isIdentStart(this.peek())) {
        while (this.pos < this.source.length && isIdentChar(this.source.charCodeAt(this.pos))) {
          this.advance();
        }
        return this.makeToken(TOKEN_DIMENSION, start, this.pos, start_line, start_column);
      }
    }
    return this.makeToken(TOKEN_NUMBER, start, this.pos, start_line, start_column);
  }
  consumeIdentOrFunction(start_line, start_column) {
    const start = this.pos;
    while (this.pos < this.source.length && isIdentChar(this.source.charCodeAt(this.pos))) {
      this.advance();
    }
    if (this.pos < this.source.length && this.source.charCodeAt(this.pos) === 40) {
      this.advance();
      return this.makeToken(TOKEN_FUNCTION, start, this.pos, start_line, start_column);
    }
    return this.makeToken(TOKEN_IDENT, start, this.pos, start_line, start_column);
  }
  consumeAtKeyword(start_line, start_column) {
    const start = this.pos;
    this.advance();
    while (this.pos < this.source.length && isIdentChar(this.source.charCodeAt(this.pos))) {
      this.advance();
    }
    return this.makeToken(TOKEN_AT_KEYWORD, start, this.pos, start_line, start_column);
  }
  consumeHash(start_line, start_column) {
    const start = this.pos;
    this.advance();
    while (this.pos < this.source.length && isIdentChar(this.source.charCodeAt(this.pos))) {
      this.advance();
    }
    return this.makeToken(TOKEN_HASH, start, this.pos, start_line, start_column);
  }
  advance(count = 1) {
    for (let i = 0; i < count; i++) {
      if (this.pos >= this.source.length) break;
      const ch = this.source.charCodeAt(this.pos);
      this.pos++;
      if (isNewline(ch)) {
        if (ch === 13 && this.pos < this.source.length && this.source.charCodeAt(this.pos) === 10) {
          this.pos++;
          i++;
        }
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
    }
  }
  peek(offset = 1) {
    const index = this.pos + offset;
    if (index >= this.source.length) return 0;
    return this.source.charCodeAt(index);
  }
  makeToken(type, start, end, line = this.line, column = this.column) {
    return { type, start, end, line, column };
  }
}

export { Lexer, TOKEN_IDENT as T, TOKEN_FUNCTION as a, TOKEN_AT_KEYWORD as b, TOKEN_HASH as c, TOKEN_STRING as d, TOKEN_BAD_STRING as e, TOKEN_URL as f, TOKEN_BAD_URL as g, TOKEN_DELIM as h, TOKEN_NUMBER as i, TOKEN_PERCENTAGE as j, TOKEN_DIMENSION as k, TOKEN_WHITESPACE as l, TOKEN_CDO as m, TOKEN_CDC as n, TOKEN_COLON as o, TOKEN_SEMICOLON as p, TOKEN_COMMA as q, TOKEN_LEFT_BRACKET as r, TOKEN_RIGHT_BRACKET as s, TOKEN_LEFT_PAREN as t, TOKEN_RIGHT_PAREN as u, TOKEN_LEFT_BRACE as v, TOKEN_RIGHT_BRACE as w, TOKEN_COMMENT as x, TOKEN_EOF as y };
