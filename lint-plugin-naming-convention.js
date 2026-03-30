/**
 * Oxlint JS plugin that enforces snake_case for variable and function names.
 * Allows:
 *   - lower_snake_case  (variables, functions, parameters)
 *   - UPPER_SNAKE_CASE  (constants)
 *   - _prefixed_snake   (private/unused convention)
 *   - PascalCase        (classes, imported bindings from external modules)
 * Flags:
 *   - camelCase names on variable declarations, function declarations, and parameters
 */

// Matches lower_snake_case, _prefixed, UPPER_SNAKE_CASE, or single chars.
// Anything with a lowercase letter immediately followed by an uppercase letter is camelCase.
const VALID = /^(_?[a-z][a-z0-9_]*|[A-Z][A-Z0-9_]*)$/

function is_valid(name) {
	return VALID.test(name)
}

const no_camel_case = {
	create(context) {
		return {
			VariableDeclarator(node) {
				if (node.id.type !== 'Identifier') return
				const name = node.id.name
				if (!is_valid(name)) {
					context.report({
						node: node.id,
						message: `'${name}' should be snake_case`,
					})
				}
			},
			FunctionDeclaration(node) {
				if (!node.id) return
				const name = node.id.name
				if (!is_valid(name)) {
					context.report({
						node: node.id,
						message: `'${name}' should be snake_case`,
					})
				}

				for (const param of node.params) {
					if (param.type !== 'Identifier') continue
					const param_name = param.name
					if (!is_valid(param_name)) {
						context.report({
							node: param,
							message: `'${param_name}' should be snake_case`,
						})
					}
				}
			},
			ArrowFunctionExpression(node) {
				for (const param of node.params) {
					if (param.type !== 'Identifier') continue
					const param_name = param.name
					if (!is_valid(param_name)) {
						context.report({
							node: param,
							message: `'${param_name}' should be snake_case`,
						})
					}
				}
			},
		}
	},
}

export default {
	meta: { name: 'naming-convention' },
	rules: {
		'no-camel-case': no_camel_case,
	},
}
