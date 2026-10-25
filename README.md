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
- **Tiny footprint** — tree-shakeable subparsers; as small as 278 bytes gzipped, < 16 kB worst case

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

Everything is exported from the package root. Each part is also available from its own entry point, so you can import only what you need. Node properties and return types ship as TypeScript types.

### Entry points

- `@projectwallace/css-parser` — everything below, except the `Lexer` and `Parser` classes
- `/parse` — `parse`, `Parser`, `ParserOptions`
- `/parse-selector` — `parse_selector`, `parse_selector_list`
- `/parse-atrule-prelude` — `parse_atrule_prelude`
- `/parse-declaration` — `parse_declaration`
- `/parse-value` — `parse_value`
- `/parse-anplusb` — `parse_anplusb`
- `/parse-dimension` — `parse_dimension`
- `/tokenizer` — `tokenize`, `Lexer`
- `/walker` — `walk`, `traverse`, `SKIP`, `BREAK`
- `/nodes` — node type constants (`STYLE_RULE`, `DECLARATION`, …), `NODE_TYPES`
- `/node-types` — type guards (`is_declaration`, `is_rule`, …) and node types (`CSSNode`, `Rule`, …)
- `/string-utils` — `is_custom`, `is_vendor_prefixed`, `strip_vendor_prefix`, `str_equals`, `str_starts_with`, `str_index_of`
- `/token-types` — token type constants (`TOKEN_*`)

### `parse(source, options?)`

Returns the root `StyleSheet` node. Nodes are iterable and expose `first_child`, `next_sibling`, `children`, `text`, `line`, `column`, `start`, `end` and `length`.

```typescript
const ast = parse('body { color: red; }')
const rule = ast.first_child
rule.block.first_child.property // "color"
rule.block.first_child.value.text // "red"
```

Options:

- `parse_values` (default `true`) — parse declaration values into nodes
- `parse_selectors` (default `true`) — parse selectors into nodes
- `parse_atrule_preludes` (default `true`) — parse at-rule preludes into nodes
- `on_comment` — called for every comment (`{ start, end, length, line, column }`); comments are never part of the tree

### Sub-parsers

```typescript
parse_selector('a.b > c').children.map((part) => part.text) // ["a", ".b", ">", "c"]
parse_selector_list('h1, h2').children.map((s) => s.text) // ["h1", "h2"]

const decl = parse_declaration('color: red !important')
decl.property // "color"
decl.is_important // true

for (const node of parse_value('10px 20px')) {
	node.type_name // "Dimension"
}

const [query] = parse_atrule_prelude('media', '(min-width: 768px)') // name without the `@`
query.type_name // "MediaQuery"

parse_dimension('1.5e3s') // { value: 1500, unit: "s" } (no validation; no leading number gives `value: 0`)
```

### `walk(node, callback)` and `traverse(node, { enter, leave })`

Both walk the tree depth-first. Return `SKIP` to skip the children of a node and `BREAK` to stop entirely. `walk` also passes a `depth` that counts rule and at-rule nesting. `traverse` calls `enter` before and `leave` after the children (`leave` still runs after `SKIP`, but not after `BREAK`).

```typescript
walk(ast, (node) => {
	if (node.type === DECLARATION) return BREAK
})

traverse(ast, {
	enter(node) {
		if (node.type === AT_RULE) return SKIP
	},
	leave(node) {},
})
```

### `tokenize(source, on_comment?)`

A generator of tokens; comments are skipped and reported through `on_comment`.

```typescript
for (const token of tokenize('a { color: red }')) {
	console.log(token.type, token.start, token.end)
}
```

### Node types, type guards and `clone()`

Type guards such as `is_declaration()` narrow a node to its specific type. `node.clone({ deep?, locations? })` returns a mutable plain-object copy of a node.

```typescript
const decl = parse('a { color: red }').first_child.block.first_child
is_declaration(decl) // true
decl.type_name // "Declaration"
```

### String helpers

Allocation-free helpers, handy when working with node names. The lowercase argument is always the first one.

```typescript
is_custom('--primary') // true
is_vendor_prefixed('-webkit-transform') // true
strip_vendor_prefix('-webkit-transform') // "transform"
str_equals('media', 'MEDIA') // true
str_starts_with('webkit', 'WEBKIT-transform') // true
str_index_of('color', 'background-COLOR') // 11
```

## Nesting limit

To keep hostile input from overflowing the call stack, parsing throws a `RangeError` (`Maximum CSS nesting depth of 256 exceeded`) when nested rules, at-rules, functions, parentheses, selector arguments or conditions go more than 256 levels deep. Real-world CSS nests a small fraction of that. If you parse untrusted CSS, wrap the call in `try/catch`.

## Non-goals

- **No syntax validation** — CSS structure is your responsibility; the parser accepts anything valid or not
- **No preprocessor syntax** — Sass, Less, and Stylus are out of scope; this parser targets plain CSS only
- **Tree operations** - Manipulating the AST is not within scope of this library

## License

MIT
