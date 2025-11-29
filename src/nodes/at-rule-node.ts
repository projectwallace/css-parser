// AtRuleNode - CSS at-rule (@media, @import, @keyframes, etc.)
import { CSSNode as CSSNodeBase } from '../css-node-base'
import { CSSNode } from '../css-node'
import { FLAG_HAS_BLOCK, NODE_BLOCK } from '../arena'
import type { AnyNode } from '../types'

// Forward declarations for child types
export type PreludeNode = AnyNode
export type BlockNode = AnyNode

export class AtRuleNode extends CSSNodeBase {
	// Get prelude nodes (children before the block, if any)
	get prelude_nodes(): PreludeNode[] {
		const nodes: PreludeNode[] = []
		let child = this.first_child
		while (child) {
			// Stop when we hit the block
			if (child.type === 7 /* NODE_BLOCK */) {
				break
			}
			nodes.push(child as PreludeNode)
			child = child.next_sibling
		}
		return nodes
	}

	// Override children with typed return
	override get children(): (PreludeNode | BlockNode)[] {
		return super.children as (PreludeNode | BlockNode)[]
	}

	// Get the at-rule name (e.g., "media", "import", "keyframes")
	get name(): string {
		let start = this.arena.get_content_start(this.index)
		let length = this.arena.get_content_length(this.index)
		if (length === 0) return ''
		return this.source.substring(start, start + length)
	}

	// Get the prelude text (for at-rules: "(min-width: 768px)" in "@media (min-width: 768px)")
	// This is an alias for `value` to make at-rule usage more semantic
	get prelude(): string | null {
		let start = this.arena.get_value_start(this.index)
		let length = this.arena.get_value_length(this.index)
		if (length === 0) return null
		return this.source.substring(start, start + length)
	}

	// Get the value text (raw value area, same as prelude for at-rules)
	get value(): string | null {
		return this.prelude
	}

	// Check if this at-rule has a prelude
	get hasPrelude(): boolean {
		return this.arena.get_value_length(this.index) > 0
	}

	// Snake_case alias for hasPrelude (overrides base class)
	override get has_prelude(): boolean {
		return this.hasPrelude
	}

	// Check if this rule has a block { }
	get hasBlock(): boolean {
		return this.arena.has_flag(this.index, FLAG_HAS_BLOCK)
	}

	// Snake_case alias for hasBlock (overrides base class)
	override get has_block(): boolean {
		return this.hasBlock
	}

	// Get the block node (for at-rules with blocks)
	get block(): BlockNode | null {
		// For AtRule: block is last child (after prelude nodes)
		let child = this.first_child
		while (child) {
			if (child.type === NODE_BLOCK && !child.next_sibling) {
				return child as BlockNode
			}
			child = child.next_sibling
		}
		return null
	}

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}
