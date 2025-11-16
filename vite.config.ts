import { defineConfig } from 'vite'

export default defineConfig({
	build: {
		lib: {
			entry: {
				index: './src/index.ts',
				lexer: './src/lexer.ts',
				parser: './src/parser.ts',
				parse: './src/parse.ts',
				'parse-selector': './src/parse-selector.ts',
				'parse-atrule-prelude': './src/parse-atrule-prelude.ts',
				'value-parser': './src/value-parser.ts',
				'selector-parser': './src/selector-parser.ts',
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
