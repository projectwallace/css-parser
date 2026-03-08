import { defineConfig } from 'tsdown'
import { codecovRollupPlugin } from '@codecov/rollup-plugin'

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
	],
	platform: 'neutral',
	dts: true,
	publint: true,
	plugins: [
		codecovRollupPlugin({
			enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
			bundleName: '@projectwallace/css-parser',
			uploadToken: process.env.CODECOV_TOKEN,
		}),
	],
})

