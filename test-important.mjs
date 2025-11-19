import { Parser, NODE_DECLARATION } from './src/parser.js'

const source = '.override { color: red !important; margin: 0 !important; padding: 0 !ie; }'
const parser = new Parser(source)
const root = parser.parse()

const rule = root.first_child
console.log('Rule:', rule.type, rule.text)
console.log('Rule children:', rule.children.length)
for (let child of rule) {
  console.log('  -', child.type, child.text)
}

const block = rule.block
console.log('\nBlock:', block ? block.type : 'null', block ? block.text : '')
console.log('Block children:', block ? block.children.length : 0)
if (block) {
  for (let child of block) {
    console.log('  -', child.type, child.text, child.name)
  }
}
