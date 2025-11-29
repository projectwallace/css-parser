// StyleRuleNode - CSS style rule with selector and declarations
import { CSSNode as CSSNodeBase } from '../css-node-base'
import { CSSNode } from '../css-node'
import { FLAG_HAS_BLOCK, FLAG_HAS_DECLARATIONS, NODE_BLOCK } from '../arena'

// Forward declarations for child types
export type SelectorListNode = CSSNode
export type BlockNode = CSSNode

export class StyleRuleNode extends CSSNodeBase {
	// Get selector list (always first child of style rule)
	get selector_list(): SelectorListNode | null {
		const first = this.first_child
		if (!first) return null
		// First child should be selector list
		if (first.type === 20 /* NODE_SELECTOR_LIST */) {
			return first as SelectorListNode
		}
		return null
	}

	// Override children with typed return
	// StyleRule has [SelectorListNode, BlockNode?]
	override get children(): (SelectorListNode | BlockNode)[] {
		return super.children as (SelectorListNode | BlockNode)[]
	}

	// Check if this rule has a block { }
	get hasBlock(): boolean {
		return this.arena.has_flag(this.index, FLAG_HAS_BLOCK)
	}

	// Snake_case alias for hasBlock (overrides base class)
	override get has_block(): boolean {
		return this.hasBlock
	}

	// Check if this style rule has declarations
	get hasDeclarations(): boolean {
		return this.arena.has_flag(this.index, FLAG_HAS_DECLARATIONS)
	}

	// Snake_case alias for hasDeclarations (overrides base class)
	override get has_declarations(): boolean {
		return this.hasDeclarations
	}

	// Get the block node (sibling after selector list)
	get block(): BlockNode | null {
		let first = this.first_child
		if (!first) return null
		// Block is the sibling after selector list
		let blockNode = first.next_sibling
		if (blockNode && blockNode.type === NODE_BLOCK) {
			return blockNode as BlockNode
		}
		return null
	}

	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}
