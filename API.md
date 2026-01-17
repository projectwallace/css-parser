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
  - `on_comment?: (info: CommentInfo) => void` - Callback for each comment encountered
  - `parse_values?: boolean` - Parse declaration values into structured nodes (default: `true`)
  - `parse_selectors?: boolean` - Parse selectors into detailed AST (default: `true`)
  - `parse_atrule_preludes?: boolean` - Parse at-rule preludes (default: `true`)

The `CommentInfo` object passed to `on_comment` contains:
  - `start: number` - Starting offset in source (0-based)
  - `end: number` - Ending offset in source (0-based)
  - `length: number` - Length of the comment
  - `line: number` - Starting line number (1-based)
  - `column: number` - Starting column number (1-based)

### Returns

`CSSNode` - Root stylesheet node with the following properties:

**Core Properties:**

- `type` - Node type constant (e.g., `STYLESHEET`, `STYLE_RULE`)
- `type_name` - CSSTree-compatible type name (e.g., `'StyleSheet'`, `'Rule'`)
- `text` - Full text of the node from source

**Content Properties:**

- `name` - Property name for declarations, at-rule name for at-rules, layer name for import layers
- `property` - Alias for `name` (for declarations, more semantic)
- `value` - Value text (for declarations), numeric value (for NUMBER/DIMENSION), string content without quotes (for STRING), URL content (for URL), or `null`
- `value_as_number` - Numeric value for NUMBER and DIMENSION nodes, or `null` for other types
- `unit` - Unit string for DIMENSION nodes (e.g., `"px"`, `"%"`), or `null` for other types
- `prelude` - Prelude node (AT_RULE_PRELUDE for at-rules, SELECTOR_LIST for style rules), or `null`. Use `.prelude.text` to get the text representation.

**Location Properties:**

- `line` - Starting line number (1-based)
- `column` - Starting column number (1-based)
- `start` - Starting offset in source (0-based)
- `length` - Length in source
- `end` - End offset in source (calculated as `start + length`)

**Flags:**

- `is_important` - Whether declaration has `!important` (DECLARATION only)
- `is_browserhack` - Whether declaration property has a browser hack prefix like `*`, `_`, `!`, etc. (DECLARATION only)
- `is_vendor_prefixed` - Whether node has vendor prefix (checks name/text based on type)
- `has_error` - Whether node has syntax error
- `has_prelude` - Whether at-rule has a prelude
- `has_block` - Whether rule has a `{ }` block
- `has_declarations` - Whether style rule has declarations
- `has_children` - Whether node has child nodes (for pseudo-class/pseudo-element, returns `true` even if empty to indicate function syntax)
- `has_next` - Whether node has a next sibling

**Tree Structure:**

- `first_child` - First child node or `null`
- `next_sibling` - Next sibling node or `null`
- `children` - Array of all child nodes
- `block` - Block node containing declarations/nested rules (for style rules and at-rules with blocks)
- `is_empty` - Whether block has no declarations or rules (only comments allowed)

**Value Access (Declarations):**

- `values` - Array of value nodes (for declarations)

**Selector Properties:**

- `selector_list` - Selector list from pseudo-classes like `:is()`, `:not()`, `:has()`, `:where()`, or `:nth-child(of)`
- `nth` - An+B formula node from `:nth-child(of)` wrapper (for NTH_OF_SELECTOR nodes)
- `selector` - Selector list from `:nth-child(of)` wrapper (for NTH_OF_SELECTOR nodes)
- `nth_a` - The 'a' coefficient from An+B expressions like `"2n"` from `:nth-child(2n+1)` (for NTH_SELECTOR)
- `nth_b` - The 'b' coefficient from An+B expressions like `"+1"` from `:nth-child(2n+1)` (for NTH_SELECTOR)

**Attribute Selector Properties:**

- `attr_operator` - Attribute operator constant (for ATTRIBUTE_SELECTOR): `ATTR_OPERATOR_NONE`, `ATTR_OPERATOR_EQUAL`, etc.
- `attr_flags` - Attribute flags constant (for ATTRIBUTE_SELECTOR): `ATTR_FLAG_NONE`, `ATTR_FLAG_CASE_INSENSITIVE`, `ATTR_FLAG_CASE_SENSITIVE`

**Methods:**

