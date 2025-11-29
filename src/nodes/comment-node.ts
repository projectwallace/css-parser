// CommentNode - CSS comment
import { CSSNode as CSSNodeBase } from '../css-node-base'
import { CSSNode } from '../css-node'

export class CommentNode extends CSSNodeBase {
	// No additional properties needed - comments are leaf nodes
	// All functionality inherited from base CSSNode

	protected override create_node_wrapper(index: number): CSSNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}
