# API

- `parse`
- `parse_selector`
- `parse_atrule_prelude`
- `walk`
- `tokenize`

---

## `parse(source, options?)`

Parse CSS source code into an Abstract Syntax Tree (AST).

### Signature

```typescript
function parse(source: string, options?: ParserOptions): CSSNode
```

### Parameters

- **`source`** (`string`) - CSS source code to parse
- **`options`** (`ParserOptions`, optional) - Parser configuration
  - `skip_comments?: boolean` - Skip comment nodes (default: `true`)
  - `parse_values?: boolean` - Parse declaration values into structured nodes (default: `true`)
  - `parse_selectors?: boolean` - Parse selectors into detailed AST (default: `true`)
  - `parse_atrule_preludes?: boolean` - Parse at-rule preludes (default: `true`)

### Returns

`CSSNode` - Root stylesheet node with the following properties:

- `type` - Node type constant (e.g., `NODE_STYLESHEET`, `NODE_STYLE_RULE`)
- `text` - Full text of the node from source
- `name` - Property name, at-rule name, or layer name
- `property` - Alias for `name` (for declarations)
- `value` - Value text (for declarations) or `null`
- `prelude` - At-rule prelude text or `null`
- `line` - Starting line number (1-based)
- `offset` - Starting offset in source
- `length` - Length in source
- `is_important` - Whether declaration has `!important`
- `is_vendor_prefixed` - Whether name has vendor prefix
- `has_error` - Whether node has syntax error
- `has_prelude` - Whether at-rule has a prelude
- `has_block` - Whether rule has a `{ }` block
- `has_children` - Whether node has child nodes
- `block` - Block node containing declarations/nested rules (for style rules and at-rules with blocks)
- `is_empty` - Whether block has no declarations or rules (only comments allowed)
- `first_child` - First child node or `null`
- `next_sibling` - Next sibling node or `null`
- `children` - Array of all child nodes
- `values` - Array of value nodes (for declarations)

### Example 1: Basic Parsing

```typescript
import { parse } from '@projectwallace/css-parser'

const ast = parse('body { color: red; }')

console.log(ast.type) // 1 (NODE_STYLESHEET)
console.log(ast.has_children) // true
console.log(ast.children.length) // 1

const rule = ast.first_child
console.log(rule.type) // 2 (NODE_STYLE_RULE)
console.log(rule.has_block) // true

const selector = rule.first_child
console.log(selector.text) // "body"

// Access block, then declaration inside it
const block = rule.block
console.log(block.type) // 7 (NODE_BLOCK)
console.log(block.is_empty) // false

const declaration = block.first_child
console.log(declaration.property) // "color"
console.log(declaration.value) // "red"
```

**Response structure:**

```
Stylesheet (NODE_STYLESHEET)
  └─ StyleRule (NODE_STYLE_RULE)
       ├─ SelectorList (NODE_SELECTOR_LIST) "body"
       │    └─ Type (NODE_SELECTOR_TYPE) "body"
       └─ Block (NODE_BLOCK)
            └─ Declaration (NODE_DECLARATION) "color: red"
                 └─ Keyword (NODE_VALUE_KEYWORD) "red"
```

### Example 2: Parsing with Options

```typescript
import { parse } from '@projectwallace/css-parser'

// Parse without detailed value parsing (faster)
const ast = parse('div { margin: 10px 20px; }', {
	parse_values: false,
	parse_selectors: false,
})

const rule = ast.first_child
const block = rule.block
const declaration = block.first_child

console.log(declaration.property) // "margin"
console.log(declaration.value) // "10px 20px"
console.log(declaration.has_children) // false (values not parsed)
```

### Example 3: At-Rules

```typescript
import { parse } from '@projectwallace/css-parser'

const ast = parse('@media (min-width: 768px) { body { color: blue; } }')

const mediaRule = ast.first_child
console.log(mediaRule.name) // "media"
console.log(mediaRule.prelude) // "(min-width: 768px)"
console.log(mediaRule.has_prelude) // true
console.log(mediaRule.has_block) // true
console.log(mediaRule.has_children) // true

// Access prelude nodes when parse_atrule_preludes is true
// (Prelude nodes are first children, before the block)
const mediaQuery = mediaRule.first_child
console.log(mediaQuery.type) // NODE_PRELUDE_MEDIA_QUERY
console.log(mediaQuery.text) // "(min-width: 768px)"
console.log(mediaQuery.value) // "min-width: 768px" (without parentheses)

// Access block content (nested rules/declarations)
const block = mediaRule.block
for (const child of block) {
	if (child.type === 2) {
		// NODE_STYLE_RULE
		console.log('Found style rule in media query')
	}
}
```

### Example 4: @import Rules