- `clone(options?)` - Clone node as a mutable plain object with children as arrays

### Example 1: Basic Parsing

```typescript
import { parse } from '@projectwallace/css-parser'

const ast = parse('body { color: red; }')

console.log(ast.type) // 1 (STYLESHEET)
console.log(ast.has_children) // true
console.log(ast.children.length) // 1

const rule = ast.first_child
console.log(rule.type) // 2 (STYLE_RULE)
console.log(rule.has_block) // true

const selector = rule.first_child
console.log(selector.text) // "body"

// Access block, then declaration inside it
const block = rule.block
console.log(block.type) // 7 (BLOCK)
console.log(block.is_empty) // false

const declaration = block.first_child
console.log(declaration.property) // "color"
console.log(declaration.value) // "red"
```

**Response structure:**

```
Stylesheet (STYLESHEET)
  └─ StyleRule (STYLE_RULE)
       ├─ SelectorList (SELECTOR_LIST) "body"
       │    └─ Type (TYPE_SELECTOR) "body"
       └─ Block (BLOCK)
            └─ Declaration (DECLARATION) "color: red"
                 └─ Keyword (IDENTIFIER) "red"
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
console.log(mediaRule.prelude?.text) // "(min-width: 768px)"
console.log(mediaRule.has_prelude) // true
console.log(mediaRule.has_block) // true
console.log(mediaRule.has_children) // true

// Access prelude node (AT_RULE_PRELUDE wrapper)
const prelude = mediaRule.prelude
console.log(prelude?.text) // "(min-width: 768px)"

// Access prelude children (media query nodes)
const mediaQuery = prelude?.first_child
console.log(mediaQuery?.type) // MEDIA_QUERY
console.log(mediaQuery?.text) // "(min-width: 768px)"
console.log(mediaQuery?.value) // "min-width: 768px" (without parentheses)

// Access block content (nested rules/declarations)
const block = mediaRule.block
for (const child of block) {
	if (child.type === 2) {
		// STYLE_RULE
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
console.log(importRule.prelude?.text) // Full prelude text
console.log(importRule.has_prelude) // true
console.log(importRule.has_block) // false (no { } block)
console.log(importRule.has_children) // true (has prelude node)

// Access parsed import components from prelude
const [url, layer, supports, media] = importRule.prelude?.children || []
console.log(url.type) // URL
console.log(url.text) // 'url("styles.css")'
console.log(url.value) // '"styles.css"'

console.log(layer.type) // LAYER_NAME
console.log(layer.name) // "base"
console.log(layer.text) // "layer(base)"

console.log(supports.type) // SUPPORTS_QUERY
console.log(supports.text) // "supports(display: flex)"
console.log(supports.value) // "display: flex" (without supports() wrapper)

console.log(media.type) // MEDIA_TYPE
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

// Iterate using for...of (recommended)
for (const node of ast) {
	console.log(node.type) // 2, 2, 2 (all STYLE_RULE)
}
```

### Example 6: Processing Comments

```typescript
import { parse, type CommentInfo } from '@projectwallace/css-parser'

const css = '/* header */ body { /* inline */ color: red; }'
const comments: CommentInfo[] = []

const ast = parse(css, {
	on_comment: (info) => {
		// Extract comment text using start and end
		const text = css.substring(info.start, info.end)
		console.log(`Comment at ${info.line}:${info.column}: ${text}`)
		comments.push(info)
	},
})

console.log(`Found ${comments.length} comments`) // 2

// Comments are always skipped from the AST
const firstNode = ast.first_child
console.log(firstNode.type) // STYLE_RULE (comments not in tree)

// Access collected comment info
for (const comment of comments) {
	console.log(`${comment.start}-${comment.end} (${comment.length} chars)`)
}
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
const ast2 = parse('.comments { /* todo */ }')
const rule2 = ast2.first_child
console.log(rule2.block.is_empty) // true (comments are always skipped)

// Rule with declarations
const ast3 = parse('.filled { color: red; }')
const rule3 = ast3.first_child
console.log(rule3.block.is_empty) // false

// Nested rules inside blocks
const ast4 = parse('.parent { .child { color: blue; } }')
const parent = ast4.first_child
const parentBlock = parent.block
const nestedRule = parentBlock.first_child

console.log(nestedRule.type) // STYLE_RULE
console.log(nestedRule.block.is_empty) // false
```

