import { describe, expect } from 'vitest'
import { parse } from './parse'
import { PositionTracker } from './parse-utils'

// 1-based line/column of a source offset, counting \n only (the inputs below use nothing else)
function position_of(source: string, offset: number): [number, number] {
	const before = source.slice(0, offset)
	return [before.split('\n').length, offset - before.lastIndexOf('\n')]
}

// Every node's line/column must be the position of its own start offset. Selector internals are
// skipped: the selector parser has its own (separate) column handling.
function find_wrong_positions(source: string): string[] {
	const wrong: string[] = []
	function visit(node: any) {
		if (node.type_name === 'SelectorList' || node.type_name === 'PreludeSelectorList') return
		const [line, column] = position_of(source, node.start)
		if (node.line !== line || node.column !== column) {
			wrong.push(
				`${node.type_name} ${JSON.stringify(node.text)}: got ${node.line}:${node.column}, want ${line}:${column}`,
			)
		}
		for (const child of node) visit(child)
	}
	visit(parse(source))
	return wrong
}

describe('node line/column', () => {
	const sources: Record<string, string> = {
		'block after a selector': 'a {\n  x: 1 }',
		'nested blocks': 'a {\n  b {\n   c: d }\n}',
		'at-rule block': '@font-face { src: url(x) }',
		'@media': '@media (hover) and (x) {}',
		'@media across lines': '@media\n  (hover)\n and (x) {}',
		'@media range': '@media (width >= 400px) and (height < 50px) {}',
		'@container': '@container name (min-width: 400px) and (x) {}',
		'@supports': '@supports (display: grid) and (not (x: y)) {}',
		'@supports across lines': '@supports\n  (display: grid)\n  and (x: y) {}',
		'@layer': '@layer a.b, c {}',
		'@keyframes': '@keyframes foo {}',
		'@import with supports() and media': '@import url(x) layer(a) supports(display:grid) screen;',
		'if() with style()': 'a { x: if(style(--a: 1): 1) }',
		'if() with supports()': 'a { x: if(supports(display: grid): 1) }',
		'if() with media()': 'a { x: if(media(hover): 1) }',
		'if() with range media()': 'a { x: if(media(width >= 10px): 1) }',
		'if() across lines': 'a {\n  x: if(\n    style(--a: 1): 1;\n    else: 2\n  ) }',
	}

	test.each(Object.entries(sources))('%s', (_name, source) => {
		expect(find_wrong_positions(source)).toEqual([])
	})

	test('Block starts right after its opening brace', () => {
		const ast = parse('a {\n  x: 1 }')
		const block = (ast.first_child as any).block
		expect([block.start, block.line, block.column]).toEqual([3, 1, 4])
	})

	test('@media prelude query nodes', () => {
		const ast = parse('@media\n  (hover)\n and (x) {}')
		const prelude = (ast.first_child as any).prelude
		const query = prelude.first_child
		const parts = [...query].map((n: any) => [n.text, n.line, n.column])
		expect([prelude.line, prelude.column]).toEqual([2, 3])
		expect([query.line, query.column]).toEqual([2, 3])
		expect(parts).toEqual([
			['(hover)', 2, 3],
			['and', 3, 2],
			['(x)', 3, 6],
		])
	})
})

describe('PositionTracker', () => {
	test('tracks lines and columns forward from an anchor', () => {
		const tracker = new PositionTracker('ab\ncd\nef')
		tracker.reset(0, 1, 1)
		expect([tracker.line_at(1), tracker.column]).toEqual([1, 2])
		expect([tracker.line_at(3), tracker.column]).toEqual([2, 1])
		expect([tracker.line_at(7), tracker.column]).toEqual([3, 2])
	})

	test('can move backwards, to the anchor at the earliest', () => {
		const tracker = new PositionTracker('ab\ncd\nef')
		tracker.reset(3, 2, 1)
		expect([tracker.line_at(7), tracker.column]).toEqual([3, 2])
		expect([tracker.line_at(4), tracker.column]).toEqual([2, 2])
	})

	test('honours the anchor line/column', () => {
		const tracker = new PositionTracker('xxxx ab\ncd')
		tracker.reset(5, 7, 20)
		expect([tracker.line_at(6), tracker.column]).toEqual([7, 21])
		expect([tracker.line_at(8), tracker.column]).toEqual([8, 1])
	})

	test('counts \\r\\n, \\r and \\f as one newline each', () => {
		const tracker = new PositionTracker('a\r\nb\rc\fd')
		tracker.reset(0, 1, 1)
		expect([tracker.line_at(3), tracker.column]).toEqual([2, 1]) // b
		expect([tracker.line_at(5), tracker.column]).toEqual([3, 1]) // c
		expect([tracker.line_at(7), tracker.column]).toEqual([4, 1]) // d
	})
})
