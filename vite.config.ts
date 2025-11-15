import { defineConfig } from 'vite'

export default defineConfig({
	build: {
		lib: {
			entry: {
				index: './src/index.ts',
				lexer: './src/lexer.ts',
				parser: './src/parser.ts',
				'value-parser': './src/value-parser.ts',
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