### Example 8: Using type_name for Debugging

The `type_name` property provides human-readable type names for easier debugging:

```typescript
import { parse, TYPE_NAMES } from '@projectwallace/css-parser'

const ast = parse('.foo { color: red; }')

// Using type_name directly on nodes
for (let node of ast) {
	console.log(`${node.type_name}: ${node.text}`)
}
// Output:
// Rule: .foo { color: red; }
// SelectorList: .foo
// ClassSelector: .foo
// Block: color: red
// Declaration: color: red
// Identifier: red

// Useful for logging and error messages
const rule = ast.first_child
console.log(`Processing ${rule.type_name}`) // "Processing Rule"

// TYPE_NAMES export for custom type checking
import { DECLARATION } from '@projectwallace/css-parser'
console.log(TYPE_NAMES[DECLARATION]) // 'Declaration'

// Compare strings instead of numeric constants
if (node.type_name === 'Declaration') {
	console.log(`Property: ${node.property}, Value: ${node.value}`)
}
```

### Example 9: Accessing Nested Selectors in Pseudo-Classes

Convenience properties simplify access to nested selector data:

```typescript
import { parse_selector, SELECTOR_LIST, NTH_SELECTOR } from '@projectwallace/css-parser'

// Simple pseudo-classes with selectors
const isSelector = parse_selector(':is(.foo, #bar)')
const pseudo = isSelector.first_child?.first_child

// Direct access to selector list
console.log(pseudo.selector_list.text) // ".foo, #bar"
console.log(pseudo.selector_list.type === SELECTOR_LIST) // true

// Complex pseudo-classes with An+B notation
const nthSelector = parse_selector(':nth-child(2n+1 of .foo)')
const nthPseudo = nthSelector.first_child?.first_child
const nthOf = nthPseudo.first_child // NTH_OF_SELECTOR

// Direct access to formula
console.log(nthOf.nth.type === NTH_SELECTOR) // true
console.log(nthOf.nth.nth_a) // "2n"
console.log(nthOf.nth.nth_b) // "+1"

// Direct access to selector list from :nth-child(of)
console.log(nthOf.selector.text) // ".foo"

// Or use the unified helper on the pseudo-class
console.log(nthPseudo.selector_list.text) // ".foo"
```

**Before (nested loops required):**

```typescript
// Had to manually traverse to find selector list
let child = pseudo.first_child
while (child) {
	if (child.type === NTH_OF_SELECTOR) {
		let inner = child.first_child
		while (inner) {
			if (inner.type === SELECTOR_LIST) {
				processSelectors(inner)
				break
			}
			inner = inner.next_sibling
		}
		break
	}
	child = child.next_sibling
}
```

**After (direct property access):**

```typescript
// Simple and clear
if (pseudo.selector_list) {
	processSelectors(pseudo.selector_list)
}
```

### Example 10: Node Cloning

Convert arena-backed immutable nodes into mutable plain JavaScript objects for manipulation:

```typescript
import { parse } from '@projectwallace/css-parser'

const ast = parse('div { margin: 10px 20px; padding: 5px; }')
const rule = ast.first_child
const block = rule.block
const marginDecl = block.first_child

// Shallow clone (no children)
const shallow = marginDecl.clone({ deep: false })
console.log(shallow.type) // DECLARATION
console.log(shallow.type_name) // "Declaration"
console.log(shallow.property) // "margin"
console.log(shallow.children) // [] (empty array)

// Deep clone (includes all children)
const deep = marginDecl.clone({ deep: true })
console.log(deep.children.length) // 2 (dimension nodes)
console.log(deep.children[0].value) // 10
console.log(deep.children[0].unit) // "px"
console.log(deep.children[1].value) // 20

// Clone with location information
const withLocation = marginDecl.clone({ locations: true })
console.log(withLocation.line) // 1
console.log(withLocation.column) // 6
console.log(withLocation.start) // 6
console.log(withLocation.end) // 28

// Cloned objects are mutable
const clone = marginDecl.clone()
clone.value = '0'
clone.children.push({ type: 99, text: 'test', children: [] })
// Original node unchanged ✅
```

**Use Cases**:

- Convert nodes to plain objects for modification
- Create synthetic AST nodes for tools
- Extract and manipulate selector parts
- Build custom transformations

