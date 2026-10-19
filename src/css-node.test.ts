import { describe, test, expect } from 'vitest'
import { parse } from './parse'
import { TYPE_NAMES } from './css-node'

describe('CSSNode type_name', () => {
	test('matches TYPE_NAMES for every known type', () => {
		const node = parse('a { color: red }')
		const proto = Object.getPrototypeOf(node)
		const getter = Object.getOwnPropertyDescriptor(proto, 'type_name')!.get!
		for (const [type, name] of Object.entries(TYPE_NAMES)) {
			expect(getter.call({ type: Number(type) })).toBe(name)
		}
	})

	test('returns unknown for an unknown type', () => {
		const node = parse('a { color: red }')
		const getter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), 'type_name')!.get!
		expect(getter.call({ type: 9999 })).toBe('unknown')
	})
})
