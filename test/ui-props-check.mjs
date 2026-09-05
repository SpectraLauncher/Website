// node test/ui-props-check.mjs
//
// Kazdy props podany komponentowi @nuxt/ui musi byc przez ten komponent
// zadeklarowany. Vue nie protestuje na literowke — nadmiarowy atrybut spada na
// element i cicho nic nie robi, wiec `:text` zamiast `:label` albo `color` na
// ikonie wyglada w kodzie na dzialajace az do momentu, gdy ktos spojrzy.
import fs from 'node:fs'
import path from 'node:path'

const DIR = 'node_modules/@nuxt/ui/dist/runtime/components'

function propsOf(name) {
  const file = path.join(DIR, `${name}.vue`)
  if (!fs.existsSync(file)) return null

  const src = fs.readFileSync(file, 'utf8')
  const out = new Set()

  const block = /defineProps\(\{([\s\S]*?)\n\}\)/.exec(src)
  if (block) for (const m of block[1].matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*)\s*:/gm)) out.add(m[1])

  // v-model-y sa deklarowane przez defineModel, nie defineProps
  for (const m of src.matchAll(/defineModel\(\s*["']([A-Za-z][A-Za-z0-9]*)["']/g)) out.add(m[1])
  if (/defineModel\(\s*\{/.test(src)) out.add('modelValue')

  return out.size ? out : null
}

const kebab = s => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

// Atrybuty natywne komponenty przepuszczaja na element pod spodem.
const NATIVE = new Set([
  'class', 'style', 'id', 'key', 'ref', 'type', 'name', 'value', 'placeholder',
  'maxlength', 'minlength', 'rows', 'cols', 'autocomplete', 'readonly', 'required',
  'href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'title', 'role',
  'tabindex', 'form', 'min', 'max', 'step', 'pattern', 'multiple', 'accept',
  'inputmode', 'spellcheck', 'enterkeyhint', 'download',
])

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (entry.name.endsWith('.vue')) yield p.split(path.sep).join('/')
  }
}

const problems = []

for (const file of walk('app')) {
  const src = fs.readFileSync(file, 'utf8')

  for (const tag of src.matchAll(/<U([A-Z][A-Za-z]*)\b((?:[^>"']|"[^"]*"|'[^']*')*?)\/?>/g)) {
    const declared = propsOf(tag[1])
    if (!declared) continue

    const allowed = new Set([...declared, ...[...declared].map(kebab), ...NATIVE])

    // Najpierw wycinamy wartosci atrybutow, zeby wyrazenie w @click nie zostalo
    // odczytane jako nazwa atrybutu.
    const names = tag[2].replace(/"[^"]*"|'[^']*'/g, '""')

    for (const attr of names.matchAll(/(?:^|\s)([:@]?[a-zA-Z][a-zA-Z0-9.-]*)(?==|\s|$)/g)) {
      const raw = attr[1]
      if (raw.startsWith('@') || raw.startsWith('v-')) continue

      const bare = raw.replace(/^:/, '').split('.')[0]
      if (!bare || bare.startsWith('data-') || bare.startsWith('aria-')) continue
      if (allowed.has(bare)) continue

      problems.push(`${file} — <U${tag[1]}> nie ma propsa "${bare}"`)
    }
  }
}

if (problems.length) {
  console.error('Propsy, ktorych komponent nie deklaruje:\n'
    + [...new Set(problems)].map(p => '  ' + p).join('\n'))
  console.error('\nSprawdz nazwe w https://ui.nuxt.com/docs/components — atrybut, ktorego')
  console.error('komponent nie zna, spada na element i nic nie robi.')
  process.exit(1)
}

console.log('\u2713 kazdy props podany komponentowi @nuxt/ui jest przez niego zadeklarowany')