**Options**:

- `deep?: boolean` (default: `true`) - Recursively clone children
- `locations?: boolean` (default: `false`) - Include line/column/start/length/end

**Return Type**: Plain object with:

- All node properties extracted (including `type_name`)
- `children` as array (no linked lists)
- Mutable - can be freely modified

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

console.log(selector.type) // SELECTOR_LIST
// Iterate over selector components
for (const part of selector.first_child) {
	console.log(part.type, part.text)
}
// TYPE_SELECTOR "div"
// CLASS_SELECTOR ".class"
// COMBINATOR ">"
// TYPE_SELECTOR "p"
// ID_SELECTOR "#id"
// PSEUDO_ELEMENT_SELECTOR "::before"
```

---

## `parse_declaration(source)`

Parse a CSS declaration string into a detailed AST.

```typescript
function parse_declaration(source: string): CSSNode
```

**Example 1: Basic Declaration:**

```typescript
import { parse_declaration } from '@projectwallace/css-parser'

const decl = parse_declaration('color: red !important')

console.log(decl.type) // DECLARATION
console.log(decl.name) // "color"
console.log(decl.value) // "red"
console.log(decl.is_important) // true

// Iterate over value nodes
for (const valueNode of decl.children) {
	console.log(valueNode.type, valueNode.text)
}
// IDENTIFIER "red"
```

**Example 2: Browser Hacks:**

```typescript
import { parse_declaration } from '@projectwallace/css-parser'

// Browser hack with * prefix (IE 6/7 hack)
const hack = parse_declaration('*width: 100px')
console.log(hack.property) // "*width"
console.log(hack.is_browserhack) // true

// Browser hack with _ prefix (IE 6 hack)
const underscore = parse_declaration('_height: 50px')
console.log(underscore.is_browserhack) // true

// Normal property (not a browser hack)
const normal = parse_declaration('width: 100px')
console.log(normal.is_browserhack) // false

// Vendor prefix (not a browser hack)
const vendor = parse_declaration('-webkit-transform: scale(1)')
console.log(vendor.is_browserhack) // false
console.log(vendor.is_vendor_prefixed) // true
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
console.log(nodes[0].type) // MEDIA_QUERY
console.log(nodes[0].text) // "(min-width: 768px)"
```

---

## `walk(ast, callback, depth?)`

Walk the AST in depth-first order, calling the callback for each node.

```typescript
function walk(node: CSSNode, callback: (node: CSSNode, depth: number) => void | typeof SKIP | typeof BREAK, depth?: number): boolean
```

### Parameters

- **`node`** - The root node to start walking from
- **`callback`** - Function to call for each node visited. Receives the node and its depth (0 for root).
  - Return `SKIP` to skip children of current node
  - Return `BREAK` to stop traversal entirely
  - Return nothing to continue normal traversal
- **`depth`** - Starting depth (default: 0)

### Returns

`boolean` - Returns `false` if traversal was stopped with `BREAK`, otherwise `true`

### Example 1: Basic Walking

```typescript
import { parse, walk } from '@projectwallace/css-parser'

const ast = parse('body { color: red; }')

walk(ast, (node, depth) => {
	console.log('  '.repeat(depth) + node.type)
})
// STYLESHEET
//   STYLE_RULE
//     SELECTOR_LIST
//       TYPE_SELECTOR
//     BLOCK
//       DECLARATION
//         IDENTIFIER
```

### Example 2: Skip Nested Rules

```typescript
import { parse, walk, SKIP, STYLE_RULE } from '@projectwallace/css-parser'

const ast = parse('.a { .b { .c { color: red; } } }')

walk(ast, (node) => {
	if (node.type === STYLE_RULE) {
		console.log(node.text)
		return SKIP // Don't visit nested rules
	}
})
// Output: .a { ... }, but not .b or .c
```

### Example 3: Stop on First Declaration

```typescript
import { parse, walk, BREAK, DECLARATION } from '@projectwallace/css-parser'

const ast = parse('.a { color: red; margin: 10px; }')

