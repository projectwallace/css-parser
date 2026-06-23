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
import { parse, NODE_STYLE_RULE, NODE_DECLARATION } from '@projectwallace/css-parser'

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
	if (rule.type === NODE_STYLE_RULE) {
		const selector = rule.first_child
		console.log(`Selector: ${selector.text}`)

		// Iterate over declarations
		for (const node of rule) {
			if (node.type === NODE_DECLARATION) {
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

### Bundle sizes

All sizes are minified and bundled with dependencies. Import only what you need — bundlers will tree-shake the rest.

| Import                                            | Description                  | Minified | Gzip    |
| ------------------------------------------------- | ---------------------------- | -------- | ------- |
| `@projectwallace/css-parser`                      | Full parser (all subparsers) | 68.9 kB  | 15.5 kB |
| `@projectwallace/css-parser/parse`                | CSS stylesheet parser        | 62.2 kB  | 13.3 kB |
| `@projectwallace/css-parser/parse-atrule-prelude` | At-rule prelude parser       | 35.4 kB  | 8.4 kB  |
| `@projectwallace/css-parser/parse-selector`       | Selector parser              | 37.7 kB  | 8.9 kB  |
| `@projectwallace/css-parser/parse-anplusb`        | An+B syntax parser           | 26.1 kB  | 6.6 kB  |
| `@projectwallace/css-parser/parse-declaration`    | Declaration parser           | 28.3 kB  | 7.3 kB  |
| `@projectwallace/css-parser/parse-value`          | Value parser                 | 25.2 kB  | 6.6 kB  |
| `@projectwallace/css-parser/parse-dimension`      | Dimension parser             | 0.4 kB   | 0.3 kB  |
| `@projectwallace/css-parser/tokenizer`            | Tokenizer                    | 9.8 kB   | 2.4 kB  |

## Documentation

See [API.md](./API.md) for complete documentation of all parser functions and nodes.

## Non-goals

- **No syntax validation** — CSS structure is your responsibility; the parser accepts anything valid or not
- **No preprocessor syntax** — Sass, Less, and Stylus are out of scope; this parser targets plain CSS only
- **Tree operations** - Manipulating the AST is not within scope of this library

## License

MIT
