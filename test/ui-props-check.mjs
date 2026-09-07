// node test/ui-props-check.mjs
//
// Every prop given to a @nuxt/ui component must be one that component declares.
// Vue does not complain about a typo: the extra attribute lands on the element
// and quietly does nothing, so `:text` instead of `:label`, or `color` on an
// icon, reads as working until somebody looks.
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

  // v-models are declared with defineModel, not defineProps
  for (const m of src.matchAll(/defineModel\(\s*["']([A-Za-z][A-Za-z0-9]*)["']/g)) out.add(m[1])
  if (/defineModel\(\s*\{/.test(src)) out.add('modelValue')

  return out.size ? out : null
}

const kebab = s => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

// Native attributes are forwarded to the element underneath.
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

    // Attribute values are stripped first, so an expression inside @click is not
    // read as an attribute name.
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


// reka-ui reserves the empty string for "no selection": a select item that uses
// it as its value throws the moment the list opens, and the page dies with the
// dropdown half-built. Nothing catches it earlier, because the item is only
// constructed when somebody opens the menu.
//
// An item is recognised by carrying both a value and a label, which is what
// tells it apart from the key/value rows some tools let people edit.
const PICKERS = ['<USelect', '<USelectMenu', '<UInputMenu', '<URadioGroup']

const emptyItems = []

for (const file of walk('app')) {
  const src = fs.readFileSync(file, 'utf8')
  if (!PICKERS.some(tag => src.includes(tag))) continue

  for (const [literal] of src.matchAll(/\{[^{}]*\}/g)) {
    if (!/\bvalue:\s*(''|"")/.test(literal)) continue
    if (!/\blabel\s*:/.test(literal)) continue

    emptyItems.push(`${file} — ${literal.trim()}`)
  }
}

if (problems.length) {
  console.error('Propsy, ktorych komponent nie deklaruje:\n'
    + [...new Set(problems)].map(p => '  ' + p).join('\n'))
  console.error('\nSprawdz nazwe w https://ui.nuxt.com/docs/components — atrybut, ktorego')
  console.error('komponent nie zna, spada na element i nic nie robi.')
}

if (emptyItems.length) {
  console.error('\nPozycje listy z pustym value:\n'
    + [...new Set(emptyItems)].map(p => '  ' + p).join('\n'))
  console.error('\nreka-ui trzyma pusty string na "nic nie wybrano" i rzuca wyjatkiem przy')
  console.error('otwarciu listy. Uzyj wlasnej wartosci i przetlumacz ja na brzegu.')
}

if (problems.length || emptyItems.length) process.exit(1)

console.log('✓ kazdy props podany komponentowi @nuxt/ui jest przez niego zadeklarowany')