```typescript
import { parse } from '@projectwallace/css-parser'

const ast = parse('@import url("styles.css") layer(base) supports(display: flex) screen;')

const importRule = ast.first_child
console.log(importRule.name) // "import"
console.log(importRule.prelude) // Full prelude text
console.log(importRule.has_prelude) // true
console.log(importRule.has_block) // false (no { } block)
console.log(importRule.has_children) // true (has prelude nodes)

// Access parsed import components
const [url, layer, supports, media] = importRule.children
console.log(url.type) // NODE_PRELUDE_IMPORT_URL
console.log(url.text) // 'url("styles.css")'

console.log(layer.type) // NODE_PRELUDE_IMPORT_LAYER
console.log(layer.name) // "base"
console.log(layer.text) // "layer(base)"

console.log(supports.type) // NODE_PRELUDE_IMPORT_SUPPORTS
console.log(supports.text) // "supports(display: flex)"
console.log(supports.value) // "display: flex" (without supports() wrapper)

console.log(media.type) // NODE_PRELUDE_MEDIA_TYPE
console.log(media.text) // "screen"
```

### Example 5: Iteration

```typescript
import { parse } from '@projectwallace/css-parser'

const ast = parse(`
  body { color: red; }
  .btn { padding: 1rem; }
  #main { margin: 0; }
`)

// Iterate using for...of
for (const rule of ast) {
	const selector = rule.first_child
	console.log(selector.text)
}
// Output: "body", ".btn", "#main"

// Iterate using children array
const rules = ast.children
console.log(rules.length) // 3

// Iterate using next_sibling
let node = ast.first_child
while (node) {
	console.log(node.type) // 2, 2, 2 (all NODE_STYLE_RULE)
	node = node.next_sibling
}
```

### Example 6: Comments

```typescript
import { parse } from '@projectwallace/css-parser'

// Include comments
const ast = parse('/* header */ body { color: red; }', {
	skip_comments: false,
})

const comment = ast.first_child
console.log(comment.type) // NODE_COMMENT
console.log(comment.text) // "/* header */"

const rule = comment.next_sibling
console.log(rule.type) // NODE_STYLE_RULE

// Skip comments (default)
const ast2 = parse('/* header */ body { color: red; }')
const firstNode = ast2.first_child
console.log(firstNode.type) // NODE_STYLE_RULE (comment skipped)
```

### Example 7: Block Nodes and Empty Rules

```typescript
import { parse } from '@projectwallace/css-parser'

// Empty rule
const ast1 = parse('.empty { }')
const rule1 = ast1.first_child
console.log(rule1.has_block) // true
console.log(rule1.block.is_empty) // true

// Rule with only comments
const ast2 = parse('.comments { /* todo */ }', { skip_comments: false })
const rule2 = ast2.first_child
console.log(rule2.block.is_empty) // true (only comments)

// Rule with declarations
const ast3 = parse('.filled { color: red; }')
const rule3 = ast3.first_child
console.log(rule3.block.is_empty) // false

// Nested rules inside blocks
const ast4 = parse('.parent { .child { color: blue; } }')
const parent = ast4.first_child
const parentBlock = parent.block
const nestedRule = parentBlock.first_child

console.log(nestedRule.type) // NODE_STYLE_RULE
console.log(nestedRule.block.is_empty) // false
```

---

## `parse_selector(source)`

Parse a CSS selector string into a detailed AST.

```typescript
function parse_selector(source: string): CSSNode
```

**Example:**

```typescript
import { parse_selector } from '@projectwallace/css-parser'

const selector = parse_selector('div.class > p#id::before')

console.log(selector.type) // NODE_SELECTOR_LIST
// Iterate over selector components
for (const part of selector.first_child) {
	console.log(part.type, part.text)
}
// NODE_SELECTOR_TYPE "div"
// NODE_SELECTOR_CLASS ".class"
// NODE_SELECTOR_COMBINATOR ">"
// NODE_SELECTOR_TYPE "p"
// NODE_SELECTOR_ID "#id"
// NODE_SELECTOR_PSEUDO_ELEMENT "::before"
```

---

## `parse_atrule_prelude(at_rule_name, prelude)`

Parse an at-rule prelude into structured nodes.

```typescript
function parse_atrule_prelude(at_rule_name: string, prelude: string): CSSNode[]
```

**Example:**

```typescript
import { parse_atrule_prelude } from '@projectwallace/css-parser'

const nodes = parse_atrule_prelude('media', '(min-width: 768px)')

console.log(nodes.length) // 1
console.log(nodes[0].type) // NODE_PRELUDE_MEDIA_QUERY
console.log(nodes[0].text) // "(min-width: 768px)"
```

---

## `walk(ast, callback)`

Walk the AST in depth-first order.

```typescript
function walk(node: CSSNode, callback: (node: CSSNode, depth: number) => void): void
```

**Example:**

```typescript
import { parse, walk } from '@projectwallace/css-parser'

const ast = parse('body { color: red; }')

walk(ast, (node, depth) => {
	console.log('  '.repeat(depth) + node.type)
})
// NODE_STYLESHEET
//   NODE_STYLE_RULE
//     NODE_SELECTOR_LIST
//       NODE_SELECTOR_TYPE
//     NODE_BLOCK
//       NODE_DECLARATION
//         NODE_VALUE_KEYWORD
```

