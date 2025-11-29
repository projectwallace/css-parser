# Migration Plan: Type-Specific Node Classes

**Branch**: `tree-structure`
**Status**: In Progress
**Progress**: 18/25 batches completed

---

## Quick Reference

**Current Batch**: Batch 19 - Implement Container/Supports Prelude Nodes
**Next Steps**: See [Batch 19](#batch-19-implement-containersupports-prelude-nodes) below

---

## Progress Tracker

### Phase 1: Foundation
- [x] **Batch 1**: Create Base CSSNode Abstract Class (15 min) ✅
- [x] **Batch 2**: Add Node Type Union and Helpers (15 min) ✅
- [x] **Batch 3**: Update Current CSSNode to Use Factory Pattern (10 min) ✅

### Phase 2: Core Structure Nodes
- [x] **Batch 4**: Implement StylesheetNode (15 min) ✅
- [x] **Batch 5**: Implement CommentNode (10 min) ✅
- [x] **Batch 6**: Implement BlockNode (15 min) ✅
- [x] **Batch 7**: Implement DeclarationNode (20 min) ✅
- [x] **Batch 8**: Implement AtRuleNode (20 min) ✅
- [x] **Batch 9**: Implement StyleRuleNode (20 min) ✅
- [x] **Batch 10**: Implement SelectorNode (10 min) ✅

### Phase 3: Value Nodes
- [x] **Batch 11**: Implement Simple Value Nodes (15 min) ✅
- [x] **Batch 12**: Implement Complex Value Nodes (20 min) ✅

### Phase 4: Selector Nodes
- [x] **Batch 13**: Implement Simple Selector Nodes (15 min) ✅
- [x] **Batch 14**: Implement Named Selector Nodes (15 min) ✅
- [x] **Batch 15**: Implement Attribute Selector Node (20 min) ✅
- [x] **Batch 16**: Implement Pseudo Selector Nodes (20 min) ✅
- [x] **Batch 17**: Implement Nth Selector Nodes (20 min) ✅

### Phase 5: Prelude Nodes
- [x] **Batch 18**: Implement Media Prelude Nodes (15 min) ✅
- [ ] **Batch 19**: Implement Container/Supports Prelude Nodes (15 min)
- [ ] **Batch 20**: Implement Import Prelude Nodes (15 min)

### Phase 6: Integration & Polish
- [ ] **Batch 21**: Update Main Parse Function Return Type (10 min)
- [ ] **Batch 22**: Add Barrel Exports (10 min)
- [ ] **Batch 23**: Update Package Exports (10 min)
- [ ] **Batch 24**: Update walk() Function Types (15 min)
- [ ] **Batch 25**: Update Documentation and Examples (20 min)

**Total Estimated Time**: 5-6 hours across 10-15 sessions

---

## Phase 1: Foundation

### Batch 1: Create Base CSSNode Abstract Class

**Files**: `src/css-node-base.ts` (new)

**Tasks**:
1. Copy current `CSSNode` class from `src/css-node.ts`
2. Make it abstract
3. Add abstract static method signature:
   ```typescript
   abstract static from(arena: CSSDataArena, source: string, index: number): CSSNode
   ```
4. Keep all existing properties and methods
5. Export from the file

**Commit**: `refactor: extract CSSNode to abstract base class`

**Testing**:
- [ ] File compiles without errors
- [ ] All existing tests still pass

---

### Batch 2: Add Node Type Union and Helpers

**Files**: `src/node-types.ts` (new)

**Tasks**:
1. Create type guards for all node types:
   ```typescript
   export function isDeclaration(node: CSSNode): node is DeclarationNode {
     return node.type === NODE_DECLARATION
   }
   ```
2. Add operator string mapping:
   ```typescript
   export const ATTR_OPERATOR_STRINGS: Record<number, string> = {
     [ATTR_OPERATOR_NONE]: '',
     [ATTR_OPERATOR_EQUAL]: '=',
     [ATTR_OPERATOR_TILDE_EQUAL]: '~=',
     // ... etc
   }
   ```
3. Create placeholder union type (will be filled as classes are added):
   ```typescript
   export type AnyNode = CSSNode // TODO: expand as classes added
   ```

**Commit**: `feat: add node type guards and helpers`

**Testing**:
- [ ] File compiles without errors
- [ ] Type guards work correctly with current CSSNode

---

### Batch 3: Update Current CSSNode to Use Factory Pattern

**Files**: `src/css-node.ts`

**Tasks**:
1. Import base class: `import { CSSNode as CSSNodeBase } from './css-node-base'`
2. Make current `CSSNode` extend `CSSNodeBase`
3. Implement factory method that returns current `CSSNode` (handles all types for now):
   ```typescript
   static from(arena: CSSDataArena, source: string, index: number): CSSNode {
     return new CSSNode(arena, source, index)
   }
   ```
4. Export factory method

**Commit**: `refactor: add factory pattern to CSSNode`

**Testing**:
- [ ] All existing tests pass
- [ ] Factory method returns CSSNode instances

---

## Phase 2: Core Structure Nodes

### Batch 4: Implement StylesheetNode

**Files**: `src/nodes/stylesheet-node.ts` (new)

**Tasks**:
1. Create class extending base `CSSNode`
2. Constructor calls super with arena, source, index
3. Override `children` getter with typed return
4. Update factory in `css-node.ts`:
   ```typescript
   case NODE_STYLESHEET: return new StylesheetNode(arena, source, index)
   ```

**Implementation**:
```typescript
import { CSSNode } from '../css-node-base'
import { NODE_STYLESHEET } from '../arena'
import type { StyleRuleNode } from './style-rule-node'
import type { AtRuleNode } from './at-rule-node'
import type { CommentNode } from './comment-node'

export class StylesheetNode extends CSSNode {
  override get children(): (StyleRuleNode | AtRuleNode | CommentNode)[] {
    return super.children as (StyleRuleNode | AtRuleNode | CommentNode)[]
  }
}
```

**Commit**: `feat: add StylesheetNode class`

**Testing**:
- [ ] Factory returns StylesheetNode for NODE_STYLESHEET
- [ ] All existing tests pass
- [ ] Add test verifying instance type

---

### Batch 5: Implement CommentNode

**Files**: `src/nodes/comment-node.ts` (new)

**Tasks**:
1. Create class extending base `CSSNode`
2. Simplest node - no additional properties
3. Update factory method

**Implementation**:
```typescript
import { CSSNode } from '../css-node-base'

export class CommentNode extends CSSNode {
  // No additional properties needed
}
```

**Commit**: `feat: add CommentNode class`

**Testing**:
- [ ] Factory returns CommentNode for NODE_COMMENT
- [ ] All tests pass

---

### Batch 6: Implement BlockNode

**Files**: `src/nodes/block-node.ts` (new)

**Tasks**:
1. Create class extending base `CSSNode`
2. Keep `is_empty` property from base
3. Override `children` with typed return
4. Update factory method

**Commit**: `feat: add BlockNode class`

**Testing**:
- [ ] Factory returns BlockNode for NODE_BLOCK
- [ ] `is_empty` property works
- [ ] All tests pass

---

### Batch 7: Implement DeclarationNode

**Files**: `src/nodes/declaration-node.ts` (new)

**Tasks**:
1. Create class with properties:
   - `property: string` (alias for name)
   - `value: string | null`
   - `values: ValueNode[]`
   - `value_count: number`
   - `is_important: boolean`
   - `is_vendor_prefixed: boolean`
2. Override `children` to return `ValueNode[]`
3. Update factory method

**Commit**: `feat: add DeclarationNode class`

**Testing**:
- [ ] Factory returns DeclarationNode
- [ ] All properties accessible
- [ ] All tests pass

---

### Batch 8: Implement AtRuleNode

**Files**: `src/nodes/at-rule-node.ts` (new)

**Tasks**:
1. Create class with properties:
   - `name: string`
   - `prelude: string | null`
   - `has_prelude: boolean`
   - `block: BlockNode | null`
   - `has_block: boolean`
   - `is_vendor_prefixed: boolean`
   - `prelude_nodes` getter (returns typed children)
2. Update factory method

**Commit**: `feat: add AtRuleNode class`

**Testing**:
- [ ] Factory returns AtRuleNode
- [ ] All properties work
- [ ] All tests pass

---

### Batch 9: Implement StyleRuleNode

**Files**: `src/nodes/style-rule-node.ts` (new)

**Tasks**:
1. Create class with properties:
   - `selector_list: SelectorListNode`
   - `block: BlockNode | null`
   - `has_block: boolean`
   - `has_declarations: boolean`
2. Update factory method

**Commit**: `feat: add StyleRuleNode class`

**Testing**:
- [ ] Factory returns StyleRuleNode
- [ ] All properties work
- [ ] All tests pass

---

### Batch 10: Implement SelectorNode

**Files**: `src/nodes/selector-node.ts` (new)

**Tasks**:
1. Simple wrapper for individual selectors
2. Override `children` for selector components
3. Update factory method

**Commit**: `feat: add SelectorNode class`

**Testing**:
- [ ] Factory returns SelectorNode
- [ ] All tests pass

---

## Phase 3: Value Nodes

### Batch 11: Implement Simple Value Nodes

**Files**: `src/nodes/value-nodes.ts` (new)

**Tasks**:
1. Create 4 simple node classes:
   - `ValueKeywordNode` - no extra properties
   - `ValueStringNode` - no extra properties
   - `ValueColorNode` - no extra properties
   - `ValueOperatorNode` - no extra properties
2. Update factory method for all 4

**Commit**: `feat: add simple value node classes`

**Testing**:
- [ ] Factory returns correct types
- [ ] All tests pass

---

### Batch 12: Implement Complex Value Nodes

**Files**: `src/nodes/value-nodes.ts` (update)

**Tasks**:
1. Add 3 complex node classes:
   - `ValueNumberNode` - add `value: number`
   - `ValueDimensionNode` - add `value: number`, `unit: string`
   - `ValueFunctionNode` - add `name: string`, override `children`
2. Update factory method for all 3

**Commit**: `feat: add complex value node classes`

**Testing**:
- [ ] Factory returns correct types
- [ ] Properties work correctly
- [ ] All tests pass

---

## Phase 4: Selector Nodes

### Batch 13: Implement Simple Selector Nodes

**Files**: `src/nodes/selector-nodes-simple.ts` (new)

**Tasks**:
1. Create 5 simple selector classes:
   - `SelectorListNode` - override `children`
   - `SelectorTypeNode` - leaf node
   - `SelectorUniversalNode` - leaf node
   - `SelectorNestingNode` - leaf node
   - `SelectorCombinatorNode` - leaf node
2. Update factory method

**Commit**: `feat: add simple selector node classes`

**Testing**:
- [ ] Factory returns correct types
- [ ] All tests pass

---

### Batch 14: Implement Named Selector Nodes

**Files**: `src/nodes/selector-nodes-named.ts` (new)

**Tasks**:
1. Create 3 named selector classes:
   - `SelectorClassNode` - add `name: string`
   - `SelectorIdNode` - add `name: string`
   - `SelectorLangNode` - leaf node
2. Update factory method

**Commit**: `feat: add named selector node classes`

**Testing**:
- [ ] Factory returns correct types
- [ ] `name` properties work
- [ ] All tests pass

---

### Batch 15: Implement Attribute Selector Node

**Files**: `src/nodes/selector-attribute-node.ts` (new)

**Tasks**:
1. Create `SelectorAttributeNode` with:
   - `name: string`
   - `value: string | null`
   - `operator: number`
   - `operator_string: string` (maps operator to string)
2. Update factory method

**Commit**: `feat: add SelectorAttributeNode class`

**Testing**:
- [ ] Factory returns correct type
- [ ] All properties work
- [ ] Operator string mapping correct
- [ ] All tests pass

---

### Batch 16: Implement Pseudo Selector Nodes

**Files**: `src/nodes/selector-pseudo-nodes.ts` (new)

**Tasks**:
1. Create 2 pseudo selector classes:
   - `SelectorPseudoClassNode` - add `name`, `is_vendor_prefixed`, override `children`
   - `SelectorPseudoElementNode` - add `name`, `is_vendor_prefixed`
2. Update factory method

**Commit**: `feat: add pseudo selector node classes`

**Testing**:
- [ ] Factory returns correct types
- [ ] Properties work
- [ ] All tests pass

---

### Batch 17: Implement Nth Selector Nodes

**Files**: `src/nodes/selector-nth-nodes.ts` (new)

**Tasks**:
1. Create 2 nth selector classes:
   - `SelectorNthNode` - add `a: string`, `b: string | null`
   - `SelectorNthOfNode` - add `nth: SelectorNthNode`, `selector_list: SelectorListNode`
2. Update factory method

**Commit**: `feat: add nth selector node classes`

**Testing**:
- [ ] Factory returns correct types
- [ ] Properties work (including `nth_a`, `nth_b`)
- [ ] All tests pass

---

## Phase 5: Prelude Nodes

### Batch 18: Implement Media Prelude Nodes

**Files**: `src/nodes/prelude-media-nodes.ts` (new)

**Tasks**:
1. Create 3 media prelude classes:
   - `PreludeMediaQueryNode` - override `children`
   - `PreludeMediaFeatureNode` - add `value: string | null`
   - `PreludeMediaTypeNode` - leaf node
2. Update factory method

**Commit**: `feat: add media prelude node classes`

**Testing**:
- [ ] Factory returns correct types
- [ ] All tests pass

---

### Batch 19: Implement Container/Supports Prelude Nodes

**Files**: `src/nodes/prelude-query-nodes.ts` (new)

**Tasks**:
1. Create 4 query prelude classes:
   - `PreludeContainerQueryNode` - override `children`
   - `PreludeSupportsQueryNode` - override `children`
   - `PreludeIdentifierNode` - leaf node
   - `PreludeOperatorNode` - leaf node
2. Update factory method

**Commit**: `feat: add query prelude node classes`

**Testing**:
- [ ] Factory returns correct types
- [ ] All tests pass

---

### Batch 20: Implement Import Prelude Nodes

**Files**: `src/nodes/prelude-import-nodes.ts` (new)

**Tasks**:
1. Create 4 import prelude classes:
   - `PreludeImportUrlNode` - leaf node
   - `PreludeImportLayerNode` - add `name: string | null`
   - `PreludeImportSupportsNode` - override `children`
   - `PreludeLayerNameNode` - add `name: string`
2. Update factory method

**Commit**: `feat: add import prelude node classes`

**Testing**:
- [ ] Factory returns correct types
- [ ] All tests pass

---

## Phase 6: Integration & Polish

### Batch 21: Update Main Parse Function Return Type

**Files**: `src/parse.ts`, `src/parser.ts`

**Tasks**:
1. Update `parse()` return type to `StylesheetNode`
2. Update Parser class methods to use factory
3. Ensure all internal uses of factory are correct

**Commit**: `feat: update parse() to return StylesheetNode`

**Testing**:
- [ ] parse() returns StylesheetNode
- [ ] All tests pass
- [ ] TypeScript compilation clean

---

### Batch 22: Add Barrel Exports

**Files**: `src/nodes/index.ts` (new)

**Tasks**:
1. Export all 36 node classes
2. Export type guards from `node-types.ts`
3. Export `AnyNode` union type
4. Export helper constants

**Commit**: `feat: add barrel exports for node classes`

**Testing**:
- [ ] All exports work
- [ ] No circular dependencies

---

### Batch 23: Update Package Exports

**Files**: `package.json`, `vite.config.ts`

**Tasks**:
1. Add package export: `"./nodes": "./dist/nodes/index.js"`
2. Update vite config to build nodes entry point
3. Test that exports work

**Commit**: `feat: export node classes from package`

**Testing**:
- [ ] Build succeeds
- [ ] Exports accessible

---

### Batch 24: Update walk() Function Types

**Files**: `src/walk.ts`

**Tasks**:
1. Update visitor callback types to accept `AnyNode`
2. Optionally add type-specific visitor methods
3. Update documentation

**Commit**: `feat: update walk() to use typed nodes`

**Testing**:
- [ ] walk() works with new types
- [ ] All tests pass

---

### Batch 25: Update Documentation and Examples

**Files**: `README.md`, `CLAUDE.md`

**Tasks**:
1. Add migration guide showing before/after
2. Update examples to use type-specific classes
3. Document instanceof type guards
4. Update API documentation

**Commit**: `docs: update for type-specific node classes`

**Testing**:
- [ ] Documentation accurate
- [ ] Examples work

---

## Complete Node Type Specifications

### Core Structure Nodes (7)

1. **StylesheetNode** (`NODE_STYLESHEET = 1`)
   - Children: `(StyleRuleNode | AtRuleNode | CommentNode)[]`

2. **StyleRuleNode** (`NODE_STYLE_RULE = 2`)
   - `selector_list: SelectorListNode`
   - `block: BlockNode | null`
   - `has_block: boolean`
   - `has_declarations: boolean`

3. **AtRuleNode** (`NODE_AT_RULE = 3`)
   - `name: string`
   - `prelude: string | null`
   - `has_prelude: boolean`
   - `block: BlockNode | null`
   - `has_block: boolean`
   - `is_vendor_prefixed: boolean`

4. **DeclarationNode** (`NODE_DECLARATION = 4`)
   - `property: string`
   - `value: string | null`
   - `values: ValueNode[]`
   - `value_count: number`
   - `is_important: boolean`
   - `is_vendor_prefixed: boolean`

5. **SelectorNode** (`NODE_SELECTOR = 5`)
   - Children: `SelectorComponentNode[]`

6. **CommentNode** (`NODE_COMMENT = 6`)
   - No additional properties

7. **BlockNode** (`NODE_BLOCK = 7`)
   - `is_empty: boolean`
   - Children: `(DeclarationNode | StyleRuleNode | AtRuleNode | CommentNode)[]`

### Value Nodes (7)

8. **ValueKeywordNode** (`NODE_VALUE_KEYWORD = 10`)
9. **ValueNumberNode** (`NODE_VALUE_NUMBER = 11`)
   - `value: number`
10. **ValueDimensionNode** (`NODE_VALUE_DIMENSION = 12`)
    - `value: number`
    - `unit: string`
11. **ValueStringNode** (`NODE_VALUE_STRING = 13`)
12. **ValueColorNode** (`NODE_VALUE_COLOR = 14`)
13. **ValueFunctionNode** (`NODE_VALUE_FUNCTION = 15`)
    - `name: string`
    - Children: `ValueNode[]`
14. **ValueOperatorNode** (`NODE_VALUE_OPERATOR = 16`)

### Selector Nodes (13)

15. **SelectorListNode** (`NODE_SELECTOR_LIST = 20`)
16. **SelectorTypeNode** (`NODE_SELECTOR_TYPE = 21`)
17. **SelectorClassNode** (`NODE_SELECTOR_CLASS = 22`)
    - `name: string`
18. **SelectorIdNode** (`NODE_SELECTOR_ID = 23`)
    - `name: string`
19. **SelectorAttributeNode** (`NODE_SELECTOR_ATTRIBUTE = 24`)
    - `name: string`
    - `value: string | null`
    - `operator: number`
    - `operator_string: string`
20. **SelectorPseudoClassNode** (`NODE_SELECTOR_PSEUDO_CLASS = 25`)
    - `name: string`
    - `is_vendor_prefixed: boolean`
21. **SelectorPseudoElementNode** (`NODE_SELECTOR_PSEUDO_ELEMENT = 26`)
    - `name: string`
    - `is_vendor_prefixed: boolean`
22. **SelectorCombinatorNode** (`NODE_SELECTOR_COMBINATOR = 27`)
23. **SelectorUniversalNode** (`NODE_SELECTOR_UNIVERSAL = 28`)
24. **SelectorNestingNode** (`NODE_SELECTOR_NESTING = 29`)
25. **SelectorNthNode** (`NODE_SELECTOR_NTH = 30`)
    - `a: string`
    - `b: string | null`
26. **SelectorNthOfNode** (`NODE_SELECTOR_NTH_OF = 31`)
    - `nth: SelectorNthNode`
    - `selector_list: SelectorListNode`
27. **SelectorLangNode** (`NODE_SELECTOR_LANG = 56`)

### Prelude Nodes (11)

28. **PreludeMediaQueryNode** (`NODE_PRELUDE_MEDIA_QUERY = 32`)
29. **PreludeMediaFeatureNode** (`NODE_PRELUDE_MEDIA_FEATURE = 33`)
    - `value: string | null`
30. **PreludeMediaTypeNode** (`NODE_PRELUDE_MEDIA_TYPE = 34`)
31. **PreludeContainerQueryNode** (`NODE_PRELUDE_CONTAINER_QUERY = 35`)
32. **PreludeSupportsQueryNode** (`NODE_PRELUDE_SUPPORTS_QUERY = 36`)
33. **PreludeLayerNameNode** (`NODE_PRELUDE_LAYER_NAME = 37`)
    - `name: string`
34. **PreludeIdentifierNode** (`NODE_PRELUDE_IDENTIFIER = 38`)
35. **PreludeOperatorNode** (`NODE_PRELUDE_OPERATOR = 39`)
36. **PreludeImportUrlNode** (`NODE_PRELUDE_IMPORT_URL = 40`)
37. **PreludeImportLayerNode** (`NODE_PRELUDE_IMPORT_LAYER = 41`)
    - `name: string | null`
38. **PreludeImportSupportsNode** (`NODE_PRELUDE_IMPORT_SUPPORTS = 42`)

---

## Performance Analysis

### Expected Impacts

**Parsing Performance** (creating wrappers): **-5% to -10%**
- Factory method switch statement overhead
- 36 different constructors vs 1
- Mitigated by V8 inline optimization

**User Code Performance** (analysis/traversal): **+15% to +25%**
- Eliminated runtime type checks (`if (node.type === NODE_*)`)
- Better property access (no conditional returns)
- Better inlining opportunities
- TypeScript type narrowing

**Net Performance**: **+10% to +15% improvement**
- Most time spent in user code, not creating wrappers
- Parsing is one-time, analysis is repeated

**Memory**: **<5% increase**
- Wrapper instances are ephemeral (not stored)
- Arena unchanged (zero-allocation preserved)

**Bundle Size**: **+10-15KB gzipped**
- 36 class definitions vs 1
- Tree-shaking eliminates unused classes

---

## Testing Strategy

### Per-Batch Testing
1. Run `npm test` after each batch
2. All existing tests must pass
3. Add 1-2 tests for new node class
4. Verify factory returns correct type
5. Verify properties work correctly

### Final Integration Testing
1. Parse 10MB CSS file - measure performance
2. Run benchmark suite - compare to baseline
3. Memory profiling - verify <5% increase
4. Bundle size check - verify increase acceptable

---

## Usage Examples

### Before (Current)
```typescript
import { parse, CSSNode, NODE_DECLARATION } from '@projectwallace/css-parser'

const ast = parse(css)
for (let node of ast.children) {
  if (node.type === NODE_DECLARATION) {
    console.log(node.property) // TypeScript doesn't know this exists
  }
}
```

### After (Type-Specific)
```typescript
import { parse, DeclarationNode } from '@projectwallace/css-parser'

const ast = parse(css)
for (let node of ast.children) {
  if (node instanceof DeclarationNode) {
    console.log(node.property) // TypeScript knows this exists! ✨
  }
}
```

---

## Notes

- All work done on `tree-structure` branch
- Each batch is independently committable
- Existing code continues to work during migration
- Can pause/resume at any batch boundary
- Factory pattern ensures backward compatibility during transition