walk(ast, (node) => {
	if (node.type === DECLARATION) {
		console.log(node.name)
		return BREAK // Stop traversal
	}
})
// Output: "color" (stops before "margin")
```

---

## `traverse(ast, options?)`

Walk the AST in depth-first order, calling enter before visiting children and leave after.

```typescript
function traverse(
	node: CSSNode,
	options?: {
		enter?: (node: CSSNode) => void | typeof SKIP | typeof BREAK
		leave?: (node: CSSNode) => void | typeof SKIP | typeof BREAK
	},
): boolean
```

### Parameters

- **`node`** - The root node to start walking from
- **`options`** - Object with optional enter and leave callback functions
  - **`enter`** - Called before visiting children
    - Return `SKIP` to skip children (leave still called)
    - Return `BREAK` to stop traversal entirely (leave NOT called)
  - **`leave`** - Called after visiting children
    - Return `BREAK` to stop traversal

### Returns

`boolean` - Returns `false` if traversal was stopped with `BREAK`, otherwise `true`

### Example 1: Track Context with Enter/Leave

```typescript
import { parse, traverse, AT_RULE } from '@projectwallace/css-parser'

const ast = parse('@media screen { .a { color: red; } }')

let depth = 0
traverse(ast, {
	enter(node) {
		depth++
		console.log(`${'  '.repeat(depth)}Entering ${node.type_name}`)
	},
	leave(node) {
		console.log(`${'  '.repeat(depth)}Leaving ${node.type_name}`)
		depth--
	},
})
```

### Example 2: Skip Media Query Contents

```typescript
import { parse, traverse, SKIP, AT_RULE } from '@projectwallace/css-parser'

const ast = parse('@media screen { .a { color: red; } }')

let depth = 0
traverse(ast, {
	enter(node) {
		depth++
		if (node.type === AT_RULE) {
			console.log('Entering media query at depth', depth)
			return SKIP // Skip contents but still call leave
		}
	},
	leave(node) {
		if (node.type === AT_RULE) {
			console.log('Leaving media query at depth', depth)
		}
		depth--
	},
})
// Output:
// Entering media query at depth 2
// Leaving media query at depth 2
```

### Example 3: Context-Aware Processing

```typescript
import { parse, traverse, STYLE_RULE, AT_RULE } from '@projectwallace/css-parser'

const ast = parse(`
	.top { color: red; }
	@media screen {
		.nested { color: blue; }
	}
`)

const context = []

traverse(ast, {
	enter(node) {
		if (node.type === AT_RULE) {
			context.push(`@${node.name}`)
		} else if (node.type === STYLE_RULE) {
			const selector = node.first_child.text
			const ctx = context.length ? ` in ${context.join(' ')}` : ''
			console.log(`Rule: ${selector}${ctx}`)
		}
	},
	leave(node) {
		if (node.type === AT_RULE) {
			context.pop()
		}
	},
})
// Output:
// Rule: .top
// Rule: .nested in @media
```

---

## `tokenize(source, on_comment?)`

Tokenize CSS source code into a stream of tokens.

```typescript
function* tokenize(source: string, on_comment?: (info: CommentInfo) => void): Generator<Token>
```

**Parameters:**
- **`source`** (`string`) - CSS source code to tokenize
- **`on_comment`** (`(info: CommentInfo) => void`, optional) - Callback for each comment encountered

**Example:**

```typescript
import { tokenize, type CommentInfo } from '@projectwallace/css-parser'

const css = '/* comment */ body { color: red; }'
const comments: CommentInfo[] = []

for (const token of tokenize(css, (info) => comments.push(info))) {
	console.log(token.type, token.start, token.end)
}
// Tokens for body { color: red; } (comments skipped)
// TOKEN_IDENT 14 18 (body)
// TOKEN_WHITESPACE 18 19
// TOKEN_LEFT_BRACE 19 20
// ...