---

## `tokenize(source, skip_comments?)`

Tokenize CSS source code into a stream of tokens.

```typescript
function* tokenize(source: string, skip_comments?: boolean): Generator<Token>
```

**Example:**

```typescript
import { tokenize } from '@projectwallace/css-parser'

for (const token of tokenize('body { color: red; }')) {
	console.log(token.type, token.text)
}
// TOKEN_IDENT "body"
// TOKEN_WHITESPACE " "
// TOKEN_LEFT_BRACE "{"
// TOKEN_WHITESPACE " "
// TOKEN_IDENT "color"
// TOKEN_COLON ":"
// TOKEN_WHITESPACE " "
// TOKEN_IDENT "red"
// TOKEN_SEMICOLON ";"
// TOKEN_WHITESPACE " "
// TOKEN_RIGHT_BRACE "}"
```

---

## Node Type Constants

The parser uses numeric constants for node types. Import them from the parser:

```typescript
import {
	NODE_STYLESHEET,
	NODE_STYLE_RULE,
	NODE_AT_RULE,
	NODE_DECLARATION,
	NODE_SELECTOR,
	NODE_COMMENT,
	NODE_BLOCK,
	// ... and more
} from '@projectwallace/css-parser'
```

### Core Node Types

- `NODE_STYLESHEET` (1) - Root stylesheet node
- `NODE_STYLE_RULE` (2) - Style rule (e.g., `body { }`)
- `NODE_AT_RULE` (3) - At-rule (e.g., `@media`, `@keyframes`)
- `NODE_DECLARATION` (4) - Property declaration (e.g., `color: red`)
- `NODE_SELECTOR` (5) - Selector wrapper (deprecated, use NODE_SELECTOR_LIST)
- `NODE_COMMENT` (6) - CSS comment
- `NODE_BLOCK` (7) - Block container for declarations and nested rules

### Value Node Types (10-16)

- `NODE_VALUE_KEYWORD` (10) - Keyword value (e.g., `red`, `auto`)
- `NODE_VALUE_NUMBER` (11) - Number value (e.g., `42`, `3.14`)
- `NODE_VALUE_DIMENSION` (12) - Dimension value (e.g., `10px`, `2em`, `50%`)
- `NODE_VALUE_STRING` (13) - String value (e.g., `"hello"`)
- `NODE_VALUE_COLOR` (14) - Hex color (e.g., `#fff`, `#ff0000`)
- `NODE_VALUE_FUNCTION` (15) - Function (e.g., `calc()`, `var()`)
- `NODE_VALUE_OPERATOR` (16) - Operator (e.g., `+`, `,`)

### Selector Node Types (20-29)

- `NODE_SELECTOR_LIST` (20) - Selector list container
- `NODE_SELECTOR_TYPE` (21) - Type selector (e.g., `div`, `span`)
- `NODE_SELECTOR_CLASS` (22) - Class selector (e.g., `.classname`)
- `NODE_SELECTOR_ID` (23) - ID selector (e.g., `#identifier`)
- `NODE_SELECTOR_ATTRIBUTE` (24) - Attribute selector (e.g., `[attr=value]`)
- `NODE_SELECTOR_PSEUDO_CLASS` (25) - Pseudo-class (e.g., `:hover`)
- `NODE_SELECTOR_PSEUDO_ELEMENT` (26) - Pseudo-element (e.g., `::before`)
- `NODE_SELECTOR_COMBINATOR` (27) - Combinator (e.g., `>`, `+`, `~`)
- `NODE_SELECTOR_UNIVERSAL` (28) - Universal selector (`*`)
- `NODE_SELECTOR_NESTING` (29) - Nesting selector (`&`)

### At-Rule Prelude Node Types (30-40)

- `NODE_PRELUDE_MEDIA_QUERY` (30) - Media query
- `NODE_PRELUDE_MEDIA_FEATURE` (31) - Media feature
- `NODE_PRELUDE_MEDIA_TYPE` (32) - Media type (e.g., `screen`, `print`)
- `NODE_PRELUDE_CONTAINER_QUERY` (33) - Container query
- `NODE_PRELUDE_SUPPORTS_QUERY` (34) - Supports query
- `NODE_PRELUDE_LAYER_NAME` (35) - Layer name
- `NODE_PRELUDE_IDENTIFIER` (36) - Generic identifier
- `NODE_PRELUDE_OPERATOR` (37) - Logical operator (e.g., `and`, `or`)
- `NODE_PRELUDE_IMPORT_URL` (38) - Import URL
- `NODE_PRELUDE_IMPORT_LAYER` (39) - Import layer
- `NODE_PRELUDE_IMPORT_SUPPORTS` (40) - Import supports condition
