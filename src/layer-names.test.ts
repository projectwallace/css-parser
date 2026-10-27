import { test, expect } from 'vitest'
import { parse, traverse, is_layer_name } from './index'

function layer_names(css: string): string[] {
	let names: string[] = []
	traverse(parse(css), {
		enter(node) {
			if (is_layer_name(node)) names.push(node.name)
		},
	})
	return names
}

test.each([
	['a . b', ['a', 'b']],
	['a..b', ['a', 'b']],
	['a.b', ['a.b']],
])('@import layer(%s) matches @layer %s', (name, expected) => {
	expect(layer_names(`@layer ${name};`)).toEqual(expected)
	expect(layer_names(`@import url(x) layer(${name});`)).toEqual(expected)
})
