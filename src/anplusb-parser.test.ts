import { describe, it, expect } from 'vitest'
import { ANplusBParser } from './anplusb-parser'
import { CSSDataArena, NODE_SELECTOR_NTH } from './arena'
import { CSSNode, SelectorNthNode } from './css-node'

// Helper to parse An+B expression
function parse_anplusb(expr: string): SelectorNthNode | null {
	const arena = new CSSDataArena(64)
	const parser = new ANplusBParser(arena, expr)
	const nodeIndex = parser.parse_anplusb(0, expr.length)

	if (nodeIndex === null) return null
	return CSSNode.from(arena, expr, nodeIndex) as SelectorNthNode
}

describe('ANplusBParser', () => {
	describe('Simple integers (b only)', () => {
		it('should parse positive integer', () => {
			const node = parse_anplusb('3')!
			expect(node).not.toBeNull()
			expect(node.type).toBe(NODE_SELECTOR_NTH)
			expect(node.nth_a).toBe(null)
			expect(node.nth_b).toBe('3')
			expect(node.text).toBe('3')
		})

		it('should parse negative integer', () => {
			const node = parse_anplusb('-5')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe(null)
			expect(node.nth_b).toBe('-5')
		})

		it('should parse zero', () => {
			const node = parse_anplusb('0')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe(null)
			expect(node.nth_b).toBe('0')
		})
	})

	describe('Keywords', () => {
		it('should parse odd keyword', () => {
			const node = parse_anplusb('odd')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('odd')
			expect(node.nth_b).toBe(null)
		})

		it('should parse even keyword', () => {
			const node = parse_anplusb('even')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('even')
			expect(node.nth_b).toBe(null)
		})

		it('should parse ODD (case-insensitive)', () => {
			const node = parse_anplusb('ODD')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('ODD')
			expect(node.nth_b).toBe(null)
		})

		it('should parse EVEN (case-insensitive)', () => {
			const node = parse_anplusb('EVEN')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('EVEN')
			expect(node.nth_b).toBe(null)
		})
	})

	describe('Just n (a only)', () => {
		it('should parse n', () => {
			const node = parse_anplusb('n')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('n')
			expect(node.nth_b).toBe(null)
		})

		it('should parse +n', () => {
			const node = parse_anplusb('+n')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('+n')
			expect(node.nth_b).toBe(null)
		})

		it('should parse -n', () => {
			const node = parse_anplusb('-n')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('-n')
			expect(node.nth_b).toBe(null)
		})
	})

	describe('Dimension tokens (An)', () => {
		it('should parse 2n', () => {
			const node = parse_anplusb('2n')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('2n')
			expect(node.nth_b).toBe(null)
		})

		it('should parse -3n', () => {
			const node = parse_anplusb('-3n')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('-3n')
			expect(node.nth_b).toBe(null)
		})

		it('should parse +5n', () => {
			const node = parse_anplusb('+5n')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('+5n')
			expect(node.nth_b).toBe(null)
		})

		it('should parse 10n', () => {
			const node = parse_anplusb('10n')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('10n')
			expect(node.nth_b).toBe(null)
		})
	})

	describe('An+B expressions', () => {
		it('should parse 2n+1', () => {
			const node = parse_anplusb('2n+1')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('2n')
			expect(node.nth_b).toBe('1')
		})

		it('should parse 3n+5', () => {
			const node = parse_anplusb('3n+5')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('3n')
			expect(node.nth_b).toBe('5')
		})

		it('should parse n+0', () => {
			const node = parse_anplusb('n+0')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('n')
			expect(node.nth_b).toBe('0')
		})

		it('should parse -n+3', () => {
			const node = parse_anplusb('-n+3')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('-n')
			expect(node.nth_b).toBe('3')
		})
	})

	describe('An-B expressions', () => {
		it('should parse 2n-1', () => {
			const node = parse_anplusb('2n-1')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('2n')
			expect(node.nth_b).toBe('-1')
		})

		it('should parse 3n-5', () => {
			const node = parse_anplusb('3n-5')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('3n')
			expect(node.nth_b).toBe('-5')
		})

		it('should parse n-2', () => {
			const node = parse_anplusb('n-2')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('n')
			expect(node.nth_b).toBe('-2')
		})

		it('should parse -n-1', () => {
			const node = parse_anplusb('-n-1')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('-n')
			expect(node.nth_b).toBe('-1')
		})

		it('should parse -2n-3', () => {
			const node = parse_anplusb('-2n-3')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('-2n')
			expect(node.nth_b).toBe('-3')
		})
	})

	describe('Whitespace handling', () => {
		it('should parse 2n + 1 with spaces', () => {
			const node = parse_anplusb('2n + 1')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('2n')
			expect(node.nth_b).toBe('1')
		})

		it('should parse 2n - 1 with spaces', () => {
			const node = parse_anplusb('2n - 1')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('2n')
			expect(node.nth_b).toBe('-1')
		})

		it('should parse n + 5 with spaces', () => {
			const node = parse_anplusb('n + 5')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('n')
			expect(node.nth_b).toBe('5')
		})

		it('should handle leading whitespace', () => {
			const node = parse_anplusb('  2n+1')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('2n')
			expect(node.nth_b).toBe('1')
		})

		it('should handle trailing whitespace', () => {
			const node = parse_anplusb('2n+1  ')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('2n')
			expect(node.nth_b).toBe('1')
		})
	})

	describe('Edge cases', () => {
		it('should parse +0n+0', () => {
			const node = parse_anplusb('+0n+0')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('+0n')
			expect(node.nth_b).toBe('0')
		})

		it('should parse large coefficients', () => {
			const node = parse_anplusb('100n+50')!
			expect(node).not.toBeNull()
			expect(node.nth_a).toBe('100n')
			expect(node.nth_b).toBe('50')
		})
	})
})