console.log(`Found ${comments.length} comment(s)`)
// Found 1 comment(s)
```

---

## Node Type Constants

The parser uses numeric constants for node types. Import them from the parser:

```typescript
import {
	STYLESHEET,
	STYLE_RULE,
	AT_RULE,
	DECLARATION,
	SELECTOR,
	COMMENT,
	BLOCK,
	// ... and more
} from '@projectwallace/css-parser'
```

### Core Node Types

- `STYLESHEET` (1) - Root stylesheet node
- `STYLE_RULE` (2) - Style rule (e.g., `body { }`)
- `AT_RULE` (3) - At-rule (e.g., `@media`, `@keyframes`)
- `DECLARATION` (4) - Property declaration (e.g., `color: red`)
- `SELECTOR` (5) - Selector wrapper (deprecated, use SELECTOR_LIST)
- `COMMENT` (6) - CSS comment
- `BLOCK` (7) - Block container for declarations and nested rules

### Value Node Types (10-18)

- `IDENTIFIER` (10) - Identifier/keyword value (e.g., `red`, `auto`, `inherit`), also used in at-rule preludes (keyframe names, @property names)
- `NUMBER` (11) - Number value (e.g., `42`, `3.14`)
- `DIMENSION` (12) - Dimension value (e.g., `10px`, `2em`, `50%`)
- `STRING` (13) - String value (e.g., `"hello"`)
- `HASH` (14) - Hex color (e.g., `#fff`, `#ff0000`)
- `FUNCTION` (15) - Function (e.g., `calc()`, `var()`)
- `OPERATOR` (16) - Operator (e.g., `+`, `,`)
- `PARENTHESIS` (17) - Parenthesized expression (e.g., `(100% - 50px)`)
- `URL` (18) - URL (e.g., `url("file.css")`, `url(image.png)`), used in values and @import preludes

### Selector Node Types (20-29)

- `SELECTOR_LIST` (20) - Selector list container
- `TYPE_SELECTOR` (21) - Type selector (e.g., `div`, `span`)
- `CLASS_SELECTOR` (22) - Class selector (e.g., `.classname`)
- `ID_SELECTOR` (23) - ID selector (e.g., `#identifier`)
- `ATTRIBUTE_SELECTOR` (24) - Attribute selector (e.g., `[attr=value]`)
- `PSEUDO_CLASS_SELECTOR` (25) - Pseudo-class (e.g., `:hover`)
- `PSEUDO_ELEMENT_SELECTOR` (26) - Pseudo-element (e.g., `::before`)
- `COMBINATOR` (27) - Combinator (e.g., `>`, `+`, `~`, or ` `)
- `UNIVERSAL_SELECTOR` (28) - Universal selector (`*`)
- `NESTING_SELECTOR` (29) - Nesting selector (`&`)

### At-Rule Prelude Node Types (32-38)

- `MEDIA_QUERY` (32) - Media query
- `MEDIA_FEATURE` (33) - Media feature
- `MEDIA_TYPE` (34) - Media type (e.g., `screen`, `print`)
- `CONTAINER_QUERY` (35) - Container query
- `SUPPORTS_QUERY` (36) - Supports query (used in @supports and @import)
- `LAYER_NAME` (37) - Layer name (used in @layer and @import)
- `PRELUDE_OPERATOR` (38) - Logical operator (e.g., `and`, `or`)

## Pseudo-Class Function Syntax Detection

For formatters and tools that need to reconstruct CSS, the parser distinguishes between pseudo-classes that use function syntax (with parentheses) and those that don't:

- `:hover` → `has_children = false` (no function syntax)
- `:lang()` → `has_children = true` (function syntax, even though empty)
- `:lang(en)` → `has_children = true` (function syntax with content)

The `has_children` property on pseudo-class and pseudo-element nodes returns `true` if:

1. The node has actual child nodes (parsed content), OR
2. The node uses function syntax (has parentheses), indicated by the `FLAG_HAS_PARENS` flag

This allows formatters to correctly reconstruct selectors:

- `:hover` → no parentheses needed
- `:lang()` → parentheses needed (even though empty)

### Example

```javascript
import { parse_selector } from '@projectwallace/css-parser'

// Function syntax (with parentheses) - even if empty
const ast1 = parse_selector(':lang()')
const pseudoClass1 = ast1.first_child.first_child
console.log(pseudoClass1.has_children) // true - indicates function syntax

// Regular pseudo-class (no parentheses)
const ast2 = parse_selector(':hover')
const pseudoClass2 = ast2.first_child.first_child
console.log(pseudoClass2.has_children) // false - no function syntax
```

## Attribute Selector Constants

### Attribute Selector Operators

Use these constants with the `node.attr_operator` property to identify the operator in attribute selectors:

