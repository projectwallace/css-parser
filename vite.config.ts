import { defineConfig } from 'vite'

export default defineConfig({
	build: {
		lib: {
			entry: {
				index: './src/index.ts',
				tokenize: './src/tokenize.ts',
				parse: './src/parse.ts',
				'parse-selector': './src/parse-selector.ts',
				'parse-atrule-prelude': './src/parse-atrule-prelude.ts',
				'parse-anplusb': './src/parse-anplusb.ts',
			},
			formats: ['es'],
		},
		target: 'esnext',
		minify: false,
		rollupOptions: {
			output: {
				preserveModules: false,
				entryFileNames: '[name].js',
			},
		},
	},
})
