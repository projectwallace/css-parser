// Named Selector Node Classes
// These selectors have specific names/identifiers
import { CSSNode as CSSNodeBase } from '../css-node-base'
import { CSSNode } from '../css-node'
import { NODE_SELECTOR_CLASS, NODE_SELECTOR_ID, NODE_SELECTOR_LANG } from '../arena'
import type { AnyNode } from '../types'

/**
 * SelectorClassNode - Class selector
 * Examples: .container, .btn-primary, .nav-item
 */
export class SelectorClassNode extends CSSNodeBase {
	override get type(): typeof NODE_SELECTOR_CLASS {
		return this.arena.get_type(this.index) as typeof NODE_SELECTOR_CLASS
	}

	// Leaf node

	// Get the class name (without the leading dot)
	get name(): string {
		const text = this.text
		return text.startsWith('.') ? text.slice(1) : text
	}

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * SelectorIdNode - ID selector
 * Examples: #header, #main-content, #footer
 */
export class SelectorIdNode extends CSSNodeBase {
	override get type(): typeof NODE_SELECTOR_ID {
		return this.arena.get_type(this.index) as typeof NODE_SELECTOR_ID
	}

	// Leaf node

	// Get the ID name (without the leading hash)
	get name(): string {
		const text = this.text
		return text.startsWith('#') ? text.slice(1) : text
	}

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}

/**
 * SelectorLangNode - Language identifier for :lang() pseudo-class
 * Examples: en, fr, de, zh-CN
 */
export class SelectorLangNode extends CSSNodeBase {
	override get type(): typeof NODE_SELECTOR_LANG {
		return this.arena.get_type(this.index) as typeof NODE_SELECTOR_LANG
	}

	// Leaf node - the language code
	// The language code is available via 'text'

	protected override create_node_wrapper(index: number): AnyNode {
		return CSSNode.from(this.arena, this.source, index)
	}
}