- `ATTR_OPERATOR_NONE` (0) - No operator (e.g., `[disabled]`)
- `ATTR_OPERATOR_EQUAL` (1) - Exact match (e.g., `[type="text"]`)
- `ATTR_OPERATOR_TILDE_EQUAL` (2) - Whitespace-separated list contains (e.g., `[class~="active"]`)
- `ATTR_OPERATOR_PIPE_EQUAL` (3) - Starts with or is followed by hyphen (e.g., `[lang|="en"]`)
- `ATTR_OPERATOR_CARET_EQUAL` (4) - Starts with (e.g., `[href^="https"]`)
- `ATTR_OPERATOR_DOLLAR_EQUAL` (5) - Ends with (e.g., `[href$=".pdf"]`)
- `ATTR_OPERATOR_STAR_EQUAL` (6) - Contains substring (e.g., `[href*="example"]`)

### Attribute Selector Flags

Use these constants with the `node.attr_flags` property to identify case sensitivity flags in attribute selectors:

- `ATTR_FLAG_NONE` (0) - No flag specified (default case sensitivity)
- `ATTR_FLAG_CASE_INSENSITIVE` (1) - Case-insensitive matching (e.g., `[type="text" i]`)
- `ATTR_FLAG_CASE_SENSITIVE` (2) - Case-sensitive matching (e.g., `[type="text" s]`)

#### Example

```javascript
import { parse_selector, ATTRIBUTE_SELECTOR, ATTR_OPERATOR_EQUAL, ATTR_FLAG_CASE_INSENSITIVE } from '@projectwallace/css-parser'

const ast = parse_selector('[type="text" i]')

for (let node of ast) {
	if (node.type === ATTRIBUTE_SELECTOR) {
		console.log(node.attr_operator === ATTR_OPERATOR_EQUAL) // true
		console.log(node.attr_flags === ATTR_FLAG_CASE_INSENSITIVE) // true
	}
}
```

---

## `@projectwallace/css-parser/string-utils`

### `is_custom(str)`

Check if a string is a CSS custom property (starts with `--`).

```typescript
import { parse } from '@projectwallace/css-parser'
import { is_custom } from '@projectwallace/css-parser/string-utils'

const ast = parse(':root { --primary: blue; color: red; }')
const block = ast.first_child.block

for (const decl of block.children) {
	if (is_custom(decl.name)) {
		console.log('Custom property:', decl.name) // Logs: "--primary"
	}
}

// Direct usage
is_custom('--primary-color') // true
is_custom('--my-var') // true
is_custom('color') // false
is_custom('-webkit-transform') // false (vendor prefix, not custom)
```

### `is_vendor_prefixed(str)`

Check if a string has a vendor prefix (`-webkit-`, `-moz-`, `-ms-`, `-o-`).

```typescript
import { is_vendor_prefixed } from '@projectwallace/css-parser/string-utils'

// Detect vendor prefixes
is_vendor_prefixed('-webkit-transform') // true
is_vendor_prefixed('-moz-appearance') // true
is_vendor_prefixed('-ms-filter') // true
is_vendor_prefixed('-o-border-image') // true

// Not vendor prefixes
is_vendor_prefixed('--custom-property') // false (custom property)
is_vendor_prefixed('border-radius') // false (standard property)
is_vendor_prefixed('transform') // false (no prefix)
```

### `str_equals(a, b)`

Case-insensitive string equality check without allocations. The first parameter must be lowercase.

```typescript
import { str_equals } from '@projectwallace/css-parser/string-utils'

// First parameter MUST be lowercase
str_equals('media', 'MEDIA') // true
str_equals('media', 'Media') // true
str_equals('media', 'media') // true
str_equals('media', 'print') // false
```

### `str_starts_with(str, prefix)`

Case-insensitive prefix check without allocations. The prefix parameter must be lowercase.

```typescript
import { str_starts_with } from '@projectwallace/css-parser/string-utils'

// prefix MUST be lowercase
str_starts_with('WEBKIT-transform', 'webkit') // true
str_starts_with('Mozilla', 'moz') // true
str_starts_with('transform', 'trans') // true
str_starts_with('color', 'border') // false
```

### `str_index_of(str, search)`

Case-insensitive substring search without allocations. Returns the index of the first occurrence. The search parameter must be lowercase.

```typescript
import { str_index_of } from '@projectwallace/css-parser/string-utils'

// search MUST be lowercase
str_index_of('background-COLOR', 'color') // 11
str_index_of('HELLO', 'e') // 1
str_index_of('transform', 'x') // -1 (not found)
```
