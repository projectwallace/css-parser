# CSS Parser

> [!WARNING]
> This is a very experimental CSS parser. Expect several bugs and inconveniences!

**High-performance CSS parser built for static analysis and tooling**

Parses large CSS files in microseconds with a fixed-size memory arena — no garbage collection pressure, no per-node allocations, no surprises. If you're building a formatter, linter, or analysis tool and need raw speed with precise source locations, this is built for that.

Heavily influenced by [CSSTree](https://github.com/csstree/csstree). Some parsing mechanics are shared, but the memory model, architecture, and API are fundamentally different — not a fork.

## Features

- **Full modern CSS** — CSS Nesting, `:is()`, `:where()`, `:has()`, `@layer`, `@container`
- **Error-tolerant** — keeps parsing through malformed input; one bad rule won't kill the file
- **Precise source locations** — line, column, offset, and length on every node
- **Tiny footprint** — tree-shakeable subparsers; as small as 278 bytes gzipped, < 16 kB kB worst case

## Installation

```bash
npm install @projectwallace/css-parser
```

## Usage

```typescript
import { parse, STYLE_RULE, DECLARATION } from '@projectwallace/css-parser'

const ast = parse(`
  body {
    color: red;
    margin: 0;
  }

  @media (min-width: 768px) {
    .container {
      max-width: 1200px;
    }
  }
`)

// Iterate over top-level rules
for (const rule of ast) {
	if (rule.type === STYLE_RULE) {
		const selector = rule.first_child
		console.log(`Selector: ${selector.text}`)

		// Iterate over declarations
		for (const node of rule) {
			if (node.type === DECLARATION) {
				console.log(`  ${node.property}: ${node.value}`)
			}
		}
	}
}
```

## Performance

- **Zero allocations during parsing** — memory is reserved upfront using real-world heuristics; the GC never runs mid-parse
- **Cache-friendly layout** — all nodes live in a single contiguous arena, making sequential access fast
- **Location tracking with no penalty** — full line, column, and offset data without slowing the parser down
- **No syntax validation** — skipping spec checks and MDN data means nothing gets in the way of speed

## API

Everything is exported from the package root. Each part is also available from its own entry point, so you can import only what you need and skip evaluating the rest of the package. Node properties and return types ship as TypeScript types, so this section sticks to short examples.

### Entry points

| Import                                            | Exports                                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `@projectwallace/css-parser`                      | Everything below, except the `Lexer` and `Parser` classes                                                 |
| `@projectwallace/css-parser/parse`                | `parse`, `Parser`, `ParserOptions`                                                                        |
| `@projectwallace/css-parser/parse-selector`       | `parse_selector`, `parse_selector_list`                                                                   |
| `@projectwallace/css-parser/parse-atrule-prelude` | `parse_atrule_prelude`                                                                                    |
| `@projectwallace/css-parser/parse-declaration`    | `parse_declaration`                                                                                       |
| `@projectwallace/css-parser/parse-value`          | `parse_value`                                                                                             |
| `@projectwallace/css-parser/parse-anplusb`        | `parse_anplusb`                                                                                           |
| `@projectwallace/css-parser/parse-dimension`      | `parse_dimension`                                                                                         |
| `@projectwallace/css-parser/tokenizer`            | `tokenize`, `Lexer`                                                                                       |
| `@projectwallace/css-parser/walker`               | `walk`, `traverse`, `SKIP`, `BREAK`                                                                       |
| `@projectwallace/css-parser/nodes`                | Node type constants (`STYLE_RULE`, `DECLARATION`, …), `NODE_TYPES`, `TYPE_NAMES`                          |
| `@projectwallace/css-parser/node-types`           | Type guards (`is_declaration`, `is_rule`, …) and node types (`CSSNode`, `Rule`, `Declaration`, …)         |
| `@projectwallace/css-parser/string-utils`         | `is_custom`, `is_vendor_prefixed`, `strip_vendor_prefix`, `str_equals`, `str_starts_with`, `str_index_of` |
| `@projectwallace/css-parser/token-types`          | Token type constants (`TOKEN_*`)                                                                          |

### `parse(source, options?)`

Parses a full stylesheet and returns the root `StyleSheet` node. Nodes are iterable and expose `first_child`, `next_sibling`, `children`, `text`, `line`, `column`, `start`, `end` and `length`.

```typescript
import { parse } from '@projectwallace/css-parser'

const ast = parse('body { color: red; }')
const rule = ast.first_child
rule.block.first_child.property // "color"
rule.block.first_child.value.text // "red"
```

Options:

- `parse_values` (default `true`) — parse declaration values into nodes
- `parse_selectors` (default `true`) — parse selectors into nodes
- `parse_atrule_preludes` (default `true`) — parse at-rule preludes into nodes
- `on_comment` — called for every comment; comments are never part of the tree

```typescript
const comments = []
parse('/* hi */ a { color: red }', {
	parse_values: false,
	on_comment: (info) => comments.push(info), // { start, end, length, line, column }
})
```

### `parse_selector(source)` and `parse_selector_list(source)`

`parse_selector` returns the first selector, `parse_selector_list` the whole `SelectorList`.

```typescript
import { parse_selector, parse_selector_list } from '@projectwallace/css-parser'

parse_selector('a.b > c').children.map((part) => part.text) // ["a", ".b", ">", "c"]
parse_selector_list('h1, h2').children.map((s) => s.text) // ["h1", "h2"]
```

### `parse_declaration(source)`

```typescript
import { parse_declaration } from '@projectwallace/css-parser'

const decl = parse_declaration('color: red !important')
decl.property // "color"
decl.is_important // true
decl.value.text // "red"
```

### `parse_value(source)`

Parses a declaration value into a `Value` node with one child per component.

```typescript
import { parse_value } from '@projectwallace/css-parser'

for (const node of parse_value('10px 20px')) {
	console.log(node.type_name, node.value, node.unit) // "Dimension" 10 "px", then "Dimension" 20 "px"
}
```

### `parse_atrule_prelude(name, prelude)`

Returns an array of nodes for the prelude of the at-rule called `name` (without the `@`).

```typescript
import { parse_atrule_prelude } from '@projectwallace/css-parser'

const [query] = parse_atrule_prelude('media', '(min-width: 768px)')
query.type_name // "MediaQuery"
```

### `parse_dimension(text)`

Splits a number from its unit. It works for anything shaped like a number followed by a unit: lengths (`100px`), percentages (`2%`), durations (`200ms`) and so on. It does not validate; text without a leading number gives `value: 0`.

```typescript
import { parse_dimension } from '@projectwallace/css-parser'

parse_dimension('100px') // { value: 100, unit: "px" }
parse_dimension('2%') // { value: 2, unit: "%" }
parse_dimension('1.5e3s') // { value: 1500, unit: "s" }
parse_dimension('5') // { value: 5, unit: "" }
```

### `walk(node, callback)` and `traverse(node, { enter, leave })`

Both walk the tree depth-first. Return `SKIP` to skip the children of a node and `BREAK` to stop entirely. `walk` also passes a `depth` that counts rule and at-rule nesting. `traverse` calls `enter` before and `leave` after the children (`leave` still runs after `SKIP`, but not after `BREAK`).

```typescript
import {
	parse,
	walk,
	traverse,
	SKIP,
	BREAK,
	DECLARATION,
	AT_RULE,
} from '@projectwallace/css-parser'

const ast = parse('@media screen { a { color: red; margin: 0 } }')

walk(ast, (node) => {
	if (node.type === DECLARATION) {
		console.log(node.property) // "color"
		return BREAK
	}
})

traverse(ast, {
	enter(node) {
		if (node.type === AT_RULE) return SKIP // leave() still runs for this node
	},
	leave(node) {},
})
```

### `tokenize(source, on_comment?)`

A generator of tokens; comments are skipped and reported through `on_comment`.

```typescript
import { tokenize } from '@projectwallace/css-parser'

for (const token of tokenize('a { color: red }')) {
	console.log(token.type, token.start, token.end)
}
```

### Node types, type guards and `clone()`

Node type constants (`STYLE_RULE`, `DECLARATION`, `DIMENSION`, …) and `NODE_TYPES` are exported from the root and from `@projectwallace/css-parser/nodes`. Type guards such as `is_declaration()` and `is_dimension()` that narrow a node to its specific type are exported from the root and from `@projectwallace/css-parser/node-types`. `node.clone({ deep?, locations? })` returns a mutable plain-object copy of a node.

```typescript
import { parse, is_declaration } from '@projectwallace/css-parser'

const decl = parse('a { color: red }').first_child.block.first_child
is_declaration(decl) // true
decl.type_name // "Declaration"
decl.clone({ deep: false }).property // "color"
```

### String helpers

Allocation-free helpers, handy when working with node names. Also available from `@projectwallace/css-parser/string-utils`; token type constants (`TOKEN_*`) are available from `@projectwallace/css-parser/token-types`. The lowercase argument is the first one for `str_equals` and the second one for `str_starts_with` and `str_index_of`. This inconsistency will be fixed in a future breaking change.

```typescript
import {
	is_custom,
	is_vendor_prefixed,
	strip_vendor_prefix,
	str_equals,
	str_starts_with,
	str_index_of,
} from '@projectwallace/css-parser'

is_custom('--primary') // true
is_vendor_prefixed('-webkit-transform') // true
strip_vendor_prefix('-webkit-transform') // "transform"
str_equals('media', 'MEDIA') // true
str_starts_with('WEBKIT-transform', 'webkit') // true
str_index_of('background-COLOR', 'color') // 11
```

## Non-goals

- **No syntax validation** — CSS structure is your responsibility; the parser accepts anything valid or not
- **No preprocessor syntax** — Sass, Less, and Stylus are out of scope; this parser targets plain CSS only
- **Tree operations** - Manipulating the AST is not within scope of this library

## License

MIT
