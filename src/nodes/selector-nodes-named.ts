// Named Selector Node Classes
// These selectors have specific names/identifiers
import { CSSNode } from '../css-node-base'

/**
 * SelectorClassNode - Class selector
 * Examples: .container, .btn-primary, .nav-item
 */
export class SelectorClassNode extends CSSNode {
	// Leaf node

	// Get the class name (without the leading dot)
	get name(): string {
		const text = this.text
		return text.startsWith('.') ? text.slice(1) : text
	}
}

/**
 * SelectorIdNode - ID selector
 * Examples: #header, #main-content, #footer
 */
export class SelectorIdNode extends CSSNode {
	// Leaf node

	// Get the ID name (without the leading hash)
	get name(): string {
		const text = this.text
		return text.startsWith('#') ? text.slice(1) : text
	}
}

/**
 * SelectorLangNode - Language identifier for :lang() pseudo-class
 * Examples: en, fr, de, zh-CN
 */
export class SelectorLangNode extends CSSNode {
	// Leaf node - the language code
	// The language code is available via 'text'
}
