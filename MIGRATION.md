# Migration Guide: `children` opt-in with `WithChildren`

## Summary

`children`, `has_children`, `child_count`, and `[Symbol.iterator]` have been
moved off `CssNodeCommon` and are now only available on the specific node types
that actually contain child nodes. All other node types no longer have these
properties.

---

## Breaking changes

### 1. `CssNodeCommon` no longer has `children`, `has_children`, `child_count`, or `[Symbol.iterator]`

These properties now only exist on types that extend the new `WithChildren`
interface.

**Node types that have `WithChildren`:**

| Type | Example CSS |
|------|-------------|
| `StyleSheet` | the root node |
| `SelectorList` | `div, p` |
| `Selector` | `div.foo > p` |
| `Block` | `{ color: red; }` |
| `Value` | `red`, `1px 2px` |
| `Function` | `rgb(0, 0, 0)` |
| `Parenthesis` | `(100% - 50px)` inside calc |
| `PseudoClassSelector` | `:is(a, b)`, `:hover` |
| `PseudoElementSelector` | `::slotted()`, `::part()` |
| `AtrulePrelude` | the structured prelude of at-rules |
| `MediaQuery` | `screen and (min-width: 768px)` |
| `MediaFeature` | `(min-width: 768px)` |
| `ContainerQuery` | `sidebar (min-width: 400px)` |
| `FeatureRange` | `(400px <= width)` |

**Node types that do NOT have `WithChildren`** (use specific typed properties
instead):

| Type | How to access content |
|------|-----------------------|
| `Rule` | `.prelude` (SelectorList/Raw), `.block` (Block) |
| `Atrule` | `.prelude` (AtrulePrelude/Raw), `.block` (Block) |
| `Declaration` | `.first_child` (Value/Raw) |
| `Url` | `.value` (string) |
| `Raw` | `.text` (string) |

### 2. `Atrule.has_children` is removed

Use the typed properties instead:

```ts
// Before
expect(atrule.has_children).toBe(true)

// After — pick the right check for your use case:
expect(atrule.has_prelude).toBe(true)   // has a prelude node
expect(atrule.has_block).toBe(true)     // has a block node
expect(atrule.has_prelude || atrule.has_block).toBe(true) // has either
```

### 3. `[...node]` spread/iteration is removed from non-`WithChildren` types

```ts
// Before — worked on any node
const children = [...someNode]

// After — cast to the appropriate WithChildren type first
const children = [...(someNode as AtrulePrelude)]
// or access via a typed property:
const prelude = (atrule.prelude as AtrulePrelude)
const children = [...prelude]
```

---

## Migration patterns

### Accessing `.children` on `first_child` results

`CssNodeCommon.first_child` returns `CssNodeCommon | null`, which never has
`.children`. Cast to the specific type you expect:

```ts
// Before
const valueNode = decl.first_child!
const items = valueNode.children

// After
import type { Value } from './node-types'
const valueNode = decl.first_child! as Value
const items = valueNode.children
```

### Accessing the prelude's children

`Atrule.prelude` has type `AtrulePrelude | Raw | null`. `Raw` has no children,
so cast to `AtrulePrelude` when you know the prelude was parsed:

```ts
// Before
const queries = atrule.prelude?.children

// After
import type { AtrulePrelude } from './node-types'
const queries = (atrule.prelude as AtrulePrelude | null)?.children
```

### `has_children` on non-`WithChildren` types

For types that are not containers (Declaration, Raw, Url, etc.), replace
`has_children` with a `first_child` check:

```ts
// Before
expect(declaration.has_children).toBe(true)

// After
expect(declaration.first_child).not.toBeNull()
```

For `Url` specifically, the URL value is always stored as a string in `.value`,
not as child nodes. `has_children` was always `false`:

```ts
// Before
expect(urlNode.has_children).toBe(false)

// After
expect(urlNode.first_child).toBeNull()
```

### Rule children

`Rule` does not have `children`. Use its typed properties:

```ts
// Before
const [selectorList, block] = rule.children

// After
import type { Rule } from './node-types'
const rule = someNode as Rule
const selectorList = rule.prelude // SelectorList | Raw | null
const block        = rule.block   // Block | null
```

### Checking whether a rule/atrule has content

```ts
// Before — generic
expect(rule.has_children).toBe(true)

// After — use first_child for Rule (which has a SelectorList as first child)
expect(rule.first_child).not.toBeNull()

// After — use typed properties for Atrule
expect(atrule.has_prelude || atrule.has_block).toBe(true)
```

### Accessing nested `.children` chains

When drilling into children via `.children[N].children`, the intermediate
`AnyCss` result needs a cast:

```ts
// Before
const paren = funcNode.children[0].children[0]

// After
import type { Parenthesis } from './node-types'
const paren = (funcNode.children[0] as Parenthesis).children[0]
```

---

## TypeScript import changes

Add new types to your imports as needed:

```ts
import type {
  WithChildren,     // the interface itself, if you need it
  Value,
  Block,
  Selector,
  SelectorList,
  AtrulePrelude,
  MediaQuery,
  MediaFeature,
  ContainerQuery,
  FeatureRange,
  Function,
  Parenthesis,
  PseudoClassSelector,
  PseudoElementSelector,
} from '@projectwallace/css-parser'
```

---

## Instructions for automated migration (Claude)

When migrating a codebase, search for the following patterns and apply the
corresponding fixes. Run `npx tsc --noEmit` after each file to confirm you've
addressed all errors before moving on.

### Step 1 — Fix `Atrule.has_children`

Search: `\.has_children`  
Find all uses on variables typed as `Atrule`. Replace with one of:

- `has_prelude` — when checking the prelude exists
- `has_block` — when checking the block exists
- `has_prelude || has_block` — when checking either exists

### Step 2 — Fix `(Raw | AtrulePrelude).children`

Search: `\.prelude\??\.children`  
Replace with: `(.prelude as AtrulePrelude | null)?.children`

Also handle the intermediate-variable pattern:

```ts
// Before
const prelude = atrule.prelude
prelude?.children

// After
const prelude = atrule.prelude as AtrulePrelude | null | undefined
prelude?.children
```

### Step 3 — Fix `CssNodeCommon.children` from `.first_child!`

Search for any `.first_child!.children` or `.first_child?.children` access.
Determine what node type `first_child` returns from context and add a cast:

- If inside a `Rule` or `Atrule` and the node is a selector → cast to `SelectorList`
- If `first_child` of a `SelectorList` → cast to `Selector`
- If `first_child` of a `Declaration` → cast to `Value`
- If `first_child` of an `AtrulePrelude` → cast to `MediaQuery` (for `@media`)

### Step 4 — Fix `AnyCss.children` (secondary errors)

After fixing Step 3, secondary errors may appear on `.children[N].children`.
The element at index N is `AnyCss`. Cast it to the expected concrete type:

```ts
// pattern: value.children[0].children
// fix:     (value.children[0] as Function).children
```

### Step 5 — Fix `Rule.children` destructuring

Search: `rule\.children` or `\[_selector.*block\] = \w+\.children`

Replace destructuring with direct property access:

```ts
// Before
const [_selector, block] = rule.children

// After
const block = (rule as Rule).block!
```

For `rule.children.length` checks, replace with:

```ts
// Before
expect(rule.children.length).toBe(2)

// After — check that both structural parts exist
expect((rule as Rule).block).not.toBeNull()
```

### Step 6 — Fix `CssNodeCommon.has_children` for non-container types

For `Declaration`, `Raw`, `Url`, and other types not in `WithChildren`:

```ts
// Before
node.has_children === true
// After
node.first_child !== null

// Before
node.has_children === false
// After
node.first_child === null
```

### Step 7 — Verify `WithChildren` import for new types

If your code calls `.children`, `.has_children`, `.child_count`, or `[Symbol.iterator]` on any of the newly added `WithChildren` types (`Parenthesis`, `ContainerQuery`, `MediaFeature`, `FeatureRange`, `PseudoElementSelector`), ensure these types are imported from the package.
