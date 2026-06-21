import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: [
		'./src/index.ts',
		'./src/tokenize.ts',
		'./src/parse.ts',
		'./src/parse-selector.ts',
		'./src/parse-atrule-prelude.ts',
		'./src/parse-declaration.ts',
		'./src/parse-value.ts',
		'./src/parse-anplusb.ts',
		'./src/parse-dimension.ts',
		'./src/walk.ts',
		'./src/constants.ts',
	],
	platform: 'neutral',
	dts: true,
	publint: true,
})
