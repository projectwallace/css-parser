// CommentNode - CSS comment
import { CSSNode as CSSNodeBase } from '../css-node-base'
import { CSSNode } from '../css-node'
import type { AnyNode } from '../types'

export class CommentNode extends CSSNodeBase {
	// No additional properties needed - comments are leaf nodes
	// All functionality inherited from base CSSNode

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}
