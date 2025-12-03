# CSS Parser

> [!WARNING]
> This is a very experimental CSS parser. Expect several bugs and inconveniences!

**High-performance CSS parser optimized for static analysis and formatting**

Built for speed and efficiency, this parser handles large CSS files with minimal memory overhead and blazing-fast parse times. Designed with a data-oriented architecture using a single contiguous memory arena for zero allocations during parsing.

This parser was heavily influenced by [CSSTree](https://github.com/csstree/csstree), one of the most robust CSS parsers available. Some of the parsing mechanics are taken from CSSTree, as well as some of the performance mechanics, but a lot of things are very different which is why this isn't a direct fork.

## Features

- **Modern CSS support** - CSS Nesting, `:is()`, `:where()`, `:has()`, `@layer`, `@container`
- **Error recovery** - Continues parsing on malformed CSS
- **Comment preservation** - Comments stored as first-class AST nodes
- **Location tracking** - Line, column, offset, and length for all nodes
- **Built-in vendor prefix detection** - Automatic detection of `-webkit-`, `-moz-`, etc. for selectors, values, properties and more

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

- **Tiny install size**
- **Zero allocations during parsing** - all memory allocated upfront based on real world heuristics, which also helps prevent garbage collection running often
- **Cache-friendly data layout** - contiguous memory for sequential access powered by concepts or Data Oriented Design
- **First-class comment and location support** - while still being performant because analysis requires constant access to lines and columns
- **No syntax validation** - focusing only on the raw data we can skip expensive syntax files and MDN data syncs

## Documentation

See [API.md](./API.md) for complete documentation of all parser functions and options.

## Non-goals

- **No syntax validation** - this parser does not try to validate your CSS structure. Everything can be anything

## License

MIT
